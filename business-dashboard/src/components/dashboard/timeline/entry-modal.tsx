"use client";

import { useId, useState } from "react";
import { saveEntryAction, suggestPromisesAction, updateEntryAction } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  formatDay,
  MAX_LINE,
  MAX_WHAT,
  textTooLong,
  type ClientPromise,
  type Direction,
  type EntryKind,
  type OwedBy,
  type Suggestion,
  type TimelineEntry,
} from "@/lib/timeline";
import { cancelBtn, ErrorLine, Field, inputCls, primaryBtn, selectCls, useSave } from "./form";

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
  const [dirTouched, setDirTouched] = useState(!!entry);
  const [date, setDate] = useState(entry?.occurredOn ?? today);
  const [summary, setSummary] = useState(entry?.summary ?? "");
  const [people, setPeople] = useState(entry?.people ?? "");
  const [text, setText] = useState(entry?.body ?? "");
  const [link, setLink] = useState(entry?.link ?? "");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [reading, setReading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [which, setWhich] = useState<"with" | "without">("with");
  const { pending, error, setError, run, busy: guardRef } = useSave(onClose);
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const busy = pending || reading;
  const tooLong = textTooLong(text);
  const blocked = busy || !!tooLong;

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
    if (guardRef.current || tooLong) return;
    setSuggestError(null);
    setError(null);
    if (!date) return setSuggestError("Pick a date.");
    if (!text.trim()) return setSuggestError("Paste some text first, or use Save without suggestions.");
    guardRef.current = true;
    setReading(true);
    try {
      const res = await suggestPromisesAction({ clientId, occurredOn: date, kind, direction, text });
      if (!res.ok) return setSuggestError(res.error);
      if (!summary.trim()) setSummary(res.summary.slice(0, MAX_LINE));
      if (!people.trim()) setPeople(res.people.slice(0, MAX_LINE));
      setCards(res.suggestions.map((s) => ({ ...s, keep: true })));
    } catch {
      setSuggestError("Could not read the text. Check your connection and try again.");
    } finally {
      guardRef.current = false;
      setReading(false);
    }
  }

  function save(withSuggestions: boolean) {
    if (guardRef.current || tooLong) return;
    setSuggestError(null);
    if (!date) return setError("Pick a date.");
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
    setWhich(withSuggestions ? "with" : "without");
    run(() => saveEntryAction({ clientId, ...common(), suggestions }), "Entry saved");
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry || guardRef.current || tooLong) return;
    if (!date) return setError("Pick a date.");
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
        <Field id={id("kind")} label="Kind">
          <select id={id("kind")} value={kind} onChange={(e) => changeKind(e.target.value as EntryKind)} className={selectCls}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {cap(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={id("dir")} label="Direction">
          <select
            id={id("dir")}
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
      <Field id={id("date")} label="Date">
        <input id={id("date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      </Field>
    </>
  );

  const summaryField = (
    <Field id={id("summary")} label="One-line summary">
      <input id={id("summary")} value={summary} maxLength={MAX_LINE} onChange={(e) => setSummary(e.target.value)} className={inputCls} />
    </Field>
  );
  const linkField = (
    <Field id={id("link")} label="Link (optional)">
      <input id={id("link")} inputMode="url" value={link} maxLength={2000} onChange={(e) => setLink(e.target.value)} className={inputCls} />
    </Field>
  );

  const errorLine = <ErrorLine text={error ?? tooLong} />;

  return (
    <ModalShell title={title} onClose={onClose} maxWidthClass="max-w-xl">
      {editing ? (
        <form onSubmit={saveEdit} className="flex flex-col gap-4">
          {basics}
          {summaryField}
          <Field id={id("people")} label="People (optional)">
            <input id={id("people")} value={people} maxLength={MAX_LINE} onChange={(e) => setPeople(e.target.value)} className={inputCls} />
          </Field>
          <Field id={id("text")} label="Text of the call, email or message (optional)">
            <textarea id={id("text")} rows={6} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
          </Field>
          {linkField}
          {errorLine}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={blocked} className={primaryBtn}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : !step2 ? (
        <div className="flex flex-col gap-4">
          {basics}
          {summaryField}
          <Field id={id("text")} label="Paste the notetaker summary, or the email or message text">
            <textarea id={id("text")} rows={7} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
          </Field>
          {linkField}
          <ErrorLine text={suggestError} />
          {errorLine}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => save(false)} disabled={blocked} className={cancelBtn}>
              {pending ? "Saving…" : "Save without suggestions"}
            </button>
            <button type="button" onClick={suggest} disabled={blocked} className={primaryBtn}>
              {reading ? "Reading the text…" : "Suggest promises"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {summaryField}
          <Field id={id("people")} label="People">
            <input id={id("people")} value={people} maxLength={MAX_LINE} onChange={(e) => setPeople(e.target.value)} className={inputCls} />
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
            <button
              type="button"
              onClick={() => {
                setCards(null);
                setPeople("");
              }}
              disabled={busy}
              className={cancelBtn}
            >
              Back
            </button>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" onClick={() => save(false)} disabled={blocked} className={cancelBtn}>
                {pending && which === "without" ? "Saving…" : "Save without suggestions"}
              </button>
              <button type="button" onClick={() => save(true)} disabled={blocked} className={primaryBtn}>
                {pending && which === "with" ? "Saving…" : "Save"}
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
  const newDay = c.dueOn ? formatDay(c.dueOn) : "no date";
  const label =
    c.action === "new"
      ? "New promise"
      : c.action === "done"
        ? `Done: ${old?.what ?? c.what}`
        : old
          ? `Replace: ${old.dueOn ? formatDay(old.dueOn) : "no date"} to ${newDay}`
          : `Replace: ${newDay}`;
  const uid = useId();
  const id = `${uid}-${i}`;
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
      {c.action === "replace" && old && <p className="text-xs text-zinc-500 break-words">Was: {old.what}</p>}
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
