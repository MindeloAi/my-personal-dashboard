# Document Employee, Phase 1 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard deals, documents (with frozen versions), file attachments and an activity log, plus record pages for clients, projects, invoices and documents, and make every record name in `/admin` a link.

**Architecture:** New tables come in through migration 022 (and 023 for the Storage bucket). Rules with no database live in pure `src/lib/documents.ts` and `src/lib/client-data.ts`, checked by bun assert scripts. Database reads and writes live in `src/lib/documents-db.ts`, following `src/lib/timeline-db.ts` (plain SQL, snake_case rows mapped once). Files go to a private Supabase Storage bucket via signed upload URLs, so large files never pass through a Vercel function. Server actions live in a new `src/app/documents-actions.ts`. Pages are server components that fetch, plus small client components for buttons and modals.

**Tech Stack:** Next.js 16.2 (App Router; read `business-dashboard/node_modules/next/dist/docs/` before writing route code, per `AGENTS.md`), postgres.js, Supabase Storage (`@supabase/supabase-js`), zod 4, Tailwind 4, recharts via `components/dashboard/chart-kit.tsx`, bun for test scripts.

**Spec:** `docs/superpowers/specs/2026-11-03-document-employee-design.md`. Phase 1 = "Foundations" in its Delivery section. The connector, templates, PDFs and the `/doc` skill are Phase 2 and are NOT in this plan.

---

## Ground rules for every task

- Work in `C:\Users\taylo\mpd-documents` on branch `feat/document-employee`. All app paths below are relative to `business-dashboard/`.
- **There is no dev database.** `.env.local` points at LIVE production. Never run a dev server, a script or a test that writes using `.env.local`. Database tests use the throwaway local Postgres from Task 1 only.
- **Never apply a migration to production.** Michael applies migrations himself. Never `git push`, never merge, never deploy.
- The repository is **public**: no client names, prices, emails or bank details in code, tests, fixtures or commit messages. Use made-up names ("Island Bites", "Acme").
- House style for UI: Corporate Navy palette (`#0E1A2B` navy, `#1D4ED8` blue actions, `#1E6B3A` paid green, `#B23A0A` owed orange, `#F3F5F8` page, white panels, `#DCE1E8` borders, 4px corners), plain-English purpose text through `PageHeader` / `Explain` / `StatTile` from `components/dashboard/explain.tsx`. No em dashes in user-facing text.
- Every page calls `requireAdminPage()`. Every server action calls `requireAdmin()` first.
- Commit after each task with a conventional message ending in:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## File map

| File | Responsibility |
|---|---|
| `scripts/migrations/022_documents.up.sql` / `.down.sql` | deals, documents, document_versions, attachments, activity |
| `scripts/migrations/023_files_bucket.up.sql` / `.down.sql` | private `files` Storage bucket (prod only) |
| `scripts/schema.sql` | append the same tables so a fresh database matches |
| `src/lib/documents.ts` | pure rules: types, labels, references, schedule check, status transitions, missing facts, section merge |
| `scripts/documents.test.ts` | asserts for `documents.ts` (no DB) |
| `src/lib/documents-db.ts` | SQL for deals, documents, versions, attachments, activity |
| `scripts/documents-db.test.ts` | acceptance checks against local Postgres only |
| `src/lib/storage.ts` | server-only Storage helpers (signed upload/download URLs, remove) |
| `src/app/documents-actions.ts` | server actions for deals, documents, attachments |
| `src/lib/record-graph.ts` | `href` gains real project, invoice and document pages |
| `src/lib/client-data.ts` + `scripts/client-data.test.ts` | pure money summary for one client |
| `src/components/dashboard/deal-card.tsx` | deal display + edit modal |
| `src/components/dashboard/files-panel.tsx` | attachments list + upload |
| `src/components/dashboard/documents-table.tsx` | documents list, every name a link |
| `src/components/dashboard/activity-list.tsx` | activity feed |
| `src/app/admin/projects/[id]/page.tsx` | project page |
| `src/app/admin/finance/invoices/[id]/page.tsx` | invoice page |
| `src/app/admin/documents/page.tsx`, `[id]/page.tsx`, `[id]/document-actions.tsx` | documents list + document page |
| `src/app/admin/clients/[id]/page.tsx` + `client-file.tsx` | client file upgrade |
| `src/components/dashboard/sidebar.tsx` | Documents nav item |

Task order: 1 → 2 → 3 → 4 → 5, then 6–11 in any order (each depends only on 1–5), then 12 last.

---

### Task 1: Migration 022, the tables

**Files:**
- Create: `scripts/migrations/022_documents.up.sql`
- Create: `scripts/migrations/022_documents.down.sql`
- Modify: `scripts/schema.sql` (append at the end)

- [ ] **Step 1: Write the up migration**

`scripts/migrations/022_documents.up.sql`:

```sql
-- 022_documents.up.sql
--
-- What we offered each client, the documents built from it, and the files
-- attached to any record.
--
-- `deals`: one per project. The scope, price, payment schedule, care plan and
-- deadline that every later document is built from.
-- `documents`: a proposal, quote, agreement, care plan, change request, invoice
-- or SOP. `draft` is an editable list of sections. Finalising copies the draft
-- into `document_versions`, which can never be changed or deleted.
-- `attachments`: a file in the private `files` Storage bucket, attached to a
-- client, project, invoice or document. Only the metadata lives here.
-- `activity`: append-only log of who did what, through the dashboard or Claude.
--
-- FKs are ON DELETE SET NULL like the rest of the schema, except versions,
-- which block deleting a document that has been finalised.

create or replace function schedule_total(j jsonb) returns numeric
language sql immutable as $$
  select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(j) x
$$;

create table if not exists deals (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid unique references projects(id) on delete set null,
  reference        text not null unique check (reference ~ '^[A-Z0-9]{2,8}-[0-9]{4}-[0-9]{2}$'),
  scope            text[] not null default '{}',
  price_total      numeric(12,2) check (price_total is null or price_total >= 0),
  currency         text not null default 'TTD',
  payment_schedule jsonb not null default '[]' check (jsonb_typeof(payment_schedule) = 'array'),
  care_plan        jsonb check (care_plan is null or jsonb_typeof(care_plan) = 'object'),
  deadline         date,
  goals            text,
  notes            text,
  payee_default    text check (payee_default in ('michael','zane','company')),
  created_by       text not null,
  updated_by       text not null,
  updated_via      text not null default 'dashboard' check (updated_via in ('dashboard','claude')),
  created          timestamptz not null default now(),
  updated          timestamptz not null default now(),
  constraint deals_schedule_adds_up check (
    jsonb_array_length(payment_schedule) = 0
    or (price_total is not null and schedule_total(payment_schedule) = price_total)
  )
);

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('proposal','quote','service_agreement','care_plan','change_request','invoice','sop')),
  client_id       uuid references clients(id) on delete set null,
  project_id      uuid references projects(id) on delete set null,
  deal_id         uuid references deals(id) on delete set null,
  invoice_id      uuid references invoices(id) on delete set null,
  title           text not null check (length(trim(title)) > 0),
  status          text not null default 'draft'
                  check (status in ('draft','finalised','sent','accepted','signed','declined','void')),
  draft           jsonb not null default '[]' check (jsonb_typeof(draft) = 'array'),
  current_version integer not null default 0 check (current_version >= 0),
  created_by      text not null,
  updated_by      text not null,
  updated_via     text not null default 'dashboard' check (updated_via in ('dashboard','claude')),
  created         timestamptz not null default now(),
  updated         timestamptz not null default now(),
  constraint documents_invoice_only_on_invoices check (type = 'invoice' or invoice_id is null)
);

create table if not exists document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id),
  version      integer not null check (version >= 1),
  title        text not null,
  sections     jsonb not null check (jsonb_typeof(sections) = 'array'),
  pdf_path     text,
  finalised_by text not null,
  finalised_at timestamptz not null default now(),
  unique (document_id, version)
);

create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('client','project','invoice','document')),
  entity_id    uuid not null,
  storage_path text not null unique,
  filename     text not null,
  content_type text not null,
  size         bigint not null check (size > 0),
  kind         text not null default 'other' check (kind in ('signed_copy','proof_of_payment','asset','other')),
  uploaded_by  text not null,
  created      timestamptz not null default now()
);

create table if not exists activity (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('client','project','deal','document','invoice','attachment')),
  entity_id   uuid not null,
  client_id   uuid references clients(id) on delete set null,
  action      text not null,
  summary     text not null,
  actor       text not null,
  via         text not null default 'dashboard' check (via in ('dashboard','claude')),
  created     timestamptz not null default now()
);

create index if not exists documents_client_idx on documents (client_id, updated desc);
create index if not exists documents_project_idx on documents (project_id, updated desc);
create index if not exists attachments_entity_idx on attachments (entity_type, entity_id, created desc);
create index if not exists activity_client_idx on activity (client_id, created desc);
create index if not exists activity_entity_idx on activity (entity_type, entity_id, created desc);

-- A finalised version is frozen. The one allowed change is filling in its PDF
-- path once, after the PDF has been rendered (Phase 2).
create or replace function document_versions_frozen() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'document versions cannot be deleted';
  end if;
  if new.document_id is distinct from old.document_id
     or new.version is distinct from old.version
     or new.title is distinct from old.title
     or new.sections is distinct from old.sections
     or new.finalised_by is distinct from old.finalised_by
     or new.finalised_at is distinct from old.finalised_at
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path) then
    raise exception 'document versions cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists document_versions_frozen on document_versions;
create trigger document_versions_frozen before update or delete on document_versions
  for each row execute function document_versions_frozen();

-- Signed and void are final.
create or replace function documents_final_states() returns trigger
language plpgsql as $$
begin
  if old.status in ('signed','void') and new.status is distinct from old.status then
    raise exception 'a % document cannot change status', old.status;
  end if;
  return new;
end $$;

drop trigger if exists documents_final_states on documents;
create trigger documents_final_states before update on documents
  for each row execute function documents_final_states();

-- The activity log is append-only.
create or replace function activity_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'activity is append-only';
end $$;

drop trigger if exists activity_append_only on activity;
create trigger activity_append_only before update or delete on activity
  for each row execute function activity_append_only();

-- Same lockdown as every other table: RLS on with zero policies.
alter table deals             enable row level security;
alter table documents         enable row level security;
alter table document_versions enable row level security;
alter table attachments       enable row level security;
alter table activity          enable row level security;
revoke all on table deals             from anon, authenticated;
revoke all on table documents         from anon, authenticated;
revoke all on table document_versions from anon, authenticated;
revoke all on table attachments       from anon, authenticated;
revoke all on table activity          from anon, authenticated;
```

- [ ] **Step 2: Write the down migration**

`scripts/migrations/022_documents.down.sql`:

```sql
-- 022_documents.down.sql — drops everything 022 created. Destroys deal,
-- document, attachment metadata and activity rows. Storage files are untouched.
drop table if exists activity;
drop table if exists attachments;
drop table if exists document_versions;
drop table if exists documents;
drop table if exists deals;
drop function if exists activity_append_only();
drop function if exists documents_final_states();
drop function if exists document_versions_frozen();
drop function if exists schedule_total(jsonb);
```

- [ ] **Step 3: Append the same DDL to `scripts/schema.sql`**

Open `scripts/schema.sql`, read how earlier migrations were mirrored at the end of it, then append the full body of `022_documents.up.sql` (everything except the leading comment block) under a heading comment `-- Documents, deals, attachments, activity (migration 022)`.

- [ ] **Step 4: Start a throwaway local Postgres and apply the schema + 022**

Docker Desktop is installed. Use a dedicated container so no other branch's test database is touched:

```bash
docker run -d --name docs-pg -e POSTGRES_PASSWORD=pg -p 55433:5432 postgres:17
sleep 5
docker exec docs-pg psql -U postgres -c "create role anon; create role authenticated;"
docker exec -i docs-pg psql -U postgres < scripts/schema.sql
for m in 011_founder_ledger 012_founder_projection 013_cash_never_negative 015_client_timeline 016_business_cash_collections 017_change_bonus_shares 018_zane_keeps_share 019_links_and_numbering 020_data_cleanup 021_business_cash_can_go_negative 022_documents; do
  DIRECT_URL=postgres://postgres:pg@localhost:55433/postgres node scripts/run-migration.mjs scripts/migrations/$m.up.sql || break
done
```

If `schema.sql` already contains a migration's objects and its re-run fails on an existing object, read the error, and skip only that migration (schema.sql already has it). The final 022 run must print `Applied to schema "public".` Since you just appended 022's DDL to schema.sql, the 022 run is a re-run: every statement uses `if not exists` / `create or replace` / `drop trigger if exists`, so it must still succeed.

- [ ] **Step 5: Check the down migration round-trips**

```bash
DIRECT_URL=postgres://postgres:pg@localhost:55433/postgres node scripts/run-migration.mjs scripts/migrations/022_documents.down.sql
DIRECT_URL=postgres://postgres:pg@localhost:55433/postgres node scripts/run-migration.mjs scripts/migrations/022_documents.up.sql
```

Expected: both end with `Applied to schema "public".`

- [ ] **Step 6: Commit**

```bash
git add scripts/migrations/022_documents.up.sql scripts/migrations/022_documents.down.sql scripts/schema.sql
git commit -m "feat(documents): migration 022, deals, documents, versions, attachments, activity"
```

---

### Task 2: Migration 023, the private files bucket

**Files:**
- Create: `scripts/migrations/023_files_bucket.up.sql`
- Create: `scripts/migrations/023_files_bucket.down.sql`

This only runs on Supabase (the local test Postgres has no `storage` schema). Do NOT run it anywhere; Michael applies it to prod.

- [ ] **Step 1: Write both files**

`023_files_bucket.up.sql`:

```sql
-- 023_files_bucket.up.sql
--
-- The private bucket that holds every attachment and, from Phase 2, every
-- finalised PDF. Private: no public URLs. The app reads and writes it with the
-- service role key on the server and hands the browser short-lived signed URLs.
-- No storage.objects policies are added, so the anon key can do nothing.
-- Supabase only; the local test database has no storage schema.
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 26214400)
on conflict (id) do nothing;
```

`023_files_bucket.down.sql`:

```sql
-- 023_files_bucket.down.sql — only succeeds when the bucket is empty.
delete from storage.buckets where id = 'files';
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrations/023_files_bucket.*.sql
git commit -m "feat(documents): migration 023, private files bucket"
```

---

### Task 3: Pure rules, `src/lib/documents.ts`

**Files:**
- Create: `src/lib/documents.ts`
- Test: `scripts/documents.test.ts`

- [ ] **Step 1: Write the failing test**

`scripts/documents.test.ts`:

```ts
// Checks the document and deal rules. No database.
//   bun scripts/documents.test.ts
import assert from "node:assert/strict";
import {
  canMove,
  mergeSections,
  missingFacts,
  nextReference,
  scheduleProblem,
  suggestPrefix,
  type Section,
} from "../src/lib/documents";

// References
assert.equal(nextReference("IB", 2026, []), "IB-2026-01");
assert.equal(nextReference("ib", 2026, ["IB-2026-01", "IB-2026-03", "IB-2025-07"]), "IB-2026-04", "next after the highest that year");
assert.equal(nextReference("A&B Co", 2026, []), "ABCO-2026-01", "non-alphanumerics dropped");
assert.throws(() => nextReference("X", 2026, []), /two letters/);
assert.equal(suggestPrefix("Island Bites"), "IB");
assert.equal(suggestPrefix("Acme"), "ACME");
assert.equal(suggestPrefix("The Plumbing Solutions Limited"), "PS", "filler words skipped");
assert.equal(suggestPrefix("!!"), "CL", "fallback");

// Payment schedule
assert.equal(scheduleProblem(null, []), null, "no schedule is fine");
assert.equal(scheduleProblem(6500, [
  { label: "Payment 1", amount: 3250, trigger: "On acceptance" },
  { label: "Payment 2", amount: 3250, trigger: "On handover" },
]), null);
assert.equal(scheduleProblem(0.3, [
  { label: "a", amount: 0.1, trigger: "x" },
  { label: "b", amount: 0.2, trigger: "y" },
]), null, "compared in cents");
assert.match(scheduleProblem(6500, [{ label: "P1", amount: 3000, trigger: "x" }]) ?? "", /add up to 3000\.00/);
assert.match(scheduleProblem(null, [{ label: "P1", amount: 10, trigger: "x" }]) ?? "", /total price/);
assert.match(scheduleProblem(10, [{ label: "", amount: 10, trigger: "x" }]) ?? "", /label/);
assert.match(scheduleProblem(10, [{ label: "P1", amount: 0, trigger: "x" }]) ?? "", /more than zero/);

// Status transitions
assert.equal(canMove("draft", "finalised"), true);
assert.equal(canMove("draft", "sent"), false, "must be finalised before it is sent");
assert.equal(canMove("sent", "draft"), true, "revising a sent document starts a new draft");
assert.equal(canMove("signed", "draft"), false, "signed is final");
assert.equal(canMove("void", "draft"), false, "void is final");

// Missing facts
const secs: Section[] = [
  { key: "parties", heading: "The client", body: "{{missing: client address}}\nRepresented by {{ missing: signatory title }}" },
  { key: "fees", heading: "Fees", body: "Total {{missing: client address}}" },
];
assert.deepEqual(missingFacts(secs), ["client address", "signatory title"], "deduplicated, in order");
assert.deepEqual(missingFacts([{ key: "a", heading: "A", body: "all there" }]), []);

// Section merge
const base: Section[] = [
  { key: "a", heading: "A", body: "1" },
  { key: "b", heading: "B", body: "2" },
];
assert.deepEqual(mergeSections(base, [{ key: "b", heading: "B", body: "new" }]).map((s) => s.body), ["1", "new"], "replaced in place");
assert.deepEqual(mergeSections(base, [{ key: "c", heading: "C", body: "3" }]).map((s) => s.key), ["a", "b", "c"], "new keys appended");
assert.deepEqual(
  mergeSections(base, [{ key: "c", heading: "C", body: "x" }, { key: "c", heading: "C", body: "y" }]).map((s) => s.body),
  ["1", "2", "y"],
  "a key given twice: last wins, appended once",
);

console.log("documents: all checks pass");
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun scripts/documents.test.ts`
Expected: FAIL, cannot find module `../src/lib/documents`.

- [ ] **Step 3: Write `src/lib/documents.ts`**

```ts
// Deals and documents (migration 022): the rules, with no database. Shared by
// the dashboard pages, documents-db.ts and, from Phase 2, the connector.
// Checked by scripts/documents.test.ts.

export const DOC_TYPES = ["proposal", "quote", "service_agreement", "care_plan", "change_request", "invoice", "sop"] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  proposal: "Proposal",
  quote: "Quote",
  service_agreement: "Service agreement",
  care_plan: "Care plan",
  change_request: "Change request",
  invoice: "Invoice",
  sop: "SOP",
};

export const DOC_STATUSES = ["draft", "finalised", "sent", "accepted", "signed", "declined", "void"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];
export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft",
  finalised: "Finalised",
  sent: "Sent",
  accepted: "Accepted",
  signed: "Signed",
  declined: "Declined",
  void: "Void",
};

export const PAYEES = ["michael", "zane", "company"] as const;
export type Payee = (typeof PAYEES)[number];
export const PAYEE_LABEL: Record<Payee, string> = { michael: "Michael", zane: "Zane", company: "Company account" };

export const ATTACHABLE = ["client", "project", "invoice", "document"] as const;
export type Attachable = (typeof ATTACHABLE)[number];

export const FILE_KINDS = ["signed_copy", "proof_of_payment", "asset", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  signed_copy: "Signed copy",
  proof_of_payment: "Proof of payment",
  asset: "Asset",
  other: "Other",
};

export type Section = { key: string; heading: string; body: string };
export type ScheduleLine = { label: string; amount: number; trigger: string };
export type CarePlan = {
  monthlyAmount: number;
  minimumMonths: number;
  noticeDays: number;
  inclusions: string[];
  exclusions: string[];
};

export const REFERENCE_RE = /^[A-Z0-9]{2,8}-\d{4}-\d{2}$/;

const FILLER = new Set(["THE", "AND", "LIMITED", "LTD", "CO", "COMPANY", "INC"]);

/** A short code from a client name: "Island Bites" → "IB", "Acme" → "ACME". */
export function suggestPrefix(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").split(" ").filter((w) => w && !FILLER.has(w));
  if (words.length === 0) return "CL";
  if (words.length === 1) return words[0].slice(0, 4).padEnd(2, "X");
  return words.map((w) => w[0]).join("").slice(0, 4);
}

/** The next free engagement code for a prefix in a year: IB-2026-01, IB-2026-02… */
export function nextReference(prefix: string, year: number, taken: string[]): string {
  const p = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (p.length < 2) throw new Error("A reference prefix needs at least two letters or digits");
  const stem = `${p}-${year}-`;
  const used = taken.filter((t) => t.startsWith(stem)).map((t) => Number(t.slice(stem.length))).filter(Number.isInteger);
  const n = Math.max(0, ...used) + 1;
  if (n > 99) throw new Error(`${stem}99 is the last reference for this prefix and year`);
  return `${stem}${String(n).padStart(2, "0")}`;
}

/** Why a payment schedule is wrong, or null. Compared in cents so 0.1 + 0.2 adds up. */
export function scheduleProblem(total: number | null, lines: ScheduleLine[]): string | null {
  if (lines.length === 0) return null;
  if (lines.some((l) => !l.label.trim() || !l.trigger.trim())) return "Every payment needs a label and when it falls due";
  if (lines.some((l) => !(l.amount > 0))) return "Every payment must be more than zero";
  if (total == null) return "Set the total price before splitting it into payments";
  const cents = (n: number) => Math.round(n * 100);
  const sum = lines.reduce((s, l) => s + cents(l.amount), 0);
  if (sum !== cents(total)) return `Payments add up to ${(sum / 100).toFixed(2)}, not the total of ${total.toFixed(2)}`;
  return null;
}

/** Where a document can go from each status. Signed and void are final. */
export const TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  draft: ["finalised", "void"],
  finalised: ["sent", "draft", "void"],
  sent: ["accepted", "declined", "signed", "draft", "void"],
  accepted: ["signed", "draft", "void"],
  declined: ["draft", "void"],
  signed: [],
  void: [],
};
export const canMove = (from: DocStatus, to: DocStatus) => TRANSITIONS[from].includes(to);

// A fact a draft still needs, written into its text as {{missing: client address}}.
const MISSING_RE = /\{\{\s*missing:\s*([^}]+?)\s*\}\}/g;

/** Every missing fact named in the sections, once each, in order. Finalising is blocked while any remain. */
export function missingFacts(sections: Section[]): string[] {
  const out = new Set<string>();
  for (const s of sections) for (const m of `${s.heading}\n${s.body}`.matchAll(MISSING_RE)) out.add(m[1]);
  return [...out];
}

/** Replace sections by key in place; keys not already there are appended. A key given twice: last wins. */
export function mergeSections(current: Section[], changes: Section[]): Section[] {
  const byKey = new Map(changes.map((c) => [c.key, c]));
  const have = new Set(current.map((s) => s.key));
  return [...current.map((s) => byKey.get(s.key) ?? s), ...[...byKey.values()].filter((c) => !have.has(c.key))];
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `bun scripts/documents.test.ts`
Expected: `documents: all checks pass`

- [ ] **Step 5: Add the npm script and commit**

In `package.json` `scripts`, after `"test:subscriptions"`, add:
`"test:documents": "bun scripts/documents.test.ts"`

```bash
git add src/lib/documents.ts scripts/documents.test.ts package.json
git commit -m "feat(documents): pure rules for references, schedules, statuses and sections"
```

---

### Task 4: Database layer, `src/lib/documents-db.ts`

**Files:**
- Create: `src/lib/documents-db.ts`
- Test: `scripts/documents-db.test.ts`

Read `src/lib/timeline-db.ts` first: this file follows it exactly (plain SQL via `getSql()`, `Row` type, snake_case → camelCase mappers, `sql.begin` for multi-step writes).

- [ ] **Step 1: Write the failing acceptance test**

`scripts/documents-db.test.ts`:

```ts
// documents-db.test.ts — acceptance checks for migration 022 and documents-db.ts.
//
// Runs against the THROWAWAY database from plan Task 1 (container docs-pg,
// port 55433). It deletes rows, so it refuses anything that is not localhost.
//
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/documents-db.test.ts

import postgres from "postgres";
import {
  addAttachment,
  createDocument,
  deleteAttachment,
  finaliseDocument,
  getClientActivity,
  getDealByProject,
  getDocument,
  listAttachments,
  listDocuments,
  saveDeal,
  saveDraftSections,
  setDocumentStatus,
  DocumentRuleError,
} from "../src/lib/documents-db";
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
async function rejects(name: string, fn: () => Promise<unknown>, re: RegExp) {
  try {
    await fn();
    check(name, false, "did not throw");
  } catch (e) {
    check(name, re.test(String((e as Error).message)), String((e as Error).message));
  }
}

async function reset() {
  // activity and document_versions are protected by triggers; disable them for the wipe only.
  await sql.begin(async (tx) => {
    await tx`alter table activity disable trigger activity_append_only`;
    await tx`alter table document_versions disable trigger document_versions_frozen`;
    await tx`delete from activity`;
    await tx`delete from attachments`;
    await tx`delete from document_versions`;
    await tx`delete from documents`;
    await tx`delete from deals`;
    await tx`delete from projects where name like 'TEST %'`;
    await tx`delete from clients where name like 'TEST %'`;
    await tx`alter table activity enable trigger activity_append_only`;
    await tx`alter table document_versions enable trigger document_versions_frozen`;
  });
}

try {
  await reset();
  const [client] = await sql`insert into clients (name, company) values ('TEST Andrea', 'TEST Island Bites') returning id`;
  const [project] = await sql`insert into projects (name, client_id) values ('TEST Site', ${client.id}) returning id`;
  const clientId = String(client.id);
  const projectId = String(project.id);

  // Deals
  const deal = await saveDeal({
    projectId,
    reference: "IB-2026-01",
    scope: ["Five pages", "Pickup ordering"],
    priceTotal: 6500,
    paymentSchedule: [
      { label: "Payment 1", amount: 3250, trigger: "On acceptance" },
      { label: "Payment 2", amount: 3250, trigger: "On handover" },
    ],
    carePlan: { monthlyAmount: 800, minimumMonths: 3, noticeDays: 30, inclusions: ["Hosting"], exclusions: ["New features"] },
    deadline: "2026-12-19",
    goals: null,
    notes: null,
    payeeDefault: null,
  }, ME);
  check("deal saved", deal.reference === "IB-2026-01" && deal.priceTotal === 6500);
  const again = await saveDeal({ ...deal, notes: "She asked about a gallery" }, ME);
  check("saving the same project updates, not duplicates", again.id === deal.id && again.notes === "She asked about a gallery");
  check("getDealByProject", (await getDealByProject(projectId))?.id === deal.id);
  await rejects("schedule that does not add up is refused", () =>
    saveDeal({ ...deal, paymentSchedule: [{ label: "P1", amount: 100, trigger: "x" }] }, ME), /add up/);
  await rejects("bad reference is refused", () => saveDeal({ ...deal, reference: "nope" }, ME), /reference/i);

  // Documents
  const doc = await createDocument({
    type: "proposal",
    title: "Proposal IB-2026-01",
    clientId,
    projectId,
    dealId: deal.id,
    invoiceId: null,
    sections: [
      { key: "intro", heading: "Introduction", body: "For {{missing: client address}}" },
      { key: "fees", heading: "Fees", body: "TT$6,500" },
    ],
  }, ME);
  check("document created as draft v0", doc.status === "draft" && doc.currentVersion === 0);
  await rejects("finalising with a missing fact is refused", () => finaliseDocument(doc.id, ME), /client address/);

  await saveDraftSections(doc.id, [{ key: "intro", heading: "Introduction", body: "For 1 Main Street" }], ME);
  const v1 = await finaliseDocument(doc.id, ME);
  check("finalise makes v1", v1.version === 1);
  let full = await getDocument(doc.id);
  check("document is finalised at v1", full?.status === "finalised" && full.currentVersion === 1 && full.versions.length === 1);

  await setDocumentStatus(doc.id, "sent", ME);
  await saveDraftSections(doc.id, [{ key: "fees", heading: "Fees", body: "TT$6,000" }], ME);
  full = await getDocument(doc.id);
  check("editing a sent document returns it to draft and keeps v1", full?.status === "draft" && full.versions[0].sections[1].body === "TT$6,500");
  await finaliseDocument(doc.id, ME);
  full = await getDocument(doc.id);
  check("second finalise makes v2", full?.currentVersion === 2 && full.versions.length === 2);

  await rejects("versions cannot be edited in the database", () =>
    sql`update document_versions set title = 'x' where document_id = ${doc.id}`, /cannot be changed/);
  await rejects("versions cannot be deleted", () =>
    sql`delete from document_versions where document_id = ${doc.id}`, /cannot be deleted/);
  await rejects("draft to sent is refused (must finalise)", async () => {
    const d2 = await createDocument({ type: "quote", title: "Q", clientId, projectId, dealId: null, invoiceId: null, sections: [] }, ME);
    await setDocumentStatus(d2.id, "sent", ME);
  }, /cannot go from draft to sent/);

  // Attachments: a signed copy on a sent document marks it signed
  await setDocumentStatus(doc.id, "sent", ME);
  const att = await addAttachment({
    entityType: "document", entityId: doc.id, storagePath: `document/${doc.id}/a1`,
    filename: "signed.pdf", contentType: "application/pdf", size: 1234, kind: "signed_copy",
  }, ME);
  full = await getDocument(doc.id);
  check("signed copy marks the document signed", full?.status === "signed");
  await rejects("signed document cannot be edited", () =>
    saveDraftSections(doc.id, [{ key: "fees", heading: "Fees", body: "x" }], ME), /signed/);
  check("listAttachments finds it", (await listAttachments("document", [doc.id])).length === 1);
  const removedPath = await deleteAttachment(att.id, ME);
  check("deleteAttachment returns the storage path", removedPath === `document/${doc.id}/a1`);

  // Lists and activity
  check("listDocuments by client", (await listDocuments({ clientId })).length === 2);
  const feed = await getClientActivity(clientId);
  check("activity recorded against the client", feed.length >= 6 && feed.every((a) => a.actor === ME));
  await rejects("activity is append-only", () => sql`delete from activity`, /append-only/);

  check("DocumentRuleError is exported", typeof DocumentRuleError === "function");
} finally {
  await reset();
  await sql.end();
  await closeDb();
}

console.log(failures ? `\n${failures} FAILED` : "\nAll documents-db checks pass");
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/documents-db.test.ts`
Expected: FAIL, cannot find module `../src/lib/documents-db`.

- [ ] **Step 3: Write `src/lib/documents-db.ts`**

```ts
// Deals, documents, versions, attachments and activity (migration 022).
// Plain SQL, snake_case rows mapped once, like timeline-db.ts. The rules live
// in lib/documents.ts; this file applies them inside transactions.
import type { Sql, TransactionSql } from "postgres";
import { getSql } from "./db";
import {
  REFERENCE_RE,
  canMove,
  mergeSections,
  missingFacts,
  scheduleProblem,
  type Attachable,
  type CarePlan,
  type DocStatus,
  type DocType,
  type FileKind,
  type Payee,
  type ScheduleLine,
  type Section,
} from "./documents";

/** A rule was broken (bad status move, missing fact, schedule mismatch). Safe to show to a founder. */
export class DocumentRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentRuleError";
  }
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = Sql | TransactionSql;
type Via = "dashboard" | "claude";
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));
const iso = (v: unknown) => new Date(v as string).toISOString();

// ─── Types ────────────────────────────────────────────────────────────────────

export type Deal = {
  id: string;
  projectId: string | null;
  reference: string;
  scope: string[];
  priceTotal: number | null;
  currency: string;
  paymentSchedule: ScheduleLine[];
  carePlan: CarePlan | null;
  deadline: string | null;
  goals: string | null;
  notes: string | null;
  payeeDefault: Payee | null;
  updatedBy: string;
  updatedVia: Via;
  updated: string;
};
export type DealInput = Omit<Deal, "id" | "currency" | "updatedBy" | "updatedVia" | "updated"> & { projectId: string };

export type DocumentVersion = {
  id: string;
  version: number;
  title: string;
  sections: Section[];
  pdfPath: string | null;
  finalisedBy: string;
  finalisedAt: string;
};
export type Doc = {
  id: string;
  type: DocType;
  clientId: string | null;
  projectId: string | null;
  dealId: string | null;
  invoiceId: string | null;
  title: string;
  status: DocStatus;
  draft: Section[];
  currentVersion: number;
  updatedBy: string;
  updatedVia: Via;
  created: string;
  updated: string;
};
export type DocWithVersions = Doc & { versions: DocumentVersion[] };

export type Attachment = {
  id: string;
  entityType: Attachable;
  entityId: string;
  storagePath: string;
  filename: string;
  contentType: string;
  size: number;
  kind: FileKind;
  uploadedBy: string;
  created: string;
};

export type Activity = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  actor: string;
  via: Via;
  created: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toDeal(r: Row): Deal {
  return {
    id: String(r.id),
    projectId: str(r.project_id),
    reference: r.reference,
    scope: r.scope ?? [],
    priceTotal: num(r.price_total),
    currency: r.currency,
    paymentSchedule: (r.payment_schedule ?? []).map((l: Row) => ({ label: l.label, amount: Number(l.amount), trigger: l.trigger })),
    carePlan: r.care_plan ?? null,
    deadline: r.deadline ? String(r.deadline).slice(0, 10) : null,
    goals: r.goals,
    notes: r.notes,
    payeeDefault: r.payee_default,
    updatedBy: r.updated_by,
    updatedVia: r.updated_via,
    updated: iso(r.updated),
  };
}

function toDoc(r: Row): Doc {
  return {
    id: String(r.id),
    type: r.type,
    clientId: str(r.client_id),
    projectId: str(r.project_id),
    dealId: str(r.deal_id),
    invoiceId: str(r.invoice_id),
    title: r.title,
    status: r.status,
    draft: r.draft ?? [],
    currentVersion: Number(r.current_version),
    updatedBy: r.updated_by,
    updatedVia: r.updated_via,
    created: iso(r.created),
    updated: iso(r.updated),
  };
}

function toVersion(r: Row): DocumentVersion {
  return {
    id: String(r.id),
    version: Number(r.version),
    title: r.title,
    sections: r.sections ?? [],
    pdfPath: r.pdf_path,
    finalisedBy: r.finalised_by,
    finalisedAt: iso(r.finalised_at),
  };
}

function toAttachment(r: Row): Attachment {
  return {
    id: String(r.id),
    entityType: r.entity_type,
    entityId: String(r.entity_id),
    storagePath: r.storage_path,
    filename: r.filename,
    contentType: r.content_type,
    size: Number(r.size),
    kind: r.kind,
    uploadedBy: r.uploaded_by,
    created: iso(r.created),
  };
}

function toActivity(r: Row): Activity {
  return {
    id: String(r.id),
    entityType: r.entity_type,
    entityId: String(r.entity_id),
    action: r.action,
    summary: r.summary,
    actor: r.actor,
    via: r.via,
    created: iso(r.created),
  };
}

// ─── Activity ─────────────────────────────────────────────────────────────────

/** The client a record belongs to, so every activity row can appear on the client file. */
async function clientOf(tx: Db, entityType: string, id: string): Promise<string | null> {
  const q =
    entityType === "client" ? tx`select ${id}::uuid as c`
    : entityType === "project" ? tx`select client_id as c from projects where id = ${id}`
    : entityType === "deal" ? tx`select p.client_id as c from deals d join projects p on p.id = d.project_id where d.id = ${id}`
    : entityType === "document" ? tx`select coalesce(d.client_id, p.client_id) as c from documents d left join projects p on p.id = d.project_id where d.id = ${id}`
    : entityType === "invoice" ? tx`select coalesce(i.client_id, p.client_id) as c from invoices i left join projects p on p.id = i.project_id where i.id = ${id}`
    : null;
  if (!q) return null;
  const [row] = await q;
  return row ? str(row.c) : null;
}

async function log(tx: Db, a: { entityType: string; entityId: string; action: string; summary: string; actor: string; via: Via; clientEntity?: { type: string; id: string } }) {
  const target = a.clientEntity ?? { type: a.entityType, id: a.entityId };
  const clientId = await clientOf(tx, target.type, target.id);
  await tx`
    insert into activity (entity_type, entity_id, client_id, action, summary, actor, via)
    values (${a.entityType}, ${a.entityId}, ${clientId}, ${a.action}, ${a.summary}, ${a.actor}, ${a.via})`;
}

export async function getClientActivity(clientId: string, limit = 50): Promise<Activity[]> {
  const sql = getSql();
  const rows = await sql`select * from activity where client_id = ${clientId} order by created desc limit ${limit}`;
  return rows.map(toActivity);
}

export async function getEntityActivity(entityType: string, entityId: string, limit = 50): Promise<Activity[]> {
  const sql = getSql();
  const rows = await sql`
    select * from activity where entity_type = ${entityType} and entity_id = ${entityId}
     order by created desc limit ${limit}`;
  return rows.map(toActivity);
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export async function getDealByProject(projectId: string): Promise<Deal | null> {
  const sql = getSql();
  const [row] = await sql`select * from deals where project_id = ${projectId}`;
  return row ? toDeal(row) : null;
}

export async function getDealsForClient(clientId: string): Promise<Deal[]> {
  const sql = getSql();
  const rows = await sql`
    select d.* from deals d join projects p on p.id = d.project_id
     where p.client_id = ${clientId} order by d.reference`;
  return rows.map(toDeal);
}

export async function getAllReferences(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`select reference from deals`;
  return rows.map((r) => r.reference as string);
}

/** Create or update the deal for a project (one per project). */
export async function saveDeal(input: DealInput, actor: string, via: Via = "dashboard"): Promise<Deal> {
  if (!REFERENCE_RE.test(input.reference)) throw new DocumentRuleError("The reference must look like IB-2026-01");
  const problem = scheduleProblem(input.priceTotal, input.paymentSchedule);
  if (problem) throw new DocumentRuleError(problem);
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      insert into deals (project_id, reference, scope, price_total, payment_schedule, care_plan, deadline, goals, notes,
                         payee_default, created_by, updated_by, updated_via)
      values (${input.projectId}, ${input.reference}, ${input.scope}, ${input.priceTotal},
              ${tx.json(input.paymentSchedule)}, ${input.carePlan ? tx.json(input.carePlan) : null},
              ${input.deadline}, ${input.goals}, ${input.notes}, ${input.payeeDefault}, ${actor}, ${actor}, ${via})
      on conflict (project_id) do update set
        reference = excluded.reference, scope = excluded.scope, price_total = excluded.price_total,
        payment_schedule = excluded.payment_schedule, care_plan = excluded.care_plan, deadline = excluded.deadline,
        goals = excluded.goals, notes = excluded.notes, payee_default = excluded.payee_default,
        updated_by = excluded.updated_by, updated_via = excluded.updated_via, updated = now()
      returning *, (xmax = 0) as inserted`;
    const deal = toDeal(row);
    await log(tx, {
      entityType: "deal", entityId: deal.id, action: row.inserted ? "created" : "updated",
      summary: `${row.inserted ? "Deal created" : "Deal updated"}: ${deal.reference}`, actor, via,
    });
    return deal;
  });
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function listDocuments(f: { clientId?: string; projectId?: string; type?: DocType; status?: DocStatus } = {}): Promise<Doc[]> {
  const sql = getSql();
  const rows = await sql`
    select * from documents
     where (${f.clientId ?? null}::uuid is null or client_id = ${f.clientId ?? null}::uuid)
       and (${f.projectId ?? null}::uuid is null or project_id = ${f.projectId ?? null}::uuid)
       and (${f.type ?? null}::text is null or type = ${f.type ?? null}::text)
       and (${f.status ?? null}::text is null or status = ${f.status ?? null}::text)
     order by updated desc`;
  return rows.map(toDoc);
}

export async function getDocument(id: string): Promise<DocWithVersions | null> {
  const sql = getSql();
  const [row] = await sql`select * from documents where id = ${id}`;
  if (!row) return null;
  const versions = await sql`select * from document_versions where document_id = ${id} order by version`;
  return { ...toDoc(row), versions: versions.map(toVersion) };
}

export async function createDocument(
  input: { type: DocType; title: string; clientId: string | null; projectId: string | null; dealId: string | null; invoiceId: string | null; sections: Section[] },
  actor: string,
  via: Via = "dashboard",
): Promise<Doc> {
  if (!input.title.trim()) throw new DocumentRuleError("A document needs a title");
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      insert into documents (type, title, client_id, project_id, deal_id, invoice_id, draft, created_by, updated_by, updated_via)
      values (${input.type}, ${input.title.trim()}, ${input.clientId}, ${input.projectId}, ${input.dealId}, ${input.invoiceId},
              ${tx.json(input.sections)}, ${actor}, ${actor}, ${via})
      returning *`;
    const doc = toDoc(row);
    await log(tx, { entityType: "document", entityId: doc.id, action: "created", summary: `${doc.title} drafted`, actor, via });
    return doc;
  });
}

async function lockDoc(tx: Db, id: string): Promise<Doc> {
  const [row] = await tx`select * from documents where id = ${id} for update`;
  if (!row) throw new DocumentRuleError("That document no longer exists");
  return toDoc(row);
}

/** Replace some sections of a draft. A finalised or sent document goes back to draft; its versions stay frozen. */
export async function saveDraftSections(id: string, changes: Section[], actor: string, via: Via = "dashboard"): Promise<Doc> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (doc.status !== "draft" && !canMove(doc.status, "draft"))
      throw new DocumentRuleError(`A ${doc.status} document cannot be edited`);
    const draft = mergeSections(doc.draft, changes);
    const [row] = await tx`
      update documents set draft = ${tx.json(draft)}, status = 'draft', updated_by = ${actor}, updated_via = ${via}, updated = now()
       where id = ${id} returning *`;
    await log(tx, {
      entityType: "document", entityId: id, action: "edited",
      summary: `${doc.title}: changed ${changes.map((c) => c.heading).join(", ")}`, actor, via,
    });
    return toDoc(row);
  });
}

/** Freeze the draft as the next version. Refused while any {{missing: …}} remains. */
export async function finaliseDocument(id: string, actor: string, via: Via = "dashboard"): Promise<DocumentVersion> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (!canMove(doc.status, "finalised")) throw new DocumentRuleError(`A ${doc.status} document cannot be finalised`);
    if (doc.draft.length === 0) throw new DocumentRuleError("An empty document cannot be finalised");
    const missing = missingFacts(doc.draft);
    if (missing.length) throw new DocumentRuleError(`Still missing: ${missing.join(", ")}`);
    const version = doc.currentVersion + 1;
    const [v] = await tx`
      insert into document_versions (document_id, version, title, sections, finalised_by)
      values (${id}, ${version}, ${doc.title}, ${tx.json(doc.draft)}, ${actor}) returning *`;
    await tx`
      update documents set status = 'finalised', current_version = ${version}, updated_by = ${actor}, updated_via = ${via}, updated = now()
       where id = ${id}`;
    await log(tx, { entityType: "document", entityId: id, action: "finalised", summary: `${doc.title} finalised as v${version}`, actor, via });
    return toVersion(v);
  });
}

/** Sent, accepted, declined, signed or void. Draft and finalised only happen through editing and finalising. */
export async function setDocumentStatus(id: string, to: DocStatus, actor: string, via: Via = "dashboard"): Promise<Doc> {
  if (to === "draft" || to === "finalised") throw new DocumentRuleError("Edit or finalise the document instead");
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (!canMove(doc.status, to)) throw new DocumentRuleError(`A document cannot go from ${doc.status} to ${to}`);
    const [row] = await tx`
      update documents set status = ${to}, updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${id} returning *`;
    await log(tx, { entityType: "document", entityId: id, action: to, summary: `${doc.title} marked ${to}`, actor, via });
    return toDoc(row);
  });
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function listAttachments(entityType: Attachable, ids: string[]): Promise<Attachment[]> {
  if (ids.length === 0) return [];
  const sql = getSql();
  const rows = await sql`
    select * from attachments where entity_type = ${entityType} and entity_id in ${sql(ids)} order by created desc`;
  return rows.map(toAttachment);
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const sql = getSql();
  const [row] = await sql`select * from attachments where id = ${id}`;
  return row ? toAttachment(row) : null;
}

/**
 * Record a file already uploaded to Storage. A signed copy attached to a
 * finalised, sent or accepted document marks that document signed.
 */
export async function addAttachment(
  a: { entityType: Attachable; entityId: string; storagePath: string; filename: string; contentType: string; size: number; kind: FileKind },
  actor: string,
  via: Via = "dashboard",
): Promise<Attachment> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      insert into attachments (entity_type, entity_id, storage_path, filename, content_type, size, kind, uploaded_by)
      values (${a.entityType}, ${a.entityId}, ${a.storagePath}, ${a.filename}, ${a.contentType}, ${a.size}, ${a.kind}, ${actor})
      returning *`;
    const att = toAttachment(row);
    await log(tx, {
      entityType: "attachment", entityId: att.id, action: "attached", summary: `${att.filename} attached`, actor, via,
      clientEntity: { type: a.entityType, id: a.entityId },
    });
    if (a.entityType === "document" && a.kind === "signed_copy") {
      const doc = await lockDoc(tx, a.entityId);
      if (canMove(doc.status, "signed")) {
        await tx`update documents set status = 'signed', updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${doc.id}`;
        await log(tx, { entityType: "document", entityId: doc.id, action: "signed", summary: `${doc.title} signed (copy attached)`, actor, via });
      }
    }
    return att;
  });
}

/** Remove the record and return its Storage path, so the caller can delete the file. */
export async function deleteAttachment(id: string, actor: string, via: Via = "dashboard"): Promise<string | null> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`delete from attachments where id = ${id} returning *`;
    if (!row) return null;
    const att = toAttachment(row);
    await log(tx, {
      entityType: "attachment", entityId: att.id, action: "removed", summary: `${att.filename} removed`, actor, via,
      clientEntity: { type: att.entityType, id: att.entityId },
    });
    return att.storagePath;
  });
}
```

Note on `listDocuments`: postgres.js sends `null` with an explicit cast so the `is null or …` pattern works without building SQL strings. If the cast syntax `${x}::uuid` errors in this postgres.js version, switch to building the filter with `sql` fragments (`${f.clientId ? sql\`and client_id = ${f.clientId}\` : sql\`\`}`), which is the pattern used elsewhere in `db.ts`; check `db.ts` for an example before choosing.

- [ ] **Step 4: Run the test until it passes**

Run: `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/documents-db.test.ts`
Expected: every line `PASS`, ending `All documents-db checks pass`.

If `clients`/`projects` need more NOT NULL columns than `name` (check `scripts/schema.sql`), add them to the two test inserts. Fix the implementation, not the assertions, unless an assertion contradicts the spec.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit -p .`
Expected: no errors in the new files.

In `package.json` add: `"test:documents-db": "bun scripts/documents-db.test.ts"` (run with `DATABASE_URL` pointing at localhost only).

```bash
git add src/lib/documents-db.ts scripts/documents-db.test.ts package.json
git commit -m "feat(documents): database layer for deals, documents, versions, attachments, activity"
```

---

### Task 5: Storage helpers and server actions

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/app/documents-actions.ts`

Known gotchas (from earlier Supabase work on another project): Storage keys reject non-ASCII characters, so the key is never the filename; and `upload()` ignores `contentType` for a `File`/`Blob` unless the blob itself carries the type, so the browser re-types it with `file.slice(0, file.size, type)` before uploading.

- [ ] **Step 1: Write `src/lib/storage.ts`**

```ts
// Private file storage (bucket `files`, migration 023). Server only: it uses
// the service role key, which must never reach the browser. The browser gets a
// one-time signed upload URL and short-lived signed download URLs, so files
// never pass through a Vercel function (which caps request bodies).
import "server-only";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "files";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("File storage is not configured (SUPABASE_SERVICE_ROLE_KEY missing)");
  return createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);
}

/** A one-time URL the browser uploads one file to. The key holds no user text. */
export async function signedUpload(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not start the upload: ${error?.message ?? "no URL"}`);
  return { path: data.path, token: data.token };
}

/** A link to one file, valid for five minutes, that downloads it under its real name. */
export async function signedDownload(path: string, filename: string): Promise<string> {
  const { data, error } = await storage().createSignedUrl(path, 300, { download: filename });
  if (error || !data) throw new Error(`Could not open the file: ${error?.message ?? "no URL"}`);
  return data.signedUrl;
}

/** Confirms the upload really landed before its record is written. */
export async function exists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await storage().list(path.slice(0, slash), { search: path.slice(slash + 1) });
  return !error && (data ?? []).some((o) => o.name === path.slice(slash + 1));
}

export async function removeFile(path: string): Promise<void> {
  const { error } = await storage().remove([path]);
  if (error) throw new Error(`Could not delete the file: ${error.message}`);
}
```

Check `server-only` is importable (`ls node_modules/server-only`). If it is not installed, drop that import line rather than adding a dependency; the module is only imported from server actions.

- [ ] **Step 2: Write `src/app/documents-actions.ts`**

Read the top of `src/app/actions.ts` and one existing action that returns `{ ok, error }` to match its return shape. Then:

```ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  DocumentRuleError,
  addAttachment,
  deleteAttachment,
  finaliseDocument,
  getAttachment,
  saveDeal,
  setDocumentStatus,
} from "@/lib/documents-db";
import { ATTACHABLE, DOC_STATUSES, FILE_KINDS, PAYEES } from "@/lib/documents";
import { MAX_FILE_BYTES, exists, removeFile, signedDownload, signedUpload } from "@/lib/storage";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Rule errors are shown as written; anything else is logged and reported generically. */
function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof DocumentRuleError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "That did not save. Try again, and tell Claude if it keeps happening." };
}

const ScheduleLine = z.object({ label: z.string().trim().min(1), amount: z.number().positive(), trigger: z.string().trim().min(1) });
const DealForm = z.object({
  projectId: z.uuid(),
  reference: z.string().trim(),
  scope: z.array(z.string().trim().min(1)),
  priceTotal: z.number().nonnegative().nullable(),
  paymentSchedule: z.array(ScheduleLine),
  carePlan: z
    .object({
      monthlyAmount: z.number().nonnegative(),
      minimumMonths: z.number().int().nonnegative(),
      noticeDays: z.number().int().nonnegative(),
      inclusions: z.array(z.string().trim().min(1)),
      exclusions: z.array(z.string().trim().min(1)),
    })
    .nullable(),
  deadline: z.iso.date().nullable(),
  goals: z.string().nullable(),
  notes: z.string().nullable(),
  payeeDefault: z.enum(PAYEES).nullable(),
});

export async function saveDealAction(input: z.input<typeof DealForm>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = DealForm.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    await saveDeal(parsed.data, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function finaliseDocumentAction(id: string): Promise<Result<{ version: number }>> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown document" };
  try {
    const v = await finaliseDocument(id, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: { version: v.version } };
  } catch (e) {
    return fail(e);
  }
}

export async function setDocumentStatusAction(id: string, status: string): Promise<Result> {
  const admin = await requireAdmin();
  const s = z.enum(DOC_STATUSES).safeParse(status);
  if (!z.uuid().safeParse(id).success || !s.success) return { ok: false, error: "Unknown document or status" };
  try {
    await setDocumentStatus(id, s.data, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const UploadStart = z.object({
  entityType: z.enum(ATTACHABLE),
  entityId: z.uuid(),
  size: z.number().int().positive().max(MAX_FILE_BYTES, "Files can be up to 25 MB"),
});

/** Step 1 of an upload: a one-time signed URL. The key is ids only, never the filename. */
export async function startUploadAction(input: z.input<typeof UploadStart>): Promise<Result<{ path: string; token: string }>> {
  await requireAdmin();
  const parsed = UploadStart.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the file" };
  try {
    const { entityType, entityId } = parsed.data;
    return { ok: true, data: await signedUpload(`${entityType}/${entityId}/${randomUUID()}`) };
  } catch (e) {
    return fail(e);
  }
}

const UploadDone = z.object({
  entityType: z.enum(ATTACHABLE),
  entityId: z.uuid(),
  path: z.string().regex(/^(client|project|invoice|document)\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  kind: z.enum(FILE_KINDS),
});

/** Step 2: record the file once it is really in Storage. */
export async function finishUploadAction(input: z.input<typeof UploadDone>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = UploadDone.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the file" };
  const a = parsed.data;
  if (!a.path.startsWith(`${a.entityType}/${a.entityId}/`)) return { ok: false, error: "That upload belongs to another record" };
  try {
    if (!(await exists(a.path))) return { ok: false, error: "The upload did not finish. Try again." };
    await addAttachment({ ...a, storagePath: a.path }, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function fileUrlAction(id: string): Promise<Result<{ url: string }>> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown file" };
  try {
    const att = await getAttachment(id);
    if (!att) return { ok: false, error: "That file no longer exists" };
    return { ok: true, data: { url: await signedDownload(att.storagePath, att.filename) } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFileAction(id: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown file" };
  try {
    const path = await deleteAttachment(id, admin.email);
    // The record goes first: a file left behind in Storage is harmless; a record pointing at nothing is not.
    if (path) await removeFile(path);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
```

If zod 4 in this repo lacks `z.iso.date()` or `z.uuid()`, check how `actions.ts` validates dates and ids and use the same calls.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit -p . && npx eslint src/lib/storage.ts src/app/documents-actions.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts src/app/documents-actions.ts
git commit -m "feat(documents): storage helpers and server actions for deals, documents and files"
```

---

### Task 6: Real pages behind every link (`href`) and the Documents nav item

**Files:**
- Modify: `src/lib/record-graph.ts:7-12`
- Modify: `src/components/dashboard/sidebar.tsx` (Sales group)
- Test: `scripts/record-graph.test.ts`

- [ ] **Step 1: Add the failing assertions to `scripts/record-graph.test.ts`**

Change the import to `import { href, linksFor, type Graph } from "../src/lib/record-graph";` and add before the final `console.log`:

```ts
assert.equal(href.project("p1"), "/admin/projects/p1", "projects have their own page");
assert.equal(href.invoice("i1"), "/admin/finance/invoices/i1", "invoices have their own page");
assert.equal(href.document("d1"), "/admin/documents/d1");
assert.equal(href.client("c 1"), "/admin/clients/c%201", "ids are encoded");
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun scripts/record-graph.test.ts`
Expected: FAIL on the project href.

- [ ] **Step 3: Update `href`**

Replace the `href` object in `src/lib/record-graph.ts`:

```ts
const at = (base: string) => (id: string) => `${base}/${encodeURIComponent(id)}`;

export const href = {
  client: at("/admin/clients"),
  lead: (id: string) => `/admin/leads#lead-${id}`,
  project: at("/admin/projects"),
  invoice: at("/admin/finance/invoices"),
  document: at("/admin/documents"),
};
```

Every existing link that already uses `href.project` / `href.invoice` now opens the new pages (built in Tasks 7 and 8).

- [ ] **Step 4: Add Documents to the sidebar**

In `src/components/dashboard/sidebar.tsx`, in the `Sales` group's `items`, after Clients, add `{ href: "/admin/documents", label: "Documents" }`.

- [ ] **Step 5: Run, then commit**

Run: `bun scripts/record-graph.test.ts`
Expected: `record-graph: all checks pass`

```bash
git add src/lib/record-graph.ts scripts/record-graph.test.ts src/components/dashboard/sidebar.tsx
git commit -m "feat(links): projects, invoices and documents get their own pages"
```

---

### Task 7: Shared panels: deal card, files, documents table, activity

**Files:**
- Create: `src/components/dashboard/deal-card.tsx`
- Create: `src/components/dashboard/files-panel.tsx`
- Create: `src/components/dashboard/documents-table.tsx`
- Create: `src/components/dashboard/activity-list.tsx`

Read `src/components/ui/modal-shell.tsx`, `src/components/dashboard/clients-list.tsx` (its modal form, for input styling and how it calls an action and shows `sonner` toasts), and `src/components/dashboard/client-records.tsx` (table styling constants) before writing these. Reuse their class strings; do not invent new styles.

- [ ] **Step 1: `activity-list.tsx`** (server-safe, no state)

```tsx
import type { Activity } from "@/lib/documents-db";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-TT", { timeZone: "America/Port_of_Spain", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const who = (email: string) => email.split("@")[0];

/** What changed on these records, newest first, with who did it and whether through Claude. */
export function ActivityList({ items, empty = "Nothing recorded yet." }: { items: Activity[]; empty?: string }) {
  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[#1B2533]">Activity</h2>
      <p className="mt-0.5 text-xs text-[#4A5568]">Every change to deals, documents and files, who made it, and whether it came through Claude.</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7789]">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEF1F5] text-sm">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
              <span className="text-[#1B2533]">{a.summary}</span>
              <span className="text-xs text-[#5A6678]">
                {who(a.actor)}{a.via === "claude" ? " via Claude" : ""} · {when(a.created)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: `documents-table.tsx`** (server-safe)

```tsx
import Link from "next/link";
import { href } from "@/lib/record-graph";
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL } from "@/lib/documents";
import type { Doc } from "@/lib/documents-db";

const link = "font-medium text-[#1D4ED8] hover:underline";
const th = "border-b border-[#DCE1E8] px-3 py-2 text-left text-xs font-semibold text-[#4A5568]";
const td = "border-b border-[#EEF1F5] px-3 py-2";
const STATUS_TONE: Record<string, string> = {
  draft: "text-[#5A6678]", finalised: "text-[#1D4ED8]", sent: "text-[#1D4ED8]",
  accepted: "text-[#1E6B3A]", signed: "text-[#1E6B3A]", declined: "text-[#B23A0A]", void: "text-[#6B7789] line-through",
};

/** Documents with every name a link. `names` maps client and project ids to display names. */
export function DocumentsTable({ docs, names, showClient = true }: { docs: Doc[]; names: Record<string, string>; showClient?: boolean }) {
  return (
    <div className="overflow-x-auto border border-[#DCE1E8] bg-white">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#F7F8FA]">
            <th className={th}>Document</th><th className={th}>Type</th>
            {showClient && <th className={th}>Client</th>}
            <th className={th}>Project</th><th className={th}>Status</th><th className={th}>Version</th><th className={th}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && <tr><td className={td} colSpan={showClient ? 7 : 6}>No documents yet.</td></tr>}
          {docs.map((d) => (
            <tr key={d.id}>
              <td className={td}><Link className={link} href={href.document(d.id)}>{d.title}</Link></td>
              <td className={td}>{DOC_TYPE_LABEL[d.type]}</td>
              {showClient && <td className={td}>{d.clientId ? <Link className={link} href={href.client(d.clientId)}>{names[d.clientId] ?? "Client"}</Link> : ""}</td>}
              <td className={td}>{d.projectId ? <Link className={link} href={href.project(d.projectId)}>{names[d.projectId] ?? "Project"}</Link> : ""}</td>
              <td className={`${td} font-medium ${STATUS_TONE[d.status]}`}>{DOC_STATUS_LABEL[d.status]}</td>
              <td className={td}>{d.currentVersion ? `v${d.currentVersion}` : "Not finalised"}</td>
              <td className={`${td} whitespace-nowrap text-[#5A6678]`}>{d.updated.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: `files-panel.tsx`** (client component)

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { deleteFileAction, fileUrlAction, finishUploadAction, startUploadAction } from "@/app/documents-actions";
import { FILE_KINDS, FILE_KIND_LABEL, type Attachable, type FileKind } from "@/lib/documents";
import type { Attachment } from "@/lib/documents-db";

// The anon key is public by design; a signed upload token is what authorises the upload.
const browserStorage = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    .storage.from("files");

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Files attached to one record: open, add (including from a phone camera), remove. */
export function FilesPanel({ entityType, entityId, files, defaultKind = "other" }: {
  entityType: Attachable; entityId: string; files: Attachment[]; defaultKind?: FileKind;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>(defaultKind);
  const [busy, start] = useTransition();

  async function upload(file: File) {
    const type = file.type || "application/octet-stream";
    const begun = await startUploadAction({ entityType, entityId, size: file.size });
    if (!begun.ok) return toast.error(begun.error);
    // Re-type the blob: upload() ignores contentType for a File whose own type is empty.
    const { error } = await browserStorage().uploadToSignedUrl(begun.data.path, begun.data.token, file.slice(0, file.size, type), { contentType: type });
    if (error) return toast.error(`Upload failed: ${error.message}`);
    const done = await finishUploadAction({ entityType, entityId, path: begun.data.path, filename: file.name, contentType: type, size: file.size, kind });
    if (!done.ok) return toast.error(done.error);
    toast.success(`${file.name} attached`);
  }

  const open = (id: string) => start(async () => {
    const r = await fileUrlAction(id);
    if (!r.ok) return void toast.error(r.error);
    window.open(r.data.url, "_blank", "noopener");
  });
  const remove = (f: Attachment) => {
    if (!confirm(`Remove ${f.filename}? This deletes the file.`)) return;
    start(async () => {
      const r = await deleteFileAction(f.id);
      if (r.ok) toast.success("Removed");
      else toast.error(r.error);
    });
  };

  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Files</h2>
          <p className="mt-0.5 text-xs text-[#4A5568]">Signed copies, proof of payment and anything else for this record. Private to admins.</p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Kind of file" value={kind} onChange={(e) => setKind(e.target.value as FileKind)}
            className="min-h-11 sm:min-h-0 rounded-[4px] border border-[#DCE1E8] px-2 py-1.5 text-xs">
            {FILE_KINDS.map((k) => <option key={k} value={k}>{FILE_KIND_LABEL[k]}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="min-h-11 sm:min-h-0 rounded-[4px] bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]/80 disabled:opacity-50">
            {busy ? "Working…" : "+ Attach file"}
          </button>
          <input ref={input} type="file" className="hidden" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) start(() => upload(f));
            }} />
        </div>
      </div>
      {files.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7789]">No files yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEF1F5] text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <button type="button" onClick={() => open(f.id)} className="min-h-11 sm:min-h-0 text-left font-medium text-[#1D4ED8] hover:underline">
                {f.filename}
              </button>
              <span className="flex items-center gap-3 text-xs text-[#5A6678]">
                {FILE_KIND_LABEL[f.kind]} · {kb(f.size)} · {f.created.slice(0, 10)}
                <button type="button" onClick={() => remove(f)} className="min-h-11 sm:min-h-0 text-[#B23A0A] hover:underline">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: `deal-card.tsx`** (client component)

Shows the deal (or "No deal yet" with a "Set up the deal" button) and edits it in a `ModalShell`. The form fields: reference (prefilled with `suggestedReference` for a new deal), scope (one item per line in a textarea), total price, payment schedule rows (label, amount, when due; add and remove rows), care plan (toggle; monthly amount, minimum months default 3, notice days default 30, inclusions and exclusions one per line), deadline (`<input type="date">`), goals, notes, default payee (select with "Ask each time" as empty).

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import { saveDealAction } from "@/app/documents-actions";
import { PAYEES, PAYEE_LABEL, scheduleProblem, type Payee, type ScheduleLine } from "@/lib/documents";
import type { Deal } from "@/lib/documents-db";
import { tt } from "@/lib/ledger";

const field = "w-full rounded-[4px] border border-[#DCE1E8] px-2 py-1.5 text-sm";
const label = "block text-xs font-medium text-[#4A5568]";
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

/** What we offered on this project. Every later document is built from it. */
export function DealCard({ projectId, deal, suggestedReference }: { projectId: string; deal: Deal | null; suggestedReference: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Deal{deal ? ` ${deal.reference}` : ""}</h2>
          <p className="mt-0.5 text-xs text-[#4A5568]">What we offered: scope, price, payments, care plan and deadline. Proposals, agreements and invoices are built from this.</p>
        </div>
        <button type="button" onClick={() => setEditing(true)}
          className="min-h-11 sm:min-h-0 rounded-[4px] border border-[#DCE1E8] px-3 py-2 text-xs font-semibold text-[#1B2533] hover:bg-[#0E1A2B]/5">
          {deal ? "Edit deal" : "Set up the deal"}
        </button>
      </div>
      {deal ? (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className={label}>Scope</dt><dd><ul className="list-disc pl-5">{deal.scope.map((s) => <li key={s}>{s}</li>)}</ul></dd></div>
          <div><dt className={label}>Price</dt><dd className="font-semibold">{deal.priceTotal != null ? tt(deal.priceTotal) : "Not set"}</dd></div>
          <div><dt className={label}>Payments</dt><dd>{deal.paymentSchedule.length ? deal.paymentSchedule.map((l) => <p key={l.label}>{l.label}: {tt(l.amount)}, {l.trigger}</p>) : "Not split"}</dd></div>
          <div><dt className={label}>Care plan</dt><dd>{deal.carePlan ? `${tt(deal.carePlan.monthlyAmount)} a month, ${deal.carePlan.minimumMonths} month minimum, then ${deal.carePlan.noticeDays} days' notice` : "None"}</dd></div>
          <div><dt className={label}>Deadline</dt><dd>{deal.deadline ?? "None"}</dd></div>
          <div><dt className={label}>Paid to</dt><dd>{deal.payeeDefault ? PAYEE_LABEL[deal.payeeDefault] : "Ask each time"}</dd></div>
          {deal.goals && <div className="sm:col-span-2"><dt className={label}>Goals</dt><dd className="whitespace-pre-line">{deal.goals}</dd></div>}
          {deal.notes && <div className="sm:col-span-2"><dt className={label}>Notes</dt><dd className="whitespace-pre-line">{deal.notes}</dd></div>}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-[#6B7789]">No deal recorded for this project yet.</p>
      )}
      {editing && <DealModal projectId={projectId} deal={deal} suggestedReference={suggestedReference} onClose={() => setEditing(false)} />}
    </section>
  );
}

function DealModal({ projectId, deal, suggestedReference, onClose }: { projectId: string; deal: Deal | null; suggestedReference: string; onClose: () => void }) {
  const [reference, setReference] = useState(deal?.reference ?? suggestedReference);
  const [scope, setScope] = useState((deal?.scope ?? []).join("\n"));
  const [price, setPrice] = useState(deal?.priceTotal?.toString() ?? "");
  const [schedule, setSchedule] = useState<ScheduleLine[]>(deal?.paymentSchedule ?? []);
  const [care, setCare] = useState(!!deal?.carePlan);
  const [monthly, setMonthly] = useState(deal?.carePlan?.monthlyAmount.toString() ?? "");
  const [minimum, setMinimum] = useState(deal?.carePlan?.minimumMonths.toString() ?? "3");
  const [notice, setNotice] = useState(deal?.carePlan?.noticeDays.toString() ?? "30");
  const [inclusions, setInclusions] = useState((deal?.carePlan?.inclusions ?? []).join("\n"));
  const [exclusions, setExclusions] = useState((deal?.carePlan?.exclusions ?? []).join("\n"));
  const [deadline, setDeadline] = useState(deal?.deadline ?? "");
  const [goals, setGoals] = useState(deal?.goals ?? "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [payee, setPayee] = useState<Payee | "">(deal?.payeeDefault ?? "");
  const [saving, start] = useTransition();

  const total = price.trim() === "" ? null : Number(price);
  const problem = scheduleProblem(total, schedule);
  const setLine = (i: number, patch: Partial<ScheduleLine>) => setSchedule((s) => s.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  const save = () => start(async () => {
    const r = await saveDealAction({
      projectId, reference: reference.trim().toUpperCase(), scope: lines(scope), priceTotal: total, paymentSchedule: schedule,
      carePlan: care ? { monthlyAmount: Number(monthly) || 0, minimumMonths: Number(minimum) || 0, noticeDays: Number(notice) || 0, inclusions: lines(inclusions), exclusions: lines(exclusions) } : null,
      deadline: deadline || null, goals: goals.trim() || null, notes: notes.trim() || null, payeeDefault: payee || null,
    });
    if (!r.ok) return void toast.error(r.error);
    toast.success("Deal saved");
    onClose();
  });

  return (
    <ModalShell title={deal ? `Edit deal ${deal.reference}` : "Set up the deal"} onClose={onClose} maxWidthClass="max-w-2xl">
      <div className="space-y-3">
        <label className={label}>Reference<input className={field} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
        <label className={label}>What we offered (one item per line)<textarea className={field} rows={4} value={scope} onChange={(e) => setScope(e.target.value)} /></label>
        <label className={label}>Total price (TTD)<input className={field} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <fieldset className="space-y-2">
          <legend className={label}>Payments</legend>
          {schedule.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_1fr_auto] gap-2">
              <input aria-label="Payment label" className={field} value={l.label} placeholder="Payment 1" onChange={(e) => setLine(i, { label: e.target.value })} />
              <input aria-label="Amount" className={field} inputMode="decimal" value={l.amount || ""} onChange={(e) => setLine(i, { amount: Number(e.target.value) })} />
              <input aria-label="When it falls due" className={field} value={l.trigger} placeholder="On acceptance" onChange={(e) => setLine(i, { trigger: e.target.value })} />
              <button type="button" aria-label="Remove payment" className="min-h-11 sm:min-h-0 px-2 text-[#B23A0A]" onClick={() => setSchedule((s) => s.filter((_, n) => n !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-[#1D4ED8]" onClick={() => setSchedule((s) => [...s, { label: `Payment ${s.length + 1}`, amount: 0, trigger: "" }])}>+ Add a payment</button>
          {problem && <p className="text-xs text-[#B23A0A]">{problem}</p>}
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={care} onChange={(e) => setCare(e.target.checked)} /> Care plan after handover</label>
        {care && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={label}>Monthly (TTD)<input className={field} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
            <label className={label}>Minimum months<input className={field} inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value)} /></label>
            <label className={label}>Notice days<input className={field} inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} /></label>
            <label className={`${label} sm:col-span-3`}>Included (one per line)<textarea className={field} rows={3} value={inclusions} onChange={(e) => setInclusions(e.target.value)} /></label>
            <label className={`${label} sm:col-span-3`}>Not included (one per line)<textarea className={field} rows={2} value={exclusions} onChange={(e) => setExclusions(e.target.value)} /></label>
          </div>
        )}
        <label className={label}>Deadline<input type="date" className={field} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        <label className={label}>Paid to<select className={field} value={payee} onChange={(e) => setPayee(e.target.value as Payee | "")}>
          <option value="">Ask each time</option>
          {PAYEES.map((p) => <option key={p} value={p}>{PAYEE_LABEL[p]}</option>)}
        </select></label>
        <label className={label}>Goals<textarea className={field} rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} /></label>
        <label className={label}>Notes (what was discussed, concessions)<textarea className={field} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="min-h-11 sm:min-h-0 rounded-[4px] border border-[#DCE1E8] px-3 py-2 text-xs font-semibold">Cancel</button>
          <button type="button" disabled={saving || !!problem} onClick={save}
            className="min-h-11 sm:min-h-0 rounded-[4px] bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save deal"}</button>
        </div>
      </div>
    </ModalShell>
  );
}
```

Note: `tt` is exported from `src/lib/ledger.ts` (it formats TT$ amounts). Check its signature before use.

- [ ] **Step 5: Type-check, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint src/components/dashboard/deal-card.tsx src/components/dashboard/files-panel.tsx src/components/dashboard/documents-table.tsx src/components/dashboard/activity-list.tsx`
Expected: no errors.

```bash
git add src/components/dashboard/deal-card.tsx src/components/dashboard/files-panel.tsx src/components/dashboard/documents-table.tsx src/components/dashboard/activity-list.tsx
git commit -m "feat(documents): deal card, files panel, documents table and activity list"
```

---

### Task 8: Project page `/admin/projects/[id]`

**Files:**
- Create: `src/app/admin/projects/[id]/page.tsx`

Model it on `src/app/admin/clients/[id]/page.tsx` (uuid check, `notFound()`, `requireAdminPage()`, `dynamic = "force-dynamic"`). Read `node_modules/next/dist/docs/` on dynamic route params first: in this Next, `params` is a Promise.

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getInvoices, getLeads, getProject, getProjects } from "@/lib/db";
import { getAllReferences, getDealByProject, getEntityActivity, listAttachments, listDocuments } from "@/lib/documents-db";
import { nextReference, suggestPrefix } from "@/lib/documents";
import { href } from "@/lib/record-graph";
import { PageHeader } from "@/components/dashboard/explain";
import { LinkedRecords } from "@/components/dashboard/linked-records";
import { DealCard } from "@/components/dashboard/deal-card";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";
import { today } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  if (!z.uuid().safeParse(id).success) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  const [deal, docs, files, activity, references, clients, leads, projects, invoices] = await Promise.all([
    getDealByProject(id),
    listDocuments({ projectId: id }),
    listAttachments("project", [id]),
    getEntityActivity("project", id),
    getAllReferences(),
    getClients(),
    getLeads(),
    getProjects(),
    getInvoices(),
  ]);
  const client = clients.find((c) => c.id === project.Client?.[0]);
  const clientName = client ? client.Company || client.Name : project.Name;
  const suggestedReference = nextReference(suggestPrefix(clientName), Number(today().slice(0, 4)), references);
  const names: Record<string, string> = { [id]: project.Name, ...(client ? { [client.id]: clientName } : {}) };

  return (
    <div className="space-y-3">
      <Link href="/admin/projects" className="text-xs text-[#5A6678] hover:text-[#334155]">All projects</Link>
      <PageHeader
        title={project.Name}
        purpose={`${project.Status ?? "No status"}${project["Service Type"] ? ` · ${project["Service Type"]}` : ""}. The deal, documents, invoices and files for this project.`}
      />
      <LinkedRecords kind="project" id={id} graph={{ clients, leads, projects, invoices }} hide={["projects"]} />
      {(project["GitHub Repo URL"] || project["Deploy URL"]) && (
        <p className="flex flex-wrap gap-4 text-xs">
          {project["GitHub Repo URL"] && <a className="font-medium text-[#1D4ED8] hover:underline" href={project["GitHub Repo URL"]} target="_blank" rel="noopener">Code on GitHub</a>}
          {project["Deploy URL"] && <a className="font-medium text-[#1D4ED8] hover:underline" href={project["Deploy URL"]} target="_blank" rel="noopener">Live site</a>}
        </p>
      )}
      <DealCard projectId={id} deal={deal} suggestedReference={suggestedReference} />
      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Documents</h2>
        <DocumentsTable docs={docs} names={names} showClient={false} />
      </section>
      <FilesPanel entityType="project" entityId={id} files={files} defaultKind="asset" />
      <ActivityList items={activity} />
      {client && <p className="text-xs"><Link className="font-medium text-[#1D4ED8] hover:underline" href={href.client(client.id)}>Open {clientName}&apos;s client file</Link></p>}
    </div>
  );
}
```

Note `getEntityActivity("project", id)` returns only project-level events. Deal and document events for this project are on the client file; that is acceptable for Phase 1.

- [ ] **Step 2: Type-check, lint, and build-check**

Run: `npx tsc --noEmit -p . && npx eslint "src/app/admin/projects/[id]/page.tsx"`
Expected: no errors. Do NOT run `next dev` or `next build` with `.env.local` (it reads production).

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/projects/[id]/page.tsx"
git commit -m "feat(projects): a page per project with its deal, documents, files and activity"
```

---

### Task 9: Invoice page `/admin/finance/invoices/[id]`

**Files:**
- Create: `src/app/admin/finance/invoices/[id]/page.tsx`

Read `src/components/dashboard/client-records.tsx` (how payments are matched to invoices, the pre-ledger case) and `src/lib/invoices.ts` (`effectiveStatus`). Read `getLedger` in `db.ts` for the `Payment` fields (`invoiceId`, `amount`, `paidAt`, `receivedBy`).

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getInvoices, getLeads, getLedger, getProjects } from "@/lib/db";
import { getEntityActivity, listAttachments, listDocuments } from "@/lib/documents-db";
import { effectiveStatus } from "@/lib/invoices";
import { HOLDER_LABEL, tt } from "@/lib/ledger";
import { paidOn, href } from "@/lib/record-graph";
import { today } from "@/lib/subscriptions";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { LinkedRecords } from "@/components/dashboard/linked-records";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";

export const dynamic = "force-dynamic";

const th = "border-b border-[#DCE1E8] px-3 py-2 text-left text-xs font-semibold text-[#4A5568]";
const td = "border-b border-[#EEF1F5] px-3 py-2";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  if (!z.uuid().safeParse(id).success) notFound();

  const [invoices, clients, leads, projects, ledger, files, activity, docs] = await Promise.all([
    getInvoices(), getClients(), getLeads(), getProjects(), getLedger(today()),
    listAttachments("invoice", [id]), getEntityActivity("invoice", id), listDocuments({ type: "invoice" }),
  ]);
  const inv = invoices.find((i) => i.id === id);
  if (!inv) notFound();

  const status = effectiveStatus(inv);
  const paid = paidOn(inv);
  const balance = Math.max(0, (inv.Amount ?? 0) - paid);
  const payments = ledger.payments.filter((p) => p.invoiceId === id).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const pdf = docs.find((d) => d.invoiceId === id);

  return (
    <div className="space-y-3">
      <Link href="/admin/finance/invoices" className="text-xs text-[#5A6678] hover:text-[#334155]">Invoices</Link>
      <PageHeader title={`Invoice ${inv["Invoice Number"] ?? "(draft, not numbered yet)"}`} purpose={`${status}. Issued ${inv["Issue Date"] ?? "not yet"}, due ${inv["Due Date"] ?? "no date set"}.`} />
      <LinkedRecords kind="invoice" id={id} graph={{ clients, leads, projects, invoices }} hide={["invoices"]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Amount" value={tt(inv.Amount ?? 0)} note="The full invoice." />
        <StatTile label="Paid" value={tt(paid)} note="Payments recorded against it." tone="text-[#1E6B3A]" />
        <StatTile label="Still owed" value={tt(balance)} note={balance > 0 ? "Not yet received." : "Nothing outstanding."} tone={balance > 0 ? "text-[#B23A0A]" : undefined} />
        <StatTile label="Paid on" value={inv["Paid Date"] ?? "Not paid"} note="Date it was paid in full." />
      </div>
      {inv.Notes && (
        <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-[#1B2533]">{inv.Notes}</p>
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Payments</h2>
        <div className="overflow-x-auto border border-[#DCE1E8] bg-white">
          <table className="w-full min-w-[380px] border-collapse text-sm">
            <thead><tr className="bg-[#F7F8FA]"><th className={th}>Paid on</th><th className={th}>Received by</th><th className={`${th} text-right`}>Amount</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td className={td} colSpan={3}>{inv.Status === "Paid" ? `Paid before the ledger began${inv["Paid Date"] ? `, on ${inv["Paid Date"]}` : ""}.` : "No payments yet."}</td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className={td}>{p.paidAt.slice(0, 10)}</td>
                  <td className={td}>{HOLDER_LABEL[p.receivedBy]}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{tt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs"><Link className="font-medium text-[#1D4ED8] hover:underline" href="/admin/finance/received">Record or change payments in Money received</Link></p>
      </section>
      {pdf && <p className="text-xs">Invoice document: <Link className="font-medium text-[#1D4ED8] hover:underline" href={href.document(pdf.id)}>{pdf.title}</Link></p>}
      <FilesPanel entityType="invoice" entityId={id} files={files} defaultKind="proof_of_payment" />
      <ActivityList items={activity} />
    </div>
  );
}
```

Check the `Payment` type in `db.ts` for the exact field names (`id`, `paidAt`, `receivedBy`, `amount`, `invoiceId`) and adjust if they differ.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p . && npx eslint "src/app/admin/finance/invoices/[id]/page.tsx"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/finance/invoices/[id]/page.tsx"
git commit -m "feat(invoices): a page per invoice with payments, notes, files and activity"
```

---

### Task 10: Documents list and document page

**Files:**
- Create: `src/app/admin/documents/page.tsx`
- Create: `src/app/admin/documents/[id]/page.tsx`
- Create: `src/app/admin/documents/[id]/document-actions.tsx`

- [ ] **Step 1: List page `src/app/admin/documents/page.tsx`**

Filters come from the URL (`?type=&status=&client=`), the same pattern as `/admin/finance/invoices?status=`.

```tsx
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects } from "@/lib/db";
import { listDocuments } from "@/lib/documents-db";
import { DOC_STATUSES, DOC_STATUS_LABEL, DOC_TYPES, DOC_TYPE_LABEL, type DocStatus, type DocType } from "@/lib/documents";
import { PageHeader, Explain } from "@/components/dashboard/explain";
import { DocumentsTable } from "@/components/dashboard/documents-table";

export const dynamic = "force-dynamic";

const chip = (on: boolean) =>
  `rounded-[4px] border px-2 py-1 text-xs ${on ? "border-[#1D4ED8] bg-[#1D4ED8] text-white" : "border-[#DCE1E8] bg-white text-[#334155] hover:bg-[#0E1A2B]/5"}`;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string; client?: string }> }) {
  const sp = await searchParams;
  await requireAdminPage();
  const type = DOC_TYPES.includes(sp.type as DocType) ? (sp.type as DocType) : undefined;
  const status = DOC_STATUSES.includes(sp.status as DocStatus) ? (sp.status as DocStatus) : undefined;
  const clientId = sp.client && /^[0-9a-f-]{36}$/.test(sp.client) ? sp.client : undefined;
  const [docs, clients, projects] = await Promise.all([listDocuments({ type, status, clientId }), getClients(), getProjects()]);
  const names: Record<string, string> = Object.fromEntries([
    ...clients.map((c) => [c.id, c.Company || c.Name]),
    ...projects.map((p) => [p.id, p.Name]),
  ]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ type, status, client: clientId, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return `/admin/documents${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Documents" purpose="Every proposal, quote, agreement, care plan, change request, invoice document and SOP, with its status and version." />
      <Explain
        shows="One row per document. Drafts can still change; a finalised version is frozen."
        read="Open a document to see its versions, status history and files. Names open the client or project."
        watch="Documents sent but not yet accepted or signed."
      />
      <div className="flex flex-wrap gap-2">
        <Link className={chip(!type)} href={qs({ type: undefined })}>All types</Link>
        {DOC_TYPES.map((t) => <Link key={t} className={chip(type === t)} href={qs({ type: t })}>{DOC_TYPE_LABEL[t]}</Link>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={chip(!status)} href={qs({ status: undefined })}>Any status</Link>
        {DOC_STATUSES.map((s) => <Link key={s} className={chip(status === s)} href={qs({ status: s })}>{DOC_STATUS_LABEL[s]}</Link>)}
      </div>
      {clientId && <p className="text-xs text-[#4A5568]">Showing {names[clientId] ?? "one client"} only. <Link className="font-medium text-[#1D4ED8] hover:underline" href={qs({ client: undefined })}>Show all clients</Link></p>}
      <DocumentsTable docs={docs} names={names} />
    </div>
  );
}
```

- [ ] **Step 2: Buttons `src/app/admin/documents/[id]/document-actions.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { finaliseDocumentAction, setDocumentStatusAction } from "@/app/documents-actions";
import { DOC_STATUS_LABEL, TRANSITIONS, type DocStatus } from "@/lib/documents";

/** Finalise, and the status moves allowed from here. Editing the text happens through Claude (Phase 2). */
export function DocumentActions({ id, status, missing }: { id: string; status: DocStatus; missing: string[] }) {
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(done);
      else toast.error(r.error ?? "That did not work");
    });
  const moves = TRANSITIONS[status].filter((s) => s !== "draft" && s !== "finalised");
  const btn = "min-h-11 sm:min-h-0 rounded-[4px] px-3 py-2 text-xs font-semibold disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <button type="button" disabled={busy || missing.length > 0} title={missing.length ? `Still missing: ${missing.join(", ")}` : undefined}
          className={`${btn} bg-[#1D4ED8] text-white`}
          onClick={() => confirm("Finalise? This version is frozen and can never be edited.") && run(() => finaliseDocumentAction(id), "Finalised")}>
          Finalise
        </button>
      )}
      {moves.map((s) => (
        <button key={s} type="button" disabled={busy}
          className={`${btn} border border-[#DCE1E8] ${s === "void" ? "text-[#B23A0A]" : "text-[#1B2533]"} hover:bg-[#0E1A2B]/5`}
          onClick={() => (s !== "void" || confirm("Void this document? This cannot be undone.")) && run(() => setDocumentStatusAction(id, s), `Marked ${DOC_STATUS_LABEL[s].toLowerCase()}`)}>
          Mark {DOC_STATUS_LABEL[s].toLowerCase()}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Document page `src/app/admin/documents/[id]/page.tsx`**

Shows: back link, title + type + status + version, links to client and project, missing-facts warning, the draft sections (or, when not a draft, the current version's sections), a versions list (each version selectable with `?version=N` to view it), files (default kind `signed_copy`), activity.

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getClientById, getProject } from "@/lib/db";
import { getDocument, getEntityActivity, listAttachments } from "@/lib/documents-db";
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL, missingFacts } from "@/lib/documents";
import { href } from "@/lib/record-graph";
import { PageHeader } from "@/components/dashboard/explain";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";
import { DocumentActions } from "./document-actions";

export const dynamic = "force-dynamic";
const link = "font-medium text-[#1D4ED8] hover:underline";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireAdminPage();
  if (!z.uuid().safeParse(id).success) notFound();
  const doc = await getDocument(id);
  if (!doc) notFound();
  const [client, project, files, activity] = await Promise.all([
    doc.clientId ? getClientById(doc.clientId) : null,
    doc.projectId ? getProject(doc.projectId) : null,
    listAttachments("document", [id]),
    getEntityActivity("document", id),
  ]);

  const asked = Number(sp.version);
  const shown = doc.versions.find((v) => v.version === asked) ?? (doc.status === "draft" ? null : doc.versions.at(-1) ?? null);
  const sections = shown ? shown.sections : doc.draft;
  const missing = missingFacts(doc.draft);

  return (
    <div className="space-y-3">
      <Link href="/admin/documents" className="text-xs text-[#5A6678] hover:text-[#334155]">Documents</Link>
      <PageHeader
        title={doc.title}
        purpose={`${DOC_TYPE_LABEL[doc.type]} · ${DOC_STATUS_LABEL[doc.status]} · ${doc.currentVersion ? `latest version v${doc.currentVersion}` : "never finalised"}`}
        action={<DocumentActions id={id} status={doc.status} missing={missing} />}
      />
      <p className="flex flex-wrap gap-x-4 text-xs text-[#4A5568]">
        {client && <span>Client <Link className={link} href={href.client(client.id)}>{client.Company || client.Name}</Link></span>}
        {project && <span>Project <Link className={link} href={href.project(project.id)}>{project.Name}</Link></span>}
        {doc.invoiceId && <span>Invoice <Link className={link} href={href.invoice(doc.invoiceId)}>open</Link></span>}
      </p>
      {doc.status === "draft" && missing.length > 0 && (
        <p className="border border-[#B23A0A]/30 bg-[#B23A0A]/5 p-3 text-sm text-[#B23A0A]">Still missing before it can be finalised: {missing.join(", ")}.</p>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_16rem]">
        <article className="border border-[#DCE1E8] bg-white p-4 sm:p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5A6678]">{shown ? `Version ${shown.version}, finalised ${shown.finalisedAt.slice(0, 10)}` : "Draft"}</p>
          {sections.length === 0 && <p className="text-sm text-[#6B7789]">Empty. Ask Claude to draft it.</p>}
          {sections.map((s) => (
            <section key={s.key} className="mb-4">
              <h2 className="text-[15px] font-semibold text-[#1B2533]">{s.heading}</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-[#1B2533]">{s.body}</p>
            </section>
          ))}
        </article>
        <aside className="border border-[#DCE1E8] bg-white p-4">
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Versions</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {doc.status === "draft" && <li><Link className={link} href={href.document(id)}>Current draft</Link></li>}
            {[...doc.versions].reverse().map((v) => (
              <li key={v.id}>
                <Link className={link} href={`${href.document(id)}?version=${v.version}`}>v{v.version}</Link>
                <span className="text-xs text-[#5A6678]"> · {v.finalisedAt.slice(0, 10)} · {v.finalisedBy.split("@")[0]}</span>
              </li>
            ))}
            {doc.versions.length === 0 && <li className="text-[#6B7789]">None yet</li>}
          </ul>
        </aside>
      </div>
      <FilesPanel entityType="document" entityId={id} files={files} defaultKind="signed_copy" />
      <ActivityList items={activity} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint src/app/admin/documents`
Expected: no errors.

```bash
git add src/app/admin/documents
git commit -m "feat(documents): documents list and a page per document with versions and files"
```

---

### Task 11: The client file

**Files:**
- Create: `src/lib/client-data.ts`
- Test: `scripts/client-data.test.ts`
- Modify: `src/app/admin/clients/[id]/page.tsx`
- Create: `src/app/admin/clients/[id]/client-file.tsx`

- [ ] **Step 1: Write the failing test `scripts/client-data.test.ts`**

```ts
// Checks one client's money summary. No database.
//   bun scripts/client-data.test.ts
import assert from "node:assert/strict";
import { clientMoney } from "../src/lib/client-data";
import type { Invoice, Project } from "../src/lib/db";

const projects = [{ id: "p1", Name: "Site" }, { id: "p2", Name: "App" }] as Project[];
const invoices = [
  { id: "i1", Status: "Paid", Amount: 1000, Project: ["p1"], "Issue Date": "2026-09-01", "Paid Date": "2026-09-11" },
  { id: "i2", Status: "Sent", Amount: 500, "Paid So Far": 200, Project: ["p2"], "Issue Date": "2026-10-01" },
  { id: "i3", Status: "Draft", Amount: 900, Project: ["p1"] },
] as Invoice[];
const payments = [
  { invoiceId: "i2", amount: 200, paidAt: "2026-10-05T12:00:00Z" },
];

const m = clientMoney({ projects, invoices, payments, cutover: "2026-10-22" });
assert.equal(m.billed, 1500, "drafts are not billed");
assert.equal(m.paid, 1200);
assert.equal(m.owed, 300);
assert.deepEqual(m.byMonth, [{ label: "2026-09", paid: 1000 }, { label: "2026-10", paid: 200 }], "pre-ledger paid invoices count on their paid date");
assert.deepEqual(m.byProject, [{ name: "Site", value: 1000 }, { name: "App", value: 200 }], "largest first");
assert.equal(m.avgDaysToPay, 10, "issue to paid, invoices paid in full");

const empty = clientMoney({ projects: [], invoices: [], payments: [], cutover: "2026-10-22" });
assert.deepEqual([empty.billed, empty.paid, empty.owed, empty.avgDaysToPay, empty.byMonth.length], [0, 0, 0, null, 0]);

console.log("client-data: all checks pass");
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun scripts/client-data.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write `src/lib/client-data.ts`**

```ts
// One client's money, for the client file: billed, paid, owed, received by
// month, paid by project and how long they take to pay. Pure; the caller
// passes only this client's invoices, projects and payments (see linksFor).
// Checked by scripts/client-data.test.ts.
import type { Invoice, Project } from "./db";
import { paidOn } from "./record-graph";

type Pay = { invoiceId: string; amount: number; paidAt: string };
const DAY = 86_400_000;

export function clientMoney({ projects, invoices, payments, cutover }: { projects: Project[]; invoices: Invoice[]; payments: Pay[]; cutover: string }) {
  const issued = invoices.filter((i) => i.Status !== "Draft" && i.Status !== "Void");
  const billed = issued.reduce((s, i) => s + (i.Amount ?? 0), 0);
  const paid = issued.reduce((s, i) => s + paidOn(i), 0);

  // Money in by month: ledger payments, plus invoices paid in full before the ledger began.
  const months = new Map<string, number>();
  const add = (date: string, amount: number) => months.set(date.slice(0, 7), (months.get(date.slice(0, 7)) ?? 0) + amount);
  const ids = new Set(issued.map((i) => i.id));
  for (const p of payments) if (ids.has(p.invoiceId)) add(p.paidAt, p.amount);
  for (const i of issued)
    if (i.Status === "Paid" && i["Paid Date"] && i["Paid Date"] < cutover.slice(0, 10) && !payments.some((p) => p.invoiceId === i.id))
      add(i["Paid Date"], i.Amount ?? 0);
  const byMonth = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([label, v]) => ({ label, paid: v }));

  const name = new Map(projects.map((p) => [p.id, p.Name]));
  const perProject = new Map<string, number>();
  for (const i of issued) {
    const v = paidOn(i);
    if (v <= 0) continue;
    const n = name.get(i.Project?.[0] ?? "") ?? "No project";
    perProject.set(n, (perProject.get(n) ?? 0) + v);
  }
  const byProject = [...perProject].map(([n, value]) => ({ name: n, value })).sort((a, b) => b.value - a.value);

  const spans = issued
    .filter((i) => i.Status === "Paid" && i["Issue Date"] && i["Paid Date"])
    .map((i) => (Date.parse(i["Paid Date"]!) - Date.parse(i["Issue Date"]!)) / DAY);
  const avgDaysToPay = spans.length ? Math.round(spans.reduce((s, d) => s + d, 0) / spans.length) : null;

  return { billed, paid, owed: Math.max(0, billed - paid), byMonth, byProject, avgDaysToPay };
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `bun scripts/client-data.test.ts`
Expected: `client-data: all checks pass`. Add `"test:client-data": "bun scripts/client-data.test.ts"` to `package.json`.

- [ ] **Step 5: Build the client file**

`src/app/admin/clients/[id]/client-file.tsx` is a **server-safe** component (no `"use client"`) that lays out, in this order, the sections the existing page does not have yet:

1. A row of `StatTile`s: Client since (`client.Created?.slice(0, 10)` or "Not recorded"), Billed, Paid (green tone), Still owed (orange tone when > 0), Care plan a month (sum of `monthlyAmount(s)` over this client's subscriptions where `isLive(s)`, from `lib/subscriptions.ts`), Average days to pay.
2. Charts, using the chart kit (read `chart-kit.tsx` props first): a `Donut` "Billed: paid and still owed" with slices Paid / Still owed (parts of a total, so a pie); a `SeriesChart` kind `"bar"` "Money received by month" from `byMonth` with series `[{ key: "paid", name: "Received" }]`; a `Donut` "Paid by project" from `byProject`. `SeriesChart` and `Donut` are client components; importing them into a server component is fine.
3. Deals: for each deal from `getDealsForClient`, one line: reference, project name as a link (`href.project`), price, deadline. Full editing stays on the project page.
4. Documents: `DocumentsTable` filtered to this client, `showClient={false}`, with a link "All documents for this client" to `/admin/documents?client=<id>`.
5. `FilesPanel` with `entityType="client"`.
6. `ActivityList` from `getClientActivity(id)`.

```tsx
import Link from "next/link";
import type { Client, Invoice, Project, Subscription } from "@/lib/db";
import type { Activity, Attachment, Deal, Doc } from "@/lib/documents-db";
import { clientMoney } from "@/lib/client-data";
import { isLive, monthlyAmount } from "@/lib/subscriptions";
import { tt } from "@/lib/ledger";
import { href } from "@/lib/record-graph";
import { StatTile } from "@/components/dashboard/explain";
import { Donut, SeriesChart } from "@/components/dashboard/chart-kit";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";

type Pay = { invoiceId: string; amount: number; paidAt: string };

export function ClientFile({ client, projects, invoices, payments, cutover, subscriptions, deals, docs, files, activity }: {
  client: Client; projects: Project[]; invoices: Invoice[]; payments: Pay[]; cutover: string;
  subscriptions: Subscription[]; deals: Deal[]; docs: Doc[]; files: Attachment[]; activity: Activity[];
}) {
  const m = clientMoney({ projects, invoices, payments, cutover });
  const care = subscriptions.filter((s) => isLive(s)).reduce((sum, s) => sum + monthlyAmount(s), 0);
  const projectName = new Map(projects.map((p) => [p.id, p.Name]));
  const names: Record<string, string> = Object.fromEntries(projects.map((p) => [p.id, p.Name]));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile label="Client since" value={client.Created?.slice(0, 10) ?? "Not recorded"} note="When they were added." />
        <StatTile label="Billed" value={tt(m.billed)} note="Every invoice issued, drafts and voids left out." />
        <StatTile label="Paid" value={tt(m.paid)} note="Everything received from them." tone="text-[#1E6B3A]" />
        <StatTile label="Still owed" value={tt(m.owed)} note="Billed but not yet received." tone={m.owed > 0 ? "text-[#B23A0A]" : undefined} />
        <StatTile label="Care plan a month" value={tt(care)} note="Their live recurring plans, as a monthly figure." />
        <StatTile label="Days to pay" value={m.avgDaysToPay == null ? "No data" : String(m.avgDaysToPay)} note="Average from issue to paid in full." />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Donut title="Billed: paid and still owed" description="How much of what we billed them has come in." data={[{ name: "Paid", value: m.paid }, { name: "Still owed", value: m.owed }]} centre={tt(m.billed)} />
        <SeriesChart title="Money received by month" description="Payments from this client, by the month they arrived." rows={m.byMonth} series={[{ key: "paid", name: "Received" }]} kind="bar" />
        <Donut title="Paid by project" description="Which projects their payments were for." data={m.byProject} centre={tt(m.paid)} />
      </div>
      <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Deals</h2>
        <p className="mt-0.5 text-xs text-[#4A5568]">What we offered on each project. Open a project to change its deal.</p>
        {deals.length === 0 ? <p className="mt-3 text-sm text-[#6B7789]">No deals recorded yet.</p> : (
          <ul className="mt-3 divide-y divide-[#EEF1F5] text-sm">
            {deals.map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><strong>{d.reference}</strong>{d.projectId && <> · <Link className="font-medium text-[#1D4ED8] hover:underline" href={href.project(d.projectId)}>{projectName.get(d.projectId) ?? "Project"}</Link></>}</span>
                <span className="text-[#5A6678]">{d.priceTotal != null ? tt(d.priceTotal) : "No price"}{d.deadline ? ` · due ${d.deadline}` : ""}{d.carePlan ? ` · care ${tt(d.carePlan.monthlyAmount)}/mo` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Documents</h2>
          <Link className="text-xs font-medium text-[#1D4ED8] hover:underline" href={`/admin/documents?client=${client.id}`}>All documents for this client</Link>
        </div>
        <DocumentsTable docs={docs} names={names} showClient={false} />
      </section>
      <FilesPanel entityType="client" entityId={client.id} files={files} />
      <ActivityList items={activity} />
    </>
  );
}
```

Check the exact props of `Donut` and `SeriesChart` in `chart-kit.tsx` (for example whether `centre` is required, whether `rows` needs extra keys) and adjust the calls to match. Keep the chart rule: parts of a total are pies, values over time are bars.

- [ ] **Step 6: Wire it into `src/app/admin/clients/[id]/page.tsx`**

Add to the `Promise.all`: `getSubscriptions()` from `@/lib/db`, and `getDealsForClient(id)`, `listDocuments({ clientId: id })`, `listAttachments("client", [id])`, `getClientActivity(id)` from `@/lib/documents-db`. Use `linksFor("client", id, { clients, leads, projects, invoices })` from `@/lib/record-graph` to get this client's projects and invoices, and filter `ledger.payments` to those invoice ids. Then pass a `<ClientFile …/>` element into `TimelineView` through its existing `linked` prop, after the existing `<ClientRecords …/>`:

```tsx
linked={
  <>
    <ClientRecords clientId={id} graph={{ clients, leads, projects, invoices }} payments={ledger.payments} cutover={ledger.cutover} />
    <ClientFile client={client} projects={r.projects} invoices={r.invoices} payments={clientPayments} cutover={ledger.cutover}
      subscriptions={subscriptions.filter((s) => s.Client?.[0] === id)} deals={deals} docs={docs} files={files} activity={activity} />
  </>
}
```

Check the `Subscription` type's client link field name in `db.ts` (`Client` array, by analogy with `SUBSCRIPTION_LINKS`).

In `timeline-view.tsx`, make each project chip in the header a link: wrap `{p.Name}` in `<Link href={href.project(p.id)} className="font-medium text-[#1D4ED8] hover:underline">`, importing `href` from `@/lib/record-graph`.

- [ ] **Step 7: Type-check, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint "src/app/admin/clients/[id]" src/lib/client-data.ts && bun scripts/client-data.test.ts`
Expected: no errors; tests pass.

```bash
git add src/lib/client-data.ts scripts/client-data.test.ts "src/app/admin/clients/[id]" package.json
git commit -m "feat(clients): client file with money summary, charts, deals, documents, files and activity"
```

---

### Task 12: Every name is a link (sweep)

**Files:** whatever the sweep finds under `src/components/dashboard/` and `src/app/admin/`.

- [ ] **Step 1: Find every place a record name renders as plain text**

Run these and read each hit in context:

```bash
grep -rnE "\.(Company|Name)\b" src/components/dashboard src/app/admin --include=*.tsx | grep -v "href\." | grep -v "Link"
grep -rnE "Invoice Number\"\]" src/components/dashboard src/app/admin --include=*.tsx | grep -v "href\."
grep -rnE "clientName|projectName|client_name|project_name" src/components/dashboard src/app/admin src/lib --include=*.ts --include=*.tsx
```

Write the list of findings (file:line, what is shown, which record it is) into the commit message body.

- [ ] **Step 2: Turn each into a link**

For each hit that displays a client, project, invoice, lead or document name for a known record id: wrap it in `<Link href={href.<kind>(id)} className="font-medium text-[#1D4ED8] hover:underline">`. Use `href` from `@/lib/record-graph`; never hand-build an `/admin/...` URL.

Leave alone: form inputs, `<option>` labels, chart axis tick labels (charts already open record lists on click), text inside a row that is itself already a link or a click target (do not nest interactive elements), and the public site under `src/app/(site)`.

Where a link sits inside a clickable row or card (for example `project-board.tsx`, whose cards open a modal), add `onClick={(e) => e.stopPropagation()}` to the link so following it does not also open the modal, matching `linked-records.tsx`.

- [ ] **Step 3: Type-check, lint, run all pure tests**

```bash
npx tsc --noEmit -p . && npx eslint src
bun scripts/documents.test.ts && bun scripts/record-graph.test.ts && bun scripts/client-data.test.ts && bun scripts/subscriptions.test.mjs
```

Expected: no errors; every script prints its pass line.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat(links): every client, project, invoice and document name opens its record"
```

---

## After all tasks: hand-off to Michael (not done by any subagent)

1. Run the full DB acceptance test once more against `docs-pg`.
2. Visual check through a temporary preview page with mock data (never committed), per the repo's practice.
3. Give Michael, in this order:
   - `SUPABASE_SERVICE_ROLE_KEY` must be set on Vercel production (`vercel env ls` to check; it may only exist locally for `seed-admins.mjs`).
   - Apply `022_documents.up.sql` then `023_files_bucket.up.sql` to production with `node --env-file=.env.local scripts/run-migration.mjs <file>` (run `--dry-run` first).
   - Only then merge the PR (a merge deploys).
4. Then `/qc-loop`, then the Phase 2 plan.
