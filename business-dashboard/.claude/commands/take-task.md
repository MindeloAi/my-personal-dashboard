---
description: Claim the next Pending task from the Airtable Task Board (collision-safe) and execute it end-to-end.
---

# /take-task — claim and execute one task

You are a worker terminal pulling work off the shared Task Board. Multiple terminals
may run this command at the same time, so claiming MUST be collision-safe: two
terminals must never end up working the same task.

Run everything from `business-dashboard/` (that is where `.env.local` with
`AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` lives, and where the `airtable`
dependency is installed).

## 1. Establish a unique terminal id

This id is what makes the claim verifiable. Use `$env:TASK_TERMINAL_ID` if the
user already set one; otherwise generate one and tell the user what it is:

```
term-<short-hostname>-<pid>-<4 random hex>   e.g. term-mac-48213-9f2a
```

Reuse the SAME id for the whole session (claim, work, release).

## 2. Claim a task (read-write-verify)

Airtable has no atomic conditional update, so claiming is a three-step dance that
mirrors `claimTask()` in `src/lib/airtable.ts`:

> read the row → if `Status` is `Pending`, write `Status="In Progress"` +
> `Picked Up By=<terminalId>` → **re-read** → if `Picked Up By === <terminalId>`
> the claim is yours; otherwise another terminal won the race — move to the next
> candidate.

Write this throwaway script to a TEMP path **outside the repo** (do not commit it),
substitute your terminal id, and run it with Node's env-file support. It walks the
Pending queue and stops at the first row it provably owns:

```bash
node --env-file=.env.local /tmp/claim-task.mjs "<terminalId>"
```

```js
// /tmp/claim-task.mjs  — ephemeral; never committed
import Airtable from "airtable";

const terminalId = process.argv[2];
if (!terminalId) { console.error("usage: claim-task.mjs <terminalId>"); process.exit(2); }

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);
const Tasks = base("Tasks");

// Pending queue, highest priority first.
const pending = await Tasks.select({
  filterByFormula: "{Status} = 'Pending'",
}).all();

for (const row of pending) {
  // re-read so we act on current state, not the list snapshot
  const fresh = await Tasks.find(row.id);
  if (fresh.fields["Status"] !== "Pending") continue;        // someone moved it

  await Tasks.update(row.id, { Status: "In Progress", "Picked Up By": terminalId });

  const verify = await Tasks.find(row.id);                   // verify the write is ours
  if (verify.fields["Picked Up By"] === terminalId) {
    console.log(JSON.stringify({ ok: true, id: verify.id, fields: verify.fields }));
    process.exit(0);
  }
  // lost the race on this row — try the next candidate
}
console.log(JSON.stringify({ ok: false, reason: "no-claimable-tasks" }));
```

- `ok: true` → you own `id`; its `fields` are the task payload. Proceed to step 3.
- `ok: false` → nothing to claim. Tell the user the queue is empty and stop.

(If the Airtable MCP is available you may instead perform the exact same
read → conditional write → re-read → verify sequence through MCP tools. The
algorithm is what matters, not the transport.)

## 3. Execute the task by `Kind`

Read `Title`, `Description`, `Inputs`, `Project`, and `Kind` from the claimed row,
then do the work:

- **`code`** — open the linked project's repo (`Project` → GitHub Repo URL on the
  Projects table) and implement the task there. Follow that repo's conventions.
- **`lead-gen`** — run lead research per the task brief; capture findings.
- **`client-comms`** — draft/send the client communication described.
- **`research`** — gather and synthesize the requested information.
- **`content`** — produce the requested content.
- **`ops`** — perform the operational task as written.

Keep the user informed as you go.

## 4. Finish: write results and mark Done

When the work is complete, write a concise summary to `Result Notes` and set
`Status="Done"` (run with `node --env-file=.env.local`):

```js
import Airtable from "airtable";
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);
await base("Tasks").update(process.argv[2], {
  Status: "Done",
  "Result Notes": process.argv[3],
});
```

If you cannot finish (blocked, out of scope, error you can't resolve), run
`/release-task` with this same task id so the work returns to the queue for
someone else — never leave a task stuck `In Progress`.
