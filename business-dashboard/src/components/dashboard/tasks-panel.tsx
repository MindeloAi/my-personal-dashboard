"use client";

import { useState, useTransition, useEffect, useOptimistic } from "react";
import { toast } from "sonner";
import { createTaskAction, updateTaskAction } from "@/app/actions";
import type { Task, Project } from "@/lib/airtable";

// Every status a task can hold, in flow order. Mirrors the Airtable enum in
// `@/lib/airtable` (TaskSchema.Status) and drives the per-card status select.
const TASK_STATUSES: NonNullable<Task["Status"]>[] = [
  "Pending",
  "In Progress",
  "Blocked",
  "Done",
];

// Kind / Assigned-To option lists mirror the Airtable enums in `@/lib/airtable`.
const KIND_OPTIONS: NonNullable<Task["Kind"]>[] = [
  "code",
  "lead-gen",
  "client-comms",
  "research",
  "content",
  "ops",
  "other",
];

const KIND_LABELS: Record<string, string> = {
  code: "Code",
  "lead-gen": "Lead-gen",
  "client-comms": "Client comms",
  research: "Research",
  content: "Content",
  ops: "Ops",
  other: "Other",
};

const ASSIGNEES: NonNullable<Task["Assigned To"]>[] = ["You", "Partner", "Any"];

// The three board columns, in flow order. "Blocked" tasks ride along under
// In Progress so nothing is silently hidden from the board.
const COLUMNS: { key: NonNullable<Task["Status"]>; label: string; extra?: Task["Status"][] }[] = [
  { key: "Pending", label: "Pending" },
  { key: "In Progress", label: "In Progress", extra: ["Blocked"] },
  { key: "Done", label: "Done" },
];

const COLUMN_ACCENT: Record<string, string> = {
  Pending: "text-[#3affd1]",
  "In Progress": "text-[#bfff3a]",
  Done: "text-zinc-500",
};

const KIND_BADGE = "text-[10px] px-2 py-0.5 rounded-full border bg-[#0b0d10] text-zinc-400 border-[#2a2e34]";

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

type AssignedFilter = "Any" | "You" | "Partner";

function TaskCard({
  task,
  projectName,
  pending,
  onStatusChange,
}: {
  task: Task;
  projectName?: string;
  pending: boolean;
  onStatusChange: (next: NonNullable<Task["Status"]>) => void;
}) {
  const current = task.Status ?? "Pending";
  return (
    <div className="bg-[#0b0d10] border border-[#2a2e34] rounded-xl p-3 flex flex-col gap-2 hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white font-medium leading-snug">{task.Title}</p>
        {task.Priority && (
          <span className="text-[10px] text-zinc-500 shrink-0 mt-0.5">{task.Priority}</span>
        )}
      </div>
      {task.Description && (
        <p className="text-xs text-zinc-500 line-clamp-2">{task.Description}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {task.Kind && <span className={KIND_BADGE}>{KIND_LABELS[task.Kind] ?? task.Kind}</span>}
        {projectName && (
          <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">↳ {projectName}</span>
        )}
        {task["Assigned To"] && (
          <span className="text-[10px] text-zinc-600 ml-auto">{task["Assigned To"]}</span>
        )}
      </div>
      {task["Picked Up By"] && task.Status === "In Progress" && (
        <span className="text-[10px] text-zinc-600 font-mono">@ {task["Picked Up By"]}</span>
      )}
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as NonNullable<Task["Status"]>;
          if (next !== current) onStatusChange(next);
        }}
        className={`mt-0.5 w-full text-xs px-2 py-1 rounded-lg border border-[#2a2e34] bg-[#14181d] font-medium cursor-pointer disabled:opacity-40 focus:outline-none focus:border-zinc-500 transition-colors ${COLUMN_ACCENT[current] ?? "text-zinc-400"}`}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-[#14181d] text-white">
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function NewTaskModal({
  projects,
  onClose,
}: {
  projects: Project[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string)?.trim();
    if (!title) {
      setError(true);
      toast.error("Title is required");
      return;
    }
    const projectId = (fd.get("projectId") as string) || "";
    const kind = (fd.get("kind") as string) || "";
    const assignedTo = (fd.get("assignedTo") as string) || "";
    setError(false);
    start(async () => {
      try {
        await createTaskAction({
          Title: title,
          Description: (fd.get("description") as string) || undefined,
          Project: projectId ? [projectId] : undefined,
          Kind: kind ? (kind as NonNullable<Task["Kind"]>) : undefined,
          Priority: (fd.get("priority") as string) || undefined,
          "Assigned To": assignedTo ? (assignedTo as NonNullable<Task["Assigned To"]>) : undefined,
          Status: "Pending",
        });
        toast.success("Task created");
        onClose();
      } catch {
        setError(true);
        toast.error("Failed to create task");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-white">New Task</p>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Title</label>
            <input name="title" autoFocus placeholder="What needs doing?" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Optional detail / context"
              className={inputCls + " resize-none"}
            />
          </div>
          {projects.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Project</label>
              <select name="projectId" defaultValue="" className={selectCls}>
                <option value="">— None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.Name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Kind</label>
              <select name="kind" defaultValue="other" className={selectCls}>
                {KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Priority</label>
              <select name="priority" defaultValue="Medium" className={selectCls}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Assigned To</label>
            <select name="assignedTo" defaultValue="Any" className={selectCls}>
              {ASSIGNEES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-[#ff4d8b]">Couldn&apos;t create the task. Try again.</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
            >
              {pending ? "Creating…" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TasksPanel({
  tasks,
  projects = [],
}: {
  tasks: Task[];
  projects?: Project[];
}) {
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>("Any");
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();

  // Optimistic status moves; resets to the latest server prop after revalidate.
  const [optimisticTasks, applyStatus] = useOptimistic<
    Task[],
    { id: string; status: NonNullable<Task["Status"]> }
  >(tasks, (current, { id, status }) =>
    current.map((t) => (t.id === id ? { ...t, Status: status } : t)),
  );

  function handleStatusChange(task: Task, next: NonNullable<Task["Status"]>) {
    startTransition(async () => {
      applyStatus({ id: task.id, status: next });
      try {
        await updateTaskAction(task.id, { Status: next });
        toast.success(`Moved to ${next}`);
      } catch {
        // The transition tears down on throw; the next server render replaces
        // the optimistic state with whatever is now in Airtable.
        toast.error("Failed to update status");
      }
    });
  }

  const projectName = new Map<string, string>();
  for (const p of projects) projectName.set(p.id, p.Name);

  const visible =
    assignedFilter === "Any"
      ? optimisticTasks
      : optimisticTasks.filter((t) => t["Assigned To"] === assignedFilter);

  const filters: AssignedFilter[] = ["Any", "You", "Partner"];

  return (
    <div
      id="tasks"
      className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform"
    >
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Task Board</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-wrap gap-1 bg-[#0b0d10] rounded-xl p-1">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setAssignedFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  assignedFilter === f ? "bg-[#bfff3a] text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-[#bfff3a] text-black hover:bg-[#bfff3a]/80 transition-colors"
          >
            + New task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const statuses = [col.key, ...(col.extra ?? [])];
          const colTasks = visible.filter((t) => statuses.includes(t.Status));
          return (
            <div key={col.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <p className={`text-xs uppercase tracking-wider font-medium ${COLUMN_ACCENT[col.key]}`}>
                  {col.label}
                </p>
                <span className="text-[10px] text-zinc-600">{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[60px]">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-zinc-700 italic px-1 py-4 text-center">Nothing here</p>
                ) : (
                  colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      projectName={t.Project?.[0] ? projectName.get(t.Project[0]) : undefined}
                      pending={pending}
                      onStatusChange={(next) => handleStatusChange(t, next)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && <NewTaskModal projects={projects} onClose={() => setShowNew(false)} />}
    </div>
  );
}
