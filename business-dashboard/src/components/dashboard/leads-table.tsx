"use client";

import { Fragment, useEffect, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  convertLeadAction,
  createLeadAction,
  updateLeadAction,
  updateLeadStatusAction,
  deleteLeadAction,
} from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Client, Lead, Project, Invoice } from "@/lib/airtable";
import { Explain } from "./explain";
import { LinkedRecords } from "./linked-records";

const STATUSES = ["New", "Contacted", "Proposal Sent", "Won", "Lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

const STATUS_STYLES: Record<LeadStatus, { header: string; dot: string; badge: string }> = {
  New: {
    header: "text-[#0F766E]",
    dot: "bg-[#0F766E]",
    badge: "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20",
  },
  Contacted: {
    header: "text-[#B45309]",
    dot: "bg-[#B45309]",
    badge: "bg-[#B45309]/10 text-[#B45309] border-[#B45309]/20",
  },
  "Proposal Sent": {
    header: "text-[#7E22CE]",
    dot: "bg-[#7E22CE]",
    badge: "bg-[#7E22CE]/10 text-[#7E22CE] border-[#7E22CE]/20",
  },
  Won: {
    header: "text-[#1D4ED8]",
    dot: "bg-[#1D4ED8]",
    badge: "bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20",
  },
  Lost: {
    header: "text-[#B23A0A]",
    dot: "bg-[#B23A0A]",
    badge: "bg-[#B23A0A]/10 text-[#B23A0A] border-[#B23A0A]/20",
  },
};

const inputCls =
  "w-full bg-[#F3F5F8] border border-[#DCE1E8] rounded-[4px] px-3 py-2 text-sm text-[#1B2533] placeholder:text-[#8B9AB0] focus:outline-none focus:border-[#94A3B8] transition-colors";
const selectCls = inputCls + " cursor-pointer";

// Matches the project types on the public contact form, which writes leads too.
const SERVICE_OPTIONS = [
  "Website or Web App",
  "Business Dashboard",
  "Workflow Automation",
  "System Integration",
  "Custom Software",
  "Not Sure Yet",
];

const SOURCE_OPTIONS = [
  "Referral",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "WhatsApp",
  "Cold outreach",
  "Website contact form",
  "Intake form",
  "Other",
];

// Leads saved before these lists existed hold free text, and the intake form
// writes its own service names. Keep an unlisted value as its own option so
// opening and saving the lead does not blank it.
function OptionSelect({ name, value, options }: { name: string; value?: string; options: string[] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className={selectCls}>
      <option value="">Select…</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function statusOf(lead: Lead): LeadStatus {
  return (STATUSES as readonly string[]).includes(lead.Status ?? "")
    ? (lead.Status as LeadStatus)
    : "New";
}

/**
 * Find a client that already represents this lead. The lead's own client link
 * wins outright, so an already-linked lead is never re-pointed by a heuristic
 * match. Otherwise email is the strong signal and name is the fallback when the
 * lead has no email. Prevents a second Won flip from silently creating a
 * duplicate client.
 */
function findExistingClient(lead: Lead, clients: Client[]): Client | undefined {
  const linkedId = lead.Client?.[0];
  if (linkedId) {
    const linked = clients.find((c) => c.id === linkedId);
    if (linked) return linked;
  }
  const email = lead.Email?.trim().toLowerCase();
  if (email) {
    const byEmail = clients.find((c) => c.Email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const name = (lead["Business Name"] || lead.Name)?.trim().toLowerCase();
  if (!name) return undefined;
  return clients.find(
    (c) => c.Company?.trim().toLowerCase() === name || c.Name.trim().toLowerCase() === name,
  );
}

function StatusHeading({ status, count }: { status: LeadStatus; count: number }) {
  const style = STATUS_STYLES[status];
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span className={`text-xs font-semibold uppercase tracking-wider ${style.header}`}>
        {status}
      </span>
      <span className="text-xs text-[#6B7789] ml-1">{count}</span>
    </div>
  );
}

// ─── Inline status selector ───────────────────────────────────────────────────
function StatusSelect({
  lead,
  pending,
  onSelect,
}: {
  lead: Lead;
  pending: boolean;
  onSelect: (status: LeadStatus) => void;
}) {
  const current = statusOf(lead);
  const style = STATUS_STYLES[current];

  return (
    <select
      value={current}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value as LeadStatus;
        if (next !== current) onSelect(next);
      }}
      className={`min-h-11 sm:min-h-0 text-xs px-3 py-1 rounded-[4px] border font-medium cursor-pointer disabled:opacity-40 focus:outline-none ${style.badge}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-[#FFFFFF] text-[#1B2533]">
          {s}
        </option>
      ))}
    </select>
  );
}

// ─── Create / edit lead modal ─────────────────────────────────────────────────
// One component serves both modes so the two forms cannot drift apart.
function LeadModal({ lead, onClose }: { lead?: Lead; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(false);
    // An edit has to be able to BLANK a field, and the two empties are not
    // interchangeable: db.ts's toColumns treats `undefined` as a no-op that
    // leaves the column alone, and `""` as "clear it". Sending `undefined` for
    // an emptied input would keep the old value while still reporting success.
    // On create there is nothing to clear, so undefined is right there.
    const blank = lead ? "" : undefined;
    const str = (v: FormDataEntryValue | null) => (v as string) || blank;

    const payload = {
      Name: (fd.get("name") as string) || undefined,
      "Business Name": str(fd.get("businessName")),
      Email: str(fd.get("email")),
      "Phone/WhatsApp": str(fd.get("phone")),
      "Service Interest": str(fd.get("serviceInterest")),
      "Budget Range": str(fd.get("budgetRange")),
      Source: str(fd.get("source")),
      "Current Website": str(fd.get("currentWebsite")),
      "Follow-up Date": str(fd.get("followUpDate")),
      Status: (fd.get("status") as LeadStatus) || "New",
      Message: str(fd.get("message")),
      Notes: str(fd.get("notes")),
      "Proposal Draft": str(fd.get("proposalDraft")),
    };
    start(async () => {
      try {
        if (lead) {
          await updateLeadAction(lead.id, payload);
          toast.success("Lead updated");
        } else {
          await createLeadAction(payload);
          toast.success("Lead created");
        }
        onClose();
      } catch {
        setError(true);
        toast.error(lead ? "Failed to update lead" : "Failed to create lead");
      }
    });
  }

  return (
    <ModalShell title={lead ? "Edit lead" : "New Lead"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Name</label>
              <input name="name" defaultValue={lead?.Name ?? ""} className={inputCls} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Business</label>
              <input name="businessName" defaultValue={lead?.["Business Name"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Email</label>
              <input name="email" type="email" defaultValue={lead?.Email ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Phone/WhatsApp</label>
              <input name="phone" defaultValue={lead?.["Phone/WhatsApp"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Service Interest</label>
              <OptionSelect name="serviceInterest" value={lead?.["Service Interest"]} options={SERVICE_OPTIONS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Budget Range</label>
              <input name="budgetRange" defaultValue={lead?.["Budget Range"] ?? ""} placeholder="e.g. $1k–$3k" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Source</label>
              <OptionSelect name="source" value={lead?.Source} options={SOURCE_OPTIONS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Status</label>
              <select name="status" defaultValue={lead?.Status ?? "New"} className={selectCls}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Current Website</label>
              <input name="currentWebsite" defaultValue={lead?.["Current Website"] ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#4A5568]">Follow-up Date</label>
              <input name="followUpDate" type="date" defaultValue={lead?.["Follow-up Date"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Message</label>
            <textarea name="message" rows={3} defaultValue={lead?.Message ?? ""} placeholder="Optional" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Notes</label>
            <textarea name="notes" rows={2} defaultValue={lead?.Notes ?? ""} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Proposal Draft</label>
            <textarea name="proposalDraft" rows={4} defaultValue={lead?.["Proposal Draft"] ?? ""} className={inputCls} />
          </div>
          {error && <p className="text-xs text-[#B23A0A]">Failed to save. Try again.</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#1D4ED8] text-white disabled:opacity-40 transition-colors hover:bg-[#1D4ED8]/80"
            >
              {pending ? "Saving…" : lead ? "Save changes" : "Create lead"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}

// ─── Kanban view ──────────────────────────────────────────────────────────────
// Same drag mechanics as project-board.tsx. A drop goes through the list view's
// status handler, so Won still offers the client conversion.
function LeadCard({ lead, isDragging = false }: { lead: Lead; isDragging?: boolean }) {
  return (
    <div
      className={`bg-[#F3F5F8] border border-[#DCE1E8] rounded-[4px] p-4 ${
        isDragging ? "opacity-50" : "hover:border-[#CBD5E1] transition-colors"
      }`}
    >
      <p className="text-sm font-medium text-[#1B2533] leading-tight">{lead.Name}</p>
      {lead["Business Name"] && (
        <p className="text-xs text-[#5A6678] mt-0.5">{lead["Business Name"]}</p>
      )}
      {(lead["Service Interest"] || lead["Budget Range"]) && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {lead["Service Interest"] && (
            <span className="text-[10px] px-2 py-0.5 rounded-[4px] font-medium bg-white/[0.04] text-[#334155]">
              {lead["Service Interest"]}
            </span>
          )}
          {lead["Budget Range"] && (
            <span className="text-[10px] text-[#5A6678]">{lead["Budget Range"]}</span>
          )}
        </div>
      )}
      {lead["Follow-up Date"] && (
        <p className="text-[10px] text-[#6B7789] mt-2">
          Follow-up {format(parseISO(lead["Follow-up Date"]), "MMM d, yyyy")}
        </p>
      )}
    </div>
  );
}

function DraggableLeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={isDragging ? undefined : onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      // No text selection or iOS callout menu stealing the long-press that starts a drag.
      className="cursor-grab active:cursor-grabbing select-none [-webkit-touch-callout:none]"
    >
      <LeadCard lead={lead} isDragging={isDragging} />
    </div>
  );
}

function LeadColumn({
  status,
  leads,
  onOpen,
}: {
  status: LeadStatus;
  leads: Lead[];
  onOpen: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="md:min-w-[200px] md:flex-1">
      <StatusHeading status={status} count={leads.length} />
      <div
        ref={setNodeRef}
        className={`min-h-14 md:min-h-[120px] rounded-[4px] p-2 space-y-2 transition-colors ${
          isOver ? "bg-white/[0.03]" : ""
        }`}
      >
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} onOpen={() => onOpen(lead)} />
        ))}
      </div>
    </div>
  );
}

// true in the browser, false during SSR, with no setState-in-effect re-render.
const noopSubscribe = () => () => {};

function LeadBoard({
  leads,
  onMove,
  onOpen,
}: {
  leads: Lead[];
  onMove: (lead: Lead, status: LeadStatus) => void;
  onOpen: (lead: Lead) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // The overlay's portal target only exists in the browser; see the DragOverlay below.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Touch needs a long-press, or every swipe to scroll the page picks up a card.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const activeLead = leads.find((l) => l.id === activeId);

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const lead = leads.find((l) => l.id === active.id);
    const next = over?.id as string | undefined;
    if (!lead || !next || !(STATUSES as readonly string[]).includes(next)) return;
    if (statusOf(lead) !== next) onMove(lead, next as LeadStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Phones stack the columns: a sideways board hides every column but the first. */}
      <div className="md:overflow-x-auto pb-2">
        <div className="flex flex-col md:flex-row gap-4">
          {STATUSES.map((status) => (
            <LeadColumn
              key={status}
              status={status}
              leads={leads.filter((l) => statusOf(l) === status)}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
      {/* Portalled for the same reason as in project-board.tsx: the panel's
          hover:-translate-y-0.5 would make the position:fixed overlay resolve
          against the panel instead of the viewport. */}
      {mounted &&
        createPortal(
          <DragOverlay>{activeLead ? <LeadCard lead={activeLead} /> : null}</DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

// ─── Pipeline ──────────────────────────────────────────────────────────────────
type Props = { leads: Lead[]; clients: Client[]; projects?: Project[]; invoices?: Invoice[] };
type View = "list" | "kanban";

export function LeadsTable({ leads, clients, projects = [], invoices = [] }: Props) {
  const [view, setView] = useState<View>("list");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // A link to /admin/leads#lead-<id> opens that lead's details (after load, so
  // the server and browser render the same HTML first).
  useEffect(() => {
    const open = () => {
      if (window.location.hash.startsWith("#lead-")) setExpandedId(window.location.hash.slice(6));
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  const graph = { clients, leads, projects, invoices };
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [pending, startTransition] = useTransition();

  // Optimistic status moves; resets to the latest server prop automatically.
  const [optimisticLeads, applyStatus] = useOptimistic<Lead[], { id: string; status: LeadStatus }>(
    leads,
    (current, { id, status }) =>
      current.map((l) => (l.id === id ? { ...l, Status: status } : l)),
  );

  function handleStatusChange(lead: Lead, next: LeadStatus) {
    startTransition(async () => {
      applyStatus({ id: lead.id, status: next });
      try {
        await updateLeadStatusAction(lead.id, next);
        toast.success(`Moved to ${next}`);
        // Won is the only status that offers conversion, and it only ever
        // offers — never converts automatically. A second Won flip finds the
        // lead's linked client first (then email/name), and the server also
        // reuses an already-linked client, so no duplicate is created.
        if (next === "Won") setConvertLead(lead);
      } catch {
        // The transition tears down on throw; the next server render replaces
        // the optimistic state with whatever is now in Airtable.
        toast.error("Failed to update status");
      }
    });
  }

  return (
    <div
      id="leads"
      className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-4 sm:p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform"
    >
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-[#5A6678] uppercase tracking-wider">Leads</p>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Leads view" className="flex gap-1 bg-[#F3F5F8] rounded-[4px] p-1">
            {(["list", "kanban"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`min-h-11 sm:min-h-0 px-2.5 py-1 rounded-[4px] text-[10px] font-medium transition-colors ${
                  view === v ? "bg-[#1D4ED8] text-white" : "text-[#4A5568] hover:text-[#0E1A2B]"
                }`}
              >
                {v === "list" ? "List" : "Kanban"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setNewOpen(true)}
            className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-[4px] font-semibold bg-[#1D4ED8] text-white hover:bg-[#1D4ED8]/80 transition-colors"
          >
            + New lead
          </button>
        </div>
      </div>
      <Explain
        className="-mt-2 mb-5"
        shows="Everyone who has shown interest in working with Mindelo, grouped by pipeline stage."
        read="Change a lead's stage with its dropdown, or switch to Kanban and drag it. Converting a won lead creates or links its client, so its projects and invoices follow."
        watch="Leads left at New or Contacted for weeks need a follow-up."
      />

      {optimisticLeads.length === 0 ? (
        <p className="py-8 text-center text-[#6B7789] text-sm">No leads yet</p>
      ) : view === "kanban" ? (
        <LeadBoard leads={optimisticLeads} onMove={handleStatusChange} onOpen={setEditing} />
      ) : (
        <div className="space-y-6">
          {STATUSES.map((status) => {
            const group = optimisticLeads.filter((l) => statusOf(l) === status);
            if (group.length === 0) return null;
            return (
              <div key={status}>
                <StatusHeading status={status} count={group.length} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-[#DCE1E8]">
                      {group.map((lead) => {
                        const isExpanded = expandedId === lead.id;
                        return (
                          <Fragment key={lead.id}>
                            <tr
                              id={`lead-${lead.id}`}
                              onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                              className="scroll-mt-24 hover:bg-[#F7F8FA] target:bg-[#EFF4FF] transition-colors cursor-pointer"
                            >
                              <td className="py-3 pr-3">
                                <p className="font-medium text-[#1B2533] leading-tight">{lead.Name}</p>
                                {lead["Business Name"] && (
                                  <p className="text-xs text-[#5A6678]">{lead["Business Name"]}</p>
                                )}
                              </td>
                              <td className="py-3 px-3 text-[#4A5568] hidden sm:table-cell">
                                {lead["Service Interest"] ?? "—"}
                              </td>
                              <td className="py-3 px-3 text-[#4A5568] hidden md:table-cell">
                                {lead["Budget Range"] ?? "—"}
                              </td>
                              <td className="py-3 pl-3 text-right">
                                <StatusSelect
                                  lead={lead}
                                  pending={pending}
                                  onSelect={(next) => handleStatusChange(lead, next)}
                                />
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-[#F3F5F8]/60">
                                <td colSpan={4} className="px-2 pb-3 pt-1">
                                  <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-[#4A5568]">
                                    {lead.Email && (
                                      <span>
                                        <span className="text-[#6B7789] mr-1">Email</span>
                                        {lead.Email}
                                      </span>
                                    )}
                                    {lead["Phone/WhatsApp"] && (
                                      <span>
                                        <span className="text-[#6B7789] mr-1">Phone</span>
                                        {lead["Phone/WhatsApp"]}
                                      </span>
                                    )}
                                    {lead["Current Website"] && (
                                      <span>
                                        <span className="text-[#6B7789] mr-1">Site</span>
                                        {lead["Current Website"]}
                                      </span>
                                    )}
                                    {lead.Source && (
                                      <span>
                                        <span className="text-[#6B7789] mr-1">Source</span>
                                        {lead.Source}
                                      </span>
                                    )}
                                    {lead["Follow-up Date"] && (
                                      <span>
                                        <span className="text-[#6B7789] mr-1">Follow-up</span>
                                        {format(parseISO(lead["Follow-up Date"]), "MMM d, yyyy")}
                                      </span>
                                    )}
                                  </div>
                                  <LinkedRecords kind="lead" id={lead.id} graph={graph} hide={["lead"]} className="mt-2" />
                                  {lead.Message && (
                                    <p className="mt-2 text-xs text-[#334155] leading-relaxed">
                                      <span className="text-[#6B7789] mr-1">Message</span>
                                      {lead.Message}
                                    </p>
                                  )}
                                  {lead["Proposal Draft"] && (
                                    <div className="mt-3 pt-3 border-t border-[#DCE1E8]">
                                      <p className="text-[10px] text-[#5A6678] uppercase tracking-wider mb-1.5">
                                        Proposal Draft
                                      </p>
                                      <p className="text-xs text-[#334155] leading-relaxed whitespace-pre-wrap">
                                        {lead["Proposal Draft"]}
                                      </p>
                                    </div>
                                  )}
                                  <div className="mt-3 flex gap-2 pt-3 border-t border-[#DCE1E8]">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditing(lead);
                                      }}
                                      className="text-xs px-3 py-2 rounded-[4px] border border-[#DCE1E8] text-[#334155] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDelete(lead);
                                      }}
                                      className="text-xs px-3 py-2 rounded-[4px] border border-[#B23A0A]/30 text-[#B23A0A] hover:bg-[#B23A0A]/10 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newOpen && <LeadModal onClose={() => setNewOpen(false)} />}
      {editing && <LeadModal lead={editing} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <ModalShell title="Delete lead" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-[#334155]">
            Delete <span className="font-medium text-[#1B2533]">{confirmDelete.Name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-5">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                startTransition(async () => {
                  try {
                    await deleteLeadAction(target.id);
                    toast.success("Lead deleted");
                  } catch {
                    toast.error("Failed to delete lead");
                  }
                });
              }}
              className="text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#B23A0A] text-white transition-colors hover:bg-[#B23A0A]/80"
            >
              Delete
            </button>
          </div>
        </ModalShell>
      )}
      {convertLead && (
        <ConvertLeadModal
          lead={convertLead}
          existing={findExistingClient(convertLead, clients)}
          onClose={() => setConvertLead(null)}
        />
      )}
    </div>
  );
}

// ─── Won → client conversion ──────────────────────────────────────────────────
function ConvertLeadModal({
  lead,
  existing,
  onClose,
}: {
  lead: Lead;
  existing?: Client;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  if (existing) {
    return (
      <ModalShell title="Link to existing client?" onClose={onClose}>
        <p className="text-sm text-[#334155] leading-relaxed">
          <span className="font-medium text-[#1B2533]">{existing.Company || existing.Name}</span> already
          matches this lead. Link the lead to that client and move the lead&apos;s projects onto it?
        </p>
        <div className="flex gap-2 justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await convertLeadAction(lead.id, existing.id);
                  toast.success("Lead linked to client");
                  onClose();
                } catch {
                  toast.error("Failed to link the lead");
                }
              })
            }
            className="text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#1D4ED8] text-white disabled:opacity-40 transition-colors hover:bg-[#1D4ED8]/80"
          >
            {pending ? "Linking…" : "Link to client"}
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Create client from this lead?" onClose={onClose}>
      <p className="text-sm text-[#334155] leading-relaxed">
        Create a client record for{" "}
        <span className="font-medium text-[#1B2533]">{lead["Business Name"] || lead.Name}</span>? Name,
        business, email and phone are copied across, the lead is linked to the new client, and its projects move onto it.
      </p>
      <div className="flex gap-2 justify-end mt-5">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                await convertLeadAction(lead.id, null);
                toast.success("Client created");
                onClose();
              } catch {
                toast.error("Failed to create client");
              }
            })
          }
          className="text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#1D4ED8] text-white disabled:opacity-40 transition-colors hover:bg-[#1D4ED8]/80"
        >
          {pending ? "Creating…" : "Create client"}
        </button>
      </div>
    </ModalShell>
  );
}
