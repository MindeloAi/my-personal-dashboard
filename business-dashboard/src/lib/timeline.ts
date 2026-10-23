// Pure client-timeline logic. No database, React or clock access: callers pass today in.
import { z } from "zod";

export type EntryKind = "call" | "meeting" | "email" | "message" | "document";
export type Direction = "received" | "sent" | "both";
export type OwedBy = "us" | "client";
export type PromiseStatus = "open" | "done" | "dropped" | "replaced";

export type TimelineEntry = {
  id: string;
  clientId: string | null;
  occurredOn: string;
  kind: EntryKind;
  direction: Direction;
  summary: string;
  people: string | null;
  body: string | null;
  link: string | null;
  createdBy: string;
  created: string;
};

export type ClientPromise = {
  id: string;
  clientId: string | null;
  entryId: string | null;
  owedBy: OwedBy;
  what: string;
  dueOn: string | null;
  status: PromiseStatus;
  replacedBy: string | null;
  closedOn: string | null;
  closedBy: string | null;
  closedEntryId: string | null;
  note: string | null;
  createdBy: string;
  created: string;
};

export type UnpaidInvoice = { id: string; number: string; balance: number; dueOn: string | null };
export type OwedItem = { type: "promise"; promise: ClientPromise } | { type: "invoice"; invoice: UnpaidInvoice };
export type DueState = { kind: "none" | "future" | "soon" | "late"; days: number };
export type LineWindow = { start: string; end: string };
export type Dot = { date: string; entryIds: string[]; direction: Direction };
export type Diamond = { date: string; side: OwedBy; late: boolean; promiseIds: string[]; invoiceIds: string[] };
export type Lit = { entries: string[]; promises: string[]; invoices: string[] };

const DAY_MS = 86_400_000;
const toMs = (day: string) => new Date(day + "T00:00:00Z").getTime();
const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY_MS);

export function addDays(day: string, n: number): string {
  return new Date(toMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

// Due soon is 0 to 7 days ahead; late is before today.
export function dueState(dueOn: string | null, today: string): DueState {
  if (!dueOn) return { kind: "none", days: 0 };
  const d = daysBetween(today, dueOn);
  if (d < 0) return { kind: "late", days: -d };
  return { kind: d <= 7 ? "soon" : "future", days: d };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Tue 29 Sep" from a YYYY-MM-DD string, in UTC so the day never shifts.
export function formatDay(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function lineWindow(today: string, dated: { date: string; late: boolean }[]): LineWindow {
  let start = addDays(today, -45);
  let end = addDays(today, 30);
  for (const { date, late } of dated) {
    if (late && date < start) start = date;
    const tail = addDays(date, 7);
    if (tail > end) end = tail;
  }
  return { start, end };
}

export function pct(day: string, w: LineWindow): number {
  const p = (daysBetween(w.start, day) / daysBetween(w.start, w.end)) * 100;
  return Math.min(100, Math.max(0, p));
}

const inWindow = (day: string, w: LineWindow) => day >= w.start && day <= w.end;

export function groupDots(entries: TimelineEntry[], w: LineWindow): Dot[] {
  const byDate = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    if (!inWindow(e.occurredOn, w)) continue;
    byDate.set(e.occurredOn, [...(byDate.get(e.occurredOn) ?? []), e]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, es]) => ({
      date,
      entryIds: es.map((e) => e.id),
      direction: es.every((e) => e.direction === es[0].direction) ? es[0].direction : "both",
    }));
}

const dueOf = (i: OwedItem) => (i.type === "promise" ? i.promise.dueOn : i.invoice.dueOn);

export function owedItems(promises: ClientPromise[], invoices: UnpaidInvoice[], side: OwedBy): OwedItem[] {
  const items: OwedItem[] = promises
    .filter((p) => p.status === "open" && p.owedBy === side)
    .map((promise) => ({ type: "promise" as const, promise }));
  if (side === "client") items.push(...invoices.map((invoice) => ({ type: "invoice" as const, invoice })));
  // Array.sort is stable, so promises stay ahead of invoices on a tie.
  return items.sort((a, b) => {
    const da = dueOf(a);
    const db = dueOf(b);
    if (da === db) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da < db ? -1 : 1;
  });
}

export function groupDiamonds(items: OwedItem[], side: OwedBy, today: string, w: LineWindow): Diamond[] {
  const byDate = new Map<string, Diamond>();
  for (const item of items) {
    const date = dueOf(item);
    if (!date || !inWindow(date, w)) continue;
    let d = byDate.get(date);
    if (!d) byDate.set(date, (d = { date, side, late: date < today, promiseIds: [], invoiceIds: [] }));
    if (item.type === "promise") d.promiseIds.push(item.promise.id);
    else d.invoiceIds.push(item.invoice.id);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// The due date this promise replaced: null when the old one was undated, undefined when never moved.
export function movedFrom(p: ClientPromise, all: ClientPromise[]): string | null | undefined {
  return all.find((x) => x.replacedBy === p.id)?.dueOn;
}

export function litFromEntry(entryId: string, promises: ClientPromise[]): Lit {
  return {
    entries: [entryId],
    promises: promises.filter((p) => p.entryId === entryId || p.closedEntryId === entryId).map((p) => p.id),
    invoices: [],
  };
}

export function litFromItems(promiseIds: string[], invoiceIds: string[], promises: ClientPromise[]): Lit {
  const entries = new Set<string>();
  for (const p of promises) if (promiseIds.includes(p.id) && p.entryId) entries.add(p.entryId);
  return { entries: [...entries], promises: promiseIds, invoices: invoiceIds };
}

// True when lighting `next` would change nothing, so a second click clears instead.
export function sameLit(current: Lit | null, next: Lit): boolean {
  const key = (a: string[]) => [...a].sort().join("|");
  return (
    !!current &&
    key(current.entries) === key(next.entries) &&
    key(current.promises) === key(next.promises) &&
    key(current.invoices) === key(next.invoices)
  );
}

export function entryTag(kind: EntryKind, direction: Direction): string {
  const name = kind[0].toUpperCase() + kind.slice(1);
  if (kind === "call" || kind === "meeting" || direction === "both") return name;
  return `${name} ${direction}`;
}

export type Suggestion = {
  action: "new" | "done" | "replace";
  promiseId: string | null;
  owedBy: OwedBy;
  what: string;
  dueOn: string | null;
  quote: string;
};

// What Claude returns for one interaction. Snake_case, matching the JSON the prompt asks for.
export const SuggestionOutputSchema = z.object({
  summary: z.string(),
  people: z.string(),
  suggestions: z.array(
    z.object({
      action: z.enum(["new", "done", "replace"]),
      promise_id: z.string().nullable(),
      owed_by: z.enum(["us", "client"]),
      what: z.string(),
      due_on: z.string().nullable(),
      quote: z.string(),
    }),
  ),
});

// Field limits, shared by cleanSuggestions and the save action so Claude output never fails save validation.
export const MAX_TEXT = 100_000;
export const MAX_WHAT = 1000;
export const MAX_QUOTE = 5000;
export const MAX_SUGGESTIONS = 50;
export const TEXT_TOO_LONG = "That text is too long. Paste up to 100,000 characters.";

export function textTooLong(text: string): string | null {
  return text.length > MAX_TEXT ? TEXT_TOO_LONG : null;
}

// Drops what the model got wrong instead of trusting it: a done/replace needs the id of a promise
// that is open now and not already used; new never carries an id; a due date must be YYYY-MM-DD;
// an empty "what" is dropped; long text is cut to the save limits.
export function cleanSuggestions(raw: z.infer<typeof SuggestionOutputSchema>, open: ClientPromise[]): Suggestion[] {
  const openIds = new Set(open.filter((p) => p.status === "open").map((p) => p.id));
  const used = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of raw.suggestions) {
    const what = s.what.trim().slice(0, MAX_WHAT);
    if (!what) continue;
    const dueOn = s.due_on && /^\d{4}-\d{2}-\d{2}$/.test(s.due_on) ? s.due_on : null;
    if (s.action !== "new") {
      if (!(s.promise_id && openIds.has(s.promise_id)) || used.has(s.promise_id)) continue;
      used.add(s.promise_id);
    }
    out.push({
      action: s.action,
      promiseId: s.action === "new" ? null : s.promise_id,
      owedBy: s.owed_by,
      what,
      dueOn,
      quote: s.quote.slice(0, MAX_QUOTE),
    });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}
