"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteEntryAction } from "@/app/actions";
import { PANEL } from "@/components/dashboard/clients-list";
import { entryTag, formatDay, litFromEntry, sameLit, type ClientPromise, type Lit, type TimelineEntry } from "@/lib/timeline";
import { EntryModal } from "./entry-modal";
import { cancelBtn, LIT_ROW, THROWN } from "./form";

type Props = {
  entries: TimelineEntry[];
  promises: ClientPromise[];
  lit: Lit | null;
  onLight: (l: Lit) => void;
  onClear: () => void;
  clientId: string;
  today: string;
  // Set only by a dot click on the date line: the history scrolls to the first of these entries.
  scrollTo: { ids: string[] } | null;
};

const SHOWN = 20;
const CHIP = "text-[11px] px-2 py-0.5 rounded-full border border-[#2a2e34] text-zinc-300";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function HistoryList({ entries, promises, lit, onLight, onClear, clientId, today, scrollTo }: Props) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<TimelineEntry | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);
  const root = useRef<HTMLElement>(null);

  // Newest first; created breaks ties on the same day.
  const sorted = [...entries].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.created.localeCompare(a.created));
  // Any lit entry behind Show older opens the list. Setting own state during render is the React pattern for this.
  if (!all && sorted.slice(SHOWN).some((e) => lit?.entries.includes(e.id))) setAll(true);
  const visible = all ? sorted : sorted.slice(0, SHOWN);

  useEffect(() => {
    if (!scrollTo) return;
    const first = sorted.find((e) => scrollTo.ids.includes(e.id));
    if (first) root.current?.querySelector(`[data-entry-id="${first.id}"]`)?.scrollIntoView({ block: "nearest" });
    // Only a new dot click (a new scrollTo object) scrolls, so sorted is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    try {
      const res = await deleteEntryAction(id);
      if (res.error) toast.error(res.error);
      else setConfirming(null);
    } catch {
      toast.error(THROWN);
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  }

  return (
    <section ref={root} className={`${PANEL} [&>*:last-child]:rounded-b-[20px]`} data-region="history" aria-label="History">
      <h2 className="px-3 py-3 text-sm font-semibold text-white">History</h2>
      {entries.length === 0 && <p className="px-3 pb-3 text-sm text-zinc-500">No calls, emails or messages yet. Add the first one.</p>}

      {visible.map((e) => {
        const on = !!lit?.entries.includes(e.id);
        const made = promises.filter((p) => p.entryId === e.id).length;
        const ticked = promises.filter((p) => p.status === "done" && p.closedEntryId === e.id);
        const moved = promises.filter((p) => p.status === "replaced" && p.closedEntryId === e.id).length;
        const expanded = open === e.id;
        return (
          <div
            key={e.id}
            data-entry-id={e.id}
            data-lit={on || undefined}
            className={`border-t border-[#23272d] cursor-pointer hover:bg-white/[0.03] ${on ? LIT_ROW : ""}`}
            onClick={() => {
              const next = litFromEntry(e.id, promises);
              if (sameLit(lit, next)) onClear();
              else onLight(next);
            }}
          >
            <div className="flex items-start gap-2 px-3 py-2">
              <button
                type="button"
                aria-pressed={on}
                className="min-w-0 flex-1 text-left cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <span className="block text-xs text-zinc-500">
                  {formatDay(e.occurredOn)} · {entryTag(e.kind, e.direction)}
                </span>
                <span className="block text-sm text-zinc-100 break-words">{e.summary}</span>
                {e.people && <span className="block text-xs text-zinc-400 break-words">{e.people}</span>}
                {(made > 0 || ticked.length > 0 || moved > 0) && (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {made > 0 && <span className={CHIP}>{plural(made, "promise", "promises")} from this</span>}
                    {ticked.map((p) => (
                      <span key={p.id} className={`${CHIP} break-words`}>
                        Ticked off: {p.what}
                      </span>
                    ))}
                    {moved > 0 && <span className={CHIP}>Moved {plural(moved, "date", "dates")}</span>}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${expanded ? "Hide" : "Show"} details: ${e.summary}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setOpen(expanded ? null : e.id);
                }}
                className="shrink-0 size-8 sm:size-6 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
              >
                {expanded ? "▴" : "▾"}
              </button>
            </div>

            {expanded && (
              <div className="px-3 pb-3 space-y-2" onClick={(ev) => ev.stopPropagation()}>
                {e.body && <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">{e.body}</p>}
                {e.link && (
                  <a href={e.link} target="_blank" rel="noopener noreferrer" className="block text-xs text-sky-400 hover:underline break-all">
                    {e.link}
                  </a>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setEditing(e)} className={cancelBtn}>
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirming(e.id)} className={cancelBtn}>
                    Delete
                  </button>
                </div>
                {confirming === e.id && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#1a1215] px-3 py-2 text-xs text-zinc-200" role="alert">
                    <span>Delete this entry? Its promises stay.</span>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => remove(e.id)}
                      className="min-h-11 sm:min-h-0 px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-40"
                      style={{ background: "#ff4d8b" }}
                    >
                      Delete
                    </button>
                    <button type="button" autoFocus onClick={() => setConfirming(null)} className={cancelBtn}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!all && sorted.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="w-full px-3 py-2 border-t border-[#23272d] text-left text-xs text-sky-400 hover:bg-white/5"
        >
          Show older
        </button>
      )}

      {editing && (
        <EntryModal clientId={clientId} today={today} promises={promises} entry={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
