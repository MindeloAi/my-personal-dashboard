import { Octokit } from "octokit";

// ─── Lazy, read-only client ─────────────────────────────────────────────────
//
// Built from `process.env.GITHUB_TOKEN`. To list PRIVATE repos the token must
// be a classic PAT with the `repo` scope (+ `read:org`), or a fine-grained PAT
// granted those repos and approved by any org (e.g. MindeloAi). Constructed
// only when a call actually runs, so `import "@/lib/github"` is side-effect
// free and the build never needs the token. If the token is missing we log
// once and return empty results rather than throwing.

// Accounts whose repos populate the dev hub. We list every repo the token can
// see (own private + org-member) via the authenticated-user endpoint, then keep
// only those owned by an allowlisted account. Defaults below; override with the
// `GITHUB_ACCOUNTS` env var (comma-separated) without touching code.
const DEFAULT_ACCOUNTS = ["MindeloAi", "trinirugby"] as const;

function accountAllowlist(): string[] {
  const raw = process.env.GITHUB_ACCOUNTS;
  if (raw && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [...DEFAULT_ACCOUNTS];
}

let _octokit: Octokit | null = null;
let _warned = false;

function getClient(): Octokit | null {
  if (_octokit) return _octokit;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    if (!_warned) {
      console.warn(
        "[github] GITHUB_TOKEN is unset — returning empty results. " +
          "Set it in .env.local (dev) or Railway service variables (deploy).",
      );
      _warned = true;
    }
    return null;
  }
  // Disable the throttling/retry plugins' automatic backoff so a transient
  // rate limit fails fast instead of blocking the server render for tens of
  // seconds; fetchCounts catches the error and degrades to zero counts.
  _octokit = new Octokit({
    auth: token,
    throttle: { enabled: false },
    retry: { enabled: false },
  });
  return _octokit;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RepoSummary {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  openIssueCount: number;
  openPRCount: number;
  lastCommit: string | null;
}

export interface RepoCounts {
  openIssueCount: number;
  openPRCount: number;
}

// ─── Count helpers ────────────────────────────────────────────────────────────
//
// GitHub's `open_issues_count` on a repo conflates issues and PRs. We get the
// open-PR count cheaply from the core `pulls.list` endpoint (5000 req/min) and
// subtract it, rather than the Search API (only 30 req/min — it exhausts
// instantly across many repos and degrades every count to zero).

// `open_issues_count` includes PRs; subtract them to get true issues. Clamped
// at zero in case the two reads race. Pure for unit testing.
export function deriveIssueCount(totalOpenIssuesAndPrs: number, openPRs: number): number {
  return Math.max(totalOpenIssuesAndPrs - openPRs, 0);
}

// With `per_page=1`, the `rel="last"` page number in a Link header equals the
// total item count. Returns null when there is no Link header (0 or 1 items).
// Pure for unit testing.
export function parseLastPage(linkHeader: string | undefined): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
}

async function fetchCounts(
  client: Octokit,
  owner: string,
  repo: string,
  totalOpenIssuesAndPrs: number,
): Promise<RepoCounts> {
  try {
    const res = await client.rest.pulls.list({
      owner,
      repo,
      state: "open",
      per_page: 1,
    });
    const openPRCount = parseLastPage(res.headers.link) ?? res.data.length;
    return {
      openPRCount,
      openIssueCount: deriveIssueCount(totalOpenIssuesAndPrs, openPRCount),
    };
  } catch (err) {
    // Transient API error — degrade to zero rather than hanging the render.
    console.warn(`[github] count fetch failed for ${owner}/${repo}:`, err);
    return { openIssueCount: 0, openPRCount: 0 };
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

// List every repo the token can see (own private + org-member, public and
// private) via the authenticated-user endpoint — one paginated sweep that works
// regardless of whether an account is a user or an org — then keep only those
// owned by an allowlisted account. Each carries open-issue / open-PR counts and
// the last-push timestamp. Returns [] when no token is configured.
export async function listAllRepos(): Promise<RepoSummary[]> {
  const client = getClient();
  if (!client) return [];

  const allowSet = new Set(accountAllowlist().map((a) => a.toLowerCase()));

  let repos;
  try {
    repos = await client.paginate(client.rest.repos.listForAuthenticatedUser, {
      visibility: "all",
      affiliation: "owner,organization_member",
      per_page: 100,
    });
  } catch (err) {
    // A failure here must not take down the dashboard — render empty instead.
    console.warn("[github] failed to list repos for the authenticated user:", err);
    return [];
  }

  const filtered = repos.filter((repo) =>
    allowSet.has(repo.owner.login.toLowerCase()),
  );

  return Promise.all(
    filtered.map(async (repo): Promise<RepoSummary> => {
      const counts = await fetchCounts(
        client,
        repo.owner.login,
        repo.name,
        repo.open_issues_count,
      );
      return {
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        defaultBranch: repo.default_branch ?? "main",
        openIssueCount: counts.openIssueCount,
        openPRCount: counts.openPRCount,
        lastCommit: repo.pushed_at ?? null,
      };
    }),
  );
}

// Parse `owner` and `repo` out of a GitHub repo URL (or `owner/repo` shorthand).
export function parseRepoUrl(
  repoUrl: string,
): { owner: string; repo: string } | null {
  const trimmed = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = trimmed.match(
    /(?:github\.com[/:])?([^/\s]+)\/([^/\s]+)$/,
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// Map a repo URL → its open-issue / open-PR counts. Returns null when the URL
// can't be parsed or no token is configured.
export async function getCountsForRepoUrl(
  repoUrl: string,
): Promise<RepoCounts | null> {
  const client = getClient();
  if (!client) return null;
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    console.warn(`[github] could not parse repo URL: ${repoUrl}`);
    return null;
  }
  try {
    const { data } = await client.rest.repos.get({
      owner: parsed.owner,
      repo: parsed.repo,
    });
    return fetchCounts(client, parsed.owner, parsed.repo, data.open_issues_count);
  } catch (err) {
    console.warn(`[github] failed to fetch ${parsed.owner}/${parsed.repo}:`, err);
    return { openIssueCount: 0, openPRCount: 0 };
  }
}

// ─── Link helpers ─────────────────────────────────────────────────────────────

// Build an "open in VSCode" deep link for a local checkout path.
export function vscodeLink(localPath: string): string {
  const normalized = localPath.replace(/\\/g, "/");
  const withSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `vscode://file${withSlash}`;
}

// Resolve the deploy/live URL for a project, falling back to the repo's GitHub
// page when no explicit deploy URL is recorded.
export function deployUrl(
  project: { deployUrl?: string | null; repoUrl?: string | null },
): string | null {
  if (project.deployUrl && project.deployUrl.trim()) {
    return project.deployUrl.trim();
  }
  if (project.repoUrl && project.repoUrl.trim()) {
    return project.repoUrl.trim();
  }
  return null;
}
