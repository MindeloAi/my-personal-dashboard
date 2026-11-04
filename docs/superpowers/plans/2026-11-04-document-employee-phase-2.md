# Document Employee, Phase 2 (Connector, templates, PDFs, `/doc`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a founder talk to Claude (Claude Code `/doc`, or the Claude phone app) and get branded proposals, quotes and invoices saved to the dashboard, frozen as numbered versions with a PDF in the new Mindelo logo.

**Architecture:** Migration 024 adds bank details per payee, a payee on invoice documents, and two OAuth tables. Pure rules (`lib/doc-templates.ts`, `lib/oauth.ts`) are checked by bun assert scripts; database code (`lib/documents-db.ts`, `lib/connector-db.ts`, `lib/oauth-db.ts`) is checked against the throwaway local Postgres. PDFs are drawn with `@react-pdf/renderer` (pure JS, no headless browser), stored in the private `files` bucket the first time a version is rendered, and served through an admin-only route. The connector is a remote MCP server at `/api/mcp` (`mcp-handler` 2.x) behind a small OAuth 2.1 server built into the app: founders approve Claude by signing in to the existing login page; tokens are opaque, stored hashed, and checked against `profiles` on every call. Every tool is a plain function in `lib/connector/tools.ts`, so it is tested without HTTP.

**Tech Stack:** Next.js 16.2 (read `business-dashboard/node_modules/next/dist/docs/` before writing route or page code, per `AGENTS.md`), postgres.js, `@react-pdf/renderer` 4.9, `mcp-handler` 2.3 + `@modelcontextprotocol/server` 2.x, zod 4, bun for test scripts.

**Spec:** `docs/superpowers/specs/2026-11-03-document-employee-design.md`. Phase 2 = "Connector and `/doc` skill" in its Delivery section, plus the payee bank-details table moved here from Phase 1.

**Not in this phase (say so, don't build):** `attach_file` (signed copies are attached in the dashboard, phone camera works there) and `whats_outstanding` (Phase 4). Service agreement, care plan and change request templates are Phase 3; until then those types render with the generic layout.

---

## Ground rules for every task

- Work in `C:\Users\taylo\mpd-documents` on branch **`feat/document-employee-phase-2`** (created from `feat/document-employee` in Task 0). App paths below are relative to `business-dashboard/`.
- **There is no dev database.** `.env.local` (if it exists at all) points at LIVE production. Never run a dev server, script or test with it. Database tests use the throwaway container `docs-pg` only:
  `postgres://postgres:pg@localhost:55433/postgres`. Every DB test script refuses anything that is not localhost.
- **Never apply a migration to production, never `git push`, never merge, never deploy.** Michael does those.
- The repository is **public**: no client names, prices, emails or bank details in code, tests, fixtures or commit messages. Use made-up names ("Island Bites", "Acme"). Bank details exist only in the `payee_accounts` table.
- Bank details are **never** returned by a connector tool. Tools return the payee name only.
- House style: Corporate Navy (`#0E1A2B` navy, `#1D4ED8` blue, `#1E6B3A` green, `#B23A0A` orange, `#F3F5F8` page, `#DCE1E8` borders, 4px corners), plain English. **No em dashes** in any user-facing text, PDF text or tool description.
- Every page calls `requireAdminPage()`, every server action `requireAdmin()`, every admin route handler `getAdmin()` (401 when null).
- Commit after each task, conventional message, ending with:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## File map

| File | Responsibility |
|---|---|
| `scripts/migrations/024_documents_phase_2.up.sql` / `.down.sql` | `payee_accounts`, `documents.payee`, payee frozen on signed/void, `oauth_codes`, `oauth_tokens` |
| `scripts/schema.sql` | append 024 |
| `src/lib/doc-templates.ts` + `scripts/doc-templates.test.ts` | default sections, item lines, money format, invoice type, dates |
| `src/lib/documents-db.ts` (modify) + `scripts/documents-db.test.ts` (extend) | payee on documents, bank details, invoice finalise rules, `createInvoiceFromDeal`, `setVersionPdf`, exported `logActivity` |
| `src/lib/connector-db.ts` + `scripts/connector-db.test.ts` | `findRecords`, `getClientContext`, `createClientAndProject` |
| `src/assets/pdf/*` | IBM Plex Sans TTFs, dark-ink logo |
| `src/lib/pdf/document-pdf.tsx` + `scripts/pdf.test.tsx` | the A4 layout (pure: data in, PDF out) |
| `src/lib/pdf/store.ts` | load a version's data, render, store in Storage, record `pdf_path` |
| `src/lib/storage.ts` (modify) | `uploadBytes` |
| `src/app/admin/documents/[id]/pdf/route.ts` | serve a version's PDF, or a live draft preview |
| `src/app/admin/settings/payees/page.tsx` + `payee-form.tsx` | bank details per payee |
| `src/app/documents-actions.ts` (modify) | finalise renders the PDF; payee actions |
| `src/app/admin/documents/[id]/page.tsx` + `document-actions.tsx` (modify) | PDF links, payee picker |
| `src/lib/oauth.ts` + `scripts/oauth.test.ts` | redirect allow-list, PKCE, secrets, safe `next` |
| `src/lib/oauth-db.ts` + `scripts/oauth-db.test.ts` | codes and tokens |
| `src/app/.well-known/oauth-authorization-server/route.ts` | RFC 8414 metadata |
| `src/app/.well-known/oauth-protected-resource/[[...path]]/route.ts` | RFC 9728 metadata |
| `src/app/oauth/register/route.ts`, `oauth/token/route.ts`, `oauth/authorize/page.tsx` | the OAuth server |
| `src/app/login/page.tsx` (modify) | honour `?next=` |
| `src/lib/connector/tools.ts` + `scripts/connector-tools.test.ts` | every connector tool as a plain function |
| `src/app/api/mcp/route.ts` | MCP endpoint |
| `C:\Users\taylo\.claude\skills\doc\` (outside the repo) | `/doc` skill, house style, Claude Project instructions |

Order: 0 → 1 → 2 → 3, then 4, 5 → 6 → 7, 8 → 9 → 10, then 11 → 12, then 13. Tasks 4, 5 and 8 depend only on 1–3.

---

### Task 0: Branch and dependencies

- [ ] **Step 1: Branch**

The branch was created with this plan. Confirm:

```bash
cd /c/Users/taylo/mpd-documents
git branch --show-current   # feat/document-employee-phase-2
```

- [ ] **Step 2: Install**

```bash
cd business-dashboard
npm install @react-pdf/renderer@4.9.0 mcp-handler@2.3.0 @modelcontextprotocol/server@^2.4.0
```

Then read `node_modules/mcp-handler/README.md` and `node_modules/mcp-handler/dist/index.d.ts` (`createMcpHandler` options, `withMcpAuth`, `generateProtectedResourceMetadata`) and note anything that differs from Tasks 10 and 12.

- [ ] **Step 3: Check nothing broke**

Run: `npx tsc --noEmit -p .`
Expected: only the error that was already there, in `scripts/export.test.ts(106,22)`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(documents): add react-pdf and mcp-handler for phase 2"
```

---

### Task 1: Migration 024

**Files:**
- Create: `scripts/migrations/024_documents_phase_2.up.sql`, `scripts/migrations/024_documents_phase_2.down.sql`
- Modify: `scripts/schema.sql` (append the up file's content at the end)

- [ ] **Step 1: Up migration**

`scripts/migrations/024_documents_phase_2.up.sql`:

```sql
-- 024_documents_phase_2.up.sql
--
-- Bank details per payee, the payee chosen on an invoice document, and the
-- OAuth tables behind the Claude connector (/api/mcp).
--
-- payee_accounts holds the only copy of the bank details. They appear on an
-- invoice PDF and nowhere else: no connector tool returns them.
--
-- oauth_codes / oauth_tokens hold SHA-256 hashes, never the secrets. A token
-- belongs to a profiles row; verifying it re-checks that the profile is still
-- an admin, so deleting a profile cuts Claude off at the next call.
--
-- Contains a plpgsql body, so run-migration.mjs executes it as one statement.

create table if not exists payee_accounts (
  payee          text primary key check (payee in ('michael','zane','company')),
  account_name   text not null check (length(trim(account_name)) > 0),
  bank_name      text not null check (length(trim(bank_name)) > 0),
  branch         text,
  account_number text not null check (length(trim(account_number)) > 0),
  account_type   text,
  updated_by     text not null,
  updated        timestamptz not null default now()
);

alter table documents add column if not exists payee text check (payee in ('michael','zane','company'));

-- As in 022, plus the payee: a signed or void invoice keeps who was paid.
create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
  -- A link may be cleared (ON DELETE SET NULL when the client, project, deal
  -- or invoice is deleted) but never pointed at a different record.
  if old.status in ('signed','void') and (
       (new.draft, new.title, new.type, new.payee) is distinct from (old.draft, old.title, old.type, old.payee)
       or (new.client_id  is not null and new.client_id  is distinct from old.client_id)
       or (new.project_id is not null and new.project_id is distinct from old.project_id)
       or (new.deal_id    is not null and new.deal_id    is distinct from old.deal_id)
       or (new.invoice_id is not null and new.invoice_id is distinct from old.invoice_id)) then
    raise exception 'a % document cannot be changed', old.status;
  end if;
  return new;
end $$;

create table if not exists oauth_codes (
  code_hash      text primary key,
  user_id        uuid not null,
  client_id      text not null,
  redirect_uri   text not null,
  code_challenge text not null,
  expires_at     timestamptz not null,
  used_at        timestamptz
);

create table if not exists oauth_tokens (
  token_hash text primary key,
  kind       text not null check (kind in ('access','refresh')),
  user_id    uuid not null,
  client_id  text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created    timestamptz not null default now()
);
create index if not exists oauth_tokens_user_idx on oauth_tokens (user_id);

alter table payee_accounts enable row level security;
alter table oauth_codes    enable row level security;
alter table oauth_tokens   enable row level security;
revoke all on table payee_accounts from anon, authenticated;
revoke all on table oauth_codes    from anon, authenticated;
revoke all on table oauth_tokens   from anon, authenticated;
```

- [ ] **Step 2: Down migration**

`scripts/migrations/024_documents_phase_2.down.sql`:

```sql
-- 024_documents_phase_2.down.sql
drop table if exists oauth_tokens;
drop table if exists oauth_codes;
drop table if exists payee_accounts;

create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
  if old.status in ('signed','void') and (
       (new.draft, new.title, new.type) is distinct from (old.draft, old.title, old.type)
       or (new.client_id  is not null and new.client_id  is distinct from old.client_id)
       or (new.project_id is not null and new.project_id is distinct from old.project_id)
       or (new.deal_id    is not null and new.deal_id    is distinct from old.deal_id)
       or (new.invoice_id is not null and new.invoice_id is distinct from old.invoice_id)) then
    raise exception 'a % document cannot be changed', old.status;
  end if;
  return new;
end $$;

alter table documents drop column if exists payee;
```

- [ ] **Step 3: Append to schema.sql**

Append the up file's content (from `create table if not exists payee_accounts` to the last `revoke`) to the end of `scripts/schema.sql`, under a header comment `-- ─── 024: payees, invoice payee, connector OAuth ───`. The `create or replace function` there overrides the 022 definition earlier in the file, the same way the migrations replay.

- [ ] **Step 4: Apply locally, check down/up round-trips**

`run-migration.mjs` reads `DIRECT_URL`.

```bash
export DIRECT_URL=postgres://postgres:pg@localhost:55433/postgres
node scripts/run-migration.mjs scripts/migrations/024_documents_phase_2.up.sql
node scripts/run-migration.mjs scripts/migrations/024_documents_phase_2.down.sql
node scripts/run-migration.mjs scripts/migrations/024_documents_phase_2.up.sql
DATABASE_URL=$DIRECT_URL bun scripts/documents-db.test.ts
```
Expected: all three apply without error; existing documents-db checks still pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/024_documents_phase_2.up.sql scripts/migrations/024_documents_phase_2.down.sql scripts/schema.sql
git commit -m "feat(documents): migration 024, bank details, invoice payee and connector OAuth tables"
```

---

### Task 2: Template rules, `src/lib/doc-templates.ts`

**Files:**
- Create: `src/lib/doc-templates.ts`, `scripts/doc-templates.test.ts`
- Modify: `package.json` (script `"test:doc-templates": "bun scripts/doc-templates.test.ts"`)

- [ ] **Step 1: Failing test**

`scripts/doc-templates.test.ts`:

```ts
// doc-templates.test.ts — pure rules for templates. No database.
//   bun scripts/doc-templates.test.ts
import assert from "node:assert/strict";
import { DEFAULT_SECTIONS, addDays, formatMoney, invoiceTypeFor, itemsProblem, parseItems } from "../src/lib/doc-templates";
import { missingFacts } from "../src/lib/documents";

// Defaults block finalising until filled in
assert.ok(missingFacts(DEFAULT_SECTIONS.proposal!).length > 0);
assert.ok(DEFAULT_SECTIONS.quote!.some((s) => s.key === "items"));
assert.ok(DEFAULT_SECTIONS.invoice!.some((s) => s.key === "items"));

// Items
assert.deepEqual(parseItems("Website build | 3,250.00\n\n  Hosting setup | TT$500 "), {
  items: [{ description: "Website build", amount: 3250 }, { description: "Hosting setup", amount: 500 }],
  bad: [],
});
assert.deepEqual(parseItems("no amount here").bad, ["no amount here"]);
assert.deepEqual(parseItems(" | 50").bad, ["| 50"]);
assert.deepEqual(parseItems("Thing | -5").bad, ["Thing | -5"]);
assert.equal(parseItems("A | x | 10").items[0].description, "A | x");
assert.equal(itemsProblem("A | 0.10\nB | 0.20", 0.3), null); // cents, not floats
assert.match(itemsProblem("A | 100", 150)!, /add up to TT\$100\.00 but the total is TT\$150\.00/);
assert.match(itemsProblem("", null)!, /at least one item/);
assert.match(itemsProblem("oops", null)!, /description \| amount/);
assert.equal(itemsProblem("A | 100", null), null);

// Money
assert.equal(formatMoney(6500), "TT$6,500.00");
assert.equal(formatMoney(0.5), "TT$0.50");
assert.equal(formatMoney(10, "USD"), "USD 10.00");

// Invoice types
assert.equal(invoiceTypeFor(0, 1), "one_off");
assert.equal(invoiceTypeFor(0, 2), "deposit");
assert.equal(invoiceTypeFor(1, 2), "final");
assert.equal(invoiceTypeFor(1, 3), "milestone");

// Dates
assert.equal(addDays("2026-12-25", 14), "2027-01-08");
assert.equal(addDays("2028-02-28", 1), "2028-02-29");

console.log("All doc-templates checks pass");
```

- [ ] **Step 2: Run it, see it fail**

Run: `bun scripts/doc-templates.test.ts`
Expected: FAIL, cannot find module `../src/lib/doc-templates`.

- [ ] **Step 3: Implement**

`src/lib/doc-templates.ts`:

```ts
// Pure rules for document templates: the sections a new document starts with,
// item lines on quotes and invoices, money and dates. No database, no React;
// the PDF layout is lib/pdf/document-pdf.tsx.
import type { DocType, Section } from "./documents";

export type Item = { description: string; amount: number };

/** Days from issue to due on an invoice raised from a deal. */
export const INVOICE_DUE_DAYS = 14;

/**
 * What a new document starts with. Each {{missing: …}} marker blocks
 * finalising until it is written. Types not listed start empty.
 * Proposals and quotes get their price table from the deal, so no fees section.
 */
export const DEFAULT_SECTIONS: Partial<Record<DocType, Section[]>> = {
  proposal: [
    { key: "summary", heading: "Summary", body: "{{missing: summary}}" },
    { key: "goals", heading: "Goals", body: "{{missing: goals}}" },
    { key: "scope", heading: "What we will deliver", body: "{{missing: scope}}" },
    { key: "timeline", heading: "Timeline", body: "{{missing: timeline}}" },
    { key: "next_steps", heading: "Next steps", body: "{{missing: next steps}}" },
  ],
  quote: [
    { key: "items", heading: "Items", body: "{{missing: items}}" },
    { key: "terms", heading: "Terms", body: "{{missing: terms}}" },
  ],
  invoice: [
    { key: "items", heading: "Items", body: "{{missing: items}}" },
    { key: "notes", heading: "Notes", body: "" },
  ],
};

/** One item per line, written `description | amount`. Blank lines are skipped. */
export function parseItems(body: string): { items: Item[]; bad: string[] } {
  const items: Item[] = [];
  const bad: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bar = line.lastIndexOf("|");
    const description = bar < 0 ? "" : line.slice(0, bar).trim();
    const amount = bar < 0 ? NaN : Number(line.slice(bar + 1).replace(/TT\$|\$|,|\s/g, ""));
    if (!description || !Number.isFinite(amount) || amount < 0) bad.push(line);
    else items.push({ description, amount: Math.round(amount * 100) / 100 });
  }
  return { items, bad };
}

/** Why the items cannot be finalised, or null. `total` null skips the sum check. Compared in cents. */
export function itemsProblem(body: string, total: number | null): string | null {
  const { items, bad } = parseItems(body);
  if (bad.length) return `Each item line needs "description | amount": ${bad[0]}`;
  if (items.length === 0) return "Add at least one item";
  if (total == null) return null;
  const sum = items.reduce((s, i) => s + Math.round(i.amount * 100), 0);
  return sum === Math.round(total * 100)
    ? null
    : `Items add up to ${formatMoney(sum / 100)} but the total is ${formatMoney(total)}`;
}

export function formatMoney(n: number, currency = "TTD"): string {
  const prefix = currency === "TTD" ? "TT$" : `${currency} `;
  return prefix + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** invoices.invoice_type for line `index` (0-based) of a `count`-line payment schedule. */
export function invoiceTypeFor(index: number, count: number): "one_off" | "deposit" | "milestone" | "final" {
  if (count <= 1) return "one_off";
  if (index === 0) return "deposit";
  return index === count - 1 ? "final" : "milestone";
}

/** yyyy-mm-dd plus whole days, in UTC so the date never shifts. */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run it, see it pass**

Run: `bun scripts/doc-templates.test.ts`
Expected: `All doc-templates checks pass`

- [ ] **Step 5: Commit**

```bash
git add src/lib/doc-templates.ts scripts/doc-templates.test.ts package.json
git commit -m "feat(documents): template rules for sections, items and invoice dates"
```

---

### Task 3: Database layer additions, `src/lib/documents-db.ts`

**Files:**
- Modify: `src/lib/documents-db.ts`
- Modify: `scripts/documents-db.test.ts`

Read the whole of `src/lib/documents-db.ts` first. Keep its style: plain SQL, rows mapped once, rules enforced inside `sql.begin`.

- [ ] **Step 1: Extend the test (failing)**

In `scripts/documents-db.test.ts`:

1. Add to the import list: `createInvoiceFromDeal, savePayeeAccount, getPayeeAccounts, setDocumentPayee, setVersionPdf`.
2. In `reset()`, inside the transaction and **before** `delete from documents`, nothing changes; **after** `delete from deals` add:
   ```ts
   await tx`delete from invoices where project_id in (select id from projects where name like 'TEST %')`;
   await tx`delete from payee_accounts`;
   ```
   (If an invoice trigger blocks deleting numbered invoices, disable it for the wipe like the others and say so in your report.)
3. Before the `// Lists and activity` block, insert:

```ts
  // Invoices from the deal (Task 3, phase 2)
  const inv = await createInvoiceFromDeal({ projectId, line: 1, payee: "michael", dueDate: null }, ME);
  const [invRow] = await sql`select amount, status, invoice_type, issue_date, due_date, invoice_number from invoices where id = ${inv.invoiceId}`;
  check("invoice drafted from schedule line 1", Number(invRow.amount) === 3250 && invRow.status === "Draft" && invRow.invoice_type === "deposit" && invRow.invoice_number === null);
  const daysToDue = (new Date(invRow.due_date).getTime() - new Date(invRow.issue_date).getTime()) / 86_400_000;
  check("due 14 days after issue", daysToDue === 14, String(daysToDue));
  check("invoice document carries the payee and the link", inv.document.type === "invoice" && inv.document.payee === "michael" && inv.document.invoiceId === inv.invoiceId && inv.document.title === "Invoice: Payment 1");
  await rejects("the same schedule line cannot be invoiced twice", () =>
    createInvoiceFromDeal({ projectId, line: 1, payee: "michael", dueDate: null }, ME), /already/);
  await rejects("a line that does not exist is refused", () =>
    createInvoiceFromDeal({ projectId, line: 9, payee: "zane", dueDate: null }, ME), /line 9/);
  await rejects("finalising without bank details is refused", () => finaliseDocument(inv.document.id, ME), /Bank details/);
  await savePayeeAccount({ payee: "michael", accountName: "TEST Account", bankName: "TEST Bank", branch: null, accountNumber: "000", accountType: null }, ME);
  check("bank details saved", (await getPayeeAccounts()).length === 1);
  const invV1 = await finaliseDocument(inv.document.id, ME);
  const [sentRow] = await sql`select status, invoice_number from invoices where id = ${inv.invoiceId}`;
  check("finalising the invoice document issues the invoice", invV1.version === 1 && sentRow.status === "Sent" && /^INV-\d{4,}$/.test(sentRow.invoice_number), JSON.stringify(sentRow));
  check("issuing is logged on the invoice", (await getEntityActivity("invoice", inv.invoiceId)).some((a) => a.action === "sent"));
  await rejects("payee cannot change once finalised", () => setDocumentPayee(inv.document.id, "zane", ME), /draft/);

  const inv2 = await createInvoiceFromDeal({ projectId, line: 2, payee: "zane", dueDate: "2027-01-31" }, ME);
  await setDocumentPayee(inv2.document.id, "michael", ME);
  check("payee can change on a draft", (await getDocument(inv2.document.id))?.payee === "michael");
  await saveDraftSections(inv2.document.id, [{ key: "items", heading: "Items", body: "Handover | 1" }], ME);
  await rejects("items that do not add up to the invoice are refused", () => finaliseDocument(inv2.document.id, ME), /add up/);

  check("setVersionPdf records the path once", (await setVersionPdf(inv.document.id, 1, "document/x/v1.pdf")) === true);
  check("a second setVersionPdf is a no-op", (await setVersionPdf(inv.document.id, 1, "document/x/other.pdf")) === false);
```

4. After the existing `"a signed document cannot be moved to another project"` check, add:
```ts
  await rejects("a signed document's payee cannot change", () =>
    sql`update documents set payee = 'zane' where id = ${doc.id}`, /cannot be changed/);
```
5. Change `check("listDocuments by client", (await listDocuments({ clientId })).length === 2);` to `=== 4` (two invoice documents were added; the project's client is the same client).

Run: `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/documents-db.test.ts`
Expected: FAIL (missing exports).

- [ ] **Step 2: Implement**

In `src/lib/documents-db.ts`:

(a) Imports: add `PAYEE_LABEL` to the `./documents` import, and add
```ts
import { INVOICE_DUE_DAYS, addDays, invoiceTypeFor, itemsProblem } from "./doc-templates";
import { today } from "./subscriptions";
```

(b) `Doc` type gains `payee: Payee | null;` and `toDoc` gains `payee: r.payee ?? null,`.

(c) Rename the private `log` to `logActivity`, export it, and update every call site in the file:
```ts
export async function logActivity(tx: Db, a: { entityType: string; entityId: string; action: string; summary: string; actor: string; via: Via }) {
```
Also export the `Db` and `Via` types (`export type Db = …`, `export type Via = …`).

(d) `createDocument` input gains `payee?: Payee | null`; the insert adds the `payee` column with `${input.payee ?? null}`.

(e) Add after `setDocumentStatus`:

```ts
/** Who is being paid on an invoice document. Only while it is a draft: the bank details on a finalised PDF never change. */
export async function setDocumentPayee(id: string, payee: Payee, actor: string, via: Via = "dashboard"): Promise<Doc> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (doc.type !== "invoice") throw new DocumentRuleError("Only invoices have a payee");
    if (doc.status !== "draft") throw new DocumentRuleError("Change the payee while the invoice is a draft");
    const [row] = await tx`
      update documents set payee = ${payee}, updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${id} returning *`;
    await logActivity(tx, { entityType: "document", entityId: id, action: "payee", summary: `${doc.title}: paid to ${PAYEE_LABEL[payee]}`, actor, via });
    return toDoc(row);
  });
}

/** Record where a version's PDF is stored. Only the first call writes; returns whether it did. */
export async function setVersionPdf(documentId: string, version: number, path: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    update document_versions set pdf_path = ${path}
     where document_id = ${documentId} and version = ${version} and pdf_path is null returning id`;
  return rows.length === 1;
}
```

(f) Template rules on finalise. Add a helper above `finaliseDocument`:

```ts
/** Rules a template adds on top of "nothing missing". Runs inside the finalise transaction. */
async function checkTemplate(tx: Db, doc: Doc): Promise<void> {
  const items = doc.draft.find((s) => s.key === "items");
  if (doc.type === "quote" && items) {
    const p = itemsProblem(items.body, null);
    if (p) throw new DocumentRuleError(p);
  }
  if (doc.type !== "invoice") return;
  if (!doc.invoiceId) throw new DocumentRuleError("This invoice document is not linked to an invoice");
  if (!doc.payee) throw new DocumentRuleError("Choose who is being paid (Michael, Zane or the company account) first");
  const [acct] = await tx`select 1 from payee_accounts where payee = ${doc.payee}`;
  if (!acct) throw new DocumentRuleError(`Bank details for ${PAYEE_LABEL[doc.payee]} are not saved yet (Documents, Bank details)`);
  const [inv] = await tx`select amount, status from invoices where id = ${doc.invoiceId} for update`;
  if (!inv) throw new DocumentRuleError("The linked invoice no longer exists");
  if (inv.status === "Void") throw new DocumentRuleError("The linked invoice is void");
  if (inv.amount == null) throw new DocumentRuleError("The linked invoice has no amount");
  if (items) {
    const p = itemsProblem(items.body, Number(inv.amount));
    if (p) throw new DocumentRuleError(p);
  }
}
```

In `finaliseDocument`, after the `missing` check add `await checkTemplate(tx, doc);`, and after the `update documents set status = 'finalised' …` statement add:

```ts
    // A finalised invoice is the one the client receives, so it needs its number.
    // The database numbers an invoice the first time it is Sent (migration 019).
    if (doc.type === "invoice" && doc.invoiceId) {
      const [issued] = await tx`
        update invoices set status = 'Sent' where id = ${doc.invoiceId} and status = 'Draft' returning invoice_number`;
      if (issued) await logActivity(tx, {
        entityType: "invoice", entityId: doc.invoiceId, action: "sent",
        summary: `${issued.invoice_number} issued with ${doc.title}`, actor, via,
      });
    }
```

(g) Bank details. Add a section `// ─── Bank details ───` with:

```ts
export type PayeeAccount = {
  payee: Payee;
  accountName: string;
  bankName: string;
  branch: string | null;
  accountNumber: string;
  accountType: string | null;
  updatedBy: string;
  updated: string;
};
export type PayeeAccountInput = Omit<PayeeAccount, "updatedBy" | "updated">;

function toPayeeAccount(r: Row): PayeeAccount {
  return {
    payee: r.payee, accountName: r.account_name, bankName: r.bank_name, branch: r.branch,
    accountNumber: r.account_number, accountType: r.account_type, updatedBy: r.updated_by, updated: iso(r.updated),
  };
}

export async function getPayeeAccounts(): Promise<PayeeAccount[]> {
  const sql = getSql();
  return (await sql`select * from payee_accounts order by payee`).map(toPayeeAccount);
}

export async function getPayeeAccount(payee: Payee): Promise<PayeeAccount | null> {
  const sql = getSql();
  const [row] = await sql`select * from payee_accounts where payee = ${payee}`;
  return row ? toPayeeAccount(row) : null;
}

/** Not written to the activity log: the log appears on client pages and must never hold bank details. */
export async function savePayeeAccount(a: PayeeAccountInput, actor: string): Promise<PayeeAccount> {
  const sql = getSql();
  const [row] = await sql`
    insert into payee_accounts (payee, account_name, bank_name, branch, account_number, account_type, updated_by)
    values (${a.payee}, ${a.accountName.trim()}, ${a.bankName.trim()}, ${a.branch?.trim() || null},
            ${a.accountNumber.trim()}, ${a.accountType?.trim() || null}, ${actor})
    on conflict (payee) do update set
      account_name = excluded.account_name, bank_name = excluded.bank_name, branch = excluded.branch,
      account_number = excluded.account_number, account_type = excluded.account_type,
      updated_by = excluded.updated_by, updated = now()
    returning *`;
  return toPayeeAccount(row);
}
```

(h) Invoice from deal. Add after the bank details section:

```ts
/**
 * Draft an invoice for one line of a project's payment schedule (1-based),
 * plus its invoice document. The invoice stays a Draft (unnumbered) until the
 * document is finalised. Bonus shares are left unset: founders set them on the
 * invoice before any payment, as with every other draft.
 */
export async function createInvoiceFromDeal(
  input: { projectId: string; line: number; payee: Payee; dueDate: string | null },
  actor: string,
  via: Via = "dashboard",
): Promise<{ invoiceId: string; document: Doc }> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [d] = await tx`
      select d.*, p.client_id as project_client from deals d join projects p on p.id = d.project_id
       where d.project_id = ${input.projectId} for update of d`;
    if (!d) throw new DocumentRuleError("That project has no deal yet");
    const deal = toDeal(d);
    const line = deal.paymentSchedule[input.line - 1];
    if (!line) throw new DocumentRuleError(`The deal has no payment line ${input.line} (it has ${deal.paymentSchedule.length})`);
    const title = `Invoice: ${line.label}`;
    const [dupe] = await tx`
      select id from documents where deal_id = ${deal.id} and type = 'invoice' and title = ${title} and status <> 'void'`;
    if (dupe) throw new DocumentRuleError(`${title} already exists (document ${dupe.id})`);

    const issued = today();
    const [inv] = await tx`
      insert into invoices (project_id, amount, invoice_type, status, issue_date, due_date, notes)
      values (${input.projectId}, ${line.amount}, ${invoiceTypeFor(input.line - 1, deal.paymentSchedule.length)}, 'Draft',
              ${issued}, ${input.dueDate ?? addDays(issued, INVOICE_DUE_DAYS)}, ${`${deal.reference} ${line.label}`})
      returning id`;
    const invoiceId = String(inv.id);
    await logActivity(tx, { entityType: "invoice", entityId: invoiceId, action: "created", summary: `Draft invoice for ${deal.reference} ${line.label}`, actor, via });

    const [row] = await tx`
      insert into documents (type, title, client_id, project_id, deal_id, invoice_id, payee, draft, created_by, updated_by, updated_via)
      values ('invoice', ${title}, ${d.project_client}, ${input.projectId}, ${deal.id}, ${invoiceId}, ${input.payee},
              ${tx.json([
                { key: "items", heading: "Items", body: `${line.label} (${deal.reference}) | ${line.amount.toFixed(2)}` },
                { key: "notes", heading: "Notes", body: line.trigger ? `${line.trigger}.` : "" },
              ])}, ${actor}, ${actor}, ${via})
      returning *`;
    const document = toDoc(row);
    await logActivity(tx, { entityType: "document", entityId: document.id, action: "created", summary: `${title} drafted`, actor, via });
    return { invoiceId, document };
  });
}
```

- [ ] **Step 3: Run the tests**

Run: `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/documents-db.test.ts`
Expected: every line PASS, `All documents-db checks pass`.
Also: `npx tsc --noEmit -p .` shows only the old `export.test.ts` error. The UI files that build a `Doc` by hand (if any) need `payee`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/documents-db.ts scripts/documents-db.test.ts
git commit -m "feat(documents): bank details, invoice payee and invoices drafted from a deal"
```

---

### Task 4: Connector reads and new records, `src/lib/connector-db.ts`

**Files:**
- Create: `src/lib/connector-db.ts`, `scripts/connector-db.test.ts`
- Modify: `package.json` (`"test:connector-db": "bun scripts/connector-db.test.ts"`)

- [ ] **Step 1: Failing test**

`scripts/connector-db.test.ts`:

```ts
// connector-db.test.ts — search, client context and new client/project, against
// the THROWAWAY local database only (container docs-pg).
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/connector-db.test.ts
import postgres from "postgres";
import { createClientAndProject, findRecords, getClientContext } from "../src/lib/connector-db";
import { DocumentRuleError } from "../src/lib/documents-db";
import { closeDb } from "../src/lib/db";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const ME = "founder@example.com";
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}

async function reset() {
  await sql.begin(async (tx) => {
    await tx`alter table activity disable trigger activity_append_only`;
    await tx`delete from activity`;
    await tx`delete from deals where reference like 'TB-%' or reference like 'TA-%'`;
    await tx`delete from projects where name like 'TEST %'`;
    await tx`delete from leads where name like 'TEST %'`;
    await tx`delete from clients where name like 'TEST %'`;
    await tx`alter table activity enable trigger activity_append_only`;
  });
}

try {
  await reset();
  const made = await createClientAndProject(
    { name: "TEST Andrea", company: "TEST Bites", email: "andrea@example.com", phone: null, asLead: false, projectName: "TEST Bites site" },
    ME,
  );
  check("client, project and empty deal created", !!made.clientId && !!made.projectId && /^TB-\d{4}-01$/.test(made.reference), made.reference);
  const [deal] = await sql`select price_total, payment_schedule from deals where project_id = ${made.projectId}`;
  check("the deal starts empty", deal.price_total === null && deal.payment_schedule.length === 0);

  try {
    await createClientAndProject({ name: "TEST andrea", company: null, email: null, phone: null, asLead: false, projectName: "TEST Other" }, ME);
    check("a duplicate client is refused", false, "did not throw");
  } catch (e) {
    check("a duplicate client is refused", e instanceof DocumentRuleError && /already/.test(e.message), String(e));
  }

  const lead = await createClientAndProject(
    { name: "TEST Lead Person", company: "TEST Acme", email: null, phone: null, asLead: true, projectName: "TEST Acme app" },
    ME,
  );
  const [leadRow] = await sql`select status from leads where id = ${lead.leadId}`;
  const [leadProject] = await sql`select lead_id, client_id, status from projects where id = ${lead.projectId}`;
  check("a lead gets a lead, a project on the lead, and a deal", leadRow?.status === "New" && String(leadProject.lead_id) === lead.leadId && leadProject.client_id === null && /^TA-\d{4}-01$/.test(lead.reference), lead.reference);

  const hits = await findRecords("test bit");
  check("find matches clients and projects by name, case-insensitive", hits.some((h) => h.kind === "client" && h.id === made.clientId) && hits.some((h) => h.kind === "project" && h.id === made.projectId));
  check("find matches a deal reference and returns its project id", (await findRecords(made.reference)).some((h) => h.kind === "deal" && h.id === made.projectId));
  check("find treats % as a literal", (await findRecords("%%")).length === 0);
  check("find ignores one-letter queries", (await findRecords("a")).length === 0);

  const ctx = await getClientContext(made.clientId);
  check("client context has the project with its deal", ctx?.projects.length === 1 && ctx.projects[0].deal?.reference === made.reference);
  check("client context has the activity", (ctx?.activity.length ?? 0) >= 3);
  check("unknown client gives null", (await getClientContext("00000000-0000-0000-0000-000000000000")) === null);
} finally {
  await reset();
  await sql.end();
  await closeDb();
}
console.log(failures ? `\n${failures} FAILED` : "\nAll connector-db checks pass");
process.exit(failures ? 1 : 0);
```

Run: `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/connector-db.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 2: Implement**

First read `suggestPrefix` and `nextReference` in `src/lib/documents.ts` and confirm their signatures (`suggestPrefix(name: string): string`, `nextReference(prefix: string, year: number, taken: string[]): string`). If they differ, adapt the calls below, not the functions.

`src/lib/connector-db.ts`:

```ts
// What the Claude connector reads and creates beyond documents-db.ts: search
// across records, everything about one client, and a new client or lead with
// its project and an empty deal. Reuses db.ts and documents-db.ts loaders
// rather than writing new queries for the same data.
import { getClientById, getInvoices, getProjects, getSql } from "./db";
import {
  DocumentRuleError,
  getClientActivity,
  getDealsForClient,
  listDocuments,
  logActivity,
  type Via,
} from "./documents-db";
import { nextReference, suggestPrefix } from "./documents";

export type Hit = { kind: "client" | "lead" | "project" | "deal" | "document"; id: string; name: string; detail: string };

/** Up to ten of each kind whose name (or deal reference) contains the query. A deal's id is its project's id. */
export async function findRecords(query: string): Promise<Hit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const sql = getSql();
  const rows = await sql`
    (select 'client' as kind, id, name, coalesce(company, '') as detail from clients
      where name ilike ${like} or company ilike ${like} limit 10)
    union all
    (select 'lead', id, name, coalesce(business_name, '') || ' (' || coalesce(status, 'New') || ')' from leads
      where name ilike ${like} or business_name ilike ${like} limit 10)
    union all
    (select 'project', id, name, coalesce(status, '') from projects where name ilike ${like} limit 10)
    union all
    (select 'deal', d.project_id, d.reference, coalesce(p.name, '') from deals d join projects p on p.id = d.project_id
      where d.reference ilike ${like} limit 10)
    union all
    (select 'document', id, title, type || ', ' || status from documents where title ilike ${like} limit 10)`;
  return rows.map((r) => ({ kind: r.kind, id: String(r.id), name: r.name, detail: r.detail }));
}

/** One client with projects (and each project's deal), documents, invoices and recent activity. Null if unknown. */
export async function getClientContext(clientId: string) {
  const client = await getClientById(clientId);
  if (!client) return null;
  const [projects, invoices, deals, documents, activity] = await Promise.all([
    getProjects(),
    getInvoices(),
    getDealsForClient(clientId),
    listDocuments({ clientId }),
    getClientActivity(clientId, 15),
  ]);
  return {
    client,
    projects: projects
      .filter((p) => p.Client?.[0] === clientId)
      .map((p) => ({ ...p, deal: deals.find((d) => d.projectId === p.id) ?? null })),
    documents: documents.map(({ draft: _draft, ...d }) => d), // eslint-disable-line @typescript-eslint/no-unused-vars
    invoices: invoices.filter((i) => i.Client?.[0] === clientId),
    activity,
  };
}

/**
 * A new client (or lead) with one project and an empty deal, in one transaction.
 * Refuses a name or company that already exists, so Claude finds it instead of
 * making a duplicate. The project starts at status Lead; founders move it on.
 */
export async function createClientAndProject(
  input: { name: string; company: string | null; email: string | null; phone: string | null; asLead: boolean; projectName: string },
  actor: string,
  via: Via = "dashboard",
): Promise<{ clientId: string | null; leadId: string | null; projectId: string; reference: string }> {
  const name = input.name.trim();
  const company = input.company?.trim() || null;
  const projectName = input.projectName.trim();
  if (!name || !projectName) throw new DocumentRuleError("A name and a project name are needed");
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [dupe] = input.asLead
      ? await tx`select name from leads where lower(name) = lower(${name}) or (${company}::text is not null and lower(business_name) = lower(${company}))`
      : await tx`select name from clients where lower(name) = lower(${name}) or (${company}::text is not null and lower(company) = lower(${company}))`;
    if (dupe) throw new DocumentRuleError(`${dupe.name} already exists. Use find to open it.`);

    let clientId: string | null = null;
    let leadId: string | null = null;
    if (input.asLead) {
      const [l] = await tx`
        insert into leads (name, business_name, email, phone_whatsapp, status, source)
        values (${name}, ${company}, ${input.email}, ${input.phone}, 'New', 'Claude') returning id`;
      leadId = String(l.id);
    } else {
      const [c] = await tx`
        insert into clients (name, company, email, phone, status)
        values (${name}, ${company}, ${input.email}, ${input.phone}, 'Active') returning id`;
      clientId = String(c.id);
    }
    const [p] = await tx`
      insert into projects (name, client_id, lead_id, status) values (${projectName}, ${clientId}, ${leadId}, 'Lead') returning id`;
    const projectId = String(p.id);

    const taken = (await tx`select reference from deals`).map((r) => r.reference as string);
    const reference = nextReference(suggestPrefix(company ?? name), new Date().getFullYear(), taken);
    const [d] = await tx`
      insert into deals (project_id, reference, created_by, updated_by, updated_via)
      values (${projectId}, ${reference}, ${actor}, ${actor}, ${via}) returning id`;

    if (clientId) await logActivity(tx, { entityType: "client", entityId: clientId, action: "created", summary: `${name} added`, actor, via });
    await logActivity(tx, { entityType: "project", entityId: projectId, action: "created", summary: `${projectName} added`, actor, via });
    await logActivity(tx, { entityType: "deal", entityId: String(d.id), action: "created", summary: `Deal created: ${reference}`, actor, via });
    return { clientId, leadId, projectId, reference };
  });
}
```

Notes for the implementer: `TB` / `TA` in the test assume `suggestPrefix("TEST Bites")` gives `TB` and `suggestPrefix("TEST Acme")` gives `TA`. Check what it really returns and change the test's regexes and the `reset()` reference patterns to match, not the function.

- [ ] **Step 3: Run**

Run: `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/connector-db.test.ts`
Expected: all PASS. Then `bun scripts/documents-db.test.ts` (same DATABASE_URL) still passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/connector-db.ts scripts/connector-db.test.ts package.json
git commit -m "feat(documents): search, client context and new client with project for the connector"
```

---

### Task 5: The PDF layout, `src/lib/pdf/document-pdf.tsx`

**Files:**
- Create: `src/assets/pdf/IBMPlexSans-Regular.ttf`, `IBMPlexSans-SemiBold.ttf`, `IBMPlexSans-Bold.ttf`, `mindelo-logo-ink.png`
- Create: `src/lib/pdf/document-pdf.tsx`, `scripts/pdf.test.tsx`
- Modify: `package.json` (`"test:pdf": "bun scripts/pdf.test.tsx"`)

- [ ] **Step 1: Fonts (OFL, from the fontsource CDN)**

```bash
mkdir -p src/assets/pdf
curl -sfL -o src/assets/pdf/IBMPlexSans-Regular.ttf  https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@latest/latin-400-normal.ttf
curl -sfL -o src/assets/pdf/IBMPlexSans-SemiBold.ttf https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@latest/latin-600-normal.ttf
curl -sfL -o src/assets/pdf/IBMPlexSans-Bold.ttf     https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans@latest/latin-700-normal.ttf
for f in src/assets/pdf/*.ttf; do head -c4 "$f" | xxd -p; done
```
Expected: each prints `00010000` (a TrueType file, about 57 KB).

- [ ] **Step 2: The dark-ink logo**

The source logo is `C:\Users\taylo\Downloads\mindelo logo newest.jpeg`: a green dot and a white "Mindelo" wordmark on near-black. For white paper, turn the background white and the wordmark navy, and keep the dot green. Run this once (do not commit the script):

```bash
python -I -c "
from PIL import Image
src = Image.open(r'C:\Users\taylo\Downloads\mindelo logo newest.jpeg').convert('RGB')
out = Image.new('RGB', src.size)
navy = (14, 26, 43)
px, po = src.load(), out.load()
for y in range(src.height):
    for x in range(src.width):
        r, g, b = px[x, y]
        if g > r + 40 and g > b:          # the green dot: keep its hue, lift its dark fringe to white
            t = min(1.0, g / 194)
            po[x, y] = tuple(round(255 * (1 - t) + c * t) for c in (5, 194, 154))
        else:                              # background 0 -> white, wordmark 1 -> navy
            t = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            po[x, y] = tuple(round(255 * (1 - t) + n * t) for n in navy)
out.save(r'src/assets/pdf/mindelo-logo-ink.png', optimize=True)
"
```

Open `src/assets/pdf/mindelo-logo-ink.png` with the Read tool and confirm: white background, navy "Mindelo", green dot, no dark halo around the dot. If there is a halo, raise the threshold (`g > r + 40`) or adjust `t`, and run it again.

- [ ] **Step 3: Failing test**

`scripts/pdf.test.tsx`:

```tsx
// pdf.test.tsx — renders each template from made-up data. No database.
//   bun scripts/pdf.test.tsx           (writes the PDFs to $PDF_OUT, default ./tmp-pdf, for a visual check)
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { renderDocumentPdf, type PdfData } from "../src/lib/pdf/document-pdf";

const out = process.env.PDF_OUT ?? "tmp-pdf";
mkdirSync(out, { recursive: true });

const base: PdfData = {
  type: "proposal",
  title: "Website for Island Bites",
  reference: "IB-2026-01",
  version: 1,
  date: "2026-11-04",
  client: { name: "Andrea Example", company: "Island Bites", email: "andrea@example.com", phone: null },
  projectName: "Island Bites website",
  sections: [
    { key: "summary", heading: "Summary", body: "A fast five-page site with pickup ordering.\n\nBuilt to be found on Google." },
    { key: "scope", heading: "What we will deliver", body: "- Five pages\n- Pickup ordering\n- Google Business setup" },
    { key: "empty", heading: "Skipped", body: "" },
  ],
  deal: {
    priceTotal: 6500,
    currency: "TTD",
    paymentSchedule: [
      { label: "Payment 1", amount: 3250, trigger: "On acceptance" },
      { label: "Payment 2", amount: 3250, trigger: "On handover" },
    ],
    carePlan: { monthlyAmount: 800, minimumMonths: 3, noticeDays: 30, inclusions: ["Hosting"], exclusions: [] },
  },
  invoice: null,
  bank: null,
};

const docs: Record<string, PdfData> = {
  proposal: base,
  quote: { ...base, type: "quote", title: "Quote", sections: [
    { key: "items", heading: "Items", body: "Website build | 5,000\nOrdering | 1,500" },
    { key: "terms", heading: "Terms", body: "Valid for 30 days." },
  ] },
  invoice: {
    ...base, type: "invoice", title: "Invoice: Payment 1", deal: null,
    sections: [
      { key: "items", heading: "Items", body: "Payment 1 (IB-2026-01) | 3250.00" },
      { key: "notes", heading: "Notes", body: "On acceptance." },
    ],
    invoice: { number: "INV-0042", issueDate: "2026-11-04", dueDate: "2026-11-18", amount: 3250 },
    bank: { accountName: "Example Name", bankName: "Example Bank", branch: "Port of Spain", accountNumber: "123456", accountType: "Chequing" },
  },
  draft: { ...base, version: 0 },
};

for (const [name, data] of Object.entries(docs)) {
  const pdf = await renderDocumentPdf(data);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", `${name} is a PDF`);
  assert.ok(pdf.length > 5_000, `${name} has content (${pdf.length} bytes)`);
  writeFileSync(`${out}/${name}.pdf`, pdf);
}
console.log(`All pdf checks pass. Look at ${out}/*.pdf`);
```

Add `tmp-pdf/` to `business-dashboard/.gitignore`.

Run: `bun scripts/pdf.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement the layout**

`src/lib/pdf/document-pdf.tsx`:

```tsx
// The A4 layout for every document type. Pure: it takes PdfData and returns
// PDF bytes, so it is tested without a database (scripts/pdf.test.tsx).
// Loading the data and storing the file is lib/pdf/store.ts.
//
// Brand: dark-ink logo on white, IBM Plex Sans, Corporate Navy. No em dashes.
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CarePlan, DocType, ScheduleLine, Section } from "../documents";
import { DOC_TYPE_LABEL } from "../documents";
import { formatMoney, parseItems } from "../doc-templates";

export type PdfData = {
  type: DocType;
  title: string;
  reference: string | null;
  /** 0 renders a draft preview. */
  version: number;
  date: string;
  client: { name: string; company: string | null; email: string | null; phone: string | null } | null;
  projectName: string | null;
  sections: Section[];
  deal: { priceTotal: number | null; currency: string; paymentSchedule: ScheduleLine[]; carePlan: CarePlan | null } | null;
  invoice: { number: string | null; issueDate: string | null; dueDate: string | null; amount: number } | null;
  bank: { accountName: string; bankName: string; branch: string | null; accountNumber: string; accountType: string | null } | null;
};

// Next traces these into the function bundle via next.config's outputFileTracingIncludes (Task 6).
const ASSETS = path.join(process.cwd(), "src/assets/pdf");
Font.register({
  family: "Plex",
  fonts: [
    { src: path.join(ASSETS, "IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(ASSETS, "IBMPlexSans-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(ASSETS, "IBMPlexSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const NAVY = "#0E1A2B";
const MUTED = "#5A6678";
const RULE = "#DCE1E8";
const GREEN = "#05C29A";

const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 10, color: NAVY, paddingTop: 40, paddingBottom: 60, paddingHorizontal: 48, lineHeight: 1.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 120 },
  meta: { alignItems: "flex-end" },
  kind: { fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: MUTED },
  rule: { height: 2, backgroundColor: GREEN, marginTop: 14, marginBottom: 18, width: 40 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  label: { fontSize: 8, fontWeight: 600, color: MUTED, letterSpacing: 1, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 14 },
  h: { fontSize: 11, fontWeight: 600, marginTop: 12, marginBottom: 4 },
  p: { marginBottom: 6 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  dot: { width: 10 },
  table: { borderTopWidth: 1, borderColor: RULE, marginTop: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: RULE, paddingVertical: 5 },
  cellGrow: { flex: 1, paddingRight: 8 },
  cellMid: { width: 130, color: MUTED },
  cellAmt: { width: 90, textAlign: "right" },
  total: { flexDirection: "row", paddingVertical: 6 },
  bold: { fontWeight: 700 },
  bank: { marginTop: 14, padding: 10, borderWidth: 1, borderColor: RULE, borderRadius: 4 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
});

function Body({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((para, i) => {
        const lines = para.split("\n");
        if (lines.every((l) => l.trim().startsWith("- ")))
          return lines.map((l, j) => (
            <View key={`${i}-${j}`} style={s.bullet}>
              <Text style={s.dot}>•</Text>
              <Text style={{ flex: 1 }}>{l.trim().slice(2)}</Text>
            </View>
          ));
        return <Text key={i} style={s.p}>{para.trim()}</Text>;
      })}
    </>
  );
}

function Money({ rows, total, currency }: { rows: { a: string; b?: string; amount: number }[]; total: number | null; currency: string }) {
  return (
    <View style={s.table}>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={s.cellGrow}>{r.a}</Text>
          {r.b !== undefined && <Text style={s.cellMid}>{r.b}</Text>}
          <Text style={s.cellAmt}>{formatMoney(r.amount, currency)}</Text>
        </View>
      ))}
      {total != null && (
        <View style={s.total}>
          <Text style={[s.cellGrow, s.bold]}>Total</Text>
          <Text style={[s.cellAmt, s.bold]}>{formatMoney(total, currency)}</Text>
        </View>
      )}
    </View>
  );
}

function carePlanLine(c: CarePlan, currency: string): string {
  return `Care plan: ${formatMoney(c.monthlyAmount, currency)} a month, for a minimum of ${c.minimumMonths} months, then month to month until either side gives ${c.noticeDays} days' notice.`;
}

function Pdf({ d }: { d: PdfData }) {
  const currency = d.deal?.currency ?? "TTD";
  const items = d.sections.find((x) => x.key === "items");
  const prose = d.sections.filter((x) => x.key !== "items" && x.body.trim());
  const parsed = items ? parseItems(items.body).items : [];
  return (
    <Document title={d.title} author="Mindelo" creator="Mindelo">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image style={s.logo} src={path.join(ASSETS, "mindelo-logo-ink.png")} />
          <View style={s.meta}>
            <Text style={s.kind}>{DOC_TYPE_LABEL[d.type].toUpperCase()}</Text>
            {d.invoice?.number && <Text>{d.invoice.number}</Text>}
            {d.reference && <Text>{d.reference}</Text>}
            <Text>{d.date}</Text>
            <Text style={{ color: MUTED }}>{d.version === 0 ? "DRAFT, not for sending" : `Version ${d.version}`}</Text>
          </View>
        </View>
        <View style={s.rule} />

        <View style={s.parties}>
          <View>
            <Text style={s.label}>{d.type === "invoice" ? "BILL TO" : "PREPARED FOR"}</Text>
            {d.client?.company && <Text style={s.bold}>{d.client.company}</Text>}
            {d.client && <Text>{d.client.name}</Text>}
            {d.client?.email && <Text>{d.client.email}</Text>}
            {d.client?.phone && <Text>{d.client.phone}</Text>}
            {d.projectName && <Text style={{ color: MUTED }}>{d.projectName}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.label}>FROM</Text>
            <Text style={s.bold}>Mindelo</Text>
            <Text>MINDELOAI LIMITED</Text>
            {d.invoice?.issueDate && <Text>Issued {d.invoice.issueDate}</Text>}
            {d.invoice?.dueDate && <Text style={s.bold}>Due {d.invoice.dueDate}</Text>}
          </View>
        </View>

        <Text style={s.title}>{d.title}</Text>

        {items && parsed.length > 0 && (
          <>
            <Text style={s.h}>{items.heading}</Text>
            <Money
              rows={parsed.map((i) => ({ a: i.description, amount: i.amount }))}
              total={d.invoice?.amount ?? parsed.reduce((t, i) => t + i.amount, 0)}
              currency={currency}
            />
          </>
        )}

        {prose.map((sec) => (
          <View key={sec.key}>
            <Text style={s.h}>{sec.heading}</Text>
            <Body text={sec.body} />
          </View>
        ))}

        {(d.type === "proposal" || d.type === "quote") && d.deal?.priceTotal != null && (
          <View wrap={false}>
            <Text style={s.h}>Investment</Text>
            <Money
              rows={d.deal.paymentSchedule.length
                ? d.deal.paymentSchedule.map((l) => ({ a: l.label, b: l.trigger, amount: l.amount }))
                : [{ a: "Total", amount: d.deal.priceTotal }]}
              total={d.deal.paymentSchedule.length ? d.deal.priceTotal : null}
              currency={currency}
            />
            {d.deal.carePlan && <Text style={[s.p, { marginTop: 8 }]}>{carePlanLine(d.deal.carePlan, currency)}</Text>}
          </View>
        )}

        {d.type === "invoice" && d.bank && (
          <View style={s.bank} wrap={false}>
            <Text style={s.label}>PAYMENT DETAILS</Text>
            <Text>Account name: {d.bank.accountName}</Text>
            <Text>Bank: {d.bank.bankName}{d.bank.branch ? `, ${d.bank.branch}` : ""}</Text>
            <Text>Account number: {d.bank.accountNumber}</Text>
            {d.bank.accountType && <Text>Account type: {d.bank.accountType}</Text>}
            {d.invoice?.number && <Text style={{ color: MUTED }}>Please use {d.invoice.number} as the payment reference.</Text>}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>Mindelo is a trading name of MINDELOAI LIMITED</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(d: PdfData): Promise<Buffer> {
  return renderToBuffer(<Pdf d={d} />);
}
```

- [ ] **Step 5: Run and look**

Run: `bun scripts/pdf.test.tsx`
Expected: `All pdf checks pass`. Open each of `tmp-pdf/proposal.pdf`, `quote.pdf`, `invoice.pdf`, `draft.pdf` with the Read tool (it renders PDFs) and check: logo sharp and not stretched; text readable in Plex; tables aligned; the footer on the page; the "DRAFT" marker on the draft; no "Skipped" heading (an empty section is left out); no em dashes. Fix the layout until all four look right.

If `bun` cannot run react-pdf (JSX runtime or ESM error), run the test with `npx tsx scripts/pdf.test.tsx` instead, update the `test:pdf` script to match, and say so in your report.

- [ ] **Step 6: Commit**

```bash
git add src/assets/pdf src/lib/pdf/document-pdf.tsx scripts/pdf.test.tsx package.json .gitignore
git commit -m "feat(documents): A4 PDF layout in the Mindelo logo for proposals, quotes and invoices"
```

---

### Task 6: Storing PDFs, the PDF route, finalise renders

**Files:**
- Modify: `src/lib/storage.ts` (add `uploadBytes`)
- Create: `src/lib/pdf/store.ts`
- Create: `src/app/admin/documents/[id]/pdf/route.ts`
- Modify: `src/app/documents-actions.ts` (`finaliseDocumentAction`)
- Modify: `src/app/admin/documents/[id]/page.tsx` (PDF links)
- Modify: `next.config.ts` (trace the PDF assets)

- [ ] **Step 1: `uploadBytes`**

Add to `src/lib/storage.ts`:

```ts
/** Server-side upload (PDFs we render). Never overwrites: a frozen version's file is written once. */
export async function uploadBytes(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await storage().upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Could not store the file: ${error.message}`);
}
```

- [ ] **Step 2: `src/lib/pdf/store.ts`**

```ts
// Gathers what a document's PDF shows, renders it, and keeps the file.
//
// A finalised version is rendered once and stored at document/<id>/v<N>.pdf, so
// it reprints identically even after the deal, client or bank details change.
// If that first render failed (e.g. Storage was down), the next request renders
// it from the frozen sections plus today's linked data, and stores that.
import { getSql } from "../db";
import { getPayeeAccount, setVersionPdf } from "../documents-db";
import type { Section } from "../documents";
import { uploadBytes } from "../storage";
import { renderDocumentPdf, type PdfData } from "./document-pdf";

/** `version` 0 = the current draft. Null when the document or version does not exist. */
export async function loadPdfData(documentId: string, version: number): Promise<PdfData | null> {
  const sql = getSql();
  const [doc] = await sql`
    select d.*, p.name as project_name,
           c.name as client_name, c.company, c.email, c.phone,
           dl.reference, dl.price_total, dl.currency, dl.payment_schedule, dl.care_plan,
           i.invoice_number, i.issue_date, i.due_date, i.amount
      from documents d
      left join projects p on p.id = d.project_id
      left join clients c on c.id = coalesce(d.client_id, p.client_id)
      left join deals dl on dl.id = d.deal_id
      left join invoices i on i.id = d.invoice_id
     where d.id = ${documentId}`;
  if (!doc) return null;
  let title = doc.title as string;
  let sections = doc.draft as Section[];
  let date = new Date().toISOString().slice(0, 10);
  if (version > 0) {
    const [v] = await sql`select * from document_versions where document_id = ${documentId} and version = ${version}`;
    if (!v) return null;
    title = v.title;
    sections = v.sections;
    date = new Date(v.finalised_at).toISOString().slice(0, 10);
  }
  const bank = doc.type === "invoice" && doc.payee ? await getPayeeAccount(doc.payee) : null;
  const day = (x: unknown) => (x ? String(x instanceof Date ? x.toISOString() : x).slice(0, 10) : null);
  return {
    type: doc.type,
    title,
    reference: doc.reference ?? null,
    version,
    date,
    client: doc.client_name != null ? { name: doc.client_name, company: doc.company, email: doc.email, phone: doc.phone } : null,
    projectName: doc.project_name ?? null,
    sections,
    deal: doc.reference
      ? {
          priceTotal: doc.price_total == null ? null : Number(doc.price_total),
          currency: doc.currency,
          paymentSchedule: (doc.payment_schedule ?? []).map((l: { label: string; amount: unknown; trigger: string }) => ({ ...l, amount: Number(l.amount) })),
          carePlan: doc.care_plan,
        }
      : null,
    invoice: doc.invoice_id
      ? { number: doc.invoice_number, issueDate: day(doc.issue_date), dueDate: day(doc.due_date), amount: Number(doc.amount ?? 0) }
      : null,
    bank: bank && { accountName: bank.accountName, bankName: bank.bankName, branch: bank.branch, accountNumber: bank.accountNumber, accountType: bank.accountType },
  };
}

/** The Storage path of a finalised version's PDF, rendering and storing it first if needed. */
export async function ensurePdf(documentId: string, version: number): Promise<string> {
  const sql = getSql();
  const [v] = await sql`select pdf_path from document_versions where document_id = ${documentId} and version = ${version}`;
  if (!v) throw new Error(`Document ${documentId} has no version ${version}`);
  if (v.pdf_path) return v.pdf_path;
  const data = await loadPdfData(documentId, version);
  if (!data) throw new Error(`Document ${documentId} has no version ${version}`);
  const path = `document/${documentId}/v${version}.pdf`;
  try {
    await uploadBytes(path, await renderDocumentPdf(data), "application/pdf");
  } catch (e) {
    // A previous attempt stored the file but failed before recording it. Same frozen version, so keep that file.
    if (!/already exists/i.test(String((e as Error).message))) throw e;
  }
  await setVersionPdf(documentId, version, path);
  return path;
}
```

- [ ] **Step 3: The route**

Read `node_modules/next/dist/docs/` on Route Handlers (dynamic segments: `params` is a Promise) first.

`src/app/admin/documents/[id]/pdf/route.ts`:

```ts
// GET /admin/documents/<id>/pdf?version=N  -> the stored PDF of version N (rendered on first request)
// GET /admin/documents/<id>/pdf            -> a live preview of the current draft, never stored
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { ensurePdf, loadPdfData } from "@/lib/pdf/store";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { signedDownload } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return new NextResponse("Not authorised", { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const raw = new URL(request.url).searchParams.get("version");
  const version = raw === null ? 0 : Number(raw);
  if (!Number.isInteger(version) || version < 0) return new NextResponse("Bad version", { status: 400 });

  try {
    if (version === 0) {
      const data = await loadPdfData(id, 0);
      if (!data) return new NextResponse("Not found", { status: 404 });
      return new NextResponse(new Uint8Array(await renderDocumentPdf(data)), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${slug(data.title)}-draft.pdf"`, "Cache-Control": "no-store" },
      });
    }
    const data = await loadPdfData(id, version);
    if (!data) return new NextResponse("Not found", { status: 404 });
    const path = await ensurePdf(id, version);
    return NextResponse.redirect(await signedDownload(path, `${slug(data.title)}-v${version}.pdf`), 302);
  } catch (e) {
    console.error("[documents/pdf]", e);
    return new NextResponse("The PDF could not be made. Try again.", { status: 500 });
  }
}
```

- [ ] **Step 4: Finalise renders the PDF**

In `src/app/documents-actions.ts`, change `finaliseDocumentAction` so that after `finaliseDocument` succeeds it calls `ensurePdf`. A PDF failure must not hide that the version was frozen:

```ts
export async function finaliseDocumentAction(id: string): Promise<Result<{ version: number; pdfError?: string }>> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown document" };
  try {
    const v = await finaliseDocument(id, admin.email);
    revalidatePath("/", "layout");
    try {
      await ensurePdf(id, v.version);
      return { ok: true, data: { version: v.version } };
    } catch (e) {
      console.error("[finalise] PDF", e);
      return { ok: true, data: { version: v.version, pdfError: "Finalised, but the PDF could not be made yet. Open it again from the version list." } };
    }
  } catch (e) {
    return fail(e);
  }
}
```

Import `ensurePdf` from `@/lib/pdf/store`. In `src/app/admin/documents/[id]/document-actions.tsx`, when the result carries `pdfError`, show it with `toast.warning` instead of the success toast (read the file to see how results are shown now).

- [ ] **Step 5: PDF links on the document page**

In `src/app/admin/documents/[id]/page.tsx`:
- In the version list, next to each version add `<a href={`/admin/documents/${doc.id}/pdf?version=${v.version}`} target="_blank" rel="noreferrer" className="text-[#1D4ED8] hover:underline">PDF</a>`.
- Near the draft preview (when the status is `draft` and the draft has sections) add a link "Preview PDF" to `/admin/documents/${doc.id}/pdf`.

- [ ] **Step 6: Trace the assets into the build**

Read `node_modules/next/dist/docs/` for `outputFileTracingIncludes`. Add to `next.config.ts`:

```ts
  // The PDF fonts and logo are read from disk at runtime (lib/pdf/document-pdf.tsx),
  // which file tracing cannot see. Every route that can render a PDF needs them.
  outputFileTracingIncludes: {
    "/**": ["./src/assets/pdf/**/*"],
  },
```

Verify with a build that uses NO real environment (dummy values; the build connects to nothing):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=x DATABASE_URL=postgres://x:x@localhost:1/x npx next build
grep -l "IBMPlexSans-Regular.ttf" .next/server/app/admin/documents/\[id\]/pdf/route.js.nft.json .next/server/app/api/mcp/route.js.nft.json 2>/dev/null
```
Expected: build succeeds; the pdf route's `.nft.json` lists the font (the mcp route does not exist until Task 12, so only the first file is found now). If `/**` is not accepted, use the keys the docs show and list each route. Delete `.next` afterwards only if it was not there before.

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage.ts src/lib/pdf/store.ts "src/app/admin/documents/[id]" src/app/documents-actions.ts next.config.ts
git commit -m "feat(documents): finalising stores the version's PDF; PDF and draft preview links"
```

---

### Task 7: Bank details page and the invoice payee picker

**Files:**
- Create: `src/app/admin/settings/payees/page.tsx`, `src/app/admin/settings/payees/payee-form.tsx`
- Modify: `src/app/documents-actions.ts` (`savePayeeAccountAction`, `setDocumentPayeeAction`)
- Modify: `src/app/admin/documents/[id]/page.tsx` + `document-actions.tsx` (payee picker on invoice drafts)
- Modify: `src/components/dashboard/sidebar.tsx` (Sales group: `{ href: "/admin/settings/payees", label: "Bank details" }` after Documents)

- [ ] **Step 1: Actions**

Add to `src/app/documents-actions.ts`:

```ts
const PayeeForm = z.object({
  payee: z.enum(PAYEES),
  accountName: z.string().trim().min(1, "Account name is needed"),
  bankName: z.string().trim().min(1, "Bank is needed"),
  branch: z.string().trim().nullable(),
  accountNumber: z.string().trim().min(1, "Account number is needed"),
  accountType: z.string().trim().nullable(),
});

export async function savePayeeAccountAction(input: z.input<typeof PayeeForm>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = PayeeForm.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    await savePayeeAccount(parsed.data, admin.email);
    revalidatePath("/admin/settings/payees");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setDocumentPayeeAction(id: string, payee: string): Promise<Result> {
  const admin = await requireAdmin();
  const p = z.enum(PAYEES).safeParse(payee);
  if (!z.uuid().safeParse(id).success || !p.success) return { ok: false, error: "Unknown document or payee" };
  try {
    await setDocumentPayee(id, p.data, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
```

- [ ] **Step 2: Bank details page**

`src/app/admin/settings/payees/page.tsx`: a server component that calls `requireAdminPage()`, loads `getPayeeAccounts()`, renders `PageHeader` (title "Bank details", purpose text: "What goes in the payment box of an invoice. Claude always asks who is being paid and never sees these numbers.") and one `PayeeForm` card per payee in `PAYEES` order, pre-filled when saved, with "Last changed by … on …" under each.

`payee-form.tsx` (`"use client"`): fields Account name, Bank, Branch (optional), Account number, Account type (optional); Save button calling `savePayeeAccountAction`; `toast.success("Saved")` / `toast.error(error)`. Reuse `inputCls` from `src/components/dashboard/clients-list.tsx` like the Phase 1 deal card does. Account number is a plain text input (it can hold dashes).

- [ ] **Step 3: Payee picker on invoice documents**

On `src/app/admin/documents/[id]/page.tsx`, when `doc.type === "invoice"`: show "Paid to: {PAYEE_LABEL[doc.payee] ?? "Not chosen"}". When the status is `draft`, render a `<select>` (Michael / Zane / Company account) in `document-actions.tsx` that calls `setDocumentPayeeAction` on change. Under it, if the chosen payee has no saved bank details, show "No bank details saved for {label}. Add them in Bank details." linking to `/admin/settings/payees` (load `getPayeeAccounts()` in the page and pass a `Set` of saved payees).

- [ ] **Step 4: Check**

`npx tsc --noEmit -p .` (only the old error), `npx eslint src/app/admin/settings src/app/admin/documents src/app/documents-actions.ts` (clean).

UI is checked the Phase 1 way: a temporary preview page with mock data, rendered with `bun`/a static render or skipped; do NOT run `next dev` against `.env.local`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/settings src/app/documents-actions.ts "src/app/admin/documents/[id]" src/components/dashboard/sidebar.tsx
git commit -m "feat(documents): bank details page and payee picker on invoice drafts"
```

---

### Task 8: OAuth rules, `src/lib/oauth.ts`

**Files:**
- Create: `src/lib/oauth.ts`, `scripts/oauth.test.ts`
- Modify: `package.json` (`"test:oauth": "bun scripts/oauth.test.ts"`)

- [ ] **Step 1: Failing test**

`scripts/oauth.test.ts`:

```ts
// oauth.test.ts — pure OAuth rules. No database.
//   bun scripts/oauth.test.ts
import assert from "node:assert/strict";
import { hashSecret, newSecret, pkceMatches, redirectAllowed, safeNext } from "../src/lib/oauth";

// Redirects: Claude's callbacks and loopback only
assert.ok(redirectAllowed("https://claude.ai/api/mcp/auth_callback"));
assert.ok(redirectAllowed("https://claude.com/api/mcp/auth_callback"));
assert.ok(redirectAllowed("http://localhost:33418/callback"));
assert.ok(redirectAllowed("http://127.0.0.1:5000/oauth/callback"));
assert.ok(!redirectAllowed("http://claude.ai/api/mcp/auth_callback"));
assert.ok(!redirectAllowed("https://claude.ai.evil.com/api/mcp/auth_callback"));
assert.ok(!redirectAllowed("https://claude.ai/api/mcp/auth_callback#x"));
assert.ok(!redirectAllowed("https://claude.ai/other"));
assert.ok(!redirectAllowed("https://localhost/callback"));
assert.ok(!redirectAllowed("http://localhost.evil.com/callback"));
assert.ok(!redirectAllowed("not a url"));

// PKCE S256
const verifier = "a".repeat(43);
assert.ok(pkceMatches(verifier, "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA"));
assert.ok(!pkceMatches("b".repeat(43), "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA"));
assert.ok(!pkceMatches("short", "anything"));

// Secrets
const a = newSecret();
assert.ok(/^[A-Za-z0-9_-]{43}$/.test(a));
assert.notEqual(a, newSecret());
assert.equal(hashSecret(a), hashSecret(a));
assert.match(hashSecret(a), /^[0-9a-f]{64}$/);

// Login ?next=
assert.equal(safeNext("/oauth/authorize?x=1"), "/oauth/authorize?x=1");
assert.equal(safeNext("//evil.com"), null);
assert.equal(safeNext("/\\evil.com"), null);
assert.equal(safeNext("https://evil.com"), null);
assert.equal(safeNext(undefined), null);

console.log("All oauth checks pass");
```

Run: `bun scripts/oauth.test.ts` → FAIL (module not found).

- [ ] **Step 2: Implement**

`src/lib/oauth.ts`:

```ts
// Pure rules for the small OAuth 2.1 server behind the Claude connector.
//
// Who can get a token: only a founder who signs in on our own login page and
// presses Allow. Which apps can receive the code: only Claude (claude.ai and
// claude.com callbacks) and loopback addresses (Claude Code on a founder's
// machine). Client registration is therefore not a security boundary and is
// stateless; the redirect allow-list plus PKCE is. Secrets are stored as
// SHA-256 hashes only.
import { createHash, randomBytes } from "node:crypto";

export const CODE_TTL_S = 300;
export const ACCESS_TTL_S = 3600;
export const REFRESH_TTL_S = 30 * 24 * 3600;
export const SCOPE = "mindelo";

const CLAUDE_CALLBACKS = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];

export function redirectAllowed(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:" && CLAUDE_CALLBACKS.includes(`${u.origin}${u.pathname}`)) return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}

export const newSecret = () => randomBytes(32).toString("base64url");
export const hashSecret = (s: string) => createHash("sha256").update(s).digest("hex");

/** RFC 7636 S256. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/** A same-site path to return to after sign-in, or null. */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
```

- [ ] **Step 3: Run**: `bun scripts/oauth.test.ts` → `All oauth checks pass`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/oauth.ts scripts/oauth.test.ts package.json
git commit -m "feat(connector): OAuth rules, redirect allow-list and PKCE"
```

---

### Task 9: OAuth storage, `src/lib/oauth-db.ts`

**Files:**
- Create: `src/lib/oauth-db.ts`, `scripts/oauth-db.test.ts`
- Modify: `package.json` (`"test:oauth-db": "bun scripts/oauth-db.test.ts"`)

- [ ] **Step 1: Failing test**

`scripts/oauth-db.test.ts`:

```ts
// oauth-db.test.ts — codes and tokens, against the THROWAWAY local database only.
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/oauth-db.test.ts
import postgres from "postgres";
import { issueCode, redeemCode, refreshTokens, verifyAccessToken } from "../src/lib/oauth-db";
import { closeDb } from "../src/lib/db";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}

const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "claude-test";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "a".repeat(43);
const CHALLENGE = "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA";

async function reset() {
  await sql`delete from oauth_codes`;
  await sql`delete from oauth_tokens`;
  await sql`delete from profiles where id = ${USER}`;
}

try {
  // Production has profiles (migration 005, tied to auth.users). The throwaway DB may not.
  await sql`create table if not exists profiles (id uuid primary key, email text not null, role text not null default 'admin')`;
  await reset();
  await sql`insert into profiles (id, email, role) values (${USER}, 'founder@example.com', 'admin')`;

  const code = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  check("wrong verifier gets nothing", (await redeemCode({ code, clientId: CLIENT, redirectUri: REDIRECT, verifier: "b".repeat(43) })) === null);
  check("a code is burned by a failed attempt", (await redeemCode({ code, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER })) === null);

  const code2 = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  check("wrong redirect gets nothing", (await redeemCode({ code: code2, clientId: CLIENT, redirectUri: "http://localhost:1/cb", verifier: VERIFIER })) === null);

  const code3 = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  const t = await redeemCode({ code: code3, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER });
  check("a good code gives tokens", !!t?.accessToken && !!t.refreshToken && t.expiresIn === 3600);
  check("a code works once", (await redeemCode({ code: code3, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER })) === null);

  const who = await verifyAccessToken(t!.accessToken);
  check("the access token names the founder", who?.email === "founder@example.com" && who.userId === USER && who.clientId === CLIENT);
  check("a refresh token is not an access token", (await verifyAccessToken(t!.refreshToken)) === null);
  check("garbage is not a token", (await verifyAccessToken("nope")) === null);

  const t2 = await refreshTokens({ refreshToken: t!.refreshToken, clientId: CLIENT });
  check("refresh gives a new pair", !!t2 && t2.accessToken !== t!.accessToken);
  check("a refresh token works once", (await refreshTokens({ refreshToken: t!.refreshToken, clientId: CLIENT })) === null);
  check("refresh for another client is refused", (await refreshTokens({ refreshToken: t2!.refreshToken, clientId: "other" })) === null);

  await sql`update oauth_tokens set expires_at = now() - interval '1 second' where kind = 'access'`;
  check("an expired access token is refused", (await verifyAccessToken(t2!.accessToken)) === null);

  const code4 = await issueCode({ userId: USER, clientId: CLIENT, redirectUri: REDIRECT, codeChallenge: CHALLENGE });
  const t3 = await redeemCode({ code: code4, clientId: CLIENT, redirectUri: REDIRECT, verifier: VERIFIER });
  await sql`delete from profiles where id = ${USER}`;
  check("a token stops working when the profile goes", (await verifyAccessToken(t3!.accessToken)) === null);

  const stored = await sql`select token_hash from oauth_tokens`;
  check("only hashes are stored", stored.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash)) && !stored.some((r) => r.token_hash === t3!.accessToken));
} finally {
  await reset();
  await sql.end();
  await closeDb();
}
console.log(failures ? `\n${failures} FAILED` : "\nAll oauth-db checks pass");
process.exit(failures ? 1 : 0);
```

Run with the local DATABASE_URL → FAIL (module not found).

- [ ] **Step 2: Implement**

`src/lib/oauth-db.ts`:

```ts
// Authorization codes and tokens for the Claude connector (migration 024).
// Only SHA-256 hashes are stored. Every token check re-reads `profiles`, so
// removing a founder's profile ends Claude's access at the next call.
import { getSql } from "./db";
import { ACCESS_TTL_S, CODE_TTL_S, REFRESH_TTL_S, hashSecret, newSecret, pkceMatches } from "./oauth";

export type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };

export async function issueCode(a: { userId: string; clientId: string; redirectUri: string; codeChallenge: string }): Promise<string> {
  const code = newSecret();
  const sql = getSql();
  await sql`
    insert into oauth_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, expires_at)
    values (${hashSecret(code)}, ${a.userId}, ${a.clientId}, ${a.redirectUri}, ${a.codeChallenge},
            now() + make_interval(secs => ${CODE_TTL_S}))`;
  return code;
}

async function issueTokens(userId: string, clientId: string): Promise<Tokens> {
  const accessToken = newSecret();
  const refreshToken = newSecret();
  const sql = getSql();
  await sql`
    insert into oauth_tokens (token_hash, kind, user_id, client_id, expires_at) values
      (${hashSecret(accessToken)}, 'access', ${userId}, ${clientId}, now() + make_interval(secs => ${ACCESS_TTL_S})),
      (${hashSecret(refreshToken)}, 'refresh', ${userId}, ${clientId}, now() + make_interval(secs => ${REFRESH_TTL_S}))`;
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
}

/** Single use: the code is spent by the first attempt, right or wrong. */
export async function redeemCode(a: { code: string; clientId: string; redirectUri: string; verifier: string }): Promise<Tokens | null> {
  const sql = getSql();
  const [row] = await sql`
    update oauth_codes set used_at = now()
     where code_hash = ${hashSecret(a.code)} and used_at is null and expires_at > now()
     returning user_id, client_id, redirect_uri, code_challenge`;
  if (!row) return null;
  if (row.client_id !== a.clientId || row.redirect_uri !== a.redirectUri || !pkceMatches(a.verifier, row.code_challenge)) return null;
  return issueTokens(String(row.user_id), a.clientId);
}

/** Rotates: the old refresh token is revoked whether or not the new pair is used. */
export async function refreshTokens(a: { refreshToken: string; clientId: string }): Promise<Tokens | null> {
  const sql = getSql();
  const [row] = await sql`
    update oauth_tokens set revoked_at = now()
     where token_hash = ${hashSecret(a.refreshToken)} and kind = 'refresh' and client_id = ${a.clientId}
       and revoked_at is null and expires_at > now()
     returning user_id`;
  return row ? issueTokens(String(row.user_id), a.clientId) : null;
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string; clientId: string; expiresAt: number } | null> {
  const sql = getSql();
  const [row] = await sql`
    select t.user_id, t.client_id, t.expires_at, p.email
      from oauth_tokens t join profiles p on p.id = t.user_id and p.role = 'admin'
     where t.token_hash = ${hashSecret(token)} and t.kind = 'access' and t.revoked_at is null and t.expires_at > now()`;
  return row
    ? { userId: String(row.user_id), email: String(row.email), clientId: String(row.client_id), expiresAt: new Date(row.expires_at).getTime() }
    : null;
}
```

- [ ] **Step 3: Run**: `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/oauth-db.test.ts` → all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/oauth-db.ts scripts/oauth-db.test.ts package.json
git commit -m "feat(connector): OAuth codes and tokens, stored hashed"
```

---

### Task 10: OAuth routes, consent page, login `next`

**Files:**
- Create: `src/app/.well-known/oauth-authorization-server/route.ts`
- Create: `src/app/.well-known/oauth-protected-resource/[[...path]]/route.ts`
- Create: `src/app/oauth/register/route.ts`, `src/app/oauth/token/route.ts`
- Create: `src/app/oauth/authorize/page.tsx`
- Modify: `src/app/login/page.tsx`

Read `node_modules/next/dist/docs/` on Route Handlers, optional catch-all segments and Server Actions before starting. `src/proxy.ts` matches `/admin` only, so every route here is public and must authenticate itself.

- [ ] **Step 1: Metadata**

`src/app/.well-known/oauth-authorization-server/route.ts`:

```ts
// RFC 8414 metadata for the connector's authorization server (this app).
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" };

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      scopes_supported: [SCOPE],
    },
    { headers: CORS },
  );
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
```

`src/app/.well-known/oauth-protected-resource/[[...path]]/route.ts` (answers both `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp`):

```ts
// RFC 9728 metadata for /api/mcp.
import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    generateProtectedResourceMetadata({
      authServerUrls: [origin],
      resourceUrl: `${origin}/api/mcp`,
      additionalMetadata: { scopes_supported: [SCOPE] },
    }),
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
```

(Check the `generateProtectedResourceMetadata` signature in `node_modules/mcp-handler/dist/index.d.ts`; Task 0 notes.)

- [ ] **Step 2: Registration (stateless)**

`src/app/oauth/register/route.ts`:

```ts
// RFC 7591 dynamic client registration, stateless. Any client may register;
// what protects the founders is the redirect allow-list and PKCE (lib/oauth.ts),
// so a registration records nothing.
import { randomUUID } from "node:crypto";
import { redirectAllowed } from "@/lib/oauth";

export const dynamic = "force-dynamic";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const uris: unknown = body?.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === "string" && redirectAllowed(u)))
    return Response.json({ error: "invalid_redirect_uri", error_description: "Only Claude and loopback redirect URIs are accepted" }, { status: 400, headers: CORS });
  return Response.json(
    {
      client_id: `mindelo-${randomUUID()}`,
      client_name: typeof body.client_name === "string" ? body.client_name : "Claude",
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS },
  );
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
```

- [ ] **Step 3: Token endpoint**

`src/app/oauth/token/route.ts`:

```ts
// Exchanges a code (with its PKCE verifier) or a refresh token for tokens.
import { redeemCode, refreshTokens, type Tokens } from "@/lib/oauth-db";
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";
const HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*", "Cache-Control": "no-store" };

const bad = (error: string, status = 400) => Response.json({ error }, { status, headers: HEADERS });

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const raw = type.includes("application/json") ? await request.json().catch(() => ({})) : Object.fromEntries(await request.formData().catch(() => new FormData()));
  const p = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");

  let tokens: Tokens | null;
  if (p("grant_type") === "authorization_code") {
    if (!p("code") || !p("client_id") || !p("redirect_uri") || !p("code_verifier")) return bad("invalid_request");
    tokens = await redeemCode({ code: p("code"), clientId: p("client_id"), redirectUri: p("redirect_uri"), verifier: p("code_verifier") });
  } else if (p("grant_type") === "refresh_token") {
    if (!p("refresh_token") || !p("client_id")) return bad("invalid_request");
    tokens = await refreshTokens({ refreshToken: p("refresh_token"), clientId: p("client_id") });
  } else {
    return bad("unsupported_grant_type");
  }
  if (!tokens) return bad("invalid_grant");
  return Response.json(
    { access_token: tokens.accessToken, token_type: "Bearer", expires_in: tokens.expiresIn, refresh_token: tokens.refreshToken, scope: SCOPE },
    { headers: HEADERS },
  );
}

export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });
```

- [ ] **Step 4: Login honours `next`**

In `src/app/login/page.tsx`:
- `searchParams` type becomes `Promise<{ error?: string; next?: string }>`; compute `const next = safeNext(sp.next)`.
- The "already signed in" redirect goes to `next ?? "/admin/overview"`.
- The form gets `<input type="hidden" name="next" value={next ?? ""} />`.
- In `signIn`, read `const next = safeNext(String(formData.get("next") ?? ""))`; every error redirect keeps it (`/login?error=invalid${next ? `&next=${encodeURIComponent(next)}` : ""}`), and the success redirect goes to `next ?? "/admin/overview"`.

Import `safeNext` from `@/lib/oauth`.

- [ ] **Step 5: Consent page**

`src/app/oauth/authorize/page.tsx`:

```tsx
// The founder approves Claude here. Not under /admin, so the proxy does not
// guard it: this page checks the session itself and sends a signed-out founder
// to /login, which returns here afterwards.
import { redirect } from "next/navigation";
import { getAdmin, requireAdmin } from "@/lib/auth";
import { dashboardFont } from "@/lib/dashboard-font";
import { issueCode } from "@/lib/oauth-db";
import { redirectAllowed } from "@/lib/oauth";

export const dynamic = "force-dynamic";

type Params = { response_type?: string; client_id?: string; redirect_uri?: string; code_challenge?: string; code_challenge_method?: string; state?: string; scope?: string };

/** Null when the request is acceptable; otherwise what is wrong. Never redirect to an unchecked URI. */
function problem(p: Params): string | null {
  if (!p.redirect_uri || !redirectAllowed(p.redirect_uri)) return "This sign-in link is not from Claude.";
  if (p.response_type !== "code" || !p.client_id || !p.code_challenge || p.code_challenge_method !== "S256") return "This sign-in link is incomplete.";
  return null;
}

function back(redirectUri: string, params: Record<string, string | undefined>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

async function decide(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const p = Object.fromEntries(formData) as Params & { allow?: string };
  if (problem(p)) throw new Error("Bad authorization request");
  if (p.allow !== "yes") redirect(back(p.redirect_uri!, { error: "access_denied", state: p.state }));
  const code = await issueCode({ userId: admin.id, clientId: p.client_id!, redirectUri: p.redirect_uri!, codeChallenge: p.code_challenge! });
  redirect(back(p.redirect_uri!, { code, state: p.state }));
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const wrong = problem(p);
  const admin = wrong ? null : await getAdmin();
  if (!wrong && !admin) {
    const here = `/oauth/authorize?${new URLSearchParams(p as Record<string, string>).toString()}`;
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  return (
    <div className={`${dashboardFont.className} min-h-screen bg-[#F3F5F8] text-[#1B2533] flex items-center justify-center p-6`}>
      <div className="w-full max-w-sm space-y-4 bg-white border border-[#DCE1E8] rounded-[4px] p-6">
        {wrong ? (
          <p className="text-sm text-[#B23A0A]">{wrong}</p>
        ) : (
          <form action={decide} className="space-y-4">
            <p className="text-lg font-semibold">Connect Claude to the dashboard?</p>
            <p className="text-sm text-[#5A6678]">
              Claude will be able to read clients, projects, deals, documents and invoices, and draft and finalise documents as {admin!.email}.
              It cannot delete anything, record payments or see bank details.
            </p>
            {Object.entries(p).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <div className="flex gap-2">
              <button name="allow" value="yes" className="flex-1 rounded-[4px] bg-[#1D4ED8] px-3 py-2 text-sm font-medium text-white">Allow</button>
              <button name="allow" value="no" className="flex-1 rounded-[4px] border border-[#DCE1E8] px-3 py-2 text-sm">Deny</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

Check: `admin.id` exists on `AdminUser` (`{ id, email }` in `src/lib/auth.ts`). Check `redirect()` to an external URL from a Server Action in the Next 16 docs.

- [ ] **Step 6: Check**

`npx tsc --noEmit -p .` (only the old error) and `npx eslint src/app/oauth "src/app/.well-known" src/app/login`.
The flow is exercised end to end in Task 12's smoke test.

- [ ] **Step 7: Commit**

```bash
git add src/app/oauth "src/app/.well-known" src/app/login/page.tsx
git commit -m "feat(connector): OAuth endpoints and the Claude consent page"
```

---

### Task 11: Connector tools, `src/lib/connector/tools.ts`

**Files:**
- Create: `src/lib/connector/tools.ts`, `scripts/connector-tools.test.ts`
- Modify: `package.json` (`"test:connector-tools": "bun scripts/connector-tools.test.ts"`)

Each tool is `{ name, title, description, input (zod object), run(args, actor) }`. `run` returns plain data; the MCP route (Task 12) turns it into a tool result. Descriptions are written for Claude: say when to use the tool and what it refuses. No em dashes. The full list is below; nothing else is exposed. No tool deletes, runs SQL, records payments, touches founder pay or splits, or returns bank details.

- [ ] **Step 1: Failing test**

`scripts/connector-tools.test.ts`:

```ts
// connector-tools.test.ts — every connector tool, called as a function, against
// the THROWAWAY local database only.
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/connector-tools.test.ts
import postgres from "postgres";
import { TOOLS } from "../src/lib/connector/tools";
import { closeDb } from "../src/lib/db";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const ME = "founder@example.com";
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(name: string, args: unknown): Promise<any> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(tool.input.parse(args), ME);
}
async function refused(name: string, args: unknown, re: RegExp) {
  try {
    await call(name, args);
    check(`${name} refuses`, false, "did not throw");
  } catch (e) {
    check(`${name} refuses: ${re}`, re.test(String((e as Error).message)), String((e as Error).message));
  }
}

async function reset() {
  await sql.begin(async (tx) => {
    await tx`alter table activity disable trigger activity_append_only`;
    await tx`alter table document_versions disable trigger document_versions_frozen`;
    await tx`delete from activity`;
    await tx`delete from document_versions`;
    await tx`delete from documents`;
    await tx`delete from deals`;
    await tx`delete from invoices where project_id in (select id from projects where name like 'TEST %')`;
    await tx`delete from payee_accounts`;
    await tx`delete from projects where name like 'TEST %'`;
    await tx`delete from clients where name like 'TEST %'`;
    await tx`alter table activity enable trigger activity_append_only`;
    await tx`alter table document_versions enable trigger document_versions_frozen`;
  });
}

try {
  await reset();
  check("exactly the agreed tools", TOOLS.map((t) => t.name).sort().join(",") ===
    "create_client_and_project,create_invoice_from_deal,find,finalise_document,get_client_context,get_deal,get_document,list_documents,save_deal,save_draft,set_status");
  check("no em dashes in tool text", TOOLS.every((t) => !/\u2014/.test(t.title + t.description)));

  const made = await call("create_client_and_project", { name: "TEST Andrea", company: "TEST Bites", projectName: "TEST Bites site" });
  check("create_client_and_project", !!made.projectId && !!made.reference);
  check("find", (await call("find", { query: "test bites" })).some((h: { kind: string }) => h.kind === "client"));

  const deal = await call("save_deal", { projectId: made.projectId, priceTotal: 6500, scope: ["Five pages"],
    paymentSchedule: [{ label: "Payment 1", amount: 3250, trigger: "On acceptance" }, { label: "Payment 2", amount: 3250, trigger: "On handover" }] });
  check("save_deal merges into the existing deal and keeps its reference", deal.reference === made.reference && deal.priceTotal === 6500);
  const deal2 = await call("save_deal", { projectId: made.projectId, notes: "Asked about a gallery" });
  check("save_deal with one field keeps the rest", deal2.priceTotal === 6500 && deal2.notes === "Asked about a gallery" && deal2.paymentSchedule.length === 2);
  check("get_deal", (await call("get_deal", { projectId: made.projectId }))?.reference === made.reference);
  await refused("save_deal", { projectId: made.projectId, priceTotal: 100 }, /add up/);

  const draft = await call("save_draft", { type: "proposal", title: "Proposal TEST", projectId: made.projectId });
  check("save_draft creates from the template, linked to the client and deal", draft.status === "draft" && draft.draft.length === 5 && draft.clientId === made.clientId && !!draft.dealId);
  await refused("finalise_document", { documentId: draft.id }, /missing/i);
  await call("save_draft", { documentId: draft.id, sections: ["summary", "goals", "scope", "timeline", "next_steps"].map((key) => ({ key, heading: key, body: "Written." })) });
  await refused("save_draft", { type: "invoice", title: "x", projectId: made.projectId }, /create_invoice_from_deal/);

  const got = await call("get_document", { documentId: draft.id });
  check("get_document shows the draft and a preview link", got.draft[0].body === "Written." && /\/admin\/documents\/.+\/pdf$/.test(got.previewUrl));

  const fin = await call("finalise_document", { documentId: draft.id });
  // Storage is not configured in this test, so the PDF cannot be stored; the version must still be frozen.
  check("finalise_document freezes v1 even when the PDF cannot be stored", fin.version === 1 && typeof fin.pdfUrl === "string" && typeof fin.pdfNote === "string");
  check("set_status sent", (await call("set_status", { documentId: draft.id, status: "sent" })).status === "sent");
  await refused("set_status", { documentId: draft.id, status: "signed" }, /signed copy/);

  const inv = await call("create_invoice_from_deal", { projectId: made.projectId, line: 1, payee: "zane" });
  check("create_invoice_from_deal", inv.document.payee === "zane" && !!inv.invoiceId);
  await refused("create_invoice_from_deal", { projectId: made.projectId, line: 2 }, /payee|Required|invalid/i);

  const ctx = await call("get_client_context", { clientId: made.clientId });
  check("get_client_context", ctx.projects[0].deal.reference === made.reference && ctx.documents.length === 2);
  check("no tool output carries bank details", !JSON.stringify(ctx).includes("account_number") && !JSON.stringify(inv).includes("accountNumber"));
  check("list_documents filters", (await call("list_documents", { clientId: made.clientId, type: "invoice" })).length === 1);
} finally {
  await reset();
  await sql.end();
  await closeDb();
}
console.log(failures ? `\n${failures} FAILED` : "\nAll connector-tools checks pass");
process.exit(failures ? 1 : 0);
```

Run with the local DATABASE_URL and **without** `SUPABASE_SERVICE_ROLE_KEY` set → FAIL (module not found).

- [ ] **Step 2: Implement**

`src/lib/connector/tools.ts`:

```ts
// Every tool the Claude connector exposes, as plain functions (tested without
// HTTP in scripts/connector-tools.test.ts; served by app/api/mcp/route.ts).
//
// This list is the safety boundary: there is no dev database, so Claude can do
// exactly these things and nothing else. No tool deletes, runs SQL, records a
// payment, touches founder pay or splits, or returns bank details.
import { z } from "zod";
import { createClientAndProject, findRecords, getClientContext } from "../connector-db";
import {
  DocumentRuleError,
  createDocument,
  createInvoiceFromDeal,
  finaliseDocument,
  getDealByProject,
  getDocument,
  getEntityActivity,
  listDocuments,
  saveDeal,
  saveDraftSections,
  setDocumentPayee,
  setDocumentStatus,
} from "../documents-db";
import { DOC_STATUSES, DOC_TYPES, PAYEES } from "../documents";
import { DEFAULT_SECTIONS } from "../doc-templates";
import { getProject } from "../db";
import { ensurePdf } from "../pdf/store";

export const DASHBOARD = "https://mindelo.site";
const docUrl = (id: string) => `${DASHBOARD}/admin/documents/${id}`;
const pdfUrl = (id: string, version?: number) => `${docUrl(id)}/pdf${version ? `?version=${version}` : ""}`;

const id = z.uuid();
// No .transform() anywhere in a tool's input: MCP publishes each input as JSON
// Schema, and zod cannot express a transform there. Rounding happens in run().
const money = z.number().nonnegative();
const cents = (n: number) => Math.round(n * 100) / 100;
const Section = z.object({ key: z.string().trim().min(1), heading: z.string().trim().min(1), body: z.string() });
const ScheduleLine = z.object({ label: z.string().trim().min(1), amount: money, trigger: z.string().trim().min(1) });
const CarePlan = z.object({
  monthlyAmount: money,
  minimumMonths: z.number().int().nonnegative(),
  noticeDays: z.number().int().nonnegative(),
  inclusions: z.array(z.string().trim().min(1)),
  exclusions: z.array(z.string().trim().min(1)),
});

type Tool<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  run: (args: z.output<S>, actor: string) => Promise<unknown>;
};
/** Erased so the list is one type: callers always parse with `input` before `run`. */
export type AnyTool = Omit<Tool<z.ZodType>, "run"> & { run: (args: any, actor: string) => Promise<unknown> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const tool = <S extends z.ZodType>(t: Tool<S>): AnyTool => t as AnyTool;

export const TOOLS: AnyTool[] = [
  tool({
    name: "find",
    title: "Find records",
    description: "Search clients, leads, projects, deal references (like IB-2026-01) and document titles. Use before creating anything, so nothing is duplicated. A deal hit's id is its project id.",
    input: z.object({ query: z.string().min(2) }),
    run: ({ query }) => findRecords(query),
  }),
  tool({
    name: "get_client_context",
    title: "Everything about a client",
    description: "One client with their projects (each with its deal: what was offered, price, payment schedule, care plan, deadline), documents, invoices with amounts paid, and recent activity. Read this before drafting anything for a client.",
    input: z.object({ clientId: id }),
    run: async ({ clientId }) => {
      const ctx = await getClientContext(clientId);
      if (!ctx) throw new DocumentRuleError("No client with that id. Use find.");
      return ctx;
    },
  }),
  tool({
    name: "get_deal",
    title: "Get a project's deal",
    description: "What was offered on one project: scope, price, payment schedule, care plan, deadline, goals, notes and default payee. Null if the project has no deal yet.",
    input: z.object({ projectId: id }),
    run: ({ projectId }) => getDealByProject(projectId),
  }),
  tool({
    name: "save_deal",
    title: "Create or update a project's deal",
    description: "Record what was offered on a project. Send only the fields that change; the rest are kept. A new deal needs a reference (CLIENT-YYYY-NN). Payment schedule amounts must add up to the price. Set payeeDefault only when a founder says who is being paid; never assume it.",
    input: z.object({
      projectId: id,
      reference: z.string().trim().optional(),
      scope: z.array(z.string().trim().min(1)).optional(),
      priceTotal: money.nullable().optional(),
      paymentSchedule: z.array(ScheduleLine).optional(),
      carePlan: CarePlan.nullable().optional(),
      deadline: z.iso.date().nullable().optional(),
      goals: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      payeeDefault: z.enum(PAYEES).nullable().optional(),
    }),
    run: async (a, actor) => {
      const current = await getDealByProject(a.projectId);
      const reference = a.reference ?? current?.reference;
      if (!reference) throw new DocumentRuleError("This project has no deal yet. Send a reference like IB-2026-01.");
      const pick = <K extends keyof typeof a>(k: K, fallback: unknown) => (a[k] === undefined ? fallback : a[k]);
      return saveDeal(
        {
          projectId: a.projectId,
          reference,
          scope: pick("scope", current?.scope ?? []) as string[],
          priceTotal: a.priceTotal != null ? cents(a.priceTotal) : (pick("priceTotal", current?.priceTotal ?? null) as number | null),
          paymentSchedule: (pick("paymentSchedule", current?.paymentSchedule ?? []) as z.output<typeof ScheduleLine>[])
            .map((l) => ({ ...l, amount: cents(l.amount) })),
          carePlan: ((c) => (c ? { ...c, monthlyAmount: cents(c.monthlyAmount) } : null))(
            pick("carePlan", current?.carePlan ?? null) as z.output<typeof CarePlan> | null),
          deadline: pick("deadline", current?.deadline ?? null) as string | null,
          goals: pick("goals", current?.goals ?? null) as string | null,
          notes: pick("notes", current?.notes ?? null) as string | null,
          payeeDefault: pick("payeeDefault", current?.payeeDefault ?? null) as (typeof PAYEES)[number] | null,
        },
        actor,
        "claude",
      );
    },
  }),
  tool({
    name: "create_client_and_project",
    title: "New client (or lead) with a project",
    description: "Create a client, or a lead when they have not agreed to work with us yet, plus one project and an empty deal with a fresh reference. Refuses a name that already exists: use find first.",
    input: z.object({
      name: z.string().trim().min(1),
      company: z.string().trim().nullable().default(null),
      email: z.email().nullable().default(null),
      phone: z.string().trim().nullable().default(null),
      asLead: z.boolean().default(false),
      projectName: z.string().trim().min(1),
    }),
    run: (a, actor) => createClientAndProject(a, actor, "claude"),
  }),
  tool({
    name: "list_documents",
    title: "List documents",
    description: "Documents filtered by client, project, type or status, newest first. Draft text is left out; use get_document for it.",
    input: z.object({
      clientId: id.optional(),
      projectId: id.optional(),
      type: z.enum(DOC_TYPES).optional(),
      status: z.enum(DOC_STATUSES).optional(),
    }),
    run: async (f) => (await listDocuments(f)).map(({ draft: _d, ...d }) => ({ ...d, url: docUrl(d.id) })), // eslint-disable-line @typescript-eslint/no-unused-vars
  }),
  tool({
    name: "get_document",
    title: "Get a document",
    description: "A document's draft sections (each with a key, so you can change one precisely), its frozen versions with PDF links, its payee if it is an invoice, and its history.",
    input: z.object({ documentId: id }),
    run: async ({ documentId }) => {
      const doc = await getDocument(documentId);
      if (!doc) throw new DocumentRuleError("No document with that id. Use find or list_documents.");
      return {
        ...doc,
        url: docUrl(doc.id),
        previewUrl: pdfUrl(doc.id),
        versions: doc.versions.map((v) => ({ ...v, pdfUrl: pdfUrl(doc.id, v.version) })),
        history: await getEntityActivity("document", doc.id, 20),
      };
    },
  }),
  tool({
    name: "save_draft",
    title: "Create a draft or change sections",
    description: "With documentId: replace the given sections (matched by key; new keys are added) and optionally the payee of an invoice. A finalised or sent document goes back to draft; its versions stay frozen. Without documentId: create a draft of a type, starting from the template's sections when none are given, linked to the project's client and deal. Write {{missing: what}} for any fact you do not have; it blocks finalising. Invoices are created with create_invoice_from_deal, not here.",
    input: z.object({
      documentId: id.optional(),
      type: z.enum(DOC_TYPES).optional(),
      title: z.string().trim().min(1).optional(),
      clientId: id.optional(),
      projectId: id.optional(),
      sections: z.array(Section).optional(),
      payee: z.enum(PAYEES).optional(),
    }),
    run: async (a, actor) => {
      if (a.documentId) {
        if (a.payee) await setDocumentPayee(a.documentId, a.payee, actor, "claude");
        if (a.sections?.length) await saveDraftSections(a.documentId, a.sections, actor, "claude");
        const doc = await getDocument(a.documentId);
        if (!doc) throw new DocumentRuleError("No document with that id");
        return { ...doc, url: docUrl(doc.id), previewUrl: pdfUrl(doc.id) };
      }
      if (!a.type || !a.title) throw new DocumentRuleError("A new draft needs a type and a title");
      if (a.type === "invoice") throw new DocumentRuleError("Invoices come from a payment line: use create_invoice_from_deal");
      const project = a.projectId ? await getProject(a.projectId) : null;
      if (a.projectId && !project) throw new DocumentRuleError("No project with that id");
      const deal = a.projectId ? await getDealByProject(a.projectId) : null;
      const doc = await createDocument(
        {
          type: a.type,
          title: a.title,
          clientId: a.clientId ?? project?.Client?.[0] ?? null,
          projectId: a.projectId ?? null,
          dealId: deal?.id ?? null,
          invoiceId: null,
          sections: a.sections ?? DEFAULT_SECTIONS[a.type] ?? [],
        },
        actor,
        "claude",
      );
      return { ...doc, url: docUrl(doc.id), previewUrl: pdfUrl(doc.id) };
    },
  }),
  tool({
    name: "finalise_document",
    title: "Finalise a document",
    description: "Freeze the draft as the next numbered version and make its PDF. Only when a founder says to finalise. Refused while any {{missing: …}} remains. Finalising an invoice issues it: the invoice gets its INV number and counts as sent. The version can never be edited afterwards.",
    input: z.object({ documentId: id }),
    run: async ({ documentId }, actor) => {
      const v = await finaliseDocument(documentId, actor, "claude");
      try {
        await ensurePdf(documentId, v.version);
        return { version: v.version, pdfUrl: pdfUrl(documentId, v.version) };
      } catch (e) {
        console.error("[connector] PDF", e);
        return { version: v.version, pdfUrl: pdfUrl(documentId, v.version), pdfNote: "Version frozen. The PDF is made when the link is first opened." };
      }
    },
  }),
  tool({
    name: "set_status",
    title: "Mark sent, accepted, declined or void",
    description: "Record what happened to a finalised document. Signed is not set here: a founder attaches the signed copy in the dashboard. Only when a founder says it happened.",
    input: z.object({ documentId: id, status: z.enum(["sent", "accepted", "declined", "void"]) }),
    run: ({ documentId, status }, actor) => setDocumentStatus(documentId, status, actor, "claude"),
  }),
  tool({
    name: "create_invoice_from_deal",
    title: "Invoice a payment line",
    description: "Draft an invoice for one line of a project's payment schedule (line 1 is the first payment), with its invoice document. Needs the payee: always ask the founder who is being paid (Michael, Zane or the company account) first; never assume. Due 14 days after today unless dueDate is given. The invoice stays a draft until the document is finalised.",
    input: z.object({ projectId: id, line: z.number().int().min(1), payee: z.enum(PAYEES), dueDate: z.iso.date().nullable().default(null) }),
    run: async (a, actor) => {
      const r = await createInvoiceFromDeal(a, actor, "claude");
      return { invoiceId: r.invoiceId, document: { ...r.document, url: docUrl(r.document.id), previewUrl: pdfUrl(r.document.id) } };
    },
  }),
];
```

Implementer checks:
- `getProject` exists in `src/lib/db.ts` (line ~1023) and returns `Project | null` with `Client?: string[]`.
- If zod's `.default()` inside `z.object` makes `tool.input.parse` output types awkward, adjust the generic, not the behaviour.
- `ensurePdf` must fail fast without Storage env (it throws "File storage is not configured"), which the test relies on.

- [ ] **Step 3: Run**

```bash
DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/connector-tools.test.ts
```
Expected: all PASS. Also rerun `documents-db`, `connector-db` and `oauth-db` tests (same DATABASE_URL), then `npx tsc --noEmit -p .`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/connector scripts/connector-tools.test.ts package.json
git commit -m "feat(connector): the connector's tool list as tested functions"
```

---

### Task 12: The MCP endpoint, `src/app/api/mcp/route.ts`, and a local smoke test

**Files:**
- Create: `src/app/api/mcp/route.ts`

- [ ] **Step 1: Route**

Confirm `createMcpHandler`'s options and the tool callback's `ctx` shape in `node_modules/mcp-handler/dist/index.d.ts` and `node_modules/@modelcontextprotocol/server` types first.

```ts
// The Claude connector. Claude Code and the Claude app call this with an OAuth
// bearer token (see app/oauth/*). The token names a founder; the tools are the
// fixed list in lib/connector/tools.ts and nothing else.
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { TOOLS } from "@/lib/connector/tools";
import { DocumentRuleError } from "@/lib/documents-db";
import { verifyAccessToken } from "@/lib/oauth-db";
import { SCOPE } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], ...(isError ? { isError: true } : {}) });

const handler = createMcpHandler(
  (server) => {
    for (const t of TOOLS) {
      server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.input }, async (args, ctx) => {
        const email = ctx.http?.authInfo?.extra?.email;
        if (typeof email !== "string") return text("Not signed in. Reconnect the Mindelo connector.", true);
        try {
          return text(JSON.stringify(await t.run(args, email), null, 2));
        } catch (e) {
          if (e instanceof DocumentRuleError) return text(e.message, true);
          console.error(`[mcp] ${t.name}`, e);
          return text("That did not work on the dashboard side. Nothing was saved by this call. Try again, or tell a founder.", true);
        }
      });
    }
  },
  { serverInfo: { name: "mindelo", version: "1.0.0" } },
);

const authed = withMcpAuth(
  handler,
  async (_req, token) => {
    if (!token) return undefined;
    const who = await verifyAccessToken(token);
    if (!who) return undefined;
    return { token, clientId: who.clientId, scopes: [SCOPE], expiresAt: Math.floor(who.expiresAt / 1000), extra: { email: who.email, userId: who.userId } };
  },
  { required: true, resourceMetadataPath: "/.well-known/oauth-protected-resource" },
);

export { authed as GET, authed as POST, authed as DELETE };
```

Note: "Nothing was saved by this call" is true because every write runs in one transaction; keep it only if that stays true for every tool.

- [ ] **Step 2: Local smoke test, against the throwaway DB only**

There is no `.env.local` in this worktree; check with `ls business-dashboard/.env*` and **stop** if `.env.local` exists (rename it to `.env.local.bak` for the test and back afterwards, or run from a copy). Then:

```bash
cd business-dashboard
DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres \
NEXT_PUBLIC_SUPABASE_URL=http://localhost:1 NEXT_PUBLIC_SUPABASE_ANON_KEY=x \
npx next dev -p 5510
```
(run in the background), then in another shell:

```bash
U=11111111-1111-4111-8111-111111111111
docker exec docs-pg psql -U postgres -c "create table if not exists profiles (id uuid primary key, email text not null, role text not null default 'admin'); insert into profiles values ('$U','founder@example.com','admin') on conflict do nothing;"
TOKEN=smoke-$(date +%s)-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
HASH=$(printf %s "$TOKEN" | sha256sum | cut -d' ' -f1)
docker exec docs-pg psql -U postgres -c "insert into oauth_tokens (token_hash, kind, user_id, client_id, expires_at) values ('$HASH','access','$U','smoke', now() + interval '10 minutes');"

curl -s -i http://localhost:5510/api/mcp -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -5        # expect 401 with WWW-Authenticate resource_metadata
curl -s http://localhost:5510/.well-known/oauth-protected-resource/api/mcp   # expect JSON naming authorization_servers
curl -s http://localhost:5510/.well-known/oauth-authorization-server         # expect the endpoints
curl -s http://localhost:5510/api/mcp -X POST -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' -H 'mcp-protocol-version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'                        # expect the 11 tools
curl -s http://localhost:5510/api/mcp -X POST -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' -H 'mcp-protocol-version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"find","arguments":{"query":"zz"}}}'   # expect a [] result
curl -s -X POST http://localhost:5510/oauth/register -H 'content-type: application/json' -d '{"redirect_uris":["https://evil.com/cb"]}'   # expect 400
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'http://localhost:5510/oauth/authorize?response_type=code&client_id=x&redirect_uri=http%3A%2F%2Flocalhost%3A9%2Fcb&code_challenge=abc&code_challenge_method=S256'   # expect a redirect to /login?next=...
```

If the 2025 protocol needs an `initialize` call first, send `{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}` before `tools/list`, as the mcp-handler README describes. Stop the dev server, delete the smoke rows (`delete from oauth_tokens where client_id='smoke'`), and paste the outputs in your report.

Then the asset tracing check from Task 6 Step 6 again, now expecting `.next/server/app/api/mcp/route.js.nft.json` to list the fonts too.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mcp
git commit -m "feat(connector): MCP endpoint at /api/mcp behind OAuth"
```

---

### Task 13: The `/doc` skill and the Claude Project instructions (outside the repo)

**Files (private, NOT in the repository):**
- Create: `C:\Users\taylo\.claude\skills\doc\SKILL.md`
- Create: `C:\Users\taylo\.claude\skills\doc\house-style.md`
- Create: `C:\Users\taylo\.claude\skills\doc\project-instructions.md`

Nothing in this task is committed to `mpd-documents`. The source documents in `C:\Users\taylo\Downloads\` (the SOP and Documentation Standard, past proposals, quotes, invoices, care packages and signed agreements) contain client data: read them to learn Mindelo's style, terms and structure, and copy wording into the private skill only, never into the repo.

- [ ] **Step 1: Read the sources**

Read with the Read tool (PDFs) or the `anthropic-skills:pdf` / `docx` skills: the SOP and Documentation Standard (search Downloads for `SOP`), at least two proposals, two quotes, two invoices, the care package, and the signed agreements. Note: section order, tone, recurring terms (deposit, revisions, hosting, ownership, care-plan inclusions and exclusions), how prices and schedules are written, sign-off.

- [ ] **Step 2: `house-style.md`**

Write what you learned as rules plus short examples: voice (plain, concise, offer to expand rather than pad, no em dashes), default section order per type (proposal, quote, invoice), standard terms worded the way Mindelo already words them, care-plan default (minimum 3 months, then month to month until either side gives 30 days' notice; inclusions standard, price per deal), legal name (MINDELOAI LIMITED, trading as Mindelo), the reference format (`CLIENT-YYYY-NN`), item lines (`description | amount`). Mark anything that is a guess as "confirm with a founder".

- [ ] **Step 3: `SKILL.md`**

```markdown
---
name: doc
description: Mindelo's document employee. Use when a founder wants a proposal, quote, invoice or any client document drafted, changed, finalised or discussed, or asks what was offered to a client ("/doc", "draft a proposal for…", "invoice the deposit for…", "what did we promise…").
---

# Document employee

You are Mindelo's document employee: a careful, friendly member of staff who turns what a founder says into proposals, quotes and invoices, remembers every deal, and never sends anything on their own. Founders are Michael and Zane. Read house-style.md in this folder before drafting.

## Where facts come from (in this order)
1. The dashboard, through the `mindelo` connector tools (find, get_client_context, get_deal, get_document, list_documents). It wins when sources disagree; say so when they do.
2. The Obsidian vault: grep `C:\Users\taylo\OneDrive\Documents\MY VAULT\Home.md`, then the client's note under `01 - Projects\Clients\` and `Clients MOC.md`.
3. GitHub (`gh`) for what was actually built, when a document describes delivered work.
4. The founder. Ask only what none of the above answers, a few questions at a time, and suggest a default from past deals ("Last two sites were 50/50 deposit and handover. Same here?").

## How you work
- New client or project: `find` first. Only then `create_client_and_project` (asLead when they have not agreed yet).
- Record the deal (`save_deal`) before drafting from it: scope, price, payment schedule, care plan, deadline, goals, and notes on what was discussed, objections and concessions.
- Draft with `save_draft`. Change one section at a time by key. Write `{{missing: what}}` for any fact you do not have; never invent one.
- Flag, without blocking: no care-plan minimum, a price below comparable past deals, an unusual payment split.
- Discuss freely: explain why a section says what it says (cite the deal or a past document), offer options when asked about objections, and give the preview link (`previewUrl`) so the founder can see it.
- Finalise only when a founder says "finalise". Before finalising an invoice, say: "Finalising issues the invoice: it gets its INV number and counts as sent."
- Status: `set_status` only for what a founder says happened. Signed comes from attaching the signed copy in the dashboard.

## Money and bank details
- Before any invoice: ask who is being paid, Michael, Zane or the company account. Every time, even if the deal has a default; offer the default as the suggestion.
- You never see bank details and never type them. They come from the dashboard's Bank details page onto the PDF.
- You never record payments, change founder pay or splits, or delete anything. If asked, say it is done in the dashboard.

## Sending
Never send to a client unless a founder says "send it" in this conversation. Then draft the email in Gmail with the PDF link and show it before sending.

## When the connector fails
Say plainly what failed, keep the draft in the conversation, and never claim a save that did not happen. If the login expired, tell the founder to reconnect the Mindelo connector.
```

- [ ] **Step 4: `project-instructions.md`**

The text Michael pastes into a Claude Project ("Mindelo documents") for the phone app: the SKILL.md body adapted for the app (no Obsidian or `gh`; the GitHub connector instead; the dashboard is the memory), followed by the full house-style.md. Under 8,000 characters if possible. First line: `Paste everything below into the Project's instructions.`

- [ ] **Step 5: Check**

Grep the three files for em dashes (`—`) and remove any. Confirm `git -C C:/Users/taylo/mpd-documents status` shows nothing from this task.

---

## After all tasks: hand-off to Michael (not done by any subagent)

Report what was built, what was checked (test outputs, the four PDFs looked at, the smoke test), what was not (a real OAuth round trip from claude.ai and real Storage only happen in production), and these decisions taken by default, for him to confirm or change:

1. **Finalising an invoice document issues the invoice** (Draft to Sent, which gives it its INV number). Without that, the PDF would have no number.
2. **Invoices from a deal are due 14 days after issue** unless a due date is given.
3. **New projects from Claude start at status Lead.**
4. `attach_file` and `whats_outstanding` are not in this phase.

Go-live, in order, all done by Michael:
1. Phase 1 first (migrations 022 then 023, service role key), if not already live.
2. `node --env-file=.env.local scripts/run-migration.mjs scripts/migrations/024_documents_phase_2.up.sql --dry-run`, then without `--dry-run`. Needs `DIRECT_URL` in `.env.local`.
3. Merge (deploys). No new environment variables.
4. Dashboard → Bank details: fill in Michael, Zane and the company account.
5. Claude app: Settings → Connectors → Add custom connector → `https://mindelo.site/api/mcp`, sign in, Allow. Create a Project "Mindelo documents" and paste `project-instructions.md`.
6. Claude Code: `claude mcp add --transport http --scope user mindelo https://mindelo.site/api/mcp`, then `/mcp` to sign in.
7. First real test: "/doc new client, made-up name, quote for a 3-page site" end to end, then void it.
