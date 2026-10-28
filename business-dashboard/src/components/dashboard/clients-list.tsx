"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import { createClientAction, updateClientAction, deleteClientAction } from "@/app/actions";
import type { Client, Invoice, Project } from "@/lib/db";

const STATUSES = ["Active", "Inactive", "Lead"] as const;
type ClientStatus = (typeof STATUSES)[number];

export const PANEL = "bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px]";

export const STATUS_BADGE: Record<ClientStatus, string> = {
  Active: "bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20",
  Inactive: "bg-zinc-500/10 text-[#4A5568] border-[#94A3B8]/20",
  Lead: "bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20",
};

export const inputCls =
  "w-full bg-[#F3F5F8] border border-[#DCE1E8] rounded-[4px] px-3 py-2 text-sm text-[#1B2533] placeholder:text-[#8B9AB0] focus:outline-none focus:border-[#94A3B8] transition-colors";
export const selectCls = inputCls + " cursor-pointer";

type TimelineCounts = Record<string, { entries: number; promises: number }>;
type Props = {
  clients: Client[];
  invoices: Invoice[];
  projects: Project[];
  timelineCounts: TimelineCounts;
};

export function ClientsList({ clients, invoices, projects, timelineCounts }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [, startTransition] = useTransition();

  // Resolve a client the same way TopClients does. invoices.client_id is
  // normally NULL and the real link runs through the project (schema.sql:95),
  // so counting on invoice.Client alone under-reports and would make the
  // delete warning understate the damage.
  const linkCounts = useMemo(() => {
    const projectToClient = new Map<string, string | undefined>();
    for (const p of projects) projectToClient.set(p.id, p.Client?.[0]);

    return (clientId: string) => {
      const projectCount = projects.filter((p) => p.Client?.[0] === clientId).length;
      const invoiceCount = invoices.filter((inv) => {
        const viaProject = inv.Project?.[0] ? projectToClient.get(inv.Project[0]) : undefined;
        return (inv.Client?.[0] ?? viaProject) === clientId;
      }).length;
      return { projectCount, invoiceCount };
    };
  }, [invoices, projects]);

  const sorted = useMemo(
    () => [...clients].sort((a, b) => (a.Company || a.Name).localeCompare(b.Company || b.Name)),
    [clients],
  );

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-[#5A6678] uppercase tracking-wider">All clients</p>
        <button
          onClick={() => setCreating(true)}
          className="min-h-11 sm:min-h-0 text-xs px-3 py-2 rounded-[4px] font-semibold bg-[#1D4ED8] text-white hover:bg-[#1D4ED8]/80 transition-colors"
        >
          + New client
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-[#6B7789] text-sm">
          No clients yet. Add one, or convert a won lead.
        </p>
      ) : (
        <ul className="divide-y divide-[#DCE1E8]">
          {sorted.map((client) => {
            const status = (STATUSES as readonly string[]).includes(client.Status ?? "")
              ? (client.Status as ClientStatus)
              : "Active";
            return (
              <li key={client.id} className="py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={`/admin/clients/${encodeURIComponent(client.id)}`}
                    className="flex-1 text-left min-w-0 rounded-[4px] px-1 -mx-1 hover:bg-[#0E1A2B]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
                  >
                    <p className="font-medium text-[#1B2533] leading-tight truncate">
                      {client.Company || client.Name}
                    </p>
                    {client.Company && client.Name !== client.Company && (
                      <p className="text-xs text-[#5A6678] truncate">{client.Name}</p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-[4px] border font-medium ${STATUS_BADGE[status]}`}>
                      {status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditing(client)}
                      className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/finance/invoices?client=${encodeURIComponent(client.id)}`);
                      }}
                      className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
                    >
                      Invoices
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/projects?client=${encodeURIComponent(client.id)}`);
                      }}
                      className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
                    >
                      Projects
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <ClientModal
          client={editing ?? undefined}
          onDelete={
            editing
              ? () => {
                  const target = editing;
                  setEditing(null);
                  setConfirmDelete(target);
                }
              : undefined
          }
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <DeleteClientModal
          client={confirmDelete}
          counts={{
            ...linkCounts(confirmDelete.id),
            timelineEntries: timelineCounts[confirmDelete.id]?.entries ?? 0,
            timelinePromises: timelineCounts[confirmDelete.id]?.promises ?? 0,
          }}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            const target = confirmDelete;
            setConfirmDelete(null);
            startTransition(async () => {
              try {
                await deleteClientAction(target.id);
                toast.success("Client deleted");
              } catch {
                toast.error("Failed to delete client");
              }
            });
          }}
        />
      )}
    </div>
  );
}

export function ClientModal({
  client,
  onClose,
  onDelete,
}: {
  client?: Client;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(false);
    // See the same note in leads-table.tsx: db.ts's toColumns treats `undefined`
    // as a no-op and `""` as "clear this column", so an edit that blanks a field
    // must send `""` or the old value silently survives. Create has nothing to
    // clear, so undefined is correct there.
    const blank = client ? "" : undefined;
    const str = (v: FormDataEntryValue | null) => (v as string) || blank;

    const payload = {
      Name: (fd.get("name") as string) || undefined,
      Company: str(fd.get("company")),
      Email: str(fd.get("email")),
      Phone: str(fd.get("phone")),
      Status: (fd.get("status") as ClientStatus) || "Active",
      Owner: str(fd.get("owner")),
      Notes: str(fd.get("notes")),
    };
    start(async () => {
      try {
        if (client) {
          await updateClientAction(client.id, payload);
          toast.success("Client updated");
        } else {
          await createClientAction(payload);
          toast.success("Client created");
        }
        onClose();
      } catch {
        setError(true);
        toast.error(client ? "Failed to update client" : "Failed to create client");
      }
    });
  }

  return (
    <ModalShell title={client ? "Edit client" : "New client"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Name</label>
            <input name="name" defaultValue={client?.Name ?? ""} className={inputCls} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Company</label>
            <input name="company" defaultValue={client?.Company ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Email</label>
            <input name="email" type="email" defaultValue={client?.Email ?? ""} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Phone</label>
            <input name="phone" defaultValue={client?.Phone ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Status</label>
            <select name="status" defaultValue={client?.Status ?? "Active"} className={selectCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#4A5568]">Owner</label>
            <input name="owner" defaultValue={client?.Owner ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#4A5568]">Notes</label>
          <textarea name="notes" rows={3} defaultValue={client?.Notes ?? ""} className={inputCls} />
        </div>
        {error && <p className="text-xs text-[#B23A0A]">Failed to save. Try again.</p>}
        <div className="flex gap-2 justify-between items-center mt-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs px-3 py-2 rounded-[4px] border border-[#B23A0A]/30 text-[#B23A0A] hover:bg-[#B23A0A]/10 transition-colors"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
              {pending ? "Saving…" : client ? "Save changes" : "Create client"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteClientModal({
  client,
  counts,
  onClose,
  onConfirm,
}: {
  client: Client;
  counts: {
    projectCount: number;
    invoiceCount: number;
    timelineEntries: number;
    timelinePromises: number;
  };
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { projectCount, invoiceCount, timelineEntries, timelinePromises } = counts;
  const hasTimeline = timelineEntries > 0 || timelinePromises > 0;
  const hasDependents = projectCount > 0 || invoiceCount > 0 || hasTimeline;

  return (
    <ModalShell title="Delete client" onClose={onClose}>
      <p className="text-sm text-[#334155]">
        Delete <span className="font-medium text-[#1B2533]">{client.Company || client.Name}</span>?
      </p>
      {hasDependents && (
        <div className="mt-3 rounded-[4px] border border-[#B45309]/30 bg-[#B45309]/10 p-3">
          <p className="text-xs text-[#B45309] leading-relaxed">
            This will detach {projectCount} {projectCount === 1 ? "project" : "projects"} and{" "}
            {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}
            {hasTimeline &&
              ` and ${timelineEntries} ${timelineEntries === 1 ? "timeline entry" : "timeline entries"} and ${timelinePromises} ${timelinePromises === 1 ? "promise" : "promises"}`}
            . They are not deleted, but
            they will no longer belong to any client, will disappear from the client filter, and
            will stop counting toward Top Clients revenue.
            {hasTimeline &&
              " The timeline entries and promises stay in the database but no longer appear on any client page."}{" "}
            This cannot be undone.
          </p>
        </div>
      )}
      <div className="flex gap-2 justify-end mt-5">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-[4px] border border-[#DCE1E8] text-[#4A5568] hover:text-[#0E1A2B] hover:border-[#94A3B8] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs px-4 py-2 rounded-[4px] font-semibold bg-[#B23A0A] text-white transition-colors hover:bg-[#B23A0A]/80"
        >
          Delete client
        </button>
      </div>
    </ModalShell>
  );
}
