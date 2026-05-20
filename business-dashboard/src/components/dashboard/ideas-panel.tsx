"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { createIdeaAction, createTaskAction, updateIdeaAction } from "@/app/actions";
import type { Idea } from "@/lib/airtable";

// Local string-literal aliases. The Idea schema types Status/Category as enums;
// mirror them here so the form/select values stay constrained without adding
// runtime exports from the airtable lib.
type IdeaStatus = "Raw" | "Exploring" | "Validated" | "Parked" | "Doing";
type IdeaCategory = "product" | "service" | "marketing" | "internal" | "client";

type Props = { ideas: Idea[] };

const STATUSES: IdeaStatus[] = ["Raw", "Exploring", "Validated", "Parked", "Doing"];

const STATUS_STYLES: Record<IdeaStatus, { header: string; dot: string }> = {
  Raw: { header: "text-zinc-400", dot: "bg-zinc-500" },
  Exploring: { header: "text-[#3affd1]", dot: "bg-[#3affd1]" },
  Validated: { header: "text-[#bfff3a]", dot: "bg-[#bfff3a]" },
  Parked: { header: "text-zinc-500", dot: "bg-zinc-600" },
  Doing: { header: "text-[#c44dff]", dot: "bg-[#c44dff]" },
};

const CATEGORY_LABELS: Record<string, string> = {
  product: "Product",
  service: "Service",
  marketing: "Marketing",
  internal: "Internal",
  client: "Client",
};

const RATING_COLORS: Record<string, string> = {
  Low: "bg-zinc-700 text-zinc-300",
  Medium: "bg-[#3affd1]/10 text-[#3affd1]",
  High: "bg-[#bfff3a]/10 text-[#bfff3a]",
};

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

function Tag({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        className ?? "bg-white/[0.04] text-zinc-300"
      }`}
    >
      {label}
    </span>
  );
}

function NewIdeaModal({ onClose }: { onClose: () => void }) {
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
    const category = (fd.get("category") as string) || "";
    const effort = (fd.get("effort") as string) || "";
    const impact = (fd.get("impact") as string) || "";
    setError(false);
    start(async () => {
      try {
        await createIdeaAction({
          Title: fd.get("title") as string,
          Description: (fd.get("description") as string) || undefined,
          Category: category ? (category as IdeaCategory) : undefined,
          Status: "Raw",
          Effort: effort || undefined,
          Impact: impact || undefined,
          Notes: (fd.get("notes") as string) || undefined,
        });
        toast.success("Idea created");
        onClose();
      } catch {
        setError(true);
        toast.error("Failed to create idea");
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
          <p className="text-sm font-semibold text-white">New Idea</p>
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
            <input
              name="title"
              placeholder="e.g. Self-serve onboarding flow"
              className={inputCls}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Description</label>
            <input name="description" placeholder="What is it?" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Category</label>
            <select name="category" className={selectCls} defaultValue="">
              <option value="">—</option>
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="marketing">Marketing</option>
              <option value="internal">Internal</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Effort</label>
              <select name="effort" className={selectCls} defaultValue="">
                <option value="">—</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Impact</label>
              <select name="impact" className={selectCls} defaultValue="">
                <option value="">—</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Notes</label>
            <input name="notes" placeholder="Optional" className={inputCls} />
          </div>
          {error && <p className="text-xs text-[#ff4d8b]">Failed to save. Try again.</p>}
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
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  onStatusChange,
  onPromote,
  promoting,
}: {
  idea: Idea;
  onStatusChange: (status: IdeaStatus) => void;
  onPromote: () => void;
  promoting: boolean;
}) {
  return (
    <div className="bg-[#0b0d10] border border-[#2a2e34] rounded-2xl p-4 hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-white leading-tight flex-1">{idea.Title}</p>
        {idea.Category && (
          <Tag label={CATEGORY_LABELS[idea.Category] ?? idea.Category} />
        )}
      </div>
      {idea.Description && (
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">{idea.Description}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {idea.Effort && (
          <Tag
            label={`Effort: ${idea.Effort}`}
            className={RATING_COLORS[idea.Effort] ?? "bg-white/[0.04] text-zinc-300"}
          />
        )}
        {idea.Impact && (
          <Tag
            label={`Impact: ${idea.Impact}`}
            className={RATING_COLORS[idea.Impact] ?? "bg-white/[0.04] text-zinc-300"}
          />
        )}
      </div>
      {idea.Notes && (
        <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 italic">{idea.Notes}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          aria-label="Idea status"
          value={(idea.Status as IdeaStatus) ?? "Raw"}
          onChange={(e) => onStatusChange(e.target.value as IdeaStatus)}
          className="text-[11px] bg-[#14181d] border border-[#2a2e34] rounded-lg px-2 py-1 text-zinc-300 cursor-pointer focus:outline-none focus:border-zinc-500 transition-colors"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onPromote}
          disabled={promoting}
          className="ml-auto text-[11px] px-2.5 py-1 rounded-lg bg-[#c44dff]/10 text-[#c44dff] border border-[#c44dff]/20 hover:bg-[#c44dff]/20 disabled:opacity-40 transition-colors"
        >
          {promoting ? "Promoting…" : "Promote to task"}
        </button>
      </div>
    </div>
  );
}

export function IdeasPanel({ ideas }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // useOptimistic resets to the latest server prop on each render, so a failed
  // status change naturally rolls back once the next server render lands.
  const [optimisticIdeas, applyOptimistic] = useOptimistic<
    Idea[],
    { id: string; status: IdeaStatus }
  >(ideas, (current, action) =>
    current.map((i) => (i.id === action.id ? { ...i, Status: action.status } : i)),
  );

  const grouped = useMemo(() => {
    const map = new Map<IdeaStatus, Idea[]>();
    for (const s of STATUSES) map.set(s, []);
    for (const idea of optimisticIdeas) {
      const status = (idea.Status as IdeaStatus) ?? "Raw";
      (map.get(status) ?? map.get("Raw"))!.push(idea);
    }
    return map;
  }, [optimisticIdeas]);

  function handleStatusChange(idea: Idea, status: IdeaStatus) {
    if (idea.Status === status) return;
    startTransition(async () => {
      applyOptimistic({ id: idea.id, status });
      try {
        await updateIdeaAction(idea.id, { Status: status });
        toast.success(`Moved to ${status}`);
      } catch {
        toast.error("Failed to update idea");
      }
    });
  }

  function handlePromote(idea: Idea) {
    setPromotingId(idea.id);
    startTransition(async () => {
      try {
        await createTaskAction({
          Title: idea.Title,
          Description: idea.Description || undefined,
          Status: "Pending",
          "Assigned To": "Any",
          Kind: "other",
          Inputs: idea.Notes || undefined,
          "Created By": "Ideas panel",
        });
        toast.success("Promoted to task");
      } catch {
        toast.error("Failed to promote to task");
      } finally {
        setPromotingId(null);
      }
    });
  }

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Ideas</p>
        <button
          onClick={() => setShowNew(true)}
          className="text-xs px-3 py-1.5 bg-[#1a1d22] text-[#bfff3a] border border-[#2a2e34] rounded-full font-medium hover:bg-[#2a2e34] transition-colors"
        >
          + New idea
        </button>
      </div>

      {optimisticIdeas.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 text-sm">No ideas yet</p>
      ) : (
        <div className="space-y-6">
          {STATUSES.map((status) => {
            const items = grouped.get(status) ?? [];
            if (items.length === 0) return null;
            const style = STATUS_STYLES[status];
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${style.header}`}
                  >
                    {status}
                  </span>
                  <span className="text-xs text-zinc-600 ml-1">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      promoting={promotingId === idea.id}
                      onStatusChange={(s) => handleStatusChange(idea, s)}
                      onPromote={() => handlePromote(idea)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewIdeaModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
