# Clients Section — My Personal Dashboard

**Date:** 2026-07-16
**Status:** Approved by Taylor

## Problem

The dashboard has no place to view or update clients, even though Clients is a core
table in the `Buisness Dashboard` Airtable base. The sidebar already ships a
"Clients" nav entry, but its `id="clients"` anchor points at the read-only Top
Clients revenue widget — there is no way to see all clients, edit contact info,
change status, or add notes from the dashboard. Every other core table (Projects,
Invoices, Expenses, Leads, Tasks, Ideas) has full CRUD server actions; Clients has
reads (`getClients`, `getClientById`) and an unexposed `createClient` helper only.

## Design

### Placement

A new full-width `<Section id="clients" title="Clients">` in
`dashboard-shell.tsx`, between the Projects board (Row 3) and the Leads section —
mirroring how Leads is structured. The `id="clients"` anchor moves off the Top
Clients widget wrapper onto this new section so the existing sidebar entry lands on
real client management. Top Clients keeps working unchanged as a revenue widget
(its wrapper div just loses the `id`/`scroll-mt` attributes).

### `ClientsTable` component (new)

`src/components/dashboard/clients-table.tsx`, patterned on `leads-table.tsx`:

- Lists **all** clients: Name, Company, Email, Phone, Status badge
  (Active / Inactive / Lead), Owner.
- Status filter chips: All / Active / Inactive / Lead — same filter-chip style as
  the invoices table.
- Row click opens an **edit modal** (patterned on `edit-invoice-modal.tsx`) with
  fields: Name, Company, Email, Phone, Status, Owner, Notes.
- **"+ Add client"** button opens the same modal in create mode.
- Modal lives in `src/components/dashboard/edit-client-modal.tsx` (create + edit
  modes, like the invoice modal).

### Server actions (new, in `src/app/actions.ts`)

Following the exact pattern of the existing CRUD actions (call helper, then
`revalidatePath("/dashboard")`):

- `createClientAction(data: ClientWrite)` — wraps the existing `createClient`
  helper (`src/lib/airtable.ts:464`).
- `updateClientAction(id: string, data: ClientWrite)` — needs a small
  `updateClient` helper added to `airtable.ts`, same shape as `updateProject`
  (update record, parse with `ClientSchema`).

**No delete.** Clients are linked to Projects/Invoices; setting Status to
"Inactive" is the archive path. Deleting a client record stays an Airtable-side
decision.

### Data flow

No new fetches. `clients` is already loaded in parallel by the dashboard page and
passed into `DashboardShell`; the new section receives the same prop. Writes go
through server actions and `revalidatePath`, consistent with every other section.

### Error handling

Same conventions as existing actions/modals: zod-validated writes
(`ClientWriteSchema`), server action failures surface via the existing
sonner-toast pattern used by the other edit modals.

### Testing / QC

- `npm run build` (or the repo's standard build check) must pass.
- Run `/qc-loop` after implementation, before sign-off.
- Verify by driving the flow: load dashboard → Clients section lists records →
  edit a client → add a client → confirm records change in Airtable.
- **No commit or deploy without Taylor's explicit sign-off.** Deploy target is
  Vercel with root directory `business-dashboard`.

## Out of scope

- Client detail drawer showing linked projects/invoices (considered, deferred).
- Delete action.
- Any changes to the Top Clients revenue widget beyond removing its anchor id.
