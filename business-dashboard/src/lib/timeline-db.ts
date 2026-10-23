// Client timeline reads and writes (migration 015). Plain SQL, snake_case rows mapped once.
import { getSql } from "./db";
import type { ClientPromise, Direction, EntryKind, OwedBy, Suggestion, TimelineEntry } from "./timeline";

export class TimelineConflictError extends Error {
  constructor() {
    super("Something changed on this client. Suggest again.");
    this.name = "TimelineConflictError";
  }
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = ReturnType<typeof getSql>;

const str = (v: unknown) => (v == null ? null : String(v));

function toEntry(r: Row): TimelineEntry {
  return {
    id: String(r.id),
    clientId: str(r.client_id),
    occurredOn: r.occurred_on,
    kind: r.kind,
    direction: r.direction,
    summary: r.summary,
    people: r.people,
    body: r.body,
    link: r.link,
    createdBy: r.created_by,
    created: new Date(r.created).toISOString(),
  };
}

function toPromise(r: Row): ClientPromise {
  return {
    id: String(r.id),
    clientId: str(r.client_id),
    entryId: str(r.entry_id),
    owedBy: r.owed_by,
    what: r.what,
    dueOn: r.due_on,
    status: r.status,
    replacedBy: str(r.replaced_by),
    closedOn: r.closed_on,
    closedBy: r.closed_by,
    closedEntryId: str(r.closed_entry_id),
    note: r.note,
    createdBy: r.created_by,
    created: new Date(r.created).toISOString(),
  };
}

export async function getClientTimeline(clientId: string) {
  const sql = getSql();
  const entries = await sql`
    select * from client_entries where client_id = ${clientId} order by occurred_on desc, created desc`;
  const promises = await sql`
    select * from client_promises where client_id = ${clientId} order by created`;
  return { entries: entries.map(toEntry), promises: promises.map(toPromise) };
}

/** Locks a promise and returns it only when it is open (and, if given, belongs to the client). */
async function lockOpen(tx: Db, id: string, clientId?: string): Promise<Row> {
  const [row] = await tx`select * from client_promises where id = ${id} for update`;
  if (!row || row.status !== "open" || (clientId !== undefined && String(row.client_id) !== clientId)) {
    throw new TimelineConflictError();
  }
  return row;
}

async function insertPromise(
  tx: Db,
  p: { clientId: string; entryId: string | null; owedBy: OwedBy; what: string; dueOn: string | null; createdBy: string },
): Promise<string> {
  const [row] = await tx`
    insert into client_promises (client_id, entry_id, owed_by, what, due_on, created_by)
    values (${p.clientId}, ${p.entryId}, ${p.owedBy}, ${p.what}, ${p.dueOn}, ${p.createdBy})
    returning id`;
  return String(row.id);
}

/** One transaction: the entry, then every suggestion. A stale target rolls back everything. */
export async function saveEntry(input: {
  clientId: string;
  occurredOn: string;
  kind: EntryKind;
  direction: Direction;
  summary: string;
  people: string | null;
  body: string | null;
  link: string | null;
  createdBy: string;
  suggestions: Suggestion[];
}): Promise<{ entryId: string }> {
  const sql = getSql();
  const entryId = await sql.begin(async (tx) => {
    const [e] = await tx`
      insert into client_entries (client_id, occurred_on, kind, direction, summary, people, body, link, created_by)
      values (${input.clientId}, ${input.occurredOn}, ${input.kind}, ${input.direction}, ${input.summary},
              ${input.people}, ${input.body}, ${input.link}, ${input.createdBy})
      returning id`;
    const id = String(e.id);
    for (const s of input.suggestions) {
      if (s.action === "new") {
        await insertPromise(tx as unknown as Db, {
          clientId: input.clientId, entryId: id, owedBy: s.owedBy, what: s.what, dueOn: s.dueOn, createdBy: input.createdBy,
        });
        continue;
      }
      if (!s.promiseId) throw new TimelineConflictError();
      await lockOpen(tx as unknown as Db, s.promiseId, input.clientId);
      if (s.action === "done") {
        await tx`
          update client_promises
             set status = 'done', closed_on = ${input.occurredOn}, closed_by = ${input.createdBy}, closed_entry_id = ${id}
           where id = ${s.promiseId}`;
      } else {
        const next = await insertPromise(tx as unknown as Db, {
          clientId: input.clientId, entryId: id, owedBy: s.owedBy, what: s.what, dueOn: s.dueOn, createdBy: input.createdBy,
        });
        await tx`
          update client_promises
             set status = 'replaced', replaced_by = ${next}, closed_on = ${input.occurredOn},
                 closed_by = ${input.createdBy}, closed_entry_id = ${id}
           where id = ${s.promiseId}`;
      }
    }
    return id;
  });
  return { entryId };
}

export async function createPromise(p: {
  clientId: string;
  entryId: string | null;
  owedBy: OwedBy;
  what: string;
  dueOn: string | null;
  createdBy: string;
}): Promise<{ id: string }> {
  return { id: await insertPromise(getSql(), p) };
}

export async function updatePromise(id: string, p: { owedBy: OwedBy; what: string; dueOn: string | null }): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    update client_promises set owed_by = ${p.owedBy}, what = ${p.what}, due_on = ${p.dueOn}
     where id = ${id} returning id`;
  if (!row) throw new Error(`[db] promise ${id} not found`);
}

export async function closePromise(
  id: string,
  c: { status: "done" | "dropped"; closedOn: string; closedBy: string; note: string | null },
): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await lockOpen(tx as unknown as Db, id);
    await tx`
      update client_promises
         set status = ${c.status}, closed_on = ${c.closedOn}, closed_by = ${c.closedBy}, note = ${c.note}
       where id = ${id}`;
  });
}

export async function reopenPromise(id: string): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    update client_promises
       set status = 'open', closed_on = null, closed_by = null, closed_entry_id = null, note = null, replaced_by = null
     where id = ${id} returning id`;
  if (!row) throw new Error(`[db] promise ${id} not found`);
}

export async function replacePromise(
  id: string,
  p: { owedBy: OwedBy; what: string; dueOn: string | null; closedOn: string; createdBy: string },
): Promise<{ id: string }> {
  const sql = getSql();
  const newId = await sql.begin(async (tx) => {
    const old = await lockOpen(tx as unknown as Db, id);
    const next = await insertPromise(tx as unknown as Db, {
      clientId: String(old.client_id), entryId: null, owedBy: p.owedBy, what: p.what, dueOn: p.dueOn, createdBy: p.createdBy,
    });
    await tx`
      update client_promises
         set status = 'replaced', replaced_by = ${next}, closed_on = ${p.closedOn}, closed_by = ${p.createdBy}
       where id = ${id}`;
    return next;
  });
  return { id: newId };
}

/** Reopens any promise this one replaced first, or the replaced-has-target check rejects the delete. */
export async function deletePromise(id: string): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`
      update client_promises
         set status = 'open', closed_on = null, closed_by = null, closed_entry_id = null, note = null, replaced_by = null
       where replaced_by = ${id}`;
    const [row] = await tx`delete from client_promises where id = ${id} returning id`;
    if (!row) throw new Error(`[db] promise ${id} not found`);
  });
}

export async function updateEntry(
  id: string,
  e: { occurredOn: string; kind: EntryKind; direction: Direction; summary: string; people: string | null; body: string | null; link: string | null },
): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    update client_entries
       set occurred_on = ${e.occurredOn}, kind = ${e.kind}, direction = ${e.direction}, summary = ${e.summary},
           people = ${e.people}, body = ${e.body}, link = ${e.link}
     where id = ${id} returning id`;
  if (!row) throw new Error(`[db] entry ${id} not found`);
}

export async function deleteEntry(id: string): Promise<void> {
  const sql = getSql();
  const [row] = await sql`delete from client_entries where id = ${id} returning id`;
  if (!row) throw new Error(`[db] entry ${id} not found`);
}

export async function getTimelineCounts(): Promise<Record<string, { entries: number; promises: number }>> {
  const sql = getSql();
  const rows = await sql`
    select client_id, sum(e)::int as entries, sum(p)::int as promises from (
      select client_id, 1 as e, 0 as p from client_entries where client_id is not null
      union all
      select client_id, 0, 1 from client_promises where client_id is not null
    ) t group by client_id`;
  const out: Record<string, { entries: number; promises: number }> = {};
  for (const r of rows) out[String(r.client_id)] = { entries: Number(r.entries), promises: Number(r.promises) };
  return out;
}
