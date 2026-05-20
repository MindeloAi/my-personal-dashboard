import { Octokit } from "octokit";

// ─── Lazy, read-only client ─────────────────────────────────────────────────
//
// Built from `process.env.GITHUB_TOKEN` (a PAT with `repo` + `read:org`).
// Constructed only when a call actually runs, so `import "@/lib/github"` is
// side-effect free and the build never needs the token. If the token is
// missing we log once and return empty results rather than throwing — the
// dashboard should render without a configured PAT.

// Accounts whose repos populate the dev hub. These may be GitHub orgs OR
// personal users, which use different REST endpoints — we resolve each
// account's type at call time rather than assuming.
const ACCOUNTS = ["MindeloAi", "trinirugby"] as const;

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
  // Disable the throttling/retry plugins' automatic backoff. The dev hub fires
  // many search calls per dashboard load; if we let octokit wait out a rate
  // limit the whole server render blocks for tens of seconds. Failing fast lets
  // fetchCounts catch the error and degrade to "counts unavailable" instead.
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
// `open_issues_count` on a repo conflates issues and PRs, so we query the
// search API for each separately to get accurate, distinct counts.

async function fetchCounts(
  client: Octokit,
  fullName: string,
): Promise<RepoCounts> {
  try {
    const [issues, prs] = await Promise.all([
      client.rest.search.issuesAndPullRequests({
        q: `repo:${fullName} is:issue is:open`,
        per_page: 1,
      }),
      client.rest.search.issuesAndPullRequests({
        q: `repo:${fullName} is:pr is:open`,
        per_page: 1,
      }),
    ]);
    return {
      openIssueCount: issues.data.total_count,
      openPRCount: prs.data.total_count,
    };
  } catch (err) {
    // Rate limit or transient API error — degrade to zero rather than hanging
    // the dashboard render. The search API limit is low and the dev hub fans
    // out one of these per repo.
    console.warn(`[github] count fetch failed for ${fullName}:`, err);
    return { openIssueCount: 0, openPRCount: 0 };
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

// List every repo across both orgs, each with open-issue / open-PR counts and
// the last-push timestamp. Returns [] when no token is configured.
export async function listAllRepos(): Promise<RepoSummary[]> {
  const client = getClient();
  if (!client) return [];

  const summaries: RepoSummary[] = [];

  for (const account of ACCOUNTS) {
    // An account can be an org or a user, which use different list endpoints
    // (and the wrong one 404s). Resolve the type, then page accordingly. A
    // failure for one account must not take down the whole dashboard, so we
    // log and skip rather than letting the error propagate.
    let repos;
    try {
      const { data } = await client.rest.users.getByUsername({
        username: account,
      });
      repos =
        data.type === "Organization"
          ? await client.paginate(client.rest.repos.listForOrg, {
              org: account,
              type: "all",
              per_page: 100,
            })
          : await client.paginate(client.rest.repos.listForUser, {
              username: account,
              type: "owner",
              per_page: 100,
            });
    } catch (err) {
      console.warn(`[github] failed to list repos for ${account}:`, err);
      continue;
    }

    const accountSummaries = await Promise.all(
      repos.map(async (repo): Promise<RepoSummary> => {
        const counts = await fetchCounts(client, repo.full_name);
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

    summaries.push(...accountSummaries);
  }

  return summaries;
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
  return fetchCounts(client, `${parsed.owner}/${parsed.repo}`);
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
