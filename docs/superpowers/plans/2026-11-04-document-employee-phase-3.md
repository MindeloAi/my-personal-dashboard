# Document Employee Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Service agreement, care plan and change request documents, client legal details, change requests that update the deal, and a "Start care plan" action that creates the retainer.

**Architecture:** Same pattern as Phases 1–2: pure rules in `src/lib/doc-templates.ts`, database rules in `src/lib/documents-db.ts` (transactions, `DocumentRuleError`, `logActivity`), PDF in `src/lib/pdf/document-pdf.tsx` + `store.ts`, connector in `src/lib/connector/tools.ts` + `src/lib/connector-db.ts`, dashboard pages under `src/app/admin`. Spec: `docs/superpowers/specs/2026-11-04-document-employee-phase-3-design.md`.

**Tech Stack:** Next.js 16.2 (read `node_modules/next/dist/docs/` before Next-specific code), postgres.js, zod 4, `@react-pdf/renderer` 4.9, `mcp-handler`, bun assert tests. Throwaway DB: docker `docs-pg` at `postgres://postgres:pg@localhost:55433/postgres`.

**Ground rules for every task:**
- All paths below are under `business-dashboard/`. Work in `C:\Users\taylo\mpd-documents` on branch `feat/document-employee-phase-3`.
- NEVER use `.env.local` or any production URL. Tests run only against `docs-pg`.
- No em dashes in any user-facing text (UI, PDF, defaults, tool descriptions).
- Every mutating server action starts with `requireAdmin()`. Never write `invoices.status`, payments or founder pay.
- Match surrounding code style; comments only where they explain why.
- Run: `bun scripts/doc-templates.test.ts`, and with `DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres`: `bun scripts/documents-db.test.ts`, `bun scripts/connector-db.test.ts`, `bun scripts/connector-tools.test.ts`; plus `npx tsc --noEmit` (only the pre-existing `scripts/export.test.ts` error is allowed). Commit each task with a `feat(documents): …` message ending in `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: migration 026 + pure rules

**Files:** Create `scripts/migrations/026_agreements.up.sql`, `.down.sql`; append the up SQL to `scripts/schema.sql`; modify `src/lib/doc-templates.ts`; test `scripts/doc-templates.test.ts`.

- [ ] **026 up:**
  ```sql
  alter table clients add column if not exists address text;
  alter table clients add column if not exists signatory_name text;
  alter table clients add column if not exists signatory_title text;
  alter table documents add column if not exists subscription_id uuid references subscriptions(id) on delete set null;
  alter table documents add constraint documents_subscription_only_on_care_plans check (type = 'care_plan' or subscription_id is null);
  create unique index if not exists documents_one_retainer_per_care_plan on documents (subscription_id) where subscription_id is not null;
  ```
  Down drops them in reverse. Apply to docs-pg with `DIRECT_URL=postgres://postgres:pg@localhost:55433/postgres node scripts/run-migration.mjs scripts/migrations/026_agreements.up.sql`.
- [ ] **`DEFAULT_SECTIONS`** for `service_agreement`, `care_plan`, `change_request`, keys and headings exactly as in the spec's Templates section. Bodies: the clause wording from `C:\Users\taylo\.claude\skills\doc\house-style.md` ("Standard terms", "Care plan (default)") copied word for word, with `{{missing: …}}` for every per-deal fact (scope, price, schedule, monthly amount, timeline, CR items, CR timeline effect). Termination: "Either party may end this agreement on fourteen days written notice. The first payment is not refundable once work has started. This agreement is governed by the laws of Trinidad and Tobago." Payment terms: "Each invoice is payable within fourteen days of issue."
- [ ] **Pure helpers** in `doc-templates.ts`:
  ```ts
  /** A change request's total added to the deal: price and the LAST schedule line. Empty schedule: price only. */
  export function applyChange(price: number | null, schedule: ScheduleLine[], amount: number): { price: number; schedule: ScheduleLine[] }
  /** First care-plan invoice: one month after the care plan begins, same day, clamped to month end. yyyy-mm-dd in, out. */
  export function firstCareInvoice(startDay: string): string
  /** "<REF>-CR<n>" for the next change request, given existing CR titles/refs. */
  export function nextChangeRef(dealRef: string, existing: string[]): string
  ```
  (`ScheduleLine` is the existing payment-schedule line type in `src/lib/documents.ts`; reuse it.) Money in cents to avoid float drift.
- [ ] **Tests** (assert): defaults for the 3 types have no `—`, all block finalising (`missingFacts(...).length > 0`); `applyChange(5000, [2500,2500 lines], 800)` → price 5800, last line 3300, first unchanged; empty schedule → price only; `applyChange(null, [], 800)` → 800; `firstCareInvoice("2026-01-31")` → `"2026-02-28"`, `"2028-01-31"` → `"2028-02-29"`, `"2026-11-04"` → `"2026-12-04"`; `nextChangeRef("TC-2026-01", [])` → `"TC-2026-01-CR1"`, with `["TC-2026-01-CR1","TC-2026-01-CR2"]` → `"…-CR3"`.

### Task 2: database rules

**Files:** Modify `src/lib/documents-db.ts` (and its types), `src/lib/connector-db.ts` (`getClientContext` returns legal details); test `scripts/documents-db.test.ts`.

- [ ] `saveClientDetails(clientId, { address?, signatoryName?, signatoryTitle? }, actor, via)`: trims, empty string → null, only given fields change, refuses a missing client, logs activity on the client (`entity_type 'client'`, action `updated`, summary "Legal details updated").
- [ ] `checkTemplate` additions: `service_agreement` and `care_plan` need `doc.clientId` whose client has address and signatory name (message: "Add the client's address and signatory (client page, Legal details) first"); `care_plan` needs the deal's `care_plan.monthly_amount` (> 0); `change_request` needs an `items` section passing `itemsProblem(body, null)`.
- [ ] Change request accepted: inside `setDocumentStatus` (to `accepted`) and inside `addAttachment`'s signed-copy branch (to `signed`), when `doc.type === 'change_request'` and the previous status was neither `accepted` nor `signed`: lock the deal (`for update`), refuse if a live invoice document already exists for the deal's LAST schedule line (same live test as `createInvoiceFromDeal`'s dupe check, title `Invoice: <last label>`) with "The final invoice already exists. Invoice this change separately.", else `applyChange` with the items total, update the deal (respecting `deals_schedule_adds_up`), log activity on the deal ("<title> added TT$x to <last label>"). A CR with no deal: status changes, nothing else. Factor into one helper `applyAcceptedChange(tx, doc, actor, via)` used by both paths.
- [ ] `carePlanStart(documentId)`: returns `{ ready: true, amount, finalPaidOn, firstInvoice, clientName } | { ready: false, reason }`. Reasons: not a care plan / not signed / already started (`subscription_id` set) / deal has no care plan amount / final payment not recorded (project's `final` or `one_off` invoice not `Paid`). `finalPaidOn` = max `payments.paid_at` for that invoice.
- [ ] `startCarePlan(documentId, actor, via)`: in one transaction, lock the doc, recompute readiness (refuse with its reason), insert `subscriptions (name, client_id, project_id, amount, frequency, status, start_date, notes)` = (`<client> care plan`, client, project, amount, `'monthly'`, `'Active'`, `firstInvoice`, `Care began <finalPaidOn>. From <doc title>.`), set `documents.subscription_id`, log activity on the document ("Care plan started: first invoice <date>"). Returns the subscription id.
- [ ] Tests (extend `documents-db.test.ts`, reset must delete `subscriptions where name like 'TEST %'` and clear new client columns): legal details save/clear; agreement finalise refused without details then succeeds; CR accepted updates deal price and last line once; accepted → signed does not double count; CR refused when last-line invoice exists; `carePlanStart` not ready before the final invoice is Paid (insert payments directly in test setup as existing tests do), ready after with correct dates; `startCarePlan` creates exactly one Active monthly subscription with `start_date = firstInvoice`; second call refused.

### Task 3: PDFs

**Files:** Modify `src/lib/pdf/store.ts` (load `address`, `signatory_name`, `signatory_title`; lead fallback stays), `src/lib/pdf/document-pdf.tsx`; test `scripts/pdf.test.tsx`.

- [ ] Client block for `service_agreement`, `care_plan`, `change_request`: label `BETWEEN` / `AND`-style parties: "MINDELOAI LIMITED, trading as Mindelo, 4 Warren Street, Port of Spain" and the client's registered name (`company ?? name`), address, "Signing: <signatory>, <title>".
- [ ] Signature block at the end of those three types (`wrap={false}`): two columns, each with "For MINDELOAI LIMITED" / "For <client>", then lines for Signature, Name, Title, Date. Mindelo's name line left blank for hand fill.
- [ ] Change request: items table + total like quotes (reuse the existing items rendering).
- [ ] Care plan: show "TT$<amount> a month" from the deal under its title.
- [ ] Render each of the three to `C:\Users\taylo\AppData\Local\Temp\claude\C--Users-taylo\250c2dfd-5089-428c-b4f7-192d5c2aaa0b\scratchpad\phase3-<type>.pdf` from the test with sample data, and assert they render without throwing.

### Task 4: dashboard

**Files:** client page `src/app/admin/clients/[id]/page.tsx` (+ a small client component), document page `src/app/admin/documents/[id]/page.tsx` (+ `document-actions.tsx`), server actions in `src/app/documents-actions.ts`.

- [ ] Client page: "Legal details" card (address textarea, signatory name, signatory title, Save) calling `saveClientDetailsAction` → `saveClientDetails`. How-to note under it, same style as other Phase 2 notes: "Used on service agreements, care plans and change requests. Claude fills these in when you tell it."
- [ ] Signed care plan page: "Start care plan" card using `carePlanStart`: ready → shows client, TT$ amount a month, care began <date>, first invoice <date>, button "Start care plan" (`startCarePlanAction` → `startCarePlan`, then revalidate and show "Started. The retainer is in Finance, Recurring."); not ready → the reason in muted text; started → link to the retainer. How-to note: "Appears once the care plan is signed. It needs the project's final payment recorded in Finance first."
- [ ] Change request page: when accepted/signed, a line "Added TT$x to the deal's final payment." (read from activity or recompute; keep it simple).
- [ ] New-document picker (wherever founders create documents) offers the three types if it does not already.

### Task 5: connector

**Files:** `src/lib/connector/tools.ts`, `scripts/connector-tools.test.ts`.

- [ ] Tool `save_client_details` (title "Client legal details"): zod input `{ clientId: uuid, address?: string max 500, signatoryName?: string max 120, signatoryTitle?: string max 120 }` (no `.transform()`), calls `saveClientDetails(..., "claude")`, returns the saved details. Description tells Claude to ask once and save, and that agreements need them.
- [ ] `save_draft`: new documents of the three types start from `DEFAULT_SECTIONS` like the others (check existing behaviour; add if missing). For `change_request`, default title includes `nextChangeRef`.
- [ ] `set_status` result for an accepted change request says what was added to the deal.
- [ ] Tests: tool list has 13 tools; save_client_details round trip; rejects bad uuid.

### Task 6 (controller, not a subagent): skill + instructions

- [ ] Update `C:\Users\taylo\.claude\skills\doc\SKILL.md`, `house-style.md`, `project-instructions.md`: order (quote/proposal → accepted → service agreement → invoices; change requests during the build; care plan with the final payment), CR numbering, ask once for legal details and save with `save_client_details`, Start care plan is a dashboard button.

### Task 7: final review, PR

- [ ] Whole-branch review (fresh reviewer), fix findings, push, open PR. Michael applies migration 026 to production, then says merge.
