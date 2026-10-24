"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { closePromiseAction, deletePromiseAction, reopenPromiseAction } from "@/app/actions";
import { PANEL } from "@/components/dashboard/clients-list";
import { tt } from "@/lib/ledger";
import {
  dueState,
  formatDay,
  litFromItems,
  movedFrom,
  owedItems,
  sameLit,
  type ClientPromise,
  type Lit,
  type OwedBy,
  type UnpaidInvoice,
} from "@/lib/timeline";
import { ConfirmRow, LATE, LIT_ROW, THROWN, useFocusReturn } from "./form";
import { PromiseModal } from "./promise-modal";

type Props = {
  side: OwedBy;
  title: string;
  promises: ClientPromise[];
  invoices: UnpaidInvoice[];
  today: string;
  lit: Lit | null;
  onLight: (l: Lit) => void;
  onClear: () => void;
  clientId: string;
};

const SHOWN = 5;

function DueLabel({ dueOn, today }: { dueOn: string | null; today: string }) {
  const s = dueState(dueOn, today);
  if (!dueOn || s.kind === "none") return <span className="text-zinc-500">no date</span>;
  if (s.kind === "late")
    return (
      <span className="font-medium" style={{ color: LATE }}>
        {s.days} {s.days === 1 ? "day" : "days"} late
      </span>
    );
  return <span className={s.kind === "soon" ? "text-amber-400" : "text-zinc-500"}>{formatDay(dueOn)}</span>;
}

// A disclosure, not an ARIA menu: the trigger toggles a list of plain buttons.
function RowMenu({ what, items }: { what: string; items: [string, () => void][] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const trigger = () => root.current?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);
  return (
    <div
      ref={root}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          trigger();
        }
      }}
      onBlur={(e) => {
        // Tab out closes it. A null relatedTarget (some browsers do not focus buttons on click) is left to the outside-click handler.
        if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Actions for ${what}`}
        onClick={() => setOpen(!open)}
        className="size-8 sm:size-6 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 leading-none"
      >
        ⋯
      </button>
      {open && (
        <ul id={listId} className="absolute right-0 z-30 mt-1 w-28 rounded-lg border border-[#2a2e34] bg-[#14171b] p-1 shadow-lg">
          {items.map(([label, fn]) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (label !== "Delete") trigger();
                  fn();
                }}
                className="block w-full rounded-md px-2 py-2 sm:py-1 text-left text-xs text-zinc-200 hover:bg-white/10"
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Modal = { mode: "add" } | { mode: "edit" | "replace" | "drop"; promise: ClientPromise };

export function OwesList({ side, title, promises, invoices, today, lit, onLight, onClear, clientId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [modal, setModal] = useFocusReturn<Modal>();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pend, setPend] = useState<ReadonlySet<string>>(new Set());
  const busy = useRef(new Set<string>());

  const items = owedItems(promises, invoices, side);
  const closed = promises
    .filter((p) => p.owedBy === side && p.status !== "open")
    .sort((a, b) => (b.closedOn ?? "").localeCompare(a.closedOn ?? ""));
  const isLit = (i: (typeof items)[number]) =>
    i.type === "promise" ? !!lit?.promises.includes(i.promise.id) : !!lit?.invoices.includes(i.invoice.id);
  // Any lit row behind a Show button opens its section. Setting own state during render is the React pattern for this.
  if (!expanded && items.slice(SHOWN).some(isLit)) setExpanded(true);
  if (!showClosed && closed.some((p) => lit?.promises.includes(p.id))) setShowClosed(true);
  const visible = expanded ? items : items.slice(0, SHOWN);

  const toggle = (next: Lit) => (sameLit(lit, next) ? onClear() : onLight(next));

  // Returns true when the action succeeded. On an error the toast shows and the row keeps its state.
  async function act(id: string, call: () => Promise<{ error?: string }>): Promise<boolean> {
    if (busy.current.has(id)) return false;
    busy.current.add(id);
    setPend(new Set(busy.current));
    try {
      const res = await call();
      if (res.error) toast.error(res.error);
      return !res.error;
    } catch {
      toast.error(THROWN);
      return false;
    } finally {
      busy.current.delete(id);
      setPend(new Set(busy.current));
    }
  }

  const row = "flex items-start gap-2 px-3 py-2 border-t border-[#23272d] cursor-pointer hover:bg-white/[0.03]";
  // The text column is the keyboard control for the highlight. A click elsewhere on the row bubbles to the row handler.
  const lightBtn = "min-w-0 flex-1 text-left text-sm cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-sky-400";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const more = "w-full px-3 py-2 border-t border-[#23272d] text-left text-xs text-sky-400 hover:bg-white/5";

  return (
    <section className={`${PANEL} min-w-0 [&>*:last-child]:rounded-b-[20px]`} aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <h2 className="text-sm font-semibold text-white min-w-0 [overflow-wrap:anywhere]">{title}</h2>
        <button
          type="button"
          onClick={() => setModal({ mode: "add" })}
          className="min-h-11 sm:min-h-0 shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#2a2e34] text-zinc-200 hover:bg-white/5"
        >
          + Add promise
        </button>
      </div>

      {items.length === 0 && <p className="px-3 pb-3 text-sm text-zinc-500">Nothing open.</p>}

      {visible.map((item) => {
        const on = isLit(item);
        if (item.type === "invoice") {
          const inv = item.invoice;
          return (
            <div
              key={`i-${inv.id}`}
              className={`${row} ${on ? LIT_ROW : ""}`}
              onClick={() => toggle(litFromItems([], [inv.id], promises))}
            >
              <button type="button" aria-pressed={on} className={`${lightBtn} text-zinc-200`}>
                <span className="block [overflow-wrap:anywhere]">
                  Invoice {inv.number} · {tt(inv.balance)}
                </span>
                <span className="block text-xs">
                  <DueLabel dueOn={inv.dueOn} today={today} />
                </span>
              </button>
              <Link
                href={`/admin/finance?client=${clientId}`}
                onClick={stop}
                aria-label={`Open in Finance: invoice ${inv.number}`}
                className="text-xs text-sky-400 hover:underline self-center py-2"
              >
                Open in Finance
              </Link>
            </div>
          );
        }
        const p = item.promise;
        const moved = movedFrom(p, promises);
        return (
          <div key={p.id}>
            <div
              className={`${row} ${on ? LIT_ROW : ""}`}
              onClick={() => toggle(litFromItems([p.id], [], promises))}
            >
              <input
                type="checkbox"
                checked={pend.has(p.id)}
                disabled={pend.has(p.id)}
                aria-label={`Mark done: ${p.what}`}
                onClick={stop}
                onChange={() => act(p.id, () => closePromiseAction(p.id, { status: "done", note: null }))}
                className="mt-0.5 size-5 sm:size-4 accent-[#bfff3a] cursor-pointer"
              />
              <button type="button" aria-pressed={on} className={`${lightBtn} text-zinc-200`}>
                <span className="block [overflow-wrap:anywhere]">{p.what}</span>
                <span className="block text-xs">
                  <DueLabel dueOn={p.dueOn} today={today} />
                </span>
                {moved !== undefined && (
                  <span className="block text-xs text-zinc-500">moved from {moved ? formatDay(moved) : "no date"}</span>
                )}
              </button>
              <RowMenu
                what={p.what}
                items={[
                  ["Edit", () => setModal({ mode: "edit", promise: p })],
                  ["Replace", () => setModal({ mode: "replace", promise: p })],
                  ["Drop", () => setModal({ mode: "drop", promise: p })],
                  ["Delete", () => setConfirming(p.id)],
                ]}
              />
            </div>
            {confirming === p.id && (
              <ConfirmRow
                text="Delete this promise?"
                busy={pend.has(p.id)}
                onConfirm={async () => {
                  if (await act(p.id, () => deletePromiseAction(p.id))) setConfirming(null);
                }}
                onCancel={() => setConfirming(null)}
              />
            )}
          </div>
        );
      })}

      {!expanded && items.length > SHOWN && (
        <button type="button" onClick={() => setExpanded(true)} className={more}>
          Show {items.length - SHOWN} more
        </button>
      )}

      {closed.length > 0 && !showClosed && (
        <button type="button" onClick={() => setShowClosed(true)} className={more}>
          Show {closed.length} closed
        </button>
      )}
      {showClosed &&
        closed.map((p) => {
          const on = !!lit?.promises.includes(p.id);
          return (
            <div
              key={p.id}
              className={`${row} text-zinc-400 ${on ? LIT_ROW : ""}`}
              onClick={() => toggle(litFromItems([p.id], [], promises))}
            >
              {p.status === "done" && (
                <input
                  type="checkbox"
                  checked={!pend.has(p.id)}
                  disabled={pend.has(p.id)}
                  aria-label={`Mark not done: ${p.what}`}
                  onClick={stop}
                  onChange={() => act(p.id, () => reopenPromiseAction(p.id))}
                  className="mt-0.5 size-5 sm:size-4 accent-[#bfff3a] cursor-pointer"
                />
              )}
              <button type="button" aria-pressed={on} className={lightBtn}>
                <span className="block [overflow-wrap:anywhere] line-through decoration-zinc-600">{p.what}</span>
                <span className="block text-xs text-zinc-500">
                  {p.status[0].toUpperCase() + p.status.slice(1)}
                  {p.closedOn ? ` ${formatDay(p.closedOn)}` : ""}
                  {p.closedBy ? ` by ${p.closedBy.split("@")[0]}` : ""}
                </span>
                {p.note && <span className="block text-xs text-zinc-500 [overflow-wrap:anywhere]">{p.note}</span>}
              </button>
              <button
                type="button"
                disabled={pend.has(p.id)}
                aria-label={`Reopen: ${p.what}`}
                onClick={(e) => {
                  stop(e);
                  act(p.id, () => reopenPromiseAction(p.id));
                }}
                className="text-xs text-sky-400 hover:underline disabled:opacity-40 py-2"
              >
                Reopen
              </button>
            </div>
          );
        })}

      {modal && (
        <PromiseModal
          clientId={clientId}
          {...(modal.mode === "add" ? { mode: "add" as const, side } : { mode: modal.mode, promise: modal.promise })}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
