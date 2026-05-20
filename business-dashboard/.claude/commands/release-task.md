---
description: Return a claimed task to the Pending queue (clears Picked Up By) so another terminal can take it.
---

# /release-task — put a claimed task back

Use this when a task you claimed via `/take-task` can't be finished — you're
blocked, it's out of scope, or you hit an error you can't resolve. It reverts the
task to `Pending` and clears the claim so another terminal can pick it up. This
mirrors `releaseTaskAction()` in `src/app/actions.ts`.

Run from `business-dashboard/` (where `.env.local` and the `airtable` dependency live).

## 1. Identify the task

Use the task id you claimed in this session. If you don't have it, list your
in-flight claims first and pick the right one:

```bash
node --env-file=.env.local /tmp/list-mine.mjs "<terminalId>"
```

```js
// /tmp/list-mine.mjs — ephemeral; never committed
import Airtable from "airtable";
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);
const rows = await base("Tasks").select({
  filterByFormula: `AND({Status} = 'In Progress', {Picked Up By} = '${process.argv[2]}')`,
}).all();
for (const r of rows) console.log(r.id, "—", r.fields["Title"]);
```

## 2. Release it

Revert `Status` to `Pending` and clear `Picked Up By` (empty string clears the
field). Optionally note why in `Result Notes`:

```bash
node --env-file=.env.local /tmp/release-task.mjs "<taskId>" "<optional reason>"
```

```js
// /tmp/release-task.mjs — ephemeral; never committed
import Airtable from "airtable";
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);
const [, , taskId, reason] = process.argv;
const fields = { Status: "Pending", "Picked Up By": "" };
if (reason) fields["Result Notes"] = `Released: ${reason}`;
await base("Tasks").update(taskId, fields);
console.log(JSON.stringify({ ok: true, id: taskId }));
```

(If the Airtable MCP is available, do the equivalent update through it instead.)

Confirm to the user that the task is back in the Pending queue.
