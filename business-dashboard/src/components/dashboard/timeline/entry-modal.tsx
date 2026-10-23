"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveEntryAction, suggestPromisesAction, updateEntryAction } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  MAX_TEXT,
  MAX_WHAT,
  type ClientPromise,
  type Direction,
  type EntryKind,
  type OwedBy,
  type Suggestion,
  type TimelineEntry,
} from "@/lib/timeline";

// Same look as the client dialogs (their copies are not exported).
export const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
export const selectCls = inputCls + " cursor-pointer";
export const labelCls = "text-xs text-zinc-400";
const ghostBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-40";
export const primaryBtn =
  "min-h-11 sm:min-h-0 text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80";
export const cancelBtn = ghostBtn;
export const THROWN = "That did not save. Check your connection and try again.";

export function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
    </div>
  );
}

// One save at a time. The ref closes the gap before React re-renders the disabled buttons,
// so a fast double-click cannot send twice.
export function useSave(onClose: () => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  function run(call: () => Promise<{ error?: string }>, done: string) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    start(async () => {
      try {
        const res = await call();
        if (res.error) return setError(res.error);
        toast.success(done);
        onClose();
      } catch {
        setError(THROWN);
      } finally {
        busy.current = false;
      }
    });
  }
  return { pending, error, setError, run };
}

// "Mon 2 Nov" from a YYYY-MM-DD string, read as UTC so the day never shifts.
export function fmtDay(day: string | null): string {
  if (!day) return "no date";
  const d = new Date(day + "T00:00:00Z");
  const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${wd} ${rest}`;
}

const KINDS: EntryKind[] = ["call", "meeting", "email", "message", "document"];
const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "both", label: "Both ways" },
  { value: "received", label: "Received from the client" },
  { value: "sent", label: "Sent to the client" },
];
const defaultDirection = (k: EntryKind): Direction => (k === "call" || k === "meeting" ? "both" : "received");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type Card = Suggestion & { keep: boolean };

type Props = {
  clientId: string;
  today: string;
  promises: ClientPromise[];
  entry?: TimelineEntry;
  onClose: () => void;
};

export function EntryModal({ clientId, today, promises, entry, onClose }: Props) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? "call");
  const [direction, setDirection] = useState<Direction>(entry?.direction ?? "both");
  const [dirTouched, setDirTouched] = useState(false);
  const [date, setDate] = useState(entry?.occurredOn ?? today);
  const [summary, setSummary] = useState(entry?.summary ?? "");
  const [people, setPeople] = useState(entry?.people ?? "");
  const [text, setText] = useState(entry?.body ?? "");
  const [link, setLink] = useState(entry?.link ?? "");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [reading, setReading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const { pending, error, setError, run } = useSave(onClose);
  const busy = pending || reading;

  const common = () => ({
    occurredOn: date,
    kind,
    direction,
    summary: summary.trim(),
    people: people.trim() || null,
    body: text.trim() || null,
    link: link.trim() || null,
  });

  function changeKind(k: EntryKind) {
    setKind(k);
    if (!dirTouched) setDirection(defaultDirection(k));
  }

  async function suggest() {
    if (busy) return;
    setSuggestError(null);
    setError(null);
    if (!text.trim()) return setSuggestError("Paste some text first, or use Save without suggestions.");
    setReading(true);
    try {
      const res = await suggestPromisesAction({ clientId, occurredOn: date, kind, direction, text });
      if (!res.ok) return setSuggestError(res.error);
      if (!summary.trim()) setSummary(res.summary);
      if (!people.trim()) setPeople(res.people);
      setCards(res.suggestions.map((s) => ({ ...s, keep: true })));
    } catch {
      setSuggestError("Could not read the text. Check your connection and try again.");
    } finally {
      setReading(false);
    }
  }

  function save(withSuggestions: boolean) {
    setSuggestError(null);
    if (!summary.trim()) return setError("Add a one-line summary first.");
    const kept = withSuggestions ? (cards ?? []).filter((c) => c.keep) : [];
    if (kept.some((c) => !c.what.trim())) return setError("Every kept promise needs a description.");
    const suggestions = kept.map((c) => ({
      action: c.action,
      promiseId: c.promiseId,
      owedBy: c.owedBy,
      what: c.what.trim(),
      dueOn: c.dueOn || null,
      quote: c.quote,
    }));
    run(() => saveEntryAction({ clientId, ...common(), suggestions }), "Entry saved");
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    if (!summary.trim()) return setError("Add a one-line summary first.");
    run(() => updateEntryAction(entry.id, common()), "Entry updated");
  }

  const setCard = (i: number, patch: Partial<Card>) =>
    setCards((cs) => cs && cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const editing = !!entry;
  const step2 = !!cards && !editing;
  const title = editing ? "Edit entry" : step2 ? "Check the promises" : "Add a call, email or message";

  const basics = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="em-kind" label="Kind">
          <select id="em-kind" value={kind} onChange={(e) => changeKind(e.target.value as EntryKind)} className={selectCls}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {cap(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="em-dir" label="Direction">
          <select
            id="em-dir"
            value={direction}
            onChange={(e) => {
              setDirTouched(true);
              setDirection(e.target.value as Direction);
            }}
            className={selectCls}
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="em-date" label="Date">
        <input id="em-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
      </Field>
    </>
  );

  const summaryField = (
    <Field id="em-summary" label="One-line summary">
      <input id="em-summary" value={summary} maxLength={500} onChange={(e) => setSummary(e.target.value)} className={inputCls} />
    </Field>
  );
  const linkField = (
    <Field id="em-link" label="Link (optional)">
      <input id="em-link" type="url" value={link} maxLength={2000} onChange={(e) => setLink(e.target.value)} className={inputCls} />
    </Field>
  );

  const errorLine = error && (
    <p role="alert" className="text-xs text-[#ff4d8b]">
      {error}
    </p>
  );

  return (
    <ModalShell title={title} onClose={onClose} maxWidthClass="max-w-xl">
      {editing ? (
        <form onSubmit={saveEdit} className="flex flex-col gap-4">
          {basics}
          {summaryField}
          <Field id="em-people" label="People (optional)">
            <input id="em-people" value={people} maxLength={500} onChange={(e) => setPeople(e.target.value)} className={inputCls} />
          </Field>
          <Field id="em-text" label="Text of the call, email or message (optional)">
            <textarea id="em-text" rows={6} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} className={inputCls} />
          </Field>
          {linkField}
          {errorLine}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={ghostBtn}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : !step2 ? (
        <div className="flex flex-col gap-4">
          {basics}
          {summaryField}
          <Field id="em-text" label="Paste the notetaker summary, or the email or message text">
            <textarea id="em-text" rows={7} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} className={inputCls} />
          </Field>
          {linkField}
          {suggestError && (
            <p role="alert" className="text-xs text-[#ff4d8b]">
              {suggestError}
            </p>
          )}
          {errorLine}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => save(false)} disabled={busy} className={ghostBtn}>
              {pending ? "Saving…" : "Save without suggestions"}
            </button>
            <button type="button" onClick={suggest} disabled={busy} className={primaryBtn}>
              {reading ? "Reading the text…" : "Suggest promises"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {summaryField}
          <Field id="em-people" label="People">
            <input id="em-people" value={people} maxLength={500} onChange={(e) => setPeople(e.target.value)} className={inputCls} />
          </Field>
          {cards.length === 0 ? (
            <p className="text-sm text-zinc-400">No promises found in this text.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {cards.map((c, i) => (
                <SuggestionCard key={i} i={i} c={c} promises={promises} onChange={(p) => setCard(i, p)} />
              ))}
            </ul>
          )}
          {errorLine}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <button type="button" onClick={() => setCards(null)} disabled={busy} className={ghostBtn}>
              Back
            </button>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" onClick={() => save(false)} disabled={busy} className={ghostBtn}>
                Save without suggestions
              </button>
              <button type="button" onClick={() => save(true)} disabled={busy} className={primaryBtn}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function SuggestionCard({
  i,
  c,
  promises,
  onChange,
}: {
  i: number;
  c: Card;
  promises: ClientPromise[];
  onChange: (p: Partial<Card>) => void;
}) {
  const old = promises.find((p) => p.id === c.promiseId);
  const label =
    c.action === "new"
      ? "New promise"
      : c.action === "done"
        ? `Done: ${old?.what ?? c.what}`
        : `Replace: ${fmtDay(old?.dueOn ?? null)} to ${fmtDay(c.dueOn)}`;
  const id = `sg-${i}`;
  return (
    <li className="rounded-xl border border-[#2a2e34] bg-[#0b0d10]/60 p-3 flex flex-col gap-3">
      <label className="flex items-start gap-2 min-h-6 text-sm font-medium text-white">
        <input
          type="checkbox"
          checked={c.keep}
          onChange={(e) => onChange({ keep: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#bfff3a]"
        />
        <span className="min-w-0 break-words">{label}</span>
      </label>
      {c.action !== "done" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id={`${id}-who`} label="Who owes it">
            <select id={`${id}-who`} value={c.owedBy} onChange={(e) => onChange({ owedBy: e.target.value as OwedBy })} className={selectCls}>
              <option value="client">The client owes us</option>
              <option value="us">We owe the client</option>
            </select>
          </Field>
          <Field id={`${id}-due`} label="Due date (optional)">
            <input id={`${id}-due`} type="date" value={c.dueOn ?? ""} onChange={(e) => onChange({ dueOn: e.target.value || null })} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field id={`${id}-what`} label="What">
              <input id={`${id}-what`} value={c.what} maxLength={MAX_WHAT} onChange={(e) => onChange({ what: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </div>
      )}
      {c.quote && <blockquote className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400 break-words">“{c.quote}”</blockquote>}
    </li>
  );
}
