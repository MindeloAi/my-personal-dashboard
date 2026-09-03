"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import { createClientAction, updateClientAction, deleteClientAction } from "@/app/actions";
import type { Client, Invoice, Project } from "@/lib/db";

const STATUSES = ["Active", "Inactive", "Lead"] as const;
type ClientStatus = (typeof STATUSES)[number];

const STATUS_BADGE: Record<ClientStatus, string> = {
  Active: "bg-[#bfff3a]/10 text-[#bfff3a] border-[#bfff3a]/20",
  Inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  Lead: "bg-[#3affd1]/10 text-[#3affd1] border-[#3affd1]/20",
};

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

type Props = { clients: Client[]; invoices: Invoice[]; projects: Project[] };

export function ClientsList({ clients, invoices, projects }: Props) {
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
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">All clients</p>
        <button
          onClick={() => setCreating(true)}
          className="min-h-11 sm:min-h-0 text-xs px-3 py-2 rounded-lg font-semibold bg-[#bfff3a] text-black hover:bg-[#bfff3a]/80 transition-colors"
        >
          + New client
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 text-sm">
          No clients yet. Add one, or convert a won lead.
        </p>
      ) : (
        <ul className="divide-y divide-[#2a2e34]">
          {sorted.map((client) => {
            const status = (STATUSES as readonly string[]).includes(client.Status ?? "")
              ? (client.Status as ClientStatus)
              : "Active";
            return (
              <li key={client.id} className="py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setEditing(client)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="font-medium text-white leading-tight truncate">
                      {client.Company || client.Name}
                    </p>
                    {client.Company && client.Name !== client.Company && (
                      <p className="text-xs text-zinc-500 truncate">{client.Name}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_BADGE[status]}`}>
                      {status}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/finance?client=${encodeURIComponent(client.id)}`);
                      }}
                      className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-lg border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                    >
                      Invoices
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/projects?client=${encodeURIComponent(client.id)}`);
                      }}
                      className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-lg border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
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
          counts={linkCounts(confirmDelete.id)}
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

function ClientModal({
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
            <label className="text-xs text-zinc-400">Name</label>
            <input name="name" defaultValue={client?.Name ?? ""} className={inputCls} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Company</label>
            <input name="company" defaultValue={client?.Company ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Email</label>
            <input name="email" type="email" defaultValue={client?.Email ?? ""} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Phone</label>
            <input name="phone" defaultValue={client?.Phone ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Status</label>
            <select name="status" defaultValue={client?.Status ?? "Active"} className={selectCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Owner</label>
            <input name="owner" defaultValue={client?.Owner ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400">Notes</label>
          <textarea name="notes" rows={3} defaultValue={client?.Notes ?? ""} className={inputCls} />
        </div>
        {error && <p className="text-xs text-[#ff4d8b]">Failed to save. Try again.</p>}
        <div className="flex gap-2 justify-between items-center mt-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs px-3 py-2 rounded-xl border border-[#ff4d8b]/30 text-[#ff4d8b] hover:bg-[#ff4d8b]/10 transition-colors"
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
              className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
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
  counts: { projectCount: number; invoiceCount: number };
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { projectCount, invoiceCount } = counts;
  const hasLinks = projectCount > 0 || invoiceCount > 0;

  return (
    <ModalShell title="Delete client" onClose={onClose}>
      <p className="text-sm text-zinc-300">
        Delete <span className="font-medium text-white">{client.Company || client.Name}</span>?
      </p>
      {hasLinks && (
        <div className="mt-3 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 p-3">
          <p className="text-xs text-[#fbbf24] leading-relaxed">
            This will detach {projectCount} {projectCount === 1 ? "project" : "projects"} and{" "}
            {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}. They are not deleted, but
            they will no longer belong to any client, will disappear from the client filter, and
            will stop counting toward Top Clients revenue. This cannot be undone.
          </p>
        </div>
      )}
      <div className="flex gap-2 justify-end mt-5">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#ff4d8b] text-black transition-colors hover:bg-[#ff4d8b]/80"
        >
          Delete client
        </button>
      </div>
    </ModalShell>
  );
}
