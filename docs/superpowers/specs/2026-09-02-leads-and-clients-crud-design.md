# Leads & Clients — record CRUD, cross-tab links, mobile pass

**Date:** 2026-09-02
**Status:** Approved by Taylor
**Supersedes:** `2026-07-16-clients-section-design.md` (approved, never implemented;
it targets `dashboard-shell.tsx`, deleted in the page split, and Airtable, replaced
by Supabase on 2026-08-26). One of its decisions is deliberately reversed — see
"Reversed decision" below.

## Problem

Three distinct problems, all inside `/admin/leads` and `/admin/clients`.

**1. Neither tab can edit its records.** Leads can be created and have their Status
changed; nothing else. Email, Phone, Follow-up Date, Source, Notes and Proposal
Draft render but cannot be altered. `updateLead` exists in `db.ts` and only
`updateLeadStatusAction` calls it. Clients are worse: `/admin/clients` renders one
component, `TopClients` — a top-5 revenue leaderboard restricted to clients with
paid invoices. There is no client list and no client editing anywhere in the app.

**2. The cross-tab links are broken.** `clients-view.tsx:19` routes to
`/finance?client=…` and `overview-view.tsx:31` routes to `/finance?status=Overdue`.
Both predate the move under `/admin` and 404 today.

**3. Modals are unusable on a phone.** All five (`leads-table`, `edit-invoice-modal`,
`expenses-list`, `project-board`, `quick-actions`) share an identical shell:
`fixed inset-0 z-50 flex items-center justify-center`, with no padding, no
`max-height` and no `overflow-y-auto`. Any modal taller than the viewport is
centred and clipped at both ends with no way to scroll. The New Lead modal is nine
fields tall; on a 375×667 screen its submit button is unreachable.

## Scope

Polish, not rebuild. No component is replaced, no layout is reorganised, and
`TopClients` is not touched. Work is confined to the two tabs plus one shared
extraction; Finance, Overview and Projects change only where a link or a modal
wrapper is involved.

## Design

### 1. `ModalShell` (new shared component)

`src/components/ui/modal-shell.tsx`. Absorbs what the five modals already
duplicate verbatim: backdrop, click-outside-to-close, the `Escape` key handler and
the `max-w-md` card.

The fix that matters is on the wrapper:

- outer: `fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto`
- inner: `max-h-[calc(100dvh-2rem)] overflow-y-auto`

`dvh`, not `vh`. Mobile Safari's `100vh` measures the viewport *behind* the URL
bar, so a `vh`-based cap still clips the submit button — the exact bug being fixed.

Also adds `role="dialog"`, `aria-modal="true"`, an `aria-label` from the title, and
a body scroll lock while open. None of the five modals has any of these today.

All five migrate to it. Their form bodies are untouched; the diff is the wrapper.

### 2. Mobile pass

Beyond the modal fix:

- `app/admin/layout.tsx`: content padding `p-5` → `p-3 sm:p-5` (recovers 16px of
  usable width at 375px).
- Leads and Clients cards: `p-6` → `p-4 sm:p-6`.
- Lead status pill: grows to a 44px minimum tap target on touch viewports.

Finance, Overview and Projects get the modal fix and nothing else. Anything else
found broken there is **reported, not fixed** — expanding into those screens is out
of scope for this spec.

### 3. Leads CRUD

`NewLeadModal` becomes `LeadModal`, taking an optional `lead` prop: absent means
create, present means edit (prefilled, retitled "Edit lead"). One component for
both modes so they cannot drift apart.

Row click keeps its current inline-expand behaviour. **Edit** and **Delete**
controls are added inside the expanded panel, leaving the pipeline's shape
unchanged. Delete confirms first, and is a hard delete — nothing in the schema
references `leads`, so there is nothing to orphan.

Every field on `LeadWriteSchema` becomes editable, including the six that are
display-only today.

New in `db.ts`: `deleteLead = (id) => deleteRow("leads", id)`.
New in `actions.ts`: `updateLeadAction`, `deleteLeadAction`, both behind
`requireAdmin()`.

### 4. Clients list + CRUD

`TopClients` renders unchanged at the top of the tab. A new `ClientsList`
(`src/components/dashboard/clients-list.tsx`) renders below it: every client with
Name, Company, Status pill and a **+ New client** button.

Each row carries three distinct affordances, kept separate so no gesture is
overloaded:

- **Row body click** → opens the edit modal over `ModalShell`, with the
  `ClientWriteSchema` fields (Name, Company, Email, Phone, Status, Notes, Owner).
- **"Invoices" and "Projects" links** → the cross-tab navigation in §5. Explicit
  controls on the row, not the row click, and they `stopPropagation` so they never
  also open the editor.
- **Delete** → inside the edit modal, not on the row, so it cannot be hit by
  mis-tapping on a phone.

Note the leaderboard above uses a different gesture for a different purpose: a
`TopClients` row click filters Finance to that client (§5 repair). That is
unchanged, and is why the list's row click is the editor rather than a duplicate
of it.

**Expect this list to be empty on first load.** The clients table came out of the
Airtable migration with no usable rows. That is the condition being fixed, not a
defect in this work; the list is populated via **+ New client** and via lead
conversion (§5).

New in `db.ts`: `updateClient`, `deleteClient` (one line each over the existing
`updateRow` / `deleteRow` helpers).
New in `actions.ts`: `createClientAction`, `updateClientAction`,
`deleteClientAction`.

#### Reversed decision: client delete

The July spec ruled out client delete, making Status → "Inactive" the archive path.
**Taylor reversed this on 2026-09-02, with the consequence stated.** Recorded here
so the reversal is not mistaken for an oversight.

The consequence: every FK into `clients` is `ON DELETE SET NULL` (never CASCADE —
see `scripts/schema.sql:11`). Deleting a client therefore does **not** delete their
projects or invoices; it detaches them. Detached invoices belong to no client,
disappear from the Finance client filter, and stop counting toward Top Clients
revenue. This is permanent and has no undo.

Mitigation, and the reason the option was acceptable: the confirm dialog counts the
linked projects and invoices from the props already loaded on the page and names
those counts before proceeding — "This will detach 3 projects and 5 invoices."
No silent detachment.

The invoice count must resolve a client the same way `TopClients` does —
`invoice.Client?.[0] ?? projectToClient.get(invoice.Project?.[0])` — because
`invoices.client_id` is normally NULL and the real link runs through the project
(`schema.sql:95`). Counting on `invoice.Client` alone would under-report, and the
warning would understate the damage.

### 5. Cross-tab links

| Link | Implementation |
|---|---|
| Repair (2 dead links) | `/finance?client=` → `/admin/finance?client=`; `/finance?status=Overdue` → `/admin/finance?status=Overdue` |
| Client → invoices | Row action routes to `/admin/finance?client=<id>`. Receiving end already works — `finance/page.tsx` reads `?client` and seeds the filter. |
| Client → projects | Add `searchParams` to `projects/page.tsx` mirroring `finance/page.tsx`, plus a client filter in `ProjectBoard` beside its existing `ownerFilter`. Filter on `p.Client?.[0] === clientId`. |
| Lead → client | Moving a lead to **Won** opens a prefilled "Create client from this lead?" confirm. |

Lead conversion is **prompted, never automatic** — flipping a lead to Won twice
would otherwise silently create a duplicate client. Before offering, it checks for
an existing client matching on email (or, absent an email, on name) and reports the
match instead of creating a second record. The conversion copies Name, Business
Name, Email and Phone across and stops. No lead→client foreign key exists in the
schema and none is added; the lead is not mutated beyond its Status.

## Data flow

No new queries on Leads. `/admin/clients` already loads `clients`, `invoices` and
`projects` — `ClientsList` and the delete confirm's link counts both read from
those existing props. All writes go through server actions, each calling
`requireAdmin()` then `revalidatePath("/", "layout")`, matching every existing
mutation.

## Error handling

The established pattern, unchanged: `useOptimistic` for in-place status moves,
`toast.error` and revert on throw, zod validation at the `db.ts` boundary so an
invalid payload throws before reaching Postgres. No error is swallowed and no
failure path is silent — a failed write must surface a toast and restore the prior
value.

## Testing

- `npm run build` must pass.
- Extend the existing Playwright auth harness with the one case that cannot be
  eyeballed: at a 375×667 viewport, open the New Lead modal and assert its submit
  button is reachable and clickable. This is a regression test for the §1 bug.
- Manual pass: create → edit → delete a lead; create → edit a client; convert a Won
  lead and confirm the duplicate check fires on a second attempt; follow all three
  cross-tab links.
- Run `/qc-loop` before sign-off.
- **No commit or deploy without Taylor's explicit sign-off.** Deploy target is
  Vercel, root directory `business-dashboard`, CLI deploy from the git root.

## Out of scope

- View customisation — sort, search, column choice, saved preferences. Considered
  and explicitly deselected; this spec covers record CRUD only.
- Inline per-client counts on the list rows ("3 projects · 5 invoices").
- Any change to `TopClients` beyond leaving it in place.
- Layout or styling work on Finance, Overview and Projects beyond the shared modal
  fix and the two link repairs.
- A lead→client foreign key, or any schema migration.
