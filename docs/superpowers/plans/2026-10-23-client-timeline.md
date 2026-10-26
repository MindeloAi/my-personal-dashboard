# Client timeline page implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/clients/[id]`, a per-client page that shows what each side owes and by when, the history behind it, and a paste-to-suggest flow that saves only what a founder confirms.

**Architecture:** Two new tables (migration 015) hold entries and promises. Pure date and grouping logic lives in `src/lib/timeline.ts`, SQL in `src/lib/timeline-db.ts`, and the Claude call in `src/lib/suggest.ts`. A Server Component page loads the data and hands it to one Client Component that owns the highlight state and composes the date line, the two lists, and the history.

**Tech Stack:** Next.js 16.2.4, React 19, postgres.js, zod 4, Tailwind 4, `@anthropic-ai/sdk` (new), Docker `postgres:17` for tests, `npx tsx` to run the test file.

**Spec:** `docs/superpowers/specs/2026-10-23-client-timeline-design.md`. Read it before any task. Client seed data lives outside the repository in `C:\Users\zanea\client-timeline-brainstorm\` (`seed-plan.md` and one history file per client).

## Global Constraints

Every task's requirements include these lines, copied from the spec and the repository:

- The repository is public. No client name, email, price, or history in any committed file, test, fixture, or commit message. Tests use invented clients ("Test Client A").
- Read `node_modules/next/dist/docs/` before writing the dynamic route or any Next API (`business-dashboard/AGENTS.md`). Route `params` is a Promise in this version.
- Every Server Action calls `requireAdmin()` first. The page calls `requireAdminPage()`.
- Every foreign key is `ON DELETE SET NULL`. Date columns are `date` and come back as `YYYY-MM-DD` strings.
- Both new tables: RLS on, no policies, `revoke all ... from anon, authenticated`.
- Migration number `015`. Never apply it, or any seed, to production without Zane's explicit go-ahead.
- Today is Trinidad's date: `today()` from `src/lib/subscriptions.ts`. Never `new Date().toISOString().slice(0, 10)` on the server.
- "Due soon" is 0 to 7 days ahead. Late is a due date before today.
- Pasted text is capped at 100,000 characters.
- Model `claude-opus-5-5`, `output_config.effort: "medium"`, beta `server-side-fallback-2026-07-01` with `fallbacks: "default"`.
- The page writes nothing to `invoices`, `projects`, `payments`, or any ledger table.
- Works at 390 px wide. Every date-line marker is a `button` with an `aria-label` and a hit area of at least 24 px.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

These failure modes are implied by the spec, and no task would test them by default. Each one has a test or a check in the task named:

- **A client with no entries or promises:** the page renders an empty state and a date line with no markers, from today minus 45 days to today plus 30 days. Test in Task 2 (`lineWindow` with no items). Check in Task 6 (`?empty=1`).
- **A stale dialog:** Mikkey ticks a promise while Zane's add-entry dialog still suggests **Done** for it. Save rejects the whole entry with "Something changed on this client. Suggest again." and saves nothing. Test in Task 3.
- **A promise moved twice:** A is replaced by B, then B by C. C shows "moved from" B's date, not A's. Test in Task 2 (`movedFrom`).
- **Double-clicking Save:** the Save button is disabled while the save is pending, so one click makes one entry. Check in Task 7.
- **A huge paste:** a paste over 100,000 characters is refused with "That text is too long. Paste up to 100,000 characters." before any call to Claude. Test in Task 4.

---

### Task 1: Migration 015 and the test harness

**Files:**
- Create: `business-dashboard/scripts/migrations/015_client_timeline.up.sql`
- Create: `business-dashboard/scripts/migrations/015_client_timeline.down.sql`
- Create: `business-dashboard/scripts/client-timeline.test.ts`

**Interfaces:**
- Produces: tables `client_entries` and `client_promises`, exactly as in the spec's Data section, plus `client_entries_client_idx on client_entries (client_id, occurred_on desc)` and `client_promises_client_idx on client_promises (client_id, status)`. The test file's `check(name, ok, detail?)` helper and a `reset()` that deletes from both tables and from `clients` where `name like 'Test Client%'`.

- [ ] **Step 1: Start a throwaway database**

Run:

```bash
docker run -d --name timeline-pg -e POSTGRES_PASSWORD=pg -p 55433:5432 postgres:17
docker exec timeline-pg psql -U postgres -c "create role anon; create role authenticated;"
docker exec -i timeline-pg psql -U postgres < business-dashboard/scripts/schema.sql
```

Expected: the last command ends without `ERROR`.

- [ ] **Step 2: Write the failing constraint checks**

Create `scripts/client-timeline.test.ts` with the same header comment, localhost guard, postgres.js type config, and `check()` helper as `scripts/ledger.test.ts:1-57`, pointing at port 55433. Add these checks:

- `"entry and open promise insert"`: insert a `Test Client A` client, an entry, and an open promise; both inserts succeed.
- `"open promise with closed_on is rejected"`: inserting `status 'open'` with `closed_on` set raises an error.
- `"done promise without closed_on is rejected"`.
- `"replaced promise without replaced_by is rejected"`.
- `"anon cannot read client_entries"`: `set role anon; select 1 from client_entries` raises a permission error.

End the file with `await closeDb(); await sql.end(); process.exit(failures ? 1 : 0);`.

- [ ] **Step 3: Run the checks to verify they fail**

Run: `cd business-dashboard && DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres npx tsx scripts/client-timeline.test.ts`
Expected: FAIL, `relation "client_entries" does not exist`.

- [ ] **Step 4: Write the up and down migrations**

The up file contains the spec's two `create table` statements, the two indexes, `enable row level security` on both, and `revoke all on table ... from anon, authenticated` on both. Start it with a header comment in the style of `007_subscriptions.up.sql` that explains why the tables exist, with no client names. The down file drops `client_promises`, then `client_entries`.

- [ ] **Step 5: Apply the up migration and run the checks**

Run:

```bash
cd business-dashboard
DIRECT_URL=postgres://postgres:pg@localhost:55433/postgres node scripts/run-migration.mjs scripts/migrations/015_client_timeline.up.sql
DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres npx tsx scripts/client-timeline.test.ts
```

Expected: every line starts with `PASS`, and the exit code is 0.

- [ ] **Step 6: Prove the down migration reverses it**

Run the down file with `run-migration.mjs`, confirm `\dt client_*` lists nothing, then run the up file again.
Expected: the down run succeeds and the second up run succeeds.

- [ ] **Step 7: Commit**

```bash
git add business-dashboard/scripts/migrations/015_client_timeline.*.sql business-dashboard/scripts/client-timeline.test.ts
git commit -m "feat(timeline): migration 015 for client entries and promises"
```

### Task 2: Pure timeline logic

**Files:**
- Create: `business-dashboard/src/lib/timeline.ts`
- Modify: `business-dashboard/scripts/client-timeline.test.ts`

**Interfaces:**
- Produces, all exported from `src/lib/timeline.ts`:
  - Types: `EntryKind = "call" | "meeting" | "email" | "message" | "document"`, `Direction = "received" | "sent" | "both"`, `OwedBy = "us" | "client"`, `PromiseStatus = "open" | "done" | "dropped" | "replaced"`.
  - `TimelineEntry = { id: string; clientId: string | null; occurredOn: string; kind: EntryKind; direction: Direction; summary: string; people: string | null; body: string | null; link: string | null; createdBy: string; created: string }`.
  - `ClientPromise = { id: string; clientId: string | null; entryId: string | null; owedBy: OwedBy; what: string; dueOn: string | null; status: PromiseStatus; replacedBy: string | null; closedOn: string | null; closedBy: string | null; closedEntryId: string | null; note: string | null; createdBy: string; created: string }`.
  - `UnpaidInvoice = { id: string; number: string; balance: number; dueOn: string | null }`.
  - `OwedItem = { type: "promise"; promise: ClientPromise } | { type: "invoice"; invoice: UnpaidInvoice }`.
  - `DueState = { kind: "none" | "future" | "soon" | "late"; days: number }`.
  - `LineWindow = { start: string; end: string }`.
  - `Dot = { date: string; entryIds: string[]; direction: Direction }`.
  - `Diamond = { date: string; side: OwedBy; late: boolean; promiseIds: string[]; invoiceIds: string[] }`.
  - `Lit = { entries: string[]; promises: string[]; invoices: string[] }`.
  - `addDays(day: string, n: number): string`
  - `dueState(dueOn: string | null, today: string): DueState`
  - `lineWindow(today: string, dated: { date: string; late: boolean }[]): LineWindow`
  - `pct(day: string, w: LineWindow): number` (0 to 100)
  - `groupDots(entries: TimelineEntry[], w: LineWindow): Dot[]`
  - `owedItems(promises: ClientPromise[], invoices: UnpaidInvoice[], side: OwedBy): OwedItem[]`
  - `groupDiamonds(items: OwedItem[], side: OwedBy, today: string, w: LineWindow): Diamond[]`
  - `movedFrom(p: ClientPromise, all: ClientPromise[]): string | null | undefined`
  - `litFromEntry(entryId: string, promises: ClientPromise[]): Lit`
  - `litFromItems(promiseIds: string[], invoiceIds: string[], promises: ClientPromise[]): Lit`
  - `entryTag(kind: EntryKind, direction: Direction): string`

- [ ] **Step 1: Write the failing checks**

Add a pure-logic section to the test file, with `TODAY = "2026-10-23"`:

```ts
check("due none", dueState(null, TODAY).kind === "none");
check("due today is soon", deepEq(dueState("2026-10-23", TODAY), { kind: "soon", days: 0 }));
check("due in 7 days is soon", dueState("2026-10-30", TODAY).kind === "soon");
check("due in 8 days is future", deepEq(dueState("2026-10-31", TODAY), { kind: "future", days: 8 }));
check("due yesterday is late by 1", deepEq(dueState("2026-10-22", TODAY), { kind: "late", days: 1 }));
check("window with nothing", deepEq(lineWindow(TODAY, []), { start: "2026-09-08", end: "2026-11-22" }));
check("window reaches an old late item", lineWindow(TODAY, [{ date: "2026-08-28", late: true }]).start === "2026-08-28");
check("window ends 7 days past the last due date", lineWindow(TODAY, [{ date: "2026-12-07", late: false }]).end === "2026-12-14");
check("pct of start is 0 and end is 100", pct(w.start, w) === 0 && pct(w.end, w) === 100);
check("same-day entries share a dot", groupDots([e1sent, e2received sameDay], w).length === 1);
check("mixed directions on one day are 'both'", groupDots([e1sent, e2received sameDay], w)[0].direction === "both");
check("entries before the window have no dot", groupDots([oldEntry], w).length === 0);
check("owed items sort by due date, undated last, open only", owedItems(...).map(id) deepEq ["inv-sep30", "p-nov2", "p-nodate"]);
check("same-day same-side items share a diamond", groupDiamonds(...)[0].promiseIds.length === 3);
check("a past diamond is late", groupDiamonds(...).find(d => d.date === "2026-09-30")!.late);
check("moved from the direct predecessor", movedFrom(C, [A, B, C]) === B.dueOn);
check("never moved", movedFrom(A0, [A0]) === undefined);
check("an entry lights the promises it created and closed", deepEq(litFromEntry("e6", ps).promises.sort(), ["p1", "p2", "p9"]));
check("a promise lights its source entry", litFromItems(["p1"], [], ps).entries[0] === "e6");
check("tag", entryTag("email", "received") === "Email received" && entryTag("call", "both") === "Call");
```

Build the fixtures (`e1sent`, `ps`, `A`, `B`, `C`, and so on) in the test file with invented text. `deepEq` compares with `JSON.stringify`.

- [ ] **Step 2: Run to verify the checks fail**

Run the test command from Task 1, Step 5.
Expected: FAIL, cannot find module `../src/lib/timeline`.

- [ ] **Step 3: Implement `src/lib/timeline.ts`**

Use the exact rules below. Use plain string and UTC date arithmetic (`new Date(day + "T00:00:00Z")`), never local time.

- `lineWindow`: `start = min(addDays(today, -45), earliest late date)`, `end = max(addDays(today, 30), addDays(latest date, 7))`.
- `groupDots`: group by `occurredOn`, skip dates outside the window, `direction` is the shared direction or `"both"` when they differ.
- `owedItems`: open promises with `owedBy === side`; invoices only when `side === "client"`; sort by due date ascending with `null` last, and on a tie keep promises before invoices.
- `groupDiamonds`: dated items only, inside the window, grouped by date; `late` is `date < today`.
- `movedFrom`: find the promise whose `replacedBy === p.id`. Return its `dueOn` (which may be `null`), or `undefined` when there is none.
- `litFromEntry`: the entry, plus promises whose `entryId` or `closedEntryId` is the entry.
- `litFromItems`: the given promise and invoice ids, plus each promise's `entryId` entry.
- `entryTag`: `call` gives "Call", `meeting` gives "Meeting". Otherwise the capitalised kind plus " received" or " sent", or the kind alone for `both`.

- [ ] **Step 4: Run the checks to verify they pass**

Expected: every line `PASS`.

- [ ] **Step 5: Commit**

```bash
git add business-dashboard/src/lib/timeline.ts business-dashboard/scripts/client-timeline.test.ts
git commit -m "feat(timeline): due dates, date line window, markers, and links"
```

### Task 3: Database reads and writes

**Files:**
- Create: `business-dashboard/src/lib/timeline-db.ts`
- Modify: `business-dashboard/src/lib/db.ts:106` (export `getSql`; no other change, to keep the rebase with `feat/sunday-review` small)
- Modify: `business-dashboard/scripts/client-timeline.test.ts`

**Interfaces:**
- Consumes: the types from Task 2; `getSql` from `src/lib/db.ts`.
- Produces, exported from `src/lib/timeline-db.ts`:
  - `class TimelineConflictError extends Error` with message "Something changed on this client. Suggest again."
  - `Suggestion = { action: "new" | "done" | "replace"; promiseId: string | null; owedBy: OwedBy; what: string; dueOn: string | null; quote: string }` (exported from `src/lib/timeline.ts`, add it there).
  - `getClientTimeline(clientId: string): Promise<{ entries: TimelineEntry[]; promises: ClientPromise[] }>`: entries newest first (`occurred_on desc, created desc`), promises in every status.
  - `saveEntry(input: { clientId: string; occurredOn: string; kind: EntryKind; direction: Direction; summary: string; people: string | null; body: string | null; link: string | null; createdBy: string; suggestions: Suggestion[] }): Promise<{ entryId: string }>`
  - `createPromise(p: { clientId: string; entryId: string | null; owedBy: OwedBy; what: string; dueOn: string | null; createdBy: string }): Promise<{ id: string }>`
  - `updatePromise(id: string, p: { owedBy: OwedBy; what: string; dueOn: string | null }): Promise<void>`
  - `closePromise(id: string, c: { status: "done" | "dropped"; closedOn: string; closedBy: string; note: string | null }): Promise<void>`
  - `reopenPromise(id: string): Promise<void>`
  - `replacePromise(id: string, p: { owedBy: OwedBy; what: string; dueOn: string | null; closedOn: string; createdBy: string }): Promise<{ id: string }>`
  - `deletePromise(id: string): Promise<void>`
  - `updateEntry(id: string, e: { occurredOn: string; kind: EntryKind; direction: Direction; summary: string; people: string | null; body: string | null; link: string | null }): Promise<void>`
  - `deleteEntry(id: string): Promise<void>`
  - `getTimelineCounts(): Promise<Record<string, { entries: number; promises: number }>>`

- [ ] **Step 1: Write the failing checks**

Add a database section. Call `reset()` before each group:

- `"save: new, done and replace in one entry"`: seed two open promises for `Test Client A`, then `saveEntry` with one `new`, one `done` (first), and one `replace` (second, new date `2026-11-02`). Afterwards: the first is `done` with `closed_entry_id` set to the new entry and `closed_on` set to the entry's date; the second is `replaced`, with `replaced_by` pointing at a new open promise dated `2026-11-02` whose `entry_id` is the new entry; the `new` promise exists with `entry_id` set to the new entry.
- `"save: a done target that is already closed rejects everything"`: close a promise first, then `saveEntry` with `done` on it. Expect `TimelineConflictError` with the message "Something changed on this client. Suggest again.", and the entry count is unchanged.
- `"save: a target from another client rejects everything"`: same, with a `Test Client B` promise.
- `"reopen clears closing fields and replaced_by"`.
- `"deleting a replacement reopens the promise it replaced"`.
- `"closePromise refuses a promise that is not open"`: expect `TimelineConflictError`.
- `"deleting an entry keeps its promises with empty links"`: `entry_id` and `closed_entry_id` become `null`, and the statuses are unchanged.
- `"counts per client"`: `getTimelineCounts()[clientA]` equals the inserted counts.

- [ ] **Step 2: Run to verify the checks fail**

Expected: FAIL, cannot find module `../src/lib/timeline-db`.

- [ ] **Step 3: Implement `src/lib/timeline-db.ts`**

Follow the ledger-era style of `recordPayment` (`src/lib/db.ts:1569`). Every multi-row write runs in `sql.begin`. Map snake_case rows to the Task 2 types in one `toEntry` and one `toPromise` function.

`saveEntry` runs in one transaction. It inserts the entry first. For each `done` or `replace` suggestion, it locks the target with `select ... for update` and requires `client_id = input.clientId and status = 'open'`, or it throws `TimelineConflictError`. `done` sets `status 'done'`, `closed_on = occurredOn`, `closed_by = createdBy`, and `closed_entry_id`. `replace` inserts the new promise, then closes the old one as `replaced` with `replaced_by` and the same closing fields. `deletePromise` reopens any promise whose `replaced_by = id` before it deletes, in one transaction.

- [ ] **Step 4: Run the checks to verify they pass**

Expected: every line `PASS`.

- [ ] **Step 5: Commit**

```bash
git add business-dashboard/src/lib/timeline-db.ts business-dashboard/src/lib/timeline.ts business-dashboard/src/lib/db.ts business-dashboard/scripts/client-timeline.test.ts
git commit -m "feat(timeline): entry and promise reads and writes"
```

### Task 4: The suggestion step and the Server Actions

**Files:**
- Modify: `business-dashboard/package.json` (add `@anthropic-ai/sdk`)
- Create: `business-dashboard/src/lib/suggest.ts`
- Modify: `business-dashboard/src/lib/timeline.ts` (add `SuggestionOutputSchema` and `cleanSuggestions`)
- Modify: `business-dashboard/src/app/actions.ts` (append a `// ─── Client timeline ───` section)
- Modify: `business-dashboard/.env.local.example`
- Modify: `business-dashboard/scripts/client-timeline.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces:
  - In `timeline.ts`: `SuggestionOutputSchema` (zod, snake_case, matching the spec's JSON shape exactly: `summary`, `people`, `suggestions[]` of `action`, `promise_id`, `owed_by`, `what`, `due_on`, `quote`), and `cleanSuggestions(raw: z.infer<typeof SuggestionOutputSchema>, open: ClientPromise[]): Suggestion[]`.
  - In `suggest.ts`: `SuggestResult = { ok: true; summary: string; people: string; suggestions: Suggestion[] } | { ok: false; error: string }` and `suggestPromises(input: { clientName: string; occurredOn: string; kind: EntryKind; direction: Direction; text: string; open: ClientPromise[] }): Promise<SuggestResult>`.
  - In `actions.ts`, each returning `ActionResult` (or `SuggestResult` for the first): `suggestPromisesAction({ clientId, occurredOn, kind, direction, text })`, `saveEntryAction(input without createdBy)`, `createPromiseAction`, `updatePromiseAction`, `closePromiseAction`, `reopenPromiseAction`, `replacePromiseAction`, `deletePromiseAction`, `updateEntryAction`, `deleteEntryAction`. Each stamps `createdBy` or `closedBy` from `requireAdmin().email`, validates with zod (`Day` regex for dates, `text` max 100,000), maps `TimelineConflictError` to `{ error: message }`, and calls `revalidatePath("/", "layout")` as the existing actions do.

- [ ] **Step 1: Write the failing checks**

Add these checks:

- `"clean: done with an unknown id is dropped"`.
- `"clean: replace with a closed promise's id is dropped"`.
- `"clean: new with a promise_id gets null"`.
- `"clean: a malformed due_on becomes null"` (for example, `"2 Nov"`).
- `"clean: keeps a valid replace"`, mapping `promise_id` to `promiseId`.
- `"huge paste refused before any call"`: `suggestPromises({... text: "x".repeat(100_001) })` returns `{ ok: false, error: "That text is too long. Paste up to 100,000 characters." }` with `ANTHROPIC_API_KEY` unset.
- `"no key"`: with the key unset and a short text, it returns `ok: false` and the error mentions `ANTHROPIC_API_KEY`.

- [ ] **Step 2: Run to verify the checks fail**

Expected: FAIL on the missing exports.

- [ ] **Step 3: Install the SDK and read its docs**

Run: `cd business-dashboard && npm install @anthropic-ai/sdk`
Then read the claude-api skill's `typescript/claude-api/README.md` (Refusal Fallbacks) and `tool-use.md` (JSON Outputs). Confirm in the installed SDK whether `client.beta.messages.parse` accepts `output_config.format` with `zodOutputFormat` under zod 4. If it does not, call `client.beta.messages.create` with `output_config.format = { type: "json_schema", schema: z.toJSONSchema(SuggestionOutputSchema) }` and parse the text block with the same schema.

- [ ] **Step 4: Implement `cleanSuggestions` and `suggestPromises`**

`suggestPromises` checks the length first, then the key. It sends `model: "claude-opus-5-5"`, `max_tokens: 16000`, `output_config.effort: "medium"`, `betas: ["server-side-fallback-2026-07-01"]`, and `fallbacks: "default"`. It checks `stop_reason === "refusal"` before reading content. It logs and returns `ok: false` on any error, refusal, or parse failure, and never throws. Use this system prompt verbatim:

```text
You read one interaction between Mindelo (a two-person software studio: Zane and Mikkey, "us") and a client, and list the promises it contains.

A promise is a commitment by one side to do or deliver something: "us" when Mindelo commits, "client" when the client commits.

Rules:
- Only list promises the text states. Never infer one from context.
- Resolve relative dates ("by Friday", "next week") against the interaction date given below. Assume a date falls on or after the interaction date unless the text says otherwise.
- For a range ("the week of 5 Oct", "9 to 10 Nov"), use the last day of the range and keep the range in "what".
- If no date is stated, or the date depends on something that has not happened yet ("3 weeks after approval"), set due_on to null and keep the wording in "what".
- If the text fulfils one of the open promises listed below, suggest "done" with its id.
- If the text changes the date or terms of an open promise, suggest "replace" with its id, and give the new "what" and due_on.
- Use "new" for anything else, with promise_id null.
- Quote the sentence each suggestion comes from, word for word.
- summary is one line, under 140 characters, saying what happened. people lists the names in the text.
```

The user message gives the interaction date with its weekday, the kind and direction, the client name, the open promises as `id | owed_by | what | due_on`, and then the pasted text between `<text>` and `</text>`.

- [ ] **Step 5: Write the actions and the env example**

Add the actions described in Interfaces. In `.env.local.example`, replace the stale note that says `ANTHROPIC_API_KEY` is no longer used with an `ANTHROPIC_API_KEY=` entry and a comment: used by the client timeline to suggest promises; server-only.

- [ ] **Step 6: Run the checks, the type check, and lint**

Run: the test command, then `npx tsc --noEmit` and `npm run lint` in `business-dashboard`.
Expected: every check `PASS`, and no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add business-dashboard/package.json business-dashboard/package-lock.json business-dashboard/src/lib/suggest.ts business-dashboard/src/lib/timeline.ts business-dashboard/src/app/actions.ts business-dashboard/.env.local.example business-dashboard/scripts/client-timeline.test.ts
git commit -m "feat(timeline): Claude promise suggestions and timeline actions"
```

### Task 5: The page and its layout

**Files:**
- Create: `business-dashboard/src/app/admin/clients/[id]/page.tsx`
- Create: `business-dashboard/src/app/admin/clients/[id]/timeline-view.tsx`
- Modify: `business-dashboard/src/components/dashboard/clients-list.tsx:166` (export `ClientModal`, unchanged otherwise)

**Interfaces:**
- Consumes: `getClientById`, `getProjects`, and `getInvoices` from `src/lib/db.ts`; `getClientTimeline`; the Task 2 helpers.
- Produces: `TimelineView` props `{ client: Client; projects: Project[]; entries: TimelineEntry[]; promises: ClientPromise[]; invoices: UnpaidInvoice[]; today: string }`. A highlight state `lit: Lit | null` with `light(l: Lit)` and `clear()`, passed down to the Task 6 and 7 components.

- [ ] **Step 1: Write the page**

The page awaits `params`, calls `requireAdminPage()`, and loads the client (missing client calls `notFound()`), its projects, its timeline, and its unpaid invoices. An invoice counts as unpaid when its `Client` link is this client, its `Status` is `Sent` or `Overdue`, and its balance (`Amount - Paid So Far`, as in `record-payment-modal.tsx:80`) is above zero. Set `export const dynamic = "force-dynamic"` and `export const maxDuration = 60`.

- [ ] **Step 2: Write `TimelineView`**

Lay out the header, then the date line, then the two lists (`grid-cols-1 sm:grid-cols-2`), then the history, using the panel classes from `clients-list.tsx` (`bg-[#14181d] border border-[#2a2e34] rounded-[20px]`). Use temporary placeholders for the three child components until Tasks 6 and 7 land. The header shows `Company || Name`, the contact name, the status badge, the projects with their status, **+ Add call, email or message** (opens the Task 8 dialog), and **Edit** (opens the exported `ClientModal`). An empty client shows "No calls, emails or messages yet. Add the first one."

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed, and the build lists `/admin/clients/[id]` as dynamic.

- [ ] **Step 4: Commit**

```bash
git add "business-dashboard/src/app/admin/clients/[id]" business-dashboard/src/components/dashboard/clients-list.tsx
git commit -m "feat(timeline): client timeline page and layout"
```

### Task 6: The date line

**Files:**
- Create: `business-dashboard/src/components/dashboard/timeline/date-line.tsx`
- Modify: `business-dashboard/src/app/admin/clients/[id]/timeline-view.tsx`

**Interfaces:**
- Consumes: `lineWindow`, `pct`, `groupDots`, `groupDiamonds`, `owedItems`, `litFromEntry`, `litFromItems`, `entryTag`, `dueState` from Task 2.
- Produces: `DateLine({ entries, promises, invoices, today, lit, onLight }: { ...; lit: Lit | null; onLight: (l: Lit) => void })`.

- [ ] **Step 1: Build the component**

Follow the approved prototype `C:\Users\zanea\client-timeline-brainstorm\.superpowers\brainstorm\445978-1792777371\content\layout-c-interactive.html`. Dots sit above the axis and diamonds below it, with month labels on the 1st and a **Today** line. Dot colours: received `#34d399`, sent `#60a5fa`, both `#fbbf24`. Diamond outline: client `#fbbf24`, us `#60a5fa`. Late diamonds are filled `#ff4d8b`, the dashboard's error colour. A group shows its count. Hover or focus shows a card with the date, the tag or side, and the text, clamped inside the strip. A click calls `onLight` with `litFromEntry` or `litFromItems`. A marker whose id is in `lit` scales up and shows a ring.

- [ ] **Step 2: Wire it into `TimelineView` and check it in a browser**

Create a temporary, uncommitted page at `src/app/scratch-timeline/page.tsx` that renders `TimelineView` with invented fixtures: 6 entries, 9 promises (one late, three due the same day, one undated, one replaced), and one late invoice. Add `?empty=1` to render a client with nothing. Run `npm run dev` and open it. Check hover, focus with Tab, a click on a dot, a click on a diamond, the empty client, and widths of 390 px and 1280 px.
Expected: the behaviour matches the prototype, the empty client shows its empty state and a bare line, and nothing scrolls sideways at 390 px.

- [ ] **Step 3: Commit (without the scratch page)**

```bash
git add business-dashboard/src/components/dashboard/timeline/date-line.tsx "business-dashboard/src/app/admin/clients/[id]/timeline-view.tsx"
git commit -m "feat(timeline): interactive date line"
```

### Task 7: The add-entry and promise dialogs

**Files:**
- Create: `business-dashboard/src/components/dashboard/timeline/entry-modal.tsx`
- Create: `business-dashboard/src/components/dashboard/timeline/promise-modal.tsx`
- Modify: `business-dashboard/src/app/admin/clients/[id]/timeline-view.tsx` (the header's **+ Add** opens `EntryModal`)

**Interfaces:**
- Consumes: `ModalShell` from `src/components/ui/modal-shell.tsx`; the Task 4 actions; `Suggestion` from Task 3.
- Produces: `EntryModal({ clientId, entry?, onClose })`. Without `entry` it runs the add flow; with `entry` it is an edit form with no suggestions. Also `PromiseModal({ clientId, mode: "add" | "edit" | "replace" | "drop", side?: OwedBy, promise?, onClose })`.

- [ ] **Step 1: Build `EntryModal`**

Step one of the dialog has the kind, the direction (calls and meetings default to both, emails and messages to received), the date (default today), the paste box with the label "Paste the notetaker summary, or the email or message text", and an optional link. **Suggest promises** calls `suggestPromisesAction` and shows "Reading the text…" while it runs. Step two shows the editable summary and people, and one card per suggestion with a keep box (ticked), the action label ("New promise", "Done", "Replace: [old date] to [new date]"), editable who-owes, what, and due date, and the quoted sentence in a muted block. **Save** calls `saveEntryAction` with the kept suggestions. **Save without suggestions** is always present. While a save is pending, both buttons are disabled. An `{ error }` result shows under the buttons and keeps every field.

- [ ] **Step 2: Build `PromiseModal`**

`add` and `edit` have who-owes (preset from `side` in `add`), what, and due date. `edit` shows the line "To record a date that really moved, use Replace instead." `replace` shows the old promise read-only and asks for the new what and date. `drop` asks for an optional note.

- [ ] **Step 3: Check it in the browser**

Use the scratch page from Task 6. Open each dialog at 390 px and 1280 px, double-click **Save**, and confirm the button disables. The action calls fail on the scratch page because it has no session, and the error shows in the dialog.
Expected: every dialog scrolls inside the card, and nothing is clipped.

- [ ] **Step 4: Commit**

```bash
git add business-dashboard/src/components/dashboard/timeline/entry-modal.tsx business-dashboard/src/components/dashboard/timeline/promise-modal.tsx "business-dashboard/src/app/admin/clients/[id]/timeline-view.tsx"
git commit -m "feat(timeline): add-entry flow with suggestions, and promise dialogs"
```

### Task 8: The who-owes-what lists and the history

**Files:**
- Create: `business-dashboard/src/components/dashboard/timeline/owes-list.tsx`
- Create: `business-dashboard/src/components/dashboard/timeline/history-list.tsx`
- Modify: `business-dashboard/src/app/admin/clients/[id]/timeline-view.tsx`

**Interfaces:**
- Consumes: Task 2 helpers; the Task 4 actions `closePromiseAction`, `reopenPromiseAction`, `deletePromiseAction`, and `deleteEntryAction`; Task 7's `PromiseModal` and `EntryModal`.
- Produces: `OwesList({ side, title, promises, invoices, today, lit, onLight, clientId })` and `HistoryList({ entries, promises, lit, onLight, clientId })`.

- [ ] **Step 1: Build `OwesList`**

The list shows `owedItems` for its side, with **+ Add promise** in its header (opens `PromiseModal` in `add` mode with the list's side). Each promise row has a tick box (calls `closePromiseAction` with `status "done"` and today; unticking a done row calls `reopenPromiseAction`), the text, a due label from `dueState` ("Mon 2 Nov" in grey or amber, "N days late" in `#ff4d8b`, or "no date"), and "moved from [date]" when `movedFrom` returns a value. It also has a row menu with **Edit**, **Replace**, **Drop**, and **Delete**. Invoice rows show the number, `TT$` balance, and due label, and link to `/admin/finance?client=<clientId>`. Show the first 5 items, then **Show N more**, then **Show N closed** with each closed promise's status, date, and who closed it, plus **Reopen**. A row click calls `onLight(litFromItems(...))`. A lit row gets the prototype's highlight, and a lit row hidden behind **Show more** opens the list.

- [ ] **Step 2: Build `HistoryList`**

Newest first, the last 20, then **Show older**. Each entry shows the date and weekday, `entryTag`, the summary, the people, and chips: "N promises from this" (from `entryId`), "Ticked off: [what]" (promises with `status done` and `closedEntryId`), and "Moved N dates" (`status replaced` and `closedEntryId`). A click lights it with `litFromEntry` and scrolls it into view with `block: "nearest"`. Expanding shows the full `body` with whitespace kept, the link, **Edit**, and **Delete** (deleting asks for confirmation in the page, never with `window.confirm`).

- [ ] **Step 3: Check it in the browser**

Use the scratch page from Task 6. Click rows both ways, open **Show more** and **Show closed**, open **Edit** on an entry and on a promise, and check 390 px.
Expected: the highlights match in all three parts, and the lists stack on a phone.

- [ ] **Step 4: Commit**

```bash
git add business-dashboard/src/components/dashboard/timeline/owes-list.tsx business-dashboard/src/components/dashboard/timeline/history-list.tsx "business-dashboard/src/app/admin/clients/[id]/timeline-view.tsx"
git commit -m "feat(timeline): who-owes-what lists and history"
```

### Task 9: Connect the Clients page and the sidebar

**Files:**
- Modify: `business-dashboard/src/components/dashboard/clients-list.tsx:80-91` (name opens the timeline), `:92-116` (add **Edit**), `:291-338` (delete warning)
- Modify: `business-dashboard/src/app/admin/clients/page.tsx` and `clients-view.tsx` (load and pass `getTimelineCounts()`)
- Modify: `business-dashboard/src/components/dashboard/sidebar.tsx:25` and `:83`

**Interfaces:**
- Consumes: `getTimelineCounts` from Task 3.
- Produces: `ClientsList` gains a prop `timelineCounts: Record<string, { entries: number; promises: number }>`.

- [ ] **Step 1: Make the changes**

The client name becomes a `Link` to `/admin/clients/<id>`. A new **Edit** button, styled like **Invoices**, opens `ClientModal`. The delete warning adds "and N timeline entries and N promises" to its sentence when either count is above zero. In the sidebar, an entry is active when `pathname === href || pathname.startsWith(href + "/")`, in both places that compare paths.

- [ ] **Step 2: Check it in the browser and build**

Run `npm run build`. On the scratch page, or with `npm run dev`, confirm that the Clients link stays highlighted on a sub-path. If the full admin area is reachable, also confirm that the name opens the timeline and that **Edit** opens the dialog.
Expected: the build passes.

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/src/components/dashboard/clients-list.tsx business-dashboard/src/app/admin/clients/page.tsx business-dashboard/src/app/admin/clients/clients-view.tsx business-dashboard/src/components/dashboard/sidebar.tsx
git commit -m "feat(timeline): open a client's timeline from the Clients page"
```

### Task 10: Verify the whole feature

**Files:**
- Delete: `business-dashboard/src/app/scratch-timeline/` (never committed)

- [ ] **Step 1: Run every automated check**

Run in `business-dashboard`: the timeline test command, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
Expected: all pass. Report the number of checks that passed.

- [ ] **Step 2: Make one real Claude call**

This step needs a credential. Run `ant auth status` first. If no credential is active, ask Zane for `ANTHROPIC_API_KEY`. Write a throwaway script outside the repository that calls `suggestPromises` with one real client email from the seed sources (the history files cite the transcripts that hold the pasted emails) and two invented open promises. Check that every date resolves against the entry date, that nothing is invented, and that each quote appears in the text. Report `usage.input_tokens`, `usage.output_tokens`, and the cost at US$4 and US$20 per million tokens.

- [ ] **Step 3: Delete the scratch page and confirm the tree is clean**

Run: `git status --short`
Expected: no `scratch-timeline` path, and no uncommitted change.

### Task 11: Seed files for the first two clients (local only)

**Files:**
- Create (outside the repository): `C:\Users\zanea\client-timeline-brainstorm\seed-client-1.sql` and `seed-client-2.sql`

- [ ] **Step 1: Write the seed files**

Follow `seed-plan.md`, including Zane's answers of 23 Oct. Each file is one `do $$ begin ... end $$;` block, because `run-migration.mjs` sends a file containing `$$` as one statement, and client text contains semicolons. Use literal UUIDs generated once, so promises can reference entries and `replaced_by` can reference promises. `created_by` is `zaneadams@mindelo.site`. Apply the range rule and the "(date approximate)" rule from the spec and the seed plan. At the end of each file, add a comment that lists the history rows left out and why.

- [ ] **Step 2: Dry-run against the local database**

Insert both clients locally with their real ids from `seed-plan.md`, so foreign keys resolve. Then run each file with `run-migration.mjs --dry-run` and then for real, against port 55433.
Expected: no error, and the entry and promise counts match the seed plan.

- [ ] **Step 3: Check the result on the scratch page**

Run `npm run dev` with `DATABASE_URL` pointing at port 55433, and give the scratch page a variant that loads one client with `getClientTimeline` and its unpaid invoices instead of fixtures. Compare both lists with the seed plan's "Open promises on 23 Oct", for each client. Delete the scratch page again.

Nothing in this task is committed.

## Release

Each step needs Zane's explicit go-ahead, in this order:

1. Push the branch and open a pull request into `main`.
2. Add `ANTHROPIC_API_KEY` to Vercel (Production and Preview).
3. Apply `015_client_timeline.up.sql` to production with `run-migration.mjs` (dry run first, then for real).
4. Zane checks the preview deployment signed in: add an entry, save suggestions, tick, and replace.
5. Merge. Vercel deploys `main` to mindelo.site.
6. Run both seed files against production (dry run first, then for real), and open both clients' timelines.
