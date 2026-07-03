"use client";

import { useMemo, useState } from "react";
import type { VaultProject } from "@/lib/vault";

// Visual index of the Obsidian vault's project notes. Pure client-side filtering
// over ~40 items — cheap enough that every keystroke re-filters. Styled to match
// the dashboard's hand-rolled dark cards (see project-board.tsx), not shadcn Card,
// so it drops in seamlessly.

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  active: { dot: "bg-[#bfff3a]", text: "text-[#bfff3a]" },
  paused: { dot: "bg-[#fbbf24]", text: "text-[#fbbf24]" },
  reference: { dot: "bg-zinc-500", text: "text-zinc-400" },
};

function statusStyle(status: string) {
  return STATUS_STYLES[status.toLowerCase()] ?? { dot: "bg-zinc-600", text: "text-zinc-400" };
}

/** MindeloAi/foo-bar -> foo-bar (nicer button label). */
function repoLabel(github: string): string {
  const slash = github.indexOf("/");
  return slash === -1 ? github : github.slice(slash + 1);
}

function ExternalIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.34.85 0 1.7.12 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
    </svg>
  );
}

const btnCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#2a2e34] bg-[#0b0d10] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white";

function ProjectCard({ project }: { project: VaultProject }) {
  const s = statusStyle(project.status);
  const deployUrl = project.deploy_url;
  const githubUrl = project.github ? `https://github.com/${project.github}` : "";

  return (
    <div className="flex flex-col rounded-2xl border border-[#2a2e34] bg-[#0b0d10] p-4 transition-colors hover:border-zinc-600">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex-1 text-sm font-medium leading-tight text-white">{project.name}</p>
        {project.status && (
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className={`text-[10px] font-medium capitalize ${s.text}`}>
              {project.status}
            </span>
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {project.category && (
          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            {project.category}
          </span>
        )}
        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-500">
          {project.folder}
        </span>
      </div>

      {project.client && (
        <p className="mb-2 truncate text-[11px] text-zinc-500" title={project.client}>
          {project.client}
        </p>
      )}

      {project.stack.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {project.stack.slice(0, 6).map((tech) => (
            <span
              key={tech}
              className="rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-400"
            >
              {tech}
            </span>
          ))}
          {project.stack.length > 6 && (
            <span className="px-1 py-0.5 text-[10px] text-zinc-600">
              +{project.stack.length - 6}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {deployUrl && (
          <a href={deployUrl} target="_blank" rel="noopener noreferrer" className={btnCls}>
            <ExternalIcon />
            Live
          </a>
        )}
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={btnCls}
            title={project.github}
          >
            <GithubIcon />
            {repoLabel(project.github)}
          </a>
        )}
        {project.last_touched && (
          <span className="ml-auto text-[10px] text-zinc-600">{project.last_touched}</span>
        )}
      </div>
    </div>
  );
}

type Props = { projects: VaultProject[] };

const ALL = "All";

export function VaultProjects({ projects }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [folder, setFolder] = useState<string>(ALL);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.status) set.add(p.status);
    return [ALL, ...Array.from(set).sort()];
  }, [projects]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.folder) set.add(p.folder);
    return [ALL, ...Array.from(set).sort()];
  }, [projects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== ALL && p.status !== status) return false;
      if (folder !== ALL && p.folder !== folder) return false;
      if (!q) return true;
      const hay = `${p.name} ${p.client} ${p.stack.join(" ")} ${p.category}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query, status, folder]);

  return (
    <div className="rounded-[20px] border border-[#2a2e34] bg-[#14181d] p-6">
      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, client, stack…"
          className="w-full rounded-xl border border-[#2a2e34] bg-[#0b0d10] px-3 py-2 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-zinc-500 focus:outline-none lg:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips label="Folder" value={folder} options={folders} onChange={setFolder} />
          <FilterChips label="Status" value={status} options={statuses} onChange={setStatus} />
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-600">No projects match those filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard key={`${p.folder}/${p.name}`} project={p} />
          ))}
        </div>
      )}

      <p className="mt-4 text-right text-[10px] text-zinc-600">
        {visible.length} of {projects.length} projects
      </p>
    </div>
  );
}

function FilterChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</span>
      <div className="flex gap-1 rounded-xl bg-[#0b0d10] p-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
              value === opt ? "bg-[#fbbf24] text-black" : "text-zinc-400 hover:text-white"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
