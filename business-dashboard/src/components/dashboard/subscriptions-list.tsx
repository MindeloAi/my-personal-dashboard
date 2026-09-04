"use client";

import { useMemo, useState, useTransition } from "react";
import { addDays, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  createSubscriptionAction,
  updateSubscriptionAction,
  deleteSubscriptionAction,
  createInvoiceAction,
} from "@/app/actions";
import {
  dueSubscriptions,
  mrr,
  nextInvoiceDate,
  FREQUENCY_LABEL,
  type Frequency,
} from "@/lib/subscriptions";
import type { Client, Invoice, Project, Subscription } from "@/lib/db";

const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
const STATUSES = ["Active", "Paused", "Cancelled"] as const;
type SubStatus = (typeof STATUSES)[number];

const STATUS_BADGE: Record<SubStatus, string> = {
  Active: "bg-[#3affd1]/10 text-[#3affd1] border-[#3affd1]/20",
  Paused: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
  Cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

/** Days after the period start that an auto-created draft invoice falls due. */
const PAYMENT_TERMS_DAYS = 14;

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pretty = (d: string) => format(parseISO(d), "d MMM yyyy");

type Props = {
  subscriptions: Subscription[];
  invoices: Invoice[];
  clients: Client[];
  projects: Project[];
};

export function SubscriptionsList({ subscriptions, invoices, clients, projects }: Props) {
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Subscription | null>(null);
  const [invoicing, setInvoicing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const due = useMemo(() => dueSubscriptions(subscriptions, invoices), [subscriptions, invoices]);
  const total = useMemo(() => mrr(subscriptions), [subscriptions]);

  const clientName = (id: string | undefined) => {
    if (!id) return null;
    const c = clients.find((x) => x.id === id);
    return c ? c.Company || c.Name : null;
  };

  /**
   * Raise the invoice this subscription is due, as a Draft for review.
   *
   * Issue Date is the date the invoice was DUE, not today. Stamping today would
   * re-anchor the schedule to however late the reminder was acted on, so a
   * retainer invoiced nineteen days late would stay nineteen days late forever.
   */
  function createDraft(subId: string, dueDate: string) {
    const sub = subscriptions.find((s) => s.id === subId);
    if (!sub) return;
    setInvoicing(subId);
    startTransition(async () => {
      try {
        await createInvoiceAction({
          Amount: sub.Amount,
          "Invoice Type": "recurring",
          Status: "Draft",
          "Issue Date": dueDate,
          "Due Date": format(addDays(parseISO(dueDate), PAYMENT_TERMS_DAYS), "yyyy-MM-dd"),
          Subscription: [sub.id],
          Project: sub.Project,
          Client: sub.Client,
          Notes: sub.Name,
        });
        toast.success("Draft invoice created — review it in Invoices");
      } catch {
        toast.error("Failed to create the invoice");
      } finally {
        setInvoicing(null);
      }
    });
  }

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Recurring revenue</p>
          <p className="text-lg font-bold text-white mt-0.5 tabular-nums">
            {money(total)}
            <span className="text-xs font-medium text-zinc-500 ml-1.5">MRR</span>
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="min-h-11 sm:min-h-0 text-xs px-3 py-2 rounded-lg font-semibold bg-[#3affd1] text-black hover:bg-[#3affd1]/80 transition-colors"
        >
          + New subscription
        </button>
      </div>

      {due.length > 0 && (
        <div className="mb-5 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 p-3">
          <p className="text-xs text-[#fbbf24] font-medium mb-2">
            {due.length === 1 ? "1 retainer is" : `${due.length} retainers are`} due to be invoiced
          </p>
          <ul className="flex flex-col gap-2">
            {due.map(({ sub, due: dueDate, daysOverdue }) => (
              <li
                key={sub.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-xs text-zinc-300 min-w-0">
                  <span className="font-medium text-white">{sub.Name}</span>
                  {" · "}
                  {money(sub.Amount ?? 0)} due {pretty(dueDate)}
                  {daysOverdue > 0 && (
                    <span className="text-[#fbbf24]">
                      {" "}
                      ({daysOverdue} {daysOverdue === 1 ? "day" : "days"} ago)
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  disabled={invoicing === sub.id}
                  onClick={() => createDraft(sub.id, dueDate)}
                  className="min-h-11 sm:min-h-0 shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold bg-[#fbbf24] text-black hover:bg-[#fbbf24]/80 disabled:opacity-40 transition-colors"
                >
                  {invoicing === sub.id ? "Creating…" : "Create draft invoice"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 text-sm">
          No recurring revenue yet. Add a retainer, hosting plan or support subscription.
        </p>
      ) : (
        <ul className="divide-y divide-[#2a2e34]">
          {subscriptions.map((sub) => {
            const status = (STATUSES as readonly string[]).includes(sub.Status ?? "")
              ? (sub.Status as SubStatus)
              : "Active";
            const next = nextInvoiceDate(sub, invoices);
            const company = clientName(sub.Client?.[0]);
            return (
              <li key={sub.id} className="py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setEditing(sub)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="font-medium text-white leading-tight truncate">{sub.Name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {company ? `${company} · ` : ""}
                      {next ? `next ${pretty(next)}` : "no start date set"}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-white tabular-nums">
                      {money(sub.Amount ?? 0)}
                      <span className="text-xs text-zinc-500">
                        {FREQUENCY_LABEL[(sub.Frequency ?? "monthly") as Frequency]}
                      </span>
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_BADGE[status]}`}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <SubscriptionModal
          subscription={editing ?? undefined}
          clients={clients}
          projects={projects}
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
        <DeleteSubscriptionModal
          subscription={confirmDelete}
          invoiceCount={invoices.filter((i) => i.Subscription?.[0] === confirmDelete.id).length}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            const target = confirmDelete;
            setConfirmDelete(null);
            startTransition(async () => {
              try {
                await deleteSubscriptionAction(target.id);
                toast.success("Subscription deleted");
              } catch {
                toast.error("Failed to delete subscription");
              }
            });
          }}
        />
      )}
    </div>
  );
}

function SubscriptionModal({
  subscription,
  clients,
  projects,
  onClose,
  onDelete,
}: {
  subscription?: Subscription;
  clients: Client[];
  projects: Project[];
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(false);
    // db.ts's toColumns treats `undefined` as a no-op and "" as "clear this
    // column", so an edit that blanks a field must send "" or the old value
    // silently survives while the save reports success. Create has nothing to
    // clear, so undefined is correct there. Status and Frequency are excluded:
    // both are CHECK-constrained and "" would violate the constraint.
    const blank = subscription ? "" : undefined;
    const str = (v: FormDataEntryValue | null) => (v as string) || blank;
    const amount = fd.get("amount") as string;
    const clientId = (fd.get("clientId") as string) || "";
    const projectId = (fd.get("projectId") as string) || "";

    const payload = {
      Name: (fd.get("name") as string) || undefined,
      Amount: amount ? parseFloat(amount) : undefined,
      Frequency: (fd.get("frequency") as Frequency) || "monthly",
      Status: (fd.get("status") as SubStatus) || "Active",
      "Start Date": str(fd.get("startDate")),
      "End Date": str(fd.get("endDate")),
      Notes: str(fd.get("notes")),
      // An empty array unlinks; undefined leaves the link untouched. On create
      // there is nothing to unlink, so send nothing at all.
      Client: clientId ? [clientId] : subscription ? [] : undefined,
      Project: projectId ? [projectId] : subscription ? [] : undefined,
    };

    start(async () => {
      try {
        if (subscription) {
          await updateSubscriptionAction(subscription.id, payload);
          toast.success("Subscription updated");
        } else {
          await createSubscriptionAction(payload);
          toast.success("Subscription created");
        }
        onClose();
      } catch {
        setError(true);
        toast.error(subscription ? "Failed to update subscription" : "Failed to create subscription");
      }
    });
  }

  return (
    <ModalShell title={subscription ? "Edit subscription" : "New subscription"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400">Name</label>
          <input
            name="name"
            placeholder="e.g. Hyline QC app — monthly support"
            defaultValue={subscription?.Name ?? ""}
            className={inputCls}
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Client</label>
            <select
              name="clientId"
              defaultValue={subscription?.Client?.[0] ?? ""}
              className={selectCls}
            >
              <option value="">— None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.Company || c.Name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Project (optional)</label>
            <select
              name="projectId"
              defaultValue={subscription?.Project?.[0] ?? ""}
              className={selectCls}
            >
              <option value="">— None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.Name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Amount per period ($)</label>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              defaultValue={subscription?.Amount ?? ""}
              className={inputCls}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Billed</label>
            <select
              name="frequency"
              defaultValue={subscription?.Frequency ?? "monthly"}
              className={selectCls}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f[0].toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Status</label>
            <select
              name="status"
              defaultValue={subscription?.Status ?? "Active"}
              className={selectCls}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">First invoice date</label>
            <input
              name="startDate"
              type="date"
              defaultValue={subscription?.["Start Date"] ?? today}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400">End date (leave blank if ongoing)</label>
          <input
            name="endDate"
            type="date"
            defaultValue={subscription?.["End Date"] ?? ""}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={subscription?.Notes ?? ""}
            className={inputCls}
          />
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
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#3affd1] text-black disabled:opacity-40 transition-colors hover:bg-[#3affd1]/80"
            >
              {pending ? "Saving…" : subscription ? "Save changes" : "Create subscription"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteSubscriptionModal({
  subscription,
  invoiceCount,
  onClose,
  onConfirm,
}: {
  subscription: Subscription;
  invoiceCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell title="Delete subscription" onClose={onClose}>
      <p className="text-sm text-zinc-300">
        Delete <span className="font-medium text-white">{subscription.Name}</span>?
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Pausing it instead keeps the history and stops it counting toward MRR.
      </p>
      {invoiceCount > 0 && (
        <div className="mt-3 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 p-3">
          <p className="text-xs text-[#fbbf24] leading-relaxed">
            {invoiceCount} {invoiceCount === 1 ? "invoice is" : "invoices are"} linked to this
            subscription. They are not deleted and still count as revenue, but they will no longer
            be attributable to a retainer. This cannot be undone.
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
          Delete subscription
        </button>
      </div>
    </ModalShell>
  );
}
