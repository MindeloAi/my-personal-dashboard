# Data Cleanup and Invoice Numbering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Piece 1 of `docs/superpowers/specs/2026-10-28-dashboard-redesign-design.md`: projects can belong to a lead or be internal, leads link to clients, invoice numbers are assigned by the database, and the live data is de-duplicated and renumbered.

**Architecture:** Two migrations. `019` is generic schema (columns, the numbering trigger) and is tested against an empty throwaway Postgres. `020` is the one-time cleanup of production rows, matched by name with a guard that aborts if any match is not exactly one row; it is rehearsed against a copy of production restored into Docker. App changes map the new columns, stop forms writing invoice numbers, add a "Belongs to" selector on projects, and make lead→client conversion link the lead and move its projects in one transaction.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before touching routing), postgres.js, zod, Postgres 17 in Docker for tests, bun for test scripts.

**Working directory:** `C:\Users\taylo\mpd-money-received` (git worktree, branch `feat/dashboard-redesign`). App code is under `business-dashboard/`. All commands below run from `business-dashboard/` unless they say otherwise.

**Rules that apply throughout (repo-root `CLAUDE.md`):** never write `status = 'Paid'` from app code; money arithmetic stays in the database; never run write paths against the production `DATABASE_URL` in `.env.local`.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `scripts/migrations/019_links_and_numbering.up.sql` | create | `leads.client_id` (if missing), `projects.lead_id`, `projects.internal`, numbering trigger |
| `scripts/migrations/019_links_and_numbering.down.sql` | create | reverse of the above |
| `scripts/migrations/020_data_cleanup.up.sql` | create | one-time production fixes, renumbering, unique index |
| `scripts/migrations/020_data_cleanup.down.sql` | create | drops the unique index only (data fixes are restored from the pre-run backup) |
| `scripts/cleanup.test.ts` | create | trigger, conversion and owner-helper checks against throwaway Postgres |
| `scripts/rehearse-cleanup.sh` | create | restore a production copy into Docker, apply 019+020, print before/after |
| `src/lib/project-owner.ts` | create | pure helper: "Belongs to" select value ⇄ `Client`/`Lead`/`Internal` fields |
| `src/lib/db.ts` | modify | map new columns, drop `Invoice Number` from writes, `convertLeadToClient()` |
| `src/app/actions.ts` | modify | `convertLeadAction` |
| `src/components/dashboard/leads-table.tsx` | modify | conversion modal calls `convertLeadAction`, offers linking to an existing client |
| `src/components/dashboard/owner-select.tsx` | create | shared "Belongs to" select (`name="belongsTo"`) |
| `src/components/dashboard/project-board.tsx` | modify | "Belongs to" select in edit form |
| `src/components/dashboard/quick-actions.tsx` | modify | "Belongs to" select in new-project form; invoice number field read-only |
| `src/components/dashboard/edit-invoice-modal.tsx` | modify | invoice number read-only |
| `src/app/admin/layout.tsx`, `src/app/admin/projects/page.tsx` | modify | fetch leads and pass them to the forms |
| `docs/superpowers/specs/2026-10-28-dashboard-redesign-design.md` | modify | note the 019/020 split |

---

## Throwaway database (used by Tasks 1, 2, 3)

```bash
U=postgres://postgres:pg@localhost:55433/postgres
docker rm -f money-pg >/dev/null 2>&1
docker run -d --name money-pg -e POSTGRES_PASSWORD=pg -p 55433:5432 postgres:17 >/dev/null
for i in $(seq 1 30); do docker exec money-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 2
docker exec money-pg psql -U postgres -q -c "create role anon; create role authenticated;"
docker exec -i money-pg psql -U postgres -q -v ON_ERROR_STOP=1 < scripts/schema.sql >/dev/null
for m in 011_founder_ledger 012_founder_projection 013_cash_never_negative 015_client_timeline 016_business_cash_collections 017_change_bonus_shares 018_zane_keeps_share; do
  DIRECT_URL=$U node scripts/run-migration.mjs scripts/migrations/$m.up.sql >/dev/null || echo "FAILED $m"
done
```

If Docker is not running: `powershell.exe -NoProfile -Command 'Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"'`, then wait for `docker version` to succeed.

---

### Task 1: Migration 019 (links and numbering trigger)

**Files:**
- Create: `scripts/migrations/019_links_and_numbering.up.sql`
- Create: `scripts/migrations/019_links_and_numbering.down.sql`
- Create: `scripts/cleanup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/cleanup.test.ts`:

```ts
// cleanup.test.ts — checks for migration 019 (links, invoice numbering) and
// the lead→client conversion. Runs against a THROWAWAY database only; see the
// "Throwaway database" block in docs/superpowers/plans/2026-10-28-data-cleanup.md,
// then also apply 019:
//   DIRECT_URL=$U node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql
//   DATABASE_URL=$U bun scripts/cleanup.test.ts

import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 4, onnotice: () => {} });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function reset() {
  await sql.begin(async (tx) => {
    await tx`delete from payments`;
    await tx`delete from cash_movements where kind <> 'opening'`;
    await tx`delete from invoices`;
    await tx`delete from projects`;
    await tx`delete from leads`;
    await tx`delete from clients`;
  });
}

const inv = async (status: string, number: string | null = null) =>
  String((await sql`
    insert into invoices (invoice_number, amount, status, issue_date)
    values (${number}, 100, ${status}, '2026-10-28') returning id`)[0].id);
const numberOf = async (id: string) =>
  (await sql`select invoice_number from invoices where id = ${id}`)[0].invoice_number as string | null;

try {
  // 1 — a draft has no number; sending it assigns the next INV-####.
  await reset();
  {
    await inv("Paid", "INV-0007");
    const d = await inv("Draft");
    check("1 a draft gets no number", (await numberOf(d)) === null);
    await sql`update invoices set status = 'Sent' where id = ${d}`;
    check("  sending it assigns the next number after the highest INV-####", (await numberOf(d)) === "INV-0008", String(await numberOf(d)));
    const s = await inv("Sent");
    check("  creating one as Sent numbers it straight away", (await numberOf(s)) === "INV-0009", String(await numberOf(s)));
  }

  // 2 — numbers never change once given, even when voided.
  await reset();
  {
    const s = await inv("Sent");
    await sql`update invoices set status = 'Void' where id = ${s}`;
    check("2 voiding keeps the number", (await numberOf(s)) === "INV-0001");
    const msg = await refused(() => sql`update invoices set invoice_number = 'X-1' where id = ${s}`);
    check("  changing an issued number is refused", !!msg?.includes("already has its number"), String(msg));
    const cleared = await refused(() => sql`update invoices set invoice_number = null where id = ${s}`);
    check("  clearing it is refused too", !!cleared?.includes("already has its number"), String(cleared));
  }

  // 3 — two invoices sent at the same moment never share a number.
  await reset();
  {
    const ids = await Promise.all(Array.from({ length: 8 }, () => inv("Sent")));
    const nums = await Promise.all(ids.map(numberOf));
    check("3 eight invoices created together get eight different numbers", new Set(nums).size === 8, nums.join(","));
  }

  // 4 — the new link columns exist with the right defaults.
  await reset();
  {
    const [l] = await sql`insert into leads (name, status) values ('Test lead', 'New') returning id`;
    const [p] = await sql`insert into projects (name, lead_id) values ('Test project', ${l.id}) returning lead_id, internal, client_id`;
    check("4 a project can belong to a lead and is not internal by default",
      String(p.lead_id) === String(l.id) && p.internal === false && p.client_id === null);
    const [c] = await sql`insert into clients (name) values ('Test client') returning id`;
    await sql`update leads set client_id = ${c.id} where id = ${l.id}`;
    await sql`delete from leads where id = ${l.id}`;
    const [after] = await sql`select lead_id from projects where name = 'Test project'`;
    check("  deleting the lead leaves the project, unlinked", after.lead_id === null);
  }

  await reset();
} finally {
  await sql.end();
}

console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it to verify it fails**

Set up the throwaway database (block above), then:

```bash
DATABASE_URL=$U bun scripts/cleanup.test.ts
```

Expected: FAIL on check 1 (`sending it assigns...`), and an error on check 4 (`column "lead_id" ... does not exist`).

- [ ] **Step 3: Write migration 019**

Create `scripts/migrations/019_links_and_numbering.up.sql`:

```sql
-- 019 up  Projects can belong to a lead or be internal; leads link to clients;
-- the database numbers invoices.
--
-- Numbering: an invoice gets the next INV-#### the first time it is Sent,
-- Overdue or Paid with no number. Drafts and voided-before-sending invoices
-- stay unnumbered. Once given, a number never changes (a client holds it),
-- except during the one-time renumbering in 020, which sets
-- invoices.renumber = on for its transaction. An advisory lock serialises
-- assignment so two invoices sent together never share a number.
--
-- Contains a plpgsql body, so run-migration.mjs executes it as one statement.

-- Already in production (an earlier unmerged change); missing from schema.sql.
alter table leads add column if not exists client_id uuid references clients(id) on delete set null;

alter table projects
  add column lead_id  uuid references leads(id) on delete set null,
  add column internal boolean not null default false;
create index projects_lead_id_idx on projects (lead_id);

create function invoices_number() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and old.invoice_number is not null
     and new.invoice_number is distinct from old.invoice_number
     and coalesce(current_setting('invoices.renumber', true), '') <> 'on' then
    raise exception 'Invoice % already has its number. Numbers never change once issued.', old.invoice_number;
  end if;
  if new.invoice_number is null and new.status in ('Sent', 'Overdue', 'Paid') then
    perform pg_advisory_xact_lock(hashtext('invoices.invoice_number'));
    select 'INV-' || lpad((coalesce(max(substring(invoice_number from '^INV-([0-9]+)$')::int), 0) + 1)::text, 4, '0')
      into new.invoice_number
      from invoices;
  end if;
  return new;
end $$;

create trigger invoices_number
  before insert or update on invoices
  for each row execute function invoices_number();

revoke execute on function invoices_number() from public, anon, authenticated;
```

Create `scripts/migrations/019_links_and_numbering.down.sql`:

```sql
-- 019 down  Numbers are typed by hand again. leads.client_id is kept: it
-- existed in production before 019. Plain statements only.

drop trigger invoices_number on invoices;
drop function invoices_number();
drop index projects_lead_id_idx;
alter table projects drop column lead_id, drop column internal;
```

- [ ] **Step 4: Apply and run the test**

```bash
DIRECT_URL=$U node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql
DATABASE_URL=$U bun scripts/cleanup.test.ts
```

Expected: every line `PASS`, last line `All checks passed.`

Note on check 3: the advisory lock serialises the eight concurrent inserts. If it reports duplicate numbers, the lock is missing or taken after the `select max(...)`.

- [ ] **Step 5: Round-trip the migration**

```bash
DIRECT_URL=$U node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.down.sql
DIRECT_URL=$U node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql
DATABASE_URL=$U bun scripts/ledger.test.ts | tail -1
DATABASE_URL=$U bun scripts/export.test.ts | tail -1
```

Expected: both migrations print `Applied to schema "public".`; both test scripts print `All checks passed.` (ledger tests insert invoices with explicit `TEST-…` numbers, which the trigger leaves alone).

- [ ] **Step 6: Commit**

```bash
git add scripts/migrations/019_links_and_numbering.up.sql scripts/migrations/019_links_and_numbering.down.sql scripts/cleanup.test.ts
git commit -m "feat(db): projects link to leads or are internal; the database numbers invoices

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: db.ts mappings and lead→client conversion

**Files:**
- Modify: `src/lib/db.ts` (schemas ~L200–260, L320–340, L404–460; col maps ~L570–612; `shapeProject`, `shapeLead`; new function after `deleteLead`)
- Modify: `src/app/actions.ts` (Leads section)
- Test: `scripts/cleanup.test.ts`

- [ ] **Step 1: Write the failing test**

In `scripts/cleanup.test.ts`, add the import after `import postgres from "postgres";`:

```ts
import { convertLeadToClient, closeDb } from "../src/lib/db";
```

Add before the final `await reset();` inside `try`:

```ts
  // 5 — converting a Won lead makes (or reuses) the client, links the lead,
  // and moves the lead's projects to the client in one go.
  await reset();
  {
    const [l] = await sql`
      insert into leads (name, business_name, email, phone_whatsapp, status)
      values ('Robert', 'Aeromarine', 'r@aero.tt', '+1868', 'Won') returning id`;
    await sql`insert into projects (name, lead_id) values ('Aero site', ${l.id})`;
    const [other] = await sql`insert into clients (name) values ('Other client') returning id`;
    await sql`insert into projects (name, lead_id, client_id) values ('Aero extra', ${l.id}, ${other.id})`;
    const { clientId } = await convertLeadToClient(String(l.id), null);
    const [c] = await sql`select name, company, email, phone, status from clients where id = ${clientId}`;
    const [lead] = await sql`select client_id from leads where id = ${l.id}`;
    const [p] = await sql`select client_id, lead_id from projects where name = 'Aero site'`;
    check("5 conversion creates the client from the lead's details",
      c.name === "Robert" && c.company === "Aeromarine" && c.email === "r@aero.tt" && c.phone === "+1868" && c.status === "Active",
      JSON.stringify(c));
    check("  links the lead to it", String(lead.client_id) === clientId);
    check("  and moves the lead's projects to the client, keeping the lead as history",
      String(p.client_id) === clientId && String(p.lead_id) === String(l.id), JSON.stringify(p));
    const [px] = await sql`select client_id from projects where name = 'Aero extra'`;
    check("  a lead project already on another client stays there", String(px.client_id) === String(other.id), JSON.stringify(px));

    const again = await convertLeadToClient(String(l.id), null);
    const [{ n: n1 }] = await sql`select count(*)::int as n from clients`;
    check("  converting the same lead again reuses its client", again.clientId === clientId && n1 === 2, `${again.clientId} n=${n1}`);

    const [l2] = await sql`insert into leads (name, status) values ('Again', 'Won') returning id`;
    const reused = await convertLeadToClient(String(l2.id), clientId);
    const [{ n }] = await sql`select count(*)::int as n from clients`;
    const [lead2] = await sql`select client_id from leads where id = ${l2.id}`;
    check("  converting onto an existing client links it without creating another",
      reused.clientId === clientId && n === 2 && String(lead2.client_id) === clientId);
  }
```

And in the `finally` block, after `await sql.end();`, add:

```ts
  await closeDb();
```

- [ ] **Step 2: Run it to verify it fails**

```bash
DATABASE_URL=$U bun scripts/cleanup.test.ts
```

Expected: fails to load with `convertLeadToClient` not exported (SyntaxError / export not found).

- [ ] **Step 3: Map the new columns in `src/lib/db.ts`**

In `ProjectSchema` (the read schema, starts `export const ProjectSchema = z.object({`), after the `Client: z.array(z.string()).optional(),` line add:

```ts
  Lead: z.array(z.string()).optional(),
  Internal: z.boolean().optional(),
```

In `ProjectWriteSchema`, after its `Client: z.array(z.string()).optional(),` line add the same two lines.

In `LeadSchema`, add as its last property:

```ts
  Client: z.array(z.string()).optional(),
```

Replace:

```ts
const PROJECT_LINKS: ColMap = { Client: "client_id" };
```

with:

```ts
const PROJECT_LINKS: ColMap = { Client: "client_id", Lead: "lead_id" };
```

In `PROJECT_COLS`, after `"Tech Stack": "tech_stack",` add:

```ts
  Internal: "internal",
```

In `INVOICE_COLS`, delete the line:

```ts
  "Invoice Number": "invoice_number",
```

and in `InvoiceWriteSchema` delete the line:

```ts
  "Invoice Number": z.string().optional(),
```

(The database assigns numbers from migration 019; no form may write one.)

In `shapeProject`, after `Client: link(r.client_id),` add:

```ts
    Lead: link(r.lead_id),
    Internal: r.internal,
```

In `shapeLead` (the function that builds a lead record from a row; find it with `grep -n "function shapeLead" src/lib/db.ts`), add as its last property:

```ts
    Client: link(r.client_id),
```

- [ ] **Step 4: Add `convertLeadToClient` to `src/lib/db.ts`**

Directly after the `deleteLead` export, add:

```ts
/**
 * A Won lead becomes a client: create the client from the lead's details (or
 * use `existingClientId` when that client already represents them), link the
 * lead to it, and move every project the lead owns onto the client. lead_id
 * stays on the projects as history. One transaction.
 */
export async function convertLeadToClient(
  leadId: string,
  existingClientId: string | null,
): Promise<{ clientId: string }> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [lead] = await tx`select * from leads where id = ${leadId} for update`;
    if (!lead) throw new Error(`[db] lead ${leadId} not found`);
    // Reuse the lead's client if it has one: a lead converted twice, or pre-linked
    // by the cleanup migration, must not create a duplicate client.
    let clientId = existingClientId ?? (lead.client_id ? String(lead.client_id) : null);
    if (!clientId) {
      const [c] = await tx`
        insert into clients (name, company, email, phone, status)
        values (${lead.name}, ${lead.business_name}, ${lead.email}, ${lead.phone_whatsapp}, 'Active')
        returning id`;
      clientId = String(c.id);
    }
    await tx`update leads set client_id = ${clientId} where id = ${leadId}`;
    await tx`update projects set client_id = ${clientId} where lead_id = ${leadId} and client_id is null`;
    return { clientId };
  });
}
```

- [ ] **Step 5: Add the action in `src/app/actions.ts`**

Add `convertLeadToClient,` to the `@/lib/db` import list that contains `recordPayment`. Then after `deleteLeadAction` add:

```ts
export async function convertLeadAction(leadId: string, existingClientId: string | null) {
  await requireAdmin();
  const id = z.string().uuid().parse(leadId);
  const existing = z.string().uuid().nullable().parse(existingClientId);
  await convertLeadToClient(id, existing);
  revalidatePath("/", "layout");
}
```

- [ ] **Step 6: Run the tests and type-check**

```bash
DATABASE_URL=$U bun scripts/cleanup.test.ts
npx tsc --noEmit -p . 2>&1 | grep -v "export.test.ts\|maxByteLength"
```

Expected: `All checks passed.`; tsc prints nothing except the pre-existing `export.test.ts` Buffer error, which is filtered out. If tsc reports `"Invoice Number"` errors in `quick-actions.tsx` or `edit-invoice-modal.tsx`, that is expected and fixed in Task 4; continue.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/app/actions.ts scripts/cleanup.test.ts
git commit -m "feat(db): map lead/internal on projects and client on leads; convertLeadToClient

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: "Belongs to" selector on projects

**Files:**
- Create: `src/lib/project-owner.ts`
- Create: `src/components/dashboard/owner-select.tsx`
- Modify: `src/components/dashboard/project-board.tsx` (edit form ~L196–300)
- Modify: `src/components/dashboard/quick-actions.tsx` (new-project form ~L370–440, props ~L21)
- Modify: `src/app/admin/layout.tsx` (~L38), `src/app/admin/projects/page.tsx`
- Test: `scripts/cleanup.test.ts`

- [ ] **Step 1: Write the failing test**

In `scripts/cleanup.test.ts`, add to the imports:

```ts
import { ownerFields, ownerPatch, ownerValue } from "../src/lib/project-owner";
```

Add before the final `await reset();` inside `try`:

```ts
  // 6 — the "Belongs to" select maps onto exactly one of client / lead / internal.
  {
    const c = ownerFields("client:abc");
    const l = ownerFields("lead:def");
    const i = ownerFields("internal");
    const none = ownerFields("");
    check("6 belongs-to select sets exactly one owner",
      JSON.stringify(c) === JSON.stringify({ Client: ["abc"], Lead: [], Internal: false }) &&
      JSON.stringify(l) === JSON.stringify({ Client: [], Lead: ["def"], Internal: false }) &&
      JSON.stringify(i) === JSON.stringify({ Client: [], Lead: [], Internal: true }) &&
      JSON.stringify(none) === JSON.stringify({ Client: [], Lead: [], Internal: false }));
    check("  and reads back from a project",
      ownerValue({ Client: ["abc"], Lead: ["def"] }) === "client:abc" &&
      ownerValue({ Lead: ["def"] }) === "lead:def" &&
      ownerValue({ Internal: true }) === "internal" &&
      ownerValue({}) === "");
    const converted = { Client: ["c"], Lead: ["l"] };
    check("  an unchanged edit leaves a converted lead's lead_id alone",
      JSON.stringify(ownerPatch(converted, "client:c")) === "{}" &&
      JSON.stringify(ownerPatch(converted, "internal")) ===
        JSON.stringify({ Client: [], Lead: [], Internal: true }));
  }
```

- [ ] **Step 2: Run it to verify it fails**

```bash
DATABASE_URL=$U bun scripts/cleanup.test.ts
```

Expected: fails to load, `Cannot find module '../src/lib/project-owner'`.

- [ ] **Step 3: Create `src/lib/project-owner.ts`**

```ts
// Who a project belongs to, as one form value. Pure, shared by every project
// form. A project belongs to a client, to a lead (before there is a client),
// is internal (Mindelo's own), or is unassigned. Client wins when a converted
// lead's project has both: lead_id is kept on it as history only, so an edit
// form uses ownerPatch (sends nothing when the value is unchanged) rather than
// ownerFields (which would clear that lead_id).

export type OwnerValue = "" | "internal" | `client:${string}` | `lead:${string}`;

export function ownerFields(v: string): { Client: string[]; Lead: string[]; Internal: boolean } {
  if (v === "internal") return { Client: [], Lead: [], Internal: true };
  const [kind, id] = v.split(":");
  if (kind === "client" && id) return { Client: [id], Lead: [], Internal: false };
  if (kind === "lead" && id) return { Client: [], Lead: [id], Internal: false };
  return { Client: [], Lead: [], Internal: false };
}

export function ownerValue(p: { Client?: string[]; Lead?: string[]; Internal?: boolean }): OwnerValue {
  if (p.Client?.[0]) return `client:${p.Client[0]}`;
  if (p.Lead?.[0]) return `lead:${p.Lead[0]}`;
  if (p.Internal) return "internal";
  return "";
}

/** Edit-form patch: {} when the select is unchanged, so a converted lead's
 *  historic lead_id survives; otherwise the full ownerFields. */
export function ownerPatch(
  p: { Client?: string[]; Lead?: string[]; Internal?: boolean },
  v: string,
): Partial<ReturnType<typeof ownerFields>> {
  return v === ownerValue(p) ? {} : ownerFields(v);
}
```

- [ ] **Step 4: Run the test**

```bash
DATABASE_URL=$U bun scripts/cleanup.test.ts
```

Expected: `All checks passed.`

- [ ] **Step 5: Add a shared `OwnerSelect` and use it in both forms**

The select is UI, so it lives in its own client component `src/components/dashboard/owner-select.tsx`, imported by both forms (so the admin layout's `QuickActions` does not pull in the project board and dnd-kit). It is named `belongsTo` because both project forms already use `owner` for M/Partner/Both. Create it:

```tsx
"use client";

import type { Client, Lead } from "@/lib/airtable";

/** "Belongs to": a client, a lead (before there is a client), or internal.
 *  Named "belongsTo" because both project forms already use "owner" for M/Partner/Both. */
export function OwnerSelect({
  clients,
  leads,
  defaultValue,
  className,
}: {
  clients: Client[];
  leads: Lead[];
  defaultValue: string;
  className: string;
}) {
  const openLeads = leads.filter((l) => l.Status !== "Lost" || defaultValue === `lead:${l.id}`);
  return (
    <select name="belongsTo" defaultValue={defaultValue} className={className}>
      <option value="">— Not assigned</option>
      <option value="internal">Internal (Mindelo&apos;s own)</option>
      <optgroup label="Clients">
        {clients.map((c) => (
          <option key={c.id} value={`client:${c.id}`}>{c.Company || c.Name}</option>
        ))}
      </optgroup>
      <optgroup label="Leads (not a client yet)">
        {openLeads.map((l) => (
          <option key={l.id} value={`lead:${l.id}`}>{l["Business Name"] || l.Name}</option>
        ))}
      </optgroup>
    </select>
  );
}
```

Change the type import at L24 from:

```ts
import type { Client, Project } from "@/lib/airtable";
```

to:

```ts
import type { Client, Lead, Project } from "@/lib/airtable";
import { OwnerSelect } from "@/components/dashboard/owner-select";
import { ownerPatch, ownerValue } from "@/lib/project-owner";
```

Change the props type at L75 from:

```ts
type Props = { projects: Project[]; clients?: Client[]; initialClientId?: string | null };
```

to:

```ts
type Props = { projects: Project[]; clients?: Client[]; leads?: Lead[]; initialClientId?: string | null };
```

Thread `leads` from `ProjectBoard`'s props down to the edit modal component the same way `clients` is threaded today (search `clients={clients}` inside `project-board.tsx` and add `leads={leads}` next to each, defaulting `leads = []` wherever `clients = []` is defaulted, and add `leads: Lead[];` next to `clients: Client[];` at ~L196).

In the edit form, replace the whole `{clients.length > 0 && ( ... Client ... )}` block (~L282–297) with:

```tsx
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Belongs to</label>
              <OwnerSelect clients={clients} leads={leads} defaultValue={ownerValue(project)} className={selectCls} />
            </div>
```

In that form's submit handler, replace:

```ts
    const clientId = (fd.get("clientId") as string) || "";
```

with:

```ts
    const belongsTo = (fd.get("belongsTo") as string) || "";
```

and replace the payload line:

```ts
          Client: clientId ? [clientId] : clients.length ? [] : undefined,
```

with (`ownerPatch` sends nothing when the select is unchanged, so editing a converted lead's project keeps its historic `lead_id`):

```ts
          ...ownerPatch(project, belongsTo),
```

In `src/components/dashboard/quick-actions.tsx`: add `leads?: Lead[];` next to `clients?: Client[];` at L21 and `leads: Lead[];` next to `clients: Client[];` at ~L372; thread `leads` down like `clients`; import `type Lead` alongside `Client` and `import { OwnerSelect } from "@/components/dashboard/owner-select"; import { ownerFields } from "@/lib/project-owner";`. Replace the new-project form's Client field:

```tsx
        <Field label="Client">
          <select name="clientId" className={selectCls} defaultValue="">
            <option value="">— None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.Company || c.Name}
              </option>
            ))}
          </select>
        </Field>
```

with:

```tsx
        <Field label="Belongs to">
          <OwnerSelect clients={clients} leads={leads} defaultValue="" className={selectCls} />
        </Field>
```

and in its submit handler replace `const clientId = (fd.get("clientId") as string) || "";` with `const owner = ownerFields((fd.get("belongsTo") as string) || "");` and `Client: clientId ? [clientId] : undefined,` with `...owner,` (a new project has nothing to preserve, so the create form uses `ownerFields`).

- [ ] **Step 6: Fetch leads where the forms are rendered**

`src/app/admin/layout.tsx`: add `getLeads` to the `@/lib/db` import, change

```ts
  const [clients, projects, ledger, admin] = await Promise.all([
    getClients(),
    getProjects(),
```

to

```ts
  const [clients, projects, leads, ledger, admin] = await Promise.all([
    getClients(),
    getProjects(),
    getLeads(),
```

and pass `leads={leads}` to `<QuickActions`.

`src/app/admin/projects/page.tsx`: change the import to `import { getProjects, getClients, getLeads } from "@/lib/db";`, the fetch to

```ts
  const [projects, clients, leads] = await Promise.all([getProjects(), getClients(), getLeads()]);
  return <ProjectBoard projects={projects} clients={clients} leads={leads} initialClientId={client ?? null} />;
```

- [ ] **Step 7: Type-check and lint**

```bash
npx tsc --noEmit -p . 2>&1 | grep -v "export.test.ts\|maxByteLength"
npx eslint src/components/dashboard/owner-select.tsx src/components/dashboard/project-board.tsx src/components/dashboard/quick-actions.tsx src/lib/project-owner.ts src/app/admin/layout.tsx src/app/admin/projects/page.tsx
```

Expected: no output other than the `"Invoice Number"` errors Task 4 removes.

- [ ] **Step 8: Commit**

```bash
git add src/lib/project-owner.ts src/components/dashboard/owner-select.tsx src/components/dashboard/project-board.tsx src/components/dashboard/quick-actions.tsx src/app/admin/layout.tsx src/app/admin/projects/page.tsx scripts/cleanup.test.ts
git commit -m "feat(projects): a project belongs to a client, a lead, or is internal

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Invoice number is read-only in the forms

**Files:**
- Modify: `src/components/dashboard/quick-actions.tsx` (~L141–143, payload ~L102)
- Modify: `src/components/dashboard/edit-invoice-modal.tsx` (~L89, ~L155–157)

- [ ] **Step 1: New-invoice form**

In `quick-actions.tsx` replace:

```tsx
          <Field label="Invoice Number">
            <input name="invoiceNumber" placeholder="INV-0009" className={inputCls} />
          </Field>
```

with:

```tsx
          <Field label="Invoice Number">
            <p className={inputCls + " text-zinc-500"}>Assigned automatically when sent</p>
          </Field>
```

and delete the payload line:

```ts
          "Invoice Number": (fd.get("invoiceNumber") as string) || undefined,
```

- [ ] **Step 2: Edit-invoice form**

In `edit-invoice-modal.tsx` replace:

```tsx
              <label className="text-xs text-zinc-400">Invoice Number</label>
              <input name="invoiceNumber" defaultValue={invoice["Invoice Number"] ?? ""} className={inputCls} />
```

with:

```tsx
              <label className="text-xs text-zinc-400">Invoice Number</label>
              <p className={inputCls + " text-zinc-400"}>
                {invoice["Invoice Number"] ?? "Assigned when sent"}
              </p>
```

and delete the payload line:

```ts
          "Invoice Number": (fd.get("invoiceNumber") as string) || "",
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit -p . 2>&1 | grep -v "export.test.ts\|maxByteLength"
npx eslint src/components/dashboard/quick-actions.tsx src/components/dashboard/edit-invoice-modal.tsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/quick-actions.tsx src/components/dashboard/edit-invoice-modal.tsx
git commit -m "feat(invoices): numbers are assigned by the database, never typed

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Lead conversion links the lead and moves its projects

**Files:**
- Modify: `src/components/dashboard/leads-table.tsx` (`ConvertLeadModal`, ~L710–790; import ~L19)

- [ ] **Step 1: Replace the existing-client branch**

In `ConvertLeadModal`, replace the whole `if (existing) { return ( ... ) }` block with:

```tsx
  if (existing) {
    return (
      <ModalShell title="Link to existing client?" onClose={onClose}>
        <p className="text-sm text-zinc-300 leading-relaxed">
          <span className="font-medium text-white">{existing.Company || existing.Name}</span> already
          matches this lead. Link the lead to that client and move the lead&apos;s projects onto it?
        </p>
        <div className="flex gap-2 justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await convertLeadAction(lead.id, existing.id);
                  toast.success("Lead linked to client");
                  onClose();
                } catch {
                  toast.error("Failed to link the lead");
                }
              })
            }
            className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
          >
            {pending ? "Linking…" : "Link to client"}
          </button>
        </div>
      </ModalShell>
    );
  }
```

- [ ] **Step 2: Replace the create call**

In the same component replace:

```tsx
                await createClientAction({
                  Name: lead.Name,
                  Company: lead["Business Name"] || undefined,
                  Email: lead.Email || undefined,
                  Phone: lead["Phone/WhatsApp"] || undefined,
                  Status: "Active",
                });
```

with:

```tsx
                await convertLeadAction(lead.id, null);
```

and change the explanatory sentence `business, email and phone are copied across. The lead itself is left as it is.` to `business, email and phone are copied across, the lead is linked to the new client, and its projects move onto it.`

- [ ] **Step 3: Fix the import**

In the `@/app/actions` import at the top of `leads-table.tsx`, replace `createClientAction,` with `convertLeadAction,` (if `createClientAction` is still used elsewhere in the file, keep it and add `convertLeadAction,`; check with `grep -n createClientAction src/components/dashboard/leads-table.tsx`).

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit -p . 2>&1 | grep -v "export.test.ts\|maxByteLength"
npx eslint src/components/dashboard/leads-table.tsx
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/leads-table.tsx
git commit -m "feat(leads): winning a lead links it to the client and moves its projects

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Migration 020 (one-time production cleanup)

**Files:**
- Create: `scripts/migrations/020_data_cleanup.up.sql`
- Create: `scripts/migrations/020_data_cleanup.down.sql`

This migration only makes sense against production data. It is tested in Task 7 against a restored copy. Every record is found by name, and `pg_temp.one()` aborts the whole file if a name does not match exactly one row, so a renamed record can never be changed by mistake.

- [ ] **Step 1: Write `scripts/migrations/020_data_cleanup.up.sql`**

```sql
-- 020 up  One-time cleanup of production data (dashboard redesign, piece 1).
-- Decisions are Taylor's, recorded in
-- docs/superpowers/specs/2026-10-28-dashboard-redesign-design.md.
--
-- Every record is found by name and must match exactly one row, or the whole
-- file rolls back. Contains plpgsql, so run-migration.mjs runs it as one
-- statement. Run 019 first.

create function pg_temp.one(q text, what text) returns uuid
language plpgsql as $$
declare
  ids uuid[];
begin
  execute 'select array_agg(id) from (' || q || ') s' into ids;
  if coalesce(array_length(ids, 1), 0) <> 1 then
    raise exception 'Cleanup expected exactly one %, found %', what, coalesce(array_length(ids, 1), 0);
  end if;
  return ids[1];
end $$;

do $$
declare
  c_interior uuid := pg_temp.one($q$select id from clients where company = 'Interior Jade'$q$, 'client Interior Jade');
  c_jades    uuid := pg_temp.one($q$select id from clients where company = 'Jades Interior'$q$, 'client Jades Interior');
  l_jade     uuid := pg_temp.one($q$select id from leads where business_name = 'Jades Interior'$q$, 'lead Jades Interior');
  c_house    uuid := pg_temp.one($q$select id from clients where company = 'house hunters'$q$, 'client house hunters');
  l_house    uuid := pg_temp.one($q$select id from leads where business_name = 'house hunters'$q$, 'lead house hunters');
  c_zkn      uuid := pg_temp.one($q$select id from clients where company = 'ZKN caffe'$q$, 'client ZKN caffe');
  l_zkn      uuid := pg_temp.one($q$select id from leads where business_name = 'ZKN caffe'$q$, 'lead ZKN caffe');
  l_five     uuid := pg_temp.one($q$select id from leads where business_name = 'Five Islands'$q$, 'lead Five Islands');
  p_five     uuid := pg_temp.one($q$select id from projects where name = 'Five islands Webstite'$q$, 'project Five islands Webstite');
  p_aero     uuid := pg_temp.one($q$select id from projects where name = 'Aeromarine Ltd. Website'$q$, 'project Aeromarine Ltd. Website');
  c_gli      uuid := pg_temp.one($q$select id from clients where company = 'GLISCORE'$q$, 'client GLISCORE');
  l_gli      uuid := pg_temp.one($q$select id from leads where business_name = 'GLISCORE Industrial sourcing'$q$, 'lead GLISCORE');
  i_gli      uuid := pg_temp.one($q$select id from invoices where invoice_number = 'INV-0018'$q$, 'invoice INV-0018');
  c_taylor   uuid := pg_temp.one($q$select id from clients where company = 'Taylor Engineering'$q$, 'client Taylor Engineering');
  c_decle    uuid := pg_temp.one($q$select id from clients where company = 'Decle Realty'$q$, 'client Decle Realty');
  c_cole     uuid := pg_temp.one($q$select id from clients where company = 'COLE Safety'$q$, 'client COLE Safety');
  p_cole     uuid := pg_temp.one($q$select id from projects where name = 'Cole Saftey'$q$, 'project Cole Saftey');
  i_cole     uuid := pg_temp.one($q$select id from invoices where invoice_number = 'INV-002'$q$, 'invoice INV-002');
  leads_only uuid[];
  c          uuid;
  l_new      uuid;
  p_taylor   uuid;
  p_decle    uuid;
  n          int;
begin
  -- Jade: the empty duplicate client goes; the Won lead points at Interior Jade.
  select count(*) into n from projects where client_id = c_jades;
  if n > 0 then raise exception 'Jades Interior client unexpectedly has % projects', n; end if;
  select count(*) into n from invoices where client_id = c_jades;
  if n > 0 then raise exception 'Jades Interior client unexpectedly has % invoices', n; end if;
  update leads set client_id = c_interior where id = l_jade;
  delete from clients where id = c_jades;

  -- house hunters: keep both, linked.
  update leads set client_id = c_house where id = l_house;

  -- Collabr, Fresh Start, PBS: become leads (Contacted); projects move to the lead.
  leads_only := array[
    pg_temp.one($q$select id from clients where company = 'Collabr'$q$, 'client Collabr'),
    pg_temp.one($q$select id from clients where company = 'Fresh Start Natural Juices'$q$, 'client Fresh Start'),
    pg_temp.one($q$select id from clients where company = 'PBS'$q$, 'client PBS')
  ];
  foreach c in array leads_only loop
    insert into leads (name, business_name, email, phone_whatsapp, status, source)
    select name, company, email, phone, 'Contacted', 'Moved from client record' from clients where id = c
    returning id into l_new;
    update projects set lead_id = l_new, client_id = null where client_id = c;
  end loop;

  -- ZKN: lead only. Project to the lead; the void invoice keeps its project.
  update projects set lead_id = l_zkn, client_id = null where client_id = c_zkn;
  update invoices set client_id = null where client_id = c_zkn;
  update leads set client_id = null where id = l_zkn;
  leads_only := leads_only || c_zkn;

  -- The four client records are now empty. Refuse if anything still uses them.
  select count(*) into n from (
    select 1 from projects where client_id = any(leads_only)
    union all select 1 from invoices where client_id = any(leads_only)
    union all select 1 from subscriptions where client_id = any(leads_only)
    union all select 1 from leads where client_id = any(leads_only)
    union all select 1 from client_entries where client_id = any(leads_only)
    union all select 1 from client_promises where client_id = any(leads_only)
  ) x;
  if n > 0 then raise exception 'Clients moved to leads are still referenced by % rows', n; end if;
  delete from clients where id = any(leads_only);

  -- Five Islands: the project belongs to the lead. Typo fixed.
  update projects set lead_id = l_five, name = 'Five Islands Website' where id = p_five;

  -- Aeromarine: new Lost lead owns the cancelled project.
  insert into leads (name, business_name, status, source)
  values ('Robert Llanos', 'Aeromarine', 'Lost', 'Moved from project record')
  returning id into l_new;
  update projects set lead_id = l_new where id = p_aero;

  -- Internal projects.
  update projects set internal = true where name in ('CariPromos', 'Cruz');
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'Expected 2 internal projects, marked %', n; end if;

  -- GLISCORE: lead linked; INV-0018 gets its client from its project.
  update leads set client_id = c_gli where id = l_gli;
  update invoices set client_id = c_gli where id = i_gli;

  -- Invoices with no project.
  insert into projects (name, client_id, status) values ('Taylor Engineering Website', c_taylor, 'Done') returning id into p_taylor;
  insert into projects (name, client_id, status) values ('Decle Realty Website', c_decle, 'Done') returning id into p_decle;
  update invoices set project_id = p_taylor where client_id = c_taylor and project_id is null;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'Expected 2 Taylor Engineering invoices without a project, found %', n; end if;
  update invoices set project_id = p_decle where client_id = c_decle and project_id is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected 1 Decle Realty invoice without a project, found %', n; end if;
  update invoices set project_id = p_cole where id = i_cole;

  -- Typo.
  update projects set name = 'Cole Safety' where id = p_cole;

  -- Renumber. Issued (Sent, Overdue, Paid) → INV-0001…, voided → VOID-0001…,
  -- oldest issue date first, no date last, ties by sort_key. Old number kept
  -- as the first line of notes. Drafts untouched.
  perform set_config('invoices.renumber', 'on', true);
  with ordered as (
    select id, invoice_number as old,
           case when status = 'Void' then 'VOID-' else 'INV-' end as prefix,
           row_number() over (partition by (status = 'Void') order by issue_date nulls last, sort_key, id) as rn
      from invoices
     where status in ('Sent', 'Overdue', 'Paid', 'Void')
  )
  update invoices i
     set invoice_number = o.prefix || lpad(o.rn::text, 4, '0'),
         notes = case when o.old is null then 'Previously unnumbered.' else 'Previously issued as ' || o.old || '.' end
                 || coalesce(E'\n' || i.notes, '')
    from ordered o
   where o.id = i.id;
  perform set_config('invoices.renumber', 'off', true);
end $$;

-- From now on no two invoices share a number, ignoring case.
create unique index invoices_number_unique on invoices (lower(invoice_number));
```

- [ ] **Step 2: Write `scripts/migrations/020_data_cleanup.down.sql`**

```sql
-- 020 down  Drops the uniqueness rule only. The data fixes are not reversed
-- here: restore the rows from the backup taken just before 020 was applied
-- (scripts/rehearse-cleanup.sh writes one to ../backups/ on every run).

drop index invoices_number_unique;
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrations/020_data_cleanup.up.sql scripts/migrations/020_data_cleanup.down.sql
git commit -m "feat(db): one-time cleanup of clients, leads, projects and invoice numbers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Rehearse 019 + 020 on a copy of production

**Files:**
- Create: `scripts/rehearse-cleanup.sh`

- [ ] **Step 1: Write `scripts/rehearse-cleanup.sh`**

```bash
#!/usr/bin/env bash
# rehearse-cleanup.sh — restore a READ-ONLY dump of production into a local
# Docker Postgres, apply 019 and 020 there, and print every changed record.
# Never writes to production. Also leaves the dump in ../backups/ as the
# restore point for 020.
#
#   bash scripts/rehearse-cleanup.sh <path to .env.local that has DIRECT_URL>
set -euo pipefail
ENV_FILE="$1"
DIRECT_URL=$(grep '^DIRECT_URL=' "$ENV_FILE" | cut -d= -f2-)
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p ../backups
DUMP=../backups/prod-public-$STAMP.sql
LOCAL=postgres://postgres:pg@localhost:55434/postgres

docker run --rm postgres:17 pg_dump "$DIRECT_URL" --schema=public --no-owner --no-privileges > "$DUMP"
echo "Dump: $DUMP ($(wc -l < "$DUMP") lines)"

docker rm -f rehearse-pg >/dev/null 2>&1 || true
docker run -d --name rehearse-pg -e POSTGRES_PASSWORD=pg -p 55434:5432 postgres:17 >/dev/null
for i in $(seq 1 30); do docker exec rehearse-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 2
docker exec rehearse-pg psql -U postgres -q -c "create role anon; create role authenticated;"
# Foreign keys into Supabase's auth schema do not exist locally; those few
# statements fail and are skipped. Everything the cleanup touches restores.
docker exec -i rehearse-pg psql -U postgres -q < "$DUMP" 2>&1 | grep -v 'schema "auth" does not exist' | tail -5 || true

snapshot() {
  docker exec rehearse-pg psql -U postgres -At -F ' | ' -c "
    select 'client', coalesce(company, name), status from clients
    union all select 'lead', coalesce(business_name, name), status || ' -> client ' || coalesce((select coalesce(company, name) from clients c where c.id = l.client_id), '-') from leads l
    union all select 'project', name, coalesce((select 'client ' || coalesce(company, name) from clients c where c.id = p.client_id),
                                              (select 'lead ' || coalesce(business_name, name) from leads l where l.id = p.lead_id), '-')
                                     || case when p.internal then ' (internal)' else '' end from projects p
    union all select 'invoice', coalesce(invoice_number, '(none)'), status || ' ' || amount || ' ' || split_part(coalesce(notes, ''), E'\n', 1) from invoices
    order by 1, 2;" 2>/dev/null
}

snapshot > /tmp/rehearse-before.txt || true
DIRECT_URL=$LOCAL node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql
snapshot > /tmp/rehearse-mid.txt
DIRECT_URL=$LOCAL node scripts/run-migration.mjs scripts/migrations/020_data_cleanup.up.sql
snapshot > /tmp/rehearse-after.txt

echo; echo "===== CHANGES (- before, + after) ====="
diff /tmp/rehearse-mid.txt /tmp/rehearse-after.txt || true
echo; echo "===== CHECKS ====="
docker exec rehearse-pg psql -U postgres -At -c "
  select 'issued invoices ' || count(*) || ', numbered INV-0001..' || max(invoice_number) from invoices where status in ('Sent','Overdue','Paid');
  select 'voided invoices ' || count(*) || ', numbered ' || string_agg(invoice_number, ',' order by invoice_number) from invoices where status = 'Void';
  select 'invoices with duplicate numbers: ' || count(*) from (select lower(invoice_number) from invoices group by 1 having count(*) > 1) d;
  select 'business cash ' || (select business from business_cash) || ', total ' || (select total from business_cash);"
docker exec rehearse-pg psql -U postgres -At -c "insert into invoices (amount, status, issue_date) values (1, 'Sent', current_date) returning 'next new invoice gets ' || invoice_number;"
```

- [ ] **Step 2: Run it**

From `business-dashboard/`:

```bash
bash scripts/rehearse-cleanup.sh ../../my-personal-dashboard/business-dashboard/.env.local
```

Expected:
- Both migrations print `Applied to schema "public".`
- `CHANGES` lists: Jades Interior client gone; Collabr, Fresh Start, PBS, ZKN client rows gone and 3 new `lead` rows (Contacted) plus the Aeromarine lead (Lost); projects showing `lead …` / `(internal)` / new Taylor Engineering and Decle Realty projects; every issued invoice now `INV-00xx` with `Previously issued as …` in notes.
- `CHECKS`: `issued invoices 20, numbered INV-0001..INV-0020`; `voided invoices 3, numbered VOID-0001,VOID-0002,VOID-0003`; `invoices with duplicate numbers: 0`; business cash unchanged from production; `next new invoice gets INV-0021`.

If a `Cleanup expected exactly one …` error appears, the live data has changed since this plan was written: stop and ask Taylor about that record. Do not loosen the match.

- [ ] **Step 3: Save the report for Taylor and commit the script**

```bash
bash scripts/rehearse-cleanup.sh ../../my-personal-dashboard/business-dashboard/.env.local > ../backups/rehearsal-report.txt 2>&1
docker rm -f rehearse-pg >/dev/null
git add scripts/rehearse-cleanup.sh
git commit -m "chore(db): rehearse the cleanup on a local copy of production

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(`../backups/` sits outside the repo's `business-dashboard/`; confirm with `git status` that no dump is staged. If `backups/` shows as untracked at the repo root, add `backups/` to the repo-root `.gitignore` and commit that too.)

---

### Task 8: Full checks, spec note, PR

- [ ] **Step 1: Run everything on a fresh throwaway database**

Recreate the throwaway database (block at the top), then:

```bash
DIRECT_URL=$U node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql
DATABASE_URL=$U bun scripts/cleanup.test.ts | tail -1
DATABASE_URL=$U bun scripts/ledger.test.ts | tail -1
DATABASE_URL=$U bun scripts/export.test.ts | tail -1
bun scripts/subscriptions.test.mjs | tail -1
npx tsc --noEmit -p . 2>&1 | grep -v "export.test.ts\|maxByteLength"
npx eslint src scripts/cleanup.test.ts 2>&1 | tail -5
docker rm -f money-pg >/dev/null
```

Expected: four `All checks passed.` (or the subscriptions script's own pass line), no tsc output, no eslint errors.

- [ ] **Step 2: Dry-run both migrations against production (rolled back)**

```bash
node --env-file=../../my-personal-dashboard/business-dashboard/.env.local scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql --dry-run | tail -1
```

Expected: `Dry run complete — transaction rolled back, nothing persisted.` (020 cannot be dry-run on its own because it depends on 019's columns; the Task 7 rehearsal covers it.)

- [ ] **Step 3: Note the split in the spec**

In `docs/superpowers/specs/2026-10-28-dashboard-redesign-design.md`, replace `One migration (\`019\`) with an up and a down file. It holds both the schema changes and the one-time data fixes, so` with `Two migrations: \`019\` (schema, tested on an empty database) and \`020\` (the one-time data fixes, rehearsed on a restored copy of production). Together they are`.

```bash
git add ../docs/superpowers/specs/2026-10-28-dashboard-redesign-design.md
git commit -m "docs(spec): piece 1 ships as migrations 019 and 020

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/dashboard-redesign
gh pr create --base main --title "Redesign piece 1: data cleanup and automatic invoice numbers" --body "<summary of tasks 1-7, the rehearsal CHECKS output, and: apply 019 then 020 BEFORE merging; a merge deploys>"
```

- [ ] **Step 5: Hand over to Taylor**

Tell Taylor, with the rehearsal `CHANGES` list attached:
1. Run, in order, from `C:\Users\taylo\my-personal-dashboard\business-dashboard`:
   `node --env-file=.env.local ..\..\mpd-money-received\business-dashboard\scripts\run-migration.mjs ..\..\mpd-money-received\business-dashboard\scripts\migrations\019_links_and_numbering.up.sql`
   then the same with `020_data_cleanup.up.sql`.
2. Merge the PR.
3. The backup taken by the rehearsal is in `C:\Users\taylo\mpd-money-received\backups\`.
