"use client";

import { Fragment, useOptimistic, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  createClientAction,
  createLeadAction,
  updateLeadAction,
  updateLeadStatusAction,
  deleteLeadAction,
} from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Client, Lead } from "@/lib/airtable";

const STATUSES = ["New", "Contacted", "Proposal Sent", "Won", "Lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

const STATUS_STYLES: Record<LeadStatus, { header: string; dot: string; badge: string }> = {
  New: {
    header: "text-[#3affd1]",
    dot: "bg-[#3affd1]",
    badge: "bg-[#3affd1]/10 text-[#3affd1] border-[#3affd1]/20",
  },
  Contacted: {
    header: "text-[#fbbf24]",
    dot: "bg-[#fbbf24]",
    badge: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
  },
  "Proposal Sent": {
    header: "text-[#c44dff]",
    dot: "bg-[#c44dff]",
    badge: "bg-[#c44dff]/10 text-[#c44dff] border-[#c44dff]/20",
  },
  Won: {
    header: "text-[#bfff3a]",
    dot: "bg-[#bfff3a]",
    badge: "bg-[#bfff3a]/10 text-[#bfff3a] border-[#bfff3a]/20",
  },
  Lost: {
    header: "text-[#ff4d8b]",
    dot: "bg-[#ff4d8b]",
    badge: "bg-[#ff4d8b]/10 text-[#ff4d8b] border-[#ff4d8b]/20",
  },
};

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

function statusOf(lead: Lead): LeadStatus {
  return (STATUSES as readonly string[]).includes(lead.Status ?? "")
    ? (lead.Status as LeadStatus)
    : "New";
}

/**
 * Find a client that already represents this lead. Email is the strong signal;
 * name is the fallback when the lead has no email. Prevents a second Won flip
 * from silently creating a duplicate client.
 */
function findExistingClient(lead: Lead, clients: Client[]): Client | undefined {
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
      className={`min-h-11 sm:min-h-0 text-xs px-3 py-1 rounded-full border font-medium cursor-pointer disabled:opacity-40 focus:outline-none ${style.badge}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-[#14181d] text-white">
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
              <label className="text-xs text-zinc-400">Name</label>
              <input name="name" defaultValue={lead?.Name ?? ""} className={inputCls} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Business</label>
              <input name="businessName" defaultValue={lead?.["Business Name"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Email</label>
              <input name="email" type="email" defaultValue={lead?.Email ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Phone/WhatsApp</label>
              <input name="phone" defaultValue={lead?.["Phone/WhatsApp"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Service Interest</label>
              <input name="serviceInterest" defaultValue={lead?.["Service Interest"] ?? ""} placeholder="Web Dev, Automation…" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Budget Range</label>
              <input name="budgetRange" defaultValue={lead?.["Budget Range"] ?? ""} placeholder="e.g. $1k–$3k" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Source</label>
              <input name="source" defaultValue={lead?.Source ?? ""} placeholder="Referral, Instagram…" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Status</label>
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
              <label className="text-xs text-zinc-400">Current Website</label>
              <input name="currentWebsite" defaultValue={lead?.["Current Website"] ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Follow-up Date</label>
              <input name="followUpDate" type="date" defaultValue={lead?.["Follow-up Date"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Message</label>
            <textarea name="message" rows={3} defaultValue={lead?.Message ?? ""} placeholder="Optional" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Notes</label>
            <textarea name="notes" rows={2} defaultValue={lead?.Notes ?? ""} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Proposal Draft</label>
            <textarea name="proposalDraft" rows={4} defaultValue={lead?.["Proposal Draft"] ?? ""} className={inputCls} />
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
              {pending ? "Saving…" : lead ? "Save changes" : "Create lead"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}

// ─── Pipeline ──────────────────────────────────────────────────────────────────
type Props = { leads: Lead[]; clients: Client[] };

export function LeadsTable({ leads, clients }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
        // offers — never converts automatically. A second Won flip would
        // otherwise create a duplicate client with no warning.
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
      className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-4 sm:p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform"
    >
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Leads</p>
        <button
          onClick={() => setNewOpen(true)}
          className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-lg font-semibold bg-[#bfff3a] text-black hover:bg-[#bfff3a]/80 transition-colors"
        >
          + New lead
        </button>
      </div>

      {optimisticLeads.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 text-sm">No leads yet</p>
      ) : (
        <div className="space-y-6">
          {STATUSES.map((status) => {
            const group = optimisticLeads.filter((l) => statusOf(l) === status);
            if (group.length === 0) return null;
            const style = STATUS_STYLES[status];
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${style.header}`}>
                    {status}
                  </span>
                  <span className="text-xs text-zinc-600 ml-1">{group.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-[#2a2e34]">
                      {group.map((lead) => {
                        const isExpanded = expandedId === lead.id;
                        return (
                          <Fragment key={lead.id}>
                            <tr
                              onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                              className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                            >
                              <td className="py-3 pr-3">
                                <p className="font-medium text-white leading-tight">{lead.Name}</p>
                                {lead["Business Name"] && (
                                  <p className="text-xs text-zinc-500">{lead["Business Name"]}</p>
                                )}
                              </td>
                              <td className="py-3 px-3 text-zinc-400 hidden sm:table-cell">
                                {lead["Service Interest"] ?? "—"}
                              </td>
                              <td className="py-3 px-3 text-zinc-400 hidden md:table-cell">
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
                              <tr className="bg-[#0b0d10]/60">
                                <td colSpan={4} className="px-2 pb-3 pt-1">
                                  <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-zinc-400">
                                    {lead.Email && (
                                      <span>
                                        <span className="text-zinc-600 mr-1">Email</span>
                                        {lead.Email}
                                      </span>
                                    )}
                                    {lead["Phone/WhatsApp"] && (
                                      <span>
                                        <span className="text-zinc-600 mr-1">Phone</span>
                                        {lead["Phone/WhatsApp"]}
                                      </span>
                                    )}
                                    {lead["Current Website"] && (
                                      <span>
                                        <span className="text-zinc-600 mr-1">Site</span>
                                        {lead["Current Website"]}
                                      </span>
                                    )}
                                    {lead.Source && (
                                      <span>
                                        <span className="text-zinc-600 mr-1">Source</span>
                                        {lead.Source}
                                      </span>
                                    )}
                                    {lead["Follow-up Date"] && (
                                      <span>
                                        <span className="text-zinc-600 mr-1">Follow-up</span>
                                        {format(parseISO(lead["Follow-up Date"]), "MMM d, yyyy")}
                                      </span>
                                    )}
                                  </div>
                                  {lead.Message && (
                                    <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                                      <span className="text-zinc-600 mr-1">Message</span>
                                      {lead.Message}
                                    </p>
                                  )}
                                  {lead["Proposal Draft"] && (
                                    <div className="mt-3 pt-3 border-t border-[#2a2e34]">
                                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">
                                        Proposal Draft
                                      </p>
                                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                        {lead["Proposal Draft"]}
                                      </p>
                                    </div>
                                  )}
                                  <div className="mt-3 flex gap-2 pt-3 border-t border-[#2a2e34]">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditing(lead);
                                      }}
                                      className="text-xs px-3 py-2 rounded-lg border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDelete(lead);
                                      }}
                                      className="text-xs px-3 py-2 rounded-lg border border-[#ff4d8b]/30 text-[#ff4d8b] hover:bg-[#ff4d8b]/10 transition-colors"
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
          <p className="text-sm text-zinc-300">
            Delete <span className="font-medium text-white">{confirmDelete.Name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-5">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
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
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#ff4d8b] text-black transition-colors hover:bg-[#ff4d8b]/80"
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
      <ModalShell title="Client already exists" onClose={onClose}>
        <p className="text-sm text-zinc-300 leading-relaxed">
          <span className="font-medium text-white">{existing.Company || existing.Name}</span> already
          matches this lead, so no new client was created.
        </p>
        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
          >
            Close
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Create client from this lead?" onClose={onClose}>
      <p className="text-sm text-zinc-300 leading-relaxed">
        Create a client record for{" "}
        <span className="font-medium text-white">{lead["Business Name"] || lead.Name}</span>? Name,
        business, email and phone are copied across. The lead itself is left as it is.
      </p>
      <div className="flex gap-2 justify-end mt-5">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                await createClientAction({
                  Name: lead.Name,
                  Company: lead["Business Name"] || undefined,
                  Email: lead.Email || undefined,
                  Phone: lead["Phone/WhatsApp"] || undefined,
                  Status: "Active",
                });
                toast.success("Client created");
                onClose();
              } catch {
                toast.error("Failed to create client");
              }
            })
          }
          className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
        >
          {pending ? "Creating…" : "Create client"}
        </button>
      </div>
    </ModalShell>
  );
}
