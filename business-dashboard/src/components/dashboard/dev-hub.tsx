import { formatDistanceToNow, parseISO } from "date-fns";
import {
  listAllRepos,
  getCountsForRepoUrl,
  vscodeLink,
  deployUrl,
  type RepoCounts,
} from "@/lib/github";
import {
  getProjects,
  MissingAirtableEnvError,
  type Project,
} from "@/lib/airtable";
import { createTaskAction } from "@/app/actions";

// Root the "Open in VSCode" deep links resolve against. Repos are cloned flat
// under this directory locally (`<root>/<repo-name>`). Override per-machine with
// LOCAL_PROJECTS_ROOT; defaults to the owner's home where the checkouts live.
const LOCAL_PROJECTS_ROOT = process.env.LOCAL_PROJECTS_ROOT ?? "C:/Users/taylo";

const HOST_STYLES: Record<string, string> = {
  Railway: "bg-[#c44dff]/10 text-[#c44dff] border-[#c44dff]/20",
  Vercel: "bg-zinc-800 text-zinc-300 border-zinc-700",
  Netlify: "bg-[#3affd1]/10 text-[#3affd1] border-[#3affd1]/20",
};

// Inline server action: queue a Kind=code Task linked to a project. Lives in the
// server component so the card needs no client boundary — the <form> submits
// straight to the action and createTaskAction revalidates /dashboard.
async function queueCodingTask(formData: FormData) {
  "use server";
  const projectId = String(formData.get("projectId") ?? "");
  const projectName = String(formData.get("projectName") ?? "");
  if (!projectId) return;
  await createTaskAction({
    Title: projectName ? `Coding task — ${projectName}` : "Coding task",
    Kind: "code",
    Status: "Pending",
    "Assigned To": "Any",
    "Created By": "Dev Hub",
    Project: [projectId],
  });
}

function lastCommitLabel(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

function CountPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </span>
      <span className="text-zinc-500">{label}</span>
    </span>
  );
}

function GitHubLink({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs px-2.5 py-1 rounded-lg border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
    >
      {label ?? "GitHub ↗"}
    </a>
  );
}

function VSCodeLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="text-xs px-2.5 py-1 rounded-lg border border-[#3affd1]/20 bg-[#3affd1]/10 text-[#3affd1] hover:bg-[#3affd1]/20 transition-colors"
      title="Open this repo's local checkout in VSCode"
    >
      Open in VSCode
    </a>
  );
}

// ─── Repo directory ─────────────────────────────────────────────────────────

async function RepoDirectory() {
  const repos = await listAllRepos();

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Repo directory</p>
        <span className="text-[10px] text-zinc-600">
          {repos.length} repos · MindeloAi + trinirugby
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-[#2a2e34]">
              <th className="text-left pb-3 font-medium">Repo</th>
              <th className="text-right pb-3 font-medium">Issues</th>
              <th className="text-right pb-3 font-medium">PRs</th>
              <th className="text-left pb-3 font-medium pl-6">Last commit</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2e34]">
            {repos.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-600 text-sm">
                  No repos found. Set <code className="text-zinc-400">GITHUB_TOKEN</code> to list
                  repositories.
                </td>
              </tr>
            ) : (
              repos.map((repo) => (
                <tr key={repo.fullName} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3">
                    <span className="font-medium text-white">{repo.name}</span>
                    <span className="text-zinc-600 text-xs ml-2">{repo.owner}</span>
                  </td>
                  <td className="py-3 text-right tabular-nums text-zinc-300">
                    {repo.openIssueCount}
                  </td>
                  <td className="py-3 text-right tabular-nums text-zinc-300">{repo.openPRCount}</td>
                  <td className="py-3 pl-6 text-zinc-400 text-xs whitespace-nowrap">
                    {lastCommitLabel(repo.lastCommit)}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-2">
                      <GitHubLink url={repo.url} />
                      <VSCodeLink href={vscodeLink(`${LOCAL_PROJECTS_ROOT}/${repo.name}`)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Project ↔ repo cards ──────────────────────────────────────────────────

function ProjectRepoCard({
  project,
  counts,
}: {
  project: Project;
  counts: RepoCounts | null;
}) {
  const repoUrl = project["GitHub Repo URL"];
  const live = deployUrl({
    deployUrl: project["Deploy URL"] ?? null,
    repoUrl: repoUrl ?? null,
  });
  const host = project.Host;

  return (
    <div className="bg-[#0b0d10] border border-[#2a2e34] rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-tight">{project.Name}</p>
        {host && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${
              HOST_STYLES[host] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"
            }`}
          >
            {host}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {counts ? (
          <>
            <CountPill label="issues" value={counts.openIssueCount} accent="#fbbf24" />
            <CountPill label="PRs" value={counts.openPRCount} accent="#3affd1" />
          </>
        ) : (
          <span className="text-xs text-zinc-600">Counts unavailable</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-auto">
        {repoUrl && <GitHubLink url={repoUrl} label="Repo ↗" />}
        {live && (
          <a
            href={live}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1 rounded-lg border border-[#bfff3a]/20 bg-[#bfff3a]/10 text-[#bfff3a] hover:bg-[#bfff3a]/20 transition-colors"
          >
            Deploy ↗
          </a>
        )}
        <form action={queueCodingTask} className="ml-auto">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="projectName" value={project.Name} />
          <button
            type="submit"
            className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-[#c44dff] text-white hover:bg-[#c44dff]/80 transition-colors"
          >
            Queue coding task
          </button>
        </form>
      </div>
    </div>
  );
}

async function ProjectRepoCards() {
  let projects: Project[] = [];
  let error: string | null = null;
  try {
    projects = await getProjects();
  } catch (err) {
    error =
      err instanceof MissingAirtableEnvError
        ? err.message
        : "Failed to load projects. Check the server logs.";
  }

  const linked = projects.filter((p) => p["GitHub Repo URL"]);

  // Live counts per linked repo, fetched in parallel. getCountsForRepoUrl
  // returns null when the URL can't be parsed or no token is configured.
  const counts = await Promise.all(
    linked.map((p) => getCountsForRepoUrl(p["GitHub Repo URL"]!)),
  );
  const countsById = new Map<string, RepoCounts | null>();
  linked.forEach((p, i) => countsById.set(p.id, counts[i]));

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Projects ↔ repos</p>
        <span className="text-[10px] text-zinc-600">{linked.length} linked</span>
      </div>

      {error ? (
        <p className="py-8 text-center text-[#ff4d8b] text-sm">{error}</p>
      ) : linked.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 text-sm">
          No projects have a GitHub Repo URL yet. Add one on a project to link it here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {linked.map((p) => (
            <ProjectRepoCard key={p.id} project={p} counts={countsById.get(p.id) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dev hub ──────────────────────────────────────────────────────────────

// Server Component: fetches its own GitHub + Airtable data so it can drop into
// the dashboard without changes to page.tsx. Renders the repo directory (every
// repo across both orgs, one click away) and per-project repo cards with live
// counts and a "Queue coding task" button.
export async function DevHub() {
  return (
    <div className="flex flex-col gap-6">
      <RepoDirectory />
      <ProjectRepoCards />
    </div>
  );
}
