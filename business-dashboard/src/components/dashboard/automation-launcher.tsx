"use client";

import { useState, useTransition } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  createTaskAction,
  draftProposalAction,
  generateLeadsAction,
  generateInvoiceAction,
  researchAction,
} from "@/app/actions";
import type { Lead, Project } from "@/lib/airtable";

// ─── Task Kind ────────────────────────────────────────────────────────────────
// Mirrors the `Kind` enum on TaskWriteSchema in airtable.ts. Kept as a local
// literal (same approach quick-actions.tsx takes for its select values) so the
// launcher constrains queued tasks without importing runtime enums.
type TaskKind =
  | "code"
  | "lead-gen"
  | "client-comms"
  | "research"
  | "content"
  | "ops"
  | "other";

type Props = {
  projects?: Project[];
  leads?: Lead[];
};

// ─── A "play" = one runnable automation ─────────────────────────────────────────
// `execute` plays run the work in-app (calling Claude + writing Airtable);
// `queue` plays drop a Pending Task with the correct Kind + an Inputs JSON blob
// for a terminal to claim via /take-task and run the matching command (coding
// jobs that can't run inside a web request).

type FieldDef =
  | {
      name: string;
      label: string;
      type: "text" | "number" | "date";
      placeholder?: string;
      required?: boolean;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      required?: boolean;
    }
  | {
      // A select sourced from the live Projects list.
      name: string;
      label: string;
      type: "project";
      required?: boolean;
    }
  | {
      // A select sourced from the live Leads list.
      name: string;
      label: string;
      type: "lead";
      required?: boolean;
    };

type Play = {
  id: string;
  label: string;
  icon: string;
  kind: TaskKind;
  accent: string;
  blurb: string;
  /** "execute" runs in-app; "queue" drops a Task for a terminal to run. */
  mode: "execute" | "queue";
  /** Slash command a terminal runs once it claims a queued task (for the Title). */
  command?: string;
  fields: FieldDef[];
};

const PLAYS: Play[] = [
  {
    id: "generate-leads",
    label: "Generate leads",
    icon: "🎯",
    kind: "lead-gen",
    accent: "#bfff3a",
    blurb: "Find prospects in a niche and location.",
    mode: "execute",
    fields: [
      { name: "niche", label: "Niche / industry", type: "text", placeholder: "e.g. restaurants", required: true },
      { name: "location", label: "Location", type: "text", placeholder: "e.g. Port of Spain" },
      { name: "count", label: "How many", type: "number", placeholder: "10" },
    ],
  },
  {
    id: "draft-proposal",
    label: "Draft proposal",
    icon: "📝",
    kind: "client-comms",
    accent: "#c44dff",
    blurb: "Write a proposal draft for a lead.",
    mode: "execute",
    fields: [
      { name: "leadId", label: "Lead", type: "lead", required: true },
      { name: "scope", label: "Scope / asks", type: "text", placeholder: "What the client wants" },
      {
        name: "tone",
        label: "Tone",
        type: "select",
        options: [
          { value: "professional", label: "Professional" },
          { value: "friendly", label: "Friendly" },
          { value: "concise", label: "Concise" },
        ],
      },
    ],
  },
  {
    id: "generate-invoice",
    label: "Generate invoice",
    icon: "🧾",
    kind: "ops",
    accent: "#bfff3a",
    blurb: "Mint a numbered TT$ invoice for a project.",
    mode: "execute",
    fields: [
      { name: "projectId", label: "Project", type: "project", required: true },
      {
        name: "invoiceType",
        label: "Type",
        type: "select",
        options: [
          { value: "deposit", label: "Deposit" },
          { value: "milestone", label: "Milestone" },
          { value: "final", label: "Final" },
          { value: "recurring", label: "Recurring" },
          { value: "one_off", label: "One-off" },
        ],
      },
      { name: "amount", label: "Amount (TT$, blank = project value)", type: "number", placeholder: "0.00" },
      { name: "dueDate", label: "Due date (optional)", type: "date" },
    ],
  },
  {
    id: "new-marketing-site",
    label: "New marketing site",
    icon: "🌐",
    kind: "code",
    accent: "#7dd3fc",
    blurb: "Scaffold a client site from a reference pattern.",
    mode: "queue",
    command: "/new-marketing-site",
    fields: [
      { name: "clientName", label: "Client / business", type: "text", placeholder: "e.g. Trotters", required: true },
      {
        name: "pattern",
        label: "Reference pattern",
        type: "select",
        options: [
          { value: "restaurant", label: "Restaurant" },
          { value: "realtor", label: "Realtor" },
          { value: "service-business", label: "Service business" },
          { value: "ecommerce", label: "E-commerce" },
          { value: "activity-venue", label: "Activity venue" },
          { value: "agency-self", label: "Agency" },
        ],
      },
      { name: "notes", label: "Notes", type: "text", placeholder: "Anything specific" },
    ],
  },
  {
    id: "refresh-references",
    label: "Refresh references",
    icon: "🔄",
    kind: "ops",
    accent: "#ff4d8b",
    blurb: "Re-snapshot the website-references library.",
    mode: "queue",
    command: "/refresh-references",
    fields: [
      { name: "notes", label: "Notes (optional)", type: "text", placeholder: "Which sites, why" },
    ],
  },
  {
    id: "research",
    label: "Research",
    icon: "🔍",
    kind: "research",
    accent: "#fbbf24",
    blurb: "Dig into a topic and save it to Ideas.",
    mode: "execute",
    fields: [
      { name: "topic", label: "Topic", type: "text", placeholder: "What to research", required: true },
      {
        name: "depth",
        label: "Depth",
        type: "select",
        options: [
          { value: "quick", label: "Quick scan" },
          { value: "deep", label: "Deep dive" },
        ],
      },
    ],
  },
];

// ─── Shared modal primitives (visual match to quick-actions.tsx) ────────────────

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <p className="text-sm font-semibold text-white">{title}</p>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

function SubmitRow({
  pending,
  onClose,
  accent,
  mode,
}: {
  pending: boolean;
  onClose: () => void;
  accent: string;
  mode: "execute" | "queue";
}) {
  const idle = mode === "execute" ? "Run" : "Queue task";
  const busy = mode === "execute" ? "Running…" : "Queueing…";
  return (
    <div className="flex gap-2 justify-end mt-6">
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
        className="text-xs px-4 py-2 rounded-xl font-semibold disabled:opacity-40 transition-colors"
        style={{ background: accent, color: "#000" }}
      >
        {pending ? busy : idle}
      </button>
    </div>
  );
}

// ─── Per-play form → queues a Task ──────────────────────────────────────────────

// Run an in-app "execute" play, dispatched by id. Returns the launcher's
// { ok, message } so the modal can toast success or a graceful failure.
async function runExecutePlay(
  play: Play,
  inputs: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  switch (play.id) {
    case "generate-invoice":
      return generateInvoiceAction({
        projectId: inputs.projectId,
        invoiceType: inputs.invoiceType as
          | "deposit"
          | "milestone"
          | "final"
          | "recurring"
          | "one_off"
          | undefined,
        amount: inputs.amount ? Number(inputs.amount) : undefined,
        dueDate: inputs.dueDate || undefined,
      });
    case "draft-proposal":
      return draftProposalAction(inputs.leadId, {
        scope: inputs.scope,
        tone: inputs.tone,
      });
    case "generate-leads":
      return generateLeadsAction({
        niche: inputs.niche,
        location: inputs.location,
        count: inputs.count ? Number(inputs.count) : undefined,
      });
    case "research":
      return researchAction({ topic: inputs.topic, depth: inputs.depth });
    default:
      return { ok: false, message: "Unknown automation." };
  }
}

function PlayModal({
  play,
  projects,
  leads,
  onClose,
}: {
  play: Play;
  projects: Project[];
  leads: Lead[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Collect every field into an Inputs object; non-empty values only.
    const inputs: Record<string, string> = {};
    let projectId = "";
    for (const f of play.fields) {
      const raw = (fd.get(f.name) as string) ?? "";
      if (f.type === "project") projectId = raw;
      if (raw !== "") inputs[f.name] = raw;
    }

    if (play.mode === "execute") {
      start(async () => {
        try {
          const res = await runExecutePlay(play, inputs);
          if (res.ok) {
            toast.success(res.message);
            onClose();
          } else {
            toast.error(res.message);
          }
        } catch {
          toast.error("Automation failed. Try again.");
        }
      });
      return;
    }

    // Queue mode: drop a Pending Task for a terminal to claim and run.
    const projectName = projectId
      ? projects.find((p) => p.id === projectId)?.Name
      : undefined;
    const title = projectName ? `${play.label} — ${projectName}` : play.label;

    start(async () => {
      try {
        await createTaskAction({
          Title: title,
          Description: play.command
            ? `Run ${play.command} with the queued Inputs.`
            : play.blurb,
          Kind: play.kind,
          Status: "Pending",
          "Assigned To": "Any",
          Project: projectId ? [projectId] : undefined,
          Inputs: JSON.stringify(inputs),
          "Created By": "automation-launcher",
        });
        toast.success(`Queued: ${title}`);
        onClose();
      } catch {
        toast.error("Failed to queue task");
      }
    });
  }

  return (
    <Modal title={play.label} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500 -mt-1">{play.blurb}</p>
        {play.fields.map((f) => (
          <Field key={f.name} label={f.label}>
            {f.type === "project" ? (
              <select name={f.name} className={selectCls} defaultValue="" required={f.required}>
                <option value="" disabled={f.required}>
                  — Select project
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.Name}
                  </option>
                ))}
              </select>
            ) : f.type === "lead" ? (
              <select name={f.name} className={selectCls} defaultValue="" required={f.required}>
                <option value="" disabled={f.required}>
                  — Select lead
                </option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l["Business Name"] ? `${l.Name} — ${l["Business Name"]}` : l.Name}
                  </option>
                ))}
              </select>
            ) : f.type === "select" ? (
              <select name={f.name} className={selectCls} defaultValue="" required={f.required}>
                <option value="" disabled>
                  Select…
                </option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.name}
                type={f.type}
                placeholder={f.type !== "date" ? f.placeholder : undefined}
                step={f.type === "number" ? "0.01" : undefined}
                min={f.type === "number" ? "0" : undefined}
                required={f.required}
                className={inputCls}
              />
            )}
          </Field>
        ))}
        <SubmitRow pending={pending} onClose={onClose} accent={play.accent} mode={play.mode} />
      </form>
    </Modal>
  );
}

export function AutomationLauncher({ projects = [], leads = [] }: Props) {
  const [openPlay, setOpenPlay] = useState<Play | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {PLAYS.map((play) => (
          <button
            key={play.id}
            onClick={() => setOpenPlay(play)}
            className="flex flex-col items-start gap-1.5 text-left p-3.5 rounded-2xl bg-[#14181d] border border-[#2a2e34] hover:border-zinc-500 transition-colors group"
          >
            <span className="text-xl leading-none">{play.icon}</span>
            <span
              className="text-sm font-semibold text-white"
              style={{ color: play.accent }}
            >
              {play.label}
            </span>
            <span className="text-[11px] text-zinc-500 leading-snug">
              {play.blurb}
            </span>
          </button>
        ))}
      </div>

      {openPlay && (
        <PlayModal
          play={openPlay}
          projects={projects}
          leads={leads}
          onClose={() => setOpenPlay(null)}
        />
      )}
    </>
  );
}
