# Leads & Clients CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Leads and Clients full record editing, wire the three cross-tab links, and make every dashboard modal usable on a phone.

**Architecture:** Additive polish over the existing components. One shared `ModalShell` absorbs the identical broken wrapper the five modals already duplicate, fixing mobile scroll in one place. Leads keeps its status-grouped pipeline and gains edit/delete; Clients keeps its untouched `TopClients` leaderboard and gains a list beneath it. Every mutation goes through the existing `createRow`/`updateRow`/`deleteRow` helpers in `db.ts` and a `requireAdmin()`-guarded server action.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` not `middleware.ts`), React 19, TypeScript, Tailwind v4, zod, `postgres` driver against Supabase, sonner for toasts, Playwright via Python for browser checks.

**Spec:** `docs/superpowers/specs/2026-09-02-leads-and-clients-crud-design.md`

---

## Working agreement

- **All paths below are relative to `business-dashboard/`** unless they start with `docs/`.
- **Do not commit to `main`.** Task 0 creates a branch.
- **Do not deploy.** Deployment is Taylor's decision, always.
- **Read `node_modules/next/dist/docs/` before writing framework-level code.** Per `AGENTS.md`, this Next version has breaking changes versus training data.
- **No worktree.** Windows junction behaviour can empty the real `node_modules` when a worktree is removed. Work in the main checkout on a branch.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/components/ui/modal-shell.tsx` | **Create** | The one modal wrapper: backdrop, Escape, scroll lock, mobile-safe sizing |
| `src/components/dashboard/clients-list.tsx` | **Create** | Client list rows, edit modal, delete-with-warning, cross-tab links |
| `src/lib/db.ts` | Modify | Add `updateClient`, `deleteClient`, `deleteLead` |
| `src/app/actions.ts` | Modify | Add 5 server actions |
| `src/components/dashboard/leads-table.tsx` | Modify | `LeadModal` create+edit, row edit/delete, Won→client conversion |
| `src/app/admin/leads/page.tsx` | Modify | Also fetch `clients` (needed for the duplicate check) |
| `src/app/admin/clients/clients-view.tsx` | Modify | Render `ClientsList` under `TopClients`; repair dead link |
| `src/app/admin/overview/overview-view.tsx` | Modify | Repair dead link |
| `src/app/admin/projects/page.tsx` | Modify | Accept `?client=` |
| `src/components/dashboard/project-board.tsx` | Modify | Client filter beside existing owner filter; use `ModalShell` |
| `src/components/dashboard/edit-invoice-modal.tsx` | Modify | Use `ModalShell` |
| `src/components/dashboard/expenses-list.tsx` | Modify | Use `ModalShell` |
| `src/components/dashboard/quick-actions.tsx` | Modify | Use `ModalShell` |
| `src/app/admin/layout.tsx` | Modify | Mobile padding |
| `scripts/auth-flow-test.py` | Modify | Add mobile-modal regression checks |

---

## Task 0: Branch

**Files:** none

- [ ] **Step 1: Confirm a clean tree and branch**

```bash
cd /c/Users/taylo/my-personal-dashboard
git status --short
git checkout -b feat/leads-clients-crud
```

Expected: only the two known untracked entries (`.gitignore`, `business-dashboard/src/app/vault-preview/`). If anything else is modified, **stop and ask** — do not stash someone else's work.

- [ ] **Step 2: Confirm the build is green before changing anything**

```bash
cd business-dashboard && npm run build
```

Expected: `✓ Compiled successfully`. A red baseline means the failure is pre-existing — report it and stop rather than absorbing it into this work.

---

## Task 1: Database mutations

**Files:**
- Modify: `src/lib/db.ts` (writes section, near line 1016)

- [ ] **Step 1: Add the three missing mutations**

In `src/lib/db.ts`, directly after the existing `updateLead` export:

```ts
export const updateLead = (id: string, payload: LeadWrite) =>
  updateRow("leads", LeadWriteSchema, id, payload, LEAD_COLS);

// Nothing in the schema references leads, so a delete orphans nothing.
export const deleteLead = (id: string) => deleteRow("leads", id);
```

And directly after the existing `createClient` export:

```ts
export const createClient = (payload: ClientWrite) =>
  createRow("clients", ClientWriteSchema, payload, CLIENT_COLS);

export const updateClient = (id: string, payload: ClientWrite) =>
  updateRow("clients", ClientWriteSchema, id, payload, CLIENT_COLS);

// Every FK into clients is ON DELETE SET NULL (schema.sql:11), so this detaches
// projects and invoices rather than deleting them. The caller MUST warn first —
// see clients-list.tsx.
export const deleteClient = (id: string) => deleteRow("clients", id);
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd business-dashboard && npx tsc --noEmit
```

Expected: no errors. `CLIENT_COLS` (db.ts:454) already maps all seven `ClientWrite` fields, so no column map changes are needed.

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/src/lib/db.ts
git commit -m "feat(db): add updateClient, deleteClient and deleteLead"
```

---

## Task 2: Server actions

**Files:**
- Modify: `src/app/actions.ts`

- [ ] **Step 1: Extend the import block**

Change the import from `@/lib/airtable` to add the four new helpers and the `ClientWrite` type:

```ts
import {
  updateInvoice,
  updateProject,
  updateExpense,
  createInvoice,
  createExpense,
  createProject,
  deleteProject,
  deleteExpense,
  createLead,
  updateLead,
  deleteLead,
  createClient as createClientRow,
  updateClient,
  deleteClient,
  type InvoiceWrite,
  type ProjectWrite,
  type ExpenseWrite,
  type LeadWrite,
  type ClientWrite,
} from "@/lib/airtable";
```

**The alias is mandatory.** `actions.ts` already imports `createClient` from `@/lib/auth` (the Supabase client used by `signOutAction`). Importing the db helper under the same name shadows it and breaks sign-out. Alias the db one to `createClientRow`.

- [ ] **Step 2: Add the lead actions**

Directly below the existing `updateLeadStatusAction`:

```ts
export async function updateLeadAction(id: string, data: LeadWrite) {
  await requireAdmin();
  await updateLead(id, data);
  revalidatePath("/", "layout");
}

export async function deleteLeadAction(id: string) {
  await requireAdmin();
  await deleteLead(id);
  revalidatePath("/", "layout");
}
```

- [ ] **Step 3: Add the client actions**

Add a new section below the leads block:

```ts
// ─── Clients ────────────────────────────────────────────────────────────────

export async function createClientAction(data: ClientWrite) {
  await requireAdmin();
  await createClientRow(data);
  revalidatePath("/", "layout");
}

export async function updateClientAction(id: string, data: ClientWrite) {
  await requireAdmin();
  await updateClient(id, data);
  revalidatePath("/", "layout");
}

// Detaches linked projects and invoices (ON DELETE SET NULL). The UI warns with
// exact counts before calling this.
export async function deleteClientAction(id: string) {
  await requireAdmin();
  await deleteClient(id);
  revalidatePath("/", "layout");
}
```

- [ ] **Step 4: Verify sign-out was not shadowed**

```bash
cd business-dashboard && npx tsc --noEmit && grep -n "createClient" src/app/actions.ts
```

Expected: no type errors, and `signOutAction` still calls the `createClient` imported from `@/lib/auth`, while the db helper appears only as `createClientRow`.

- [ ] **Step 5: Commit**

```bash
git add business-dashboard/src/app/actions.ts
git commit -m "feat(actions): add lead update/delete and client CRUD actions"
```

---

## Task 3: ModalShell

**Files:**
- Create: `src/components/ui/modal-shell.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect } from "react";

type Props = {
  /** Shown in the header and used as the dialog's accessible name. */
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Override for denser forms. Every existing modal used max-w-md. */
  maxWidthClass?: string;
};

/**
 * The one modal wrapper.
 *
 * All five dashboard modals previously inlined an identical shell that had no
 * height cap and no scroll, so any modal taller than the viewport was centred
 * and clipped at both ends with no way to reach its submit button. That is the
 * bug this exists to fix.
 *
 * The cap lives on the CARD, not on this container. Putting `overflow-y-auto`
 * on a `flex items-center` container clips the top of an overflowing child
 * instead of letting it scroll — a well-known flexbox trap. Letting the card
 * scroll inside a non-scrolling centred container avoids it entirely.
 *
 * `100dvh`, never `100vh`. Mobile Safari's `vh` measures the viewport *behind*
 * the URL bar, so a vh-based cap reintroduces the exact clipping being fixed.
 */
export function ModalShell({ title, onClose, children, maxWidthClass = "max-w-md" }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    // Stop the page behind the modal from scrolling under the user's finger.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className={`bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-4 sm:p-6 w-full ${maxWidthClass} shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto`}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-white">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center text-lg leading-none text-zinc-500 transition-colors hover:text-white sm:h-6 sm:w-6"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd business-dashboard && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/src/components/ui/modal-shell.tsx
git commit -m "feat(ui): add ModalShell with mobile-safe sizing"
```

---

## Task 4: Migrate all five modals to ModalShell

**Files:**
- Modify: `src/components/dashboard/leads-table.tsx:124` (`NewLeadModal`)
- Modify: `src/components/dashboard/edit-invoice-modal.tsx:67`
- Modify: `src/components/dashboard/expenses-list.tsx:75`
- Modify: `src/components/dashboard/project-board.tsx:265`
- Modify: `src/components/dashboard/quick-actions.tsx:39`

Each site has the same shape: a `useEffect` Escape handler, an outer `fixed inset-0` div, an inner card div, and a header row with a title and a `✕` button. All four of those are replaced by `ModalShell`; the form body inside is **not touched**.

- [ ] **Step 1: Migrate one modal and confirm the pattern**

In `src/components/dashboard/leads-table.tsx`, add the import:

```tsx
import { ModalShell } from "@/components/ui/modal-shell";
```

Delete the `useEffect` Escape handler (lines ~84-90) and replace the outer wrapper, card, and header with:

```tsx
  return (
    <ModalShell title="New Lead" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ...existing form body, unchanged... */}
      </form>
    </ModalShell>
  );
```

- [ ] **Step 2: Verify the one migration before repeating it**

```bash
cd business-dashboard && npm run dev -- -p 5622
```

In a browser at `http://localhost:5622/admin/leads`, sign in, click **+ New lead**, and confirm: the modal opens, Escape closes it, clicking the backdrop closes it, and the form still submits. Only once this passes, do the other four.

- [ ] **Step 3: Repeat for the remaining four**

Apply the identical transformation to `edit-invoice-modal.tsx`, `expenses-list.tsx`, `project-board.tsx` and `quick-actions.tsx`. Preserve each one's existing title string — do not rename them. `quick-actions.tsx` passes its title through a prop; keep that prop and forward it to `ModalShell`'s `title`.

- [ ] **Step 4: Confirm no orphaned shells remain**

```bash
cd business-dashboard && grep -rn "fixed inset-0 z-50" --include=*.tsx src/
```

Expected: exactly one hit, in `src/components/ui/modal-shell.tsx`.

- [ ] **Step 5: Build and commit**

```bash
cd business-dashboard && npm run build
git add business-dashboard/src
git commit -m "fix(ui): route all five modals through ModalShell

Every modal shared a wrapper with no height cap and no scroll, so any modal
taller than the viewport was clipped at both ends on a phone with its submit
button unreachable."
```

---

## Task 5: Mobile padding and tap targets

**Files:**
- Modify: `src/app/admin/layout.tsx:37`
- Modify: `src/components/dashboard/leads-table.tsx` (card padding, status pill)

- [ ] **Step 1: Loosen the layout padding**

In `src/app/admin/layout.tsx`, change:

```tsx
<div className="p-5 max-w-[1400px] mx-auto space-y-3 dashboard-fade-in">
```

to:

```tsx
<div className="p-3 sm:p-5 max-w-[1400px] mx-auto space-y-3 dashboard-fade-in">
```

- [ ] **Step 2: Loosen the Leads card padding**

In `src/components/dashboard/leads-table.tsx`, on the outer panel div, change `p-6` to `p-4 sm:p-6`.

- [ ] **Step 3: Grow the status pill to a real tap target**

In `StatusSelect`, change the `className` to:

```tsx
      className={`min-h-11 sm:min-h-0 text-xs px-3 py-1 rounded-full border font-medium cursor-pointer disabled:opacity-40 focus:outline-none ${style.badge}`}
```

44px on touch, unchanged on desktop.

- [ ] **Step 4: Verify at phone width**

```bash
cd business-dashboard && npm run dev -- -p 5622
```

In the browser devtools device toolbar at 375×667, load `/admin/leads`. Confirm no horizontal scrollbar on `<body>` and that the status pills are comfortably tappable.

- [ ] **Step 5: Commit**

```bash
git add business-dashboard/src
git commit -m "fix(ui): tighten mobile padding and grow lead status tap target"
```

---

## Task 6: Mobile modal regression test

**Files:**
- Modify: `scripts/auth-flow-test.py`

This is the one check that cannot be eyeballed reliably, and it is a regression test for the bug fixed in Task 4.

- [ ] **Step 1: Append the mobile checks**

At the end of `scripts/auth-flow-test.py`, before the final summary block, add:

```python
    # ── Mobile: a modal must be reachable and submittable at phone size ────────
    # Regression test for the pre-2026-09 shell, which centred an overflowing
    # modal with no scroll, leaving the submit button permanently offscreen.
    mobile = browser.new_context(viewport={"width": 375, "height": 667})
    mpage = mobile.new_page()
    mpage.goto(f"{BASE}/login", wait_until="networkidle")
    mpage.fill('input[name="email"]', EMAIL)
    mpage.fill('input[name="password"]', PASSWORD)
    mpage.click('button[type="submit"]')
    mpage.wait_for_url("**/admin/overview", timeout=15000)

    mpage.goto(f"{BASE}/admin/leads", wait_until="networkidle")
    mpage.click('button:has-text("New lead")')
    mpage.wait_for_selector('[role="dialog"]', timeout=5000)

    submit = mpage.locator('[role="dialog"] button[type="submit"]')
    check("mobile: new-lead modal opens", submit.count() == 1)

    submit.scroll_into_view_if_needed()
    box = submit.bounding_box()
    check(
        "mobile: submit button is reachable inside the viewport",
        box is not None and 0 <= box["y"] <= 667 - box["height"],
        f"y={box['y'] if box else 'none'}",
    )

    # The page behind the modal must not scroll while it is open.
    body_overflow = mpage.evaluate("getComputedStyle(document.body).overflow")
    check("mobile: body scroll locked while modal open", body_overflow == "hidden")

    mpage.keyboard.press("Escape")
    mpage.wait_for_timeout(300)
    check("mobile: Escape closes the modal", mpage.locator('[role="dialog"]').count() == 0)

    mobile.close()
```

- [ ] **Step 2: Run it against a local server**

In one terminal:

```bash
cd business-dashboard && npm run dev -- -p 5622
```

In another:

```bash
cd business-dashboard && python scripts/auth-flow-test.py
```

Expected: the original 15 checks still PASS, plus 4 new PASS lines. If "submit button is reachable" fails, Task 4 is incomplete — fix that, do not weaken the assertion.

- [ ] **Step 3: Commit**

```bash
git add business-dashboard/scripts/auth-flow-test.py
git commit -m "test(ui): assert the new-lead modal is submittable at 375x667"
```

---

## Task 7: Leads CRUD

**Files:**
- Modify: `src/components/dashboard/leads-table.tsx`
- Modify: `src/app/admin/leads/page.tsx`

- [ ] **Step 1: Pass clients into the table**

`src/app/admin/leads/page.tsx` becomes:

```tsx
import { Section } from "@/components/dashboard/section";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { getLeads, getClients } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeadsPage() {
  // clients is needed by the Won→client conversion's duplicate check (Task 10).
  const [leads, clients] = await Promise.all([getLeads(), getClients()]);
  return (
    <Section title="Leads" description="Inbound and tracked sales pipeline.">
      <LeadsTable leads={leads} clients={clients} />
    </Section>
  );
}
```

- [ ] **Step 2: Turn NewLeadModal into a create-or-edit LeadModal**

Rename the component and give it an optional `lead`. Replace its signature and submit handler:

```tsx
function LeadModal({ lead, onClose }: { lead?: Lead; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(false);
    const payload = {
      Name: (fd.get("name") as string) || undefined,
      "Business Name": (fd.get("businessName") as string) || undefined,
      Email: (fd.get("email") as string) || undefined,
      "Phone/WhatsApp": (fd.get("phone") as string) || undefined,
      "Service Interest": (fd.get("serviceInterest") as string) || undefined,
      "Budget Range": (fd.get("budgetRange") as string) || undefined,
      Source: (fd.get("source") as string) || undefined,
      "Current Website": (fd.get("currentWebsite") as string) || undefined,
      "Follow-up Date": (fd.get("followUpDate") as string) || undefined,
      Status: (fd.get("status") as LeadStatus) || "New",
      Message: (fd.get("message") as string) || undefined,
      Notes: (fd.get("notes") as string) || undefined,
      "Proposal Draft": (fd.get("proposalDraft") as string) || undefined,
    };
    start(async () => {
      try {
        if (lead) {
          await updateLeadAction(lead.id, payload);
          toast.success("Lead updated");
        } else {
          await createLeadAction(payload);
          toast.success("Lead created");
        }
        onClose();
      } catch {
        setError(true);
        toast.error(lead ? "Failed to update lead" : "Failed to create lead");
      }
    });
  }
```

Add `defaultValue` to every existing input so edit mode prefills, e.g.:

```tsx
<input name="name" defaultValue={lead?.Name ?? ""} className={inputCls} required />
<input name="businessName" defaultValue={lead?.["Business Name"] ?? ""} className={inputCls} />
<input name="email" type="email" defaultValue={lead?.Email ?? ""} className={inputCls} />
<input name="phone" defaultValue={lead?.["Phone/WhatsApp"] ?? ""} className={inputCls} />
<input name="serviceInterest" defaultValue={lead?.["Service Interest"] ?? ""} placeholder="Web Dev, Automation…" className={inputCls} />
<input name="budgetRange" defaultValue={lead?.["Budget Range"] ?? ""} placeholder="e.g. $1k–$3k" className={inputCls} />
<input name="source" defaultValue={lead?.Source ?? ""} placeholder="Referral, Instagram…" className={inputCls} />
<select name="status" defaultValue={lead?.Status ?? "New"} className={selectCls}>
```

Add the four fields that had no input at all, in the same two-column pattern:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Current Website</label>
              <input name="currentWebsite" defaultValue={lead?.["Current Website"] ?? ""} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Follow-up Date</label>
              <input name="followUpDate" type="date" defaultValue={lead?.["Follow-up Date"] ?? ""} className={inputCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Notes</label>
            <textarea name="notes" rows={2} defaultValue={lead?.Notes ?? ""} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Proposal Draft</label>
            <textarea name="proposalDraft" rows={4} defaultValue={lead?.["Proposal Draft"] ?? ""} className={inputCls} />
          </div>
```

And the message textarea gains `defaultValue={lead?.Message ?? ""}`.

Wrap in `<ModalShell title={lead ? "Edit lead" : "New Lead"} onClose={onClose}>` and change the submit label to `{pending ? "Saving…" : lead ? "Save changes" : "Create lead"}`.

- [ ] **Step 3: Add Edit and Delete to the expanded row**

Add state and a delete handler to `LeadsTable`:

```tsx
  const [editing, setEditing] = useState<Lead | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);
```

At the end of the expanded row's `<td colSpan={4}>`, after the Proposal Draft block:

```tsx
                                  <div className="mt-3 flex gap-2 pt-3 border-t border-[#2a2e34]">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditing(lead);
                                      }}
                                      className="text-xs px-3 py-2 rounded-lg border border-[#2a2e34] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDelete(lead);
                                      }}
                                      className="text-xs px-3 py-2 rounded-lg border border-[#ff4d8b]/30 text-[#ff4d8b] hover:bg-[#ff4d8b]/10 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
```

`stopPropagation` on both is required — the parent `<tr>` has an `onClick` that would otherwise collapse the row out from under the click.

- [ ] **Step 4: Render the edit and confirm modals**

Replace the trailing `{newOpen && <NewLeadModal … />}` with:

```tsx
      {newOpen && <LeadModal onClose={() => setNewOpen(false)} />}
      {editing && <LeadModal lead={editing} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <ModalShell title="Delete lead" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-zinc-300">
            Delete <span className="font-medium text-white">{confirmDelete.Name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-5">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                startTransition(async () => {
                  try {
                    await deleteLeadAction(target.id);
                    toast.success("Lead deleted");
                  } catch {
                    toast.error("Failed to delete lead");
                  }
                });
              }}
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#ff4d8b] text-black transition-colors hover:bg-[#ff4d8b]/80"
            >
              Delete
            </button>
          </div>
        </ModalShell>
      )}
```

Update the imports at the top of the file:

```tsx
import { createLeadAction, updateLeadAction, updateLeadStatusAction, deleteLeadAction } from "@/app/actions";
import { ModalShell } from "@/components/ui/modal-shell";
```

And the `Props` type: `type Props = { leads: Lead[]; clients: Client[] };` with `Client` added to the type import from `@/lib/airtable`.

- [ ] **Step 5: Verify by driving the flow**

With `npm run dev -- -p 5622` running, at `/admin/leads`: create a lead, expand it, edit it (confirm every field prefills), save, confirm the change persists after a refresh, then delete it and confirm it disappears.

- [ ] **Step 6: Build and commit**

```bash
cd business-dashboard && npm run build
git add business-dashboard/src
git commit -m "feat(leads): make every lead field editable, and add delete"
```

---

## Task 8: Clients list

**Files:**
- Create: `src/components/dashboard/clients-list.tsx`
- Modify: `src/app/admin/clients/clients-view.tsx`

- [ ] **Step 1: Create the list component**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import { createClientAction, updateClientAction, deleteClientAction } from "@/app/actions";
import type { Client, Invoice, Project } from "@/lib/db";

const STATUSES = ["Active", "Inactive", "Lead"] as const;
type ClientStatus = (typeof STATUSES)[number];

const STATUS_BADGE: Record<ClientStatus, string> = {
  Active: "bg-[#bfff3a]/10 text-[#bfff3a] border-[#bfff3a]/20",
  Inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  Lead: "bg-[#3affd1]/10 text-[#3affd1] border-[#3affd1]/20",
};

const inputCls =
  "w-full bg-[#0b0d10] border border-[#2a2e34] rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
const selectCls = inputCls + " cursor-pointer";

type Props = { clients: Client[]; invoices: Invoice[]; projects: Project[] };

export function ClientsList({ clients, invoices, projects }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [, startTransition] = useTransition();

  // Resolve a client the same way TopClients does. invoices.client_id is
  // normally NULL and the real link runs through the project (schema.sql:95),
  // so counting on invoice.Client alone under-reports and would make the
  // delete warning understate the damage.
  const linkCounts = useMemo(() => {
    const projectToClient = new Map<string, string | undefined>();
    for (const p of projects) projectToClient.set(p.id, p.Client?.[0]);

    return (clientId: string) => {
      const projectCount = projects.filter((p) => p.Client?.[0] === clientId).length;
      const invoiceCount = invoices.filter((inv) => {
        const viaProject = inv.Project?.[0] ? projectToClient.get(inv.Project[0]) : undefined;
        return (inv.Client?.[0] ?? viaProject) === clientId;
      }).length;
      return { projectCount, invoiceCount };
    };
  }, [invoices, projects]);

  const sorted = useMemo(
    () => [...clients].sort((a, b) => (a.Company || a.Name).localeCompare(b.Company || b.Name)),
    [clients],
  );

  return (
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">All clients</p>
        <button
          onClick={() => setCreating(true)}
          className="text-xs px-3 py-2 rounded-lg font-semibold bg-[#bfff3a] text-black hover:bg-[#bfff3a]/80 transition-colors"
        >
          + New client
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 text-sm">
          No clients yet. Add one, or convert a won lead.
        </p>
      ) : (
        <ul className="divide-y divide-[#2a2e34]">
          {sorted.map((client) => {
            const status = (STATUSES as readonly string[]).includes(client.Status ?? "")
              ? (client.Status as ClientStatus)
              : "Active";
            const { projectCount, invoiceCount } = linkCounts(client.id);
            return (
              <li key={client.id} className="py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setEditing(client)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="font-medium text-white leading-tight truncate">
                      {client.Company || client.Name}
                    </p>
                    {client.Company && client.Name !== client.Company && (
                      <p className="text-xs text-zinc-500 truncate">{client.Name}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_BADGE[status]}`}>
                      {status}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/finance?client=${encodeURIComponent(client.id)}`);
                      }}
                      className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-lg border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                    >
                      {invoiceCount} inv
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/projects?client=${encodeURIComponent(client.id)}`);
                      }}
                      className="min-h-11 sm:min-h-0 text-xs px-3 py-1.5 rounded-lg border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                    >
                      {projectCount} proj
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <ClientModal
          client={editing ?? undefined}
          onDelete={editing ? () => { const t = editing; setEditing(null); setConfirmDelete(t); } : undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <DeleteClientModal
          client={confirmDelete}
          counts={linkCounts(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            const target = confirmDelete;
            setConfirmDelete(null);
            startTransition(async () => {
              try {
                await deleteClientAction(target.id);
                toast.success("Client deleted");
              } catch {
                toast.error("Failed to delete client");
              }
            });
          }}
        />
      )}
    </div>
  );
}

function ClientModal({
  client,
  onClose,
  onDelete,
}: {
  client?: Client;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(false);
    const payload = {
      Name: (fd.get("name") as string) || undefined,
      Company: (fd.get("company") as string) || undefined,
      Email: (fd.get("email") as string) || undefined,
      Phone: (fd.get("phone") as string) || undefined,
      Status: (fd.get("status") as ClientStatus) || "Active",
      Owner: (fd.get("owner") as string) || undefined,
      Notes: (fd.get("notes") as string) || undefined,
    };
    start(async () => {
      try {
        if (client) {
          await updateClientAction(client.id, payload);
          toast.success("Client updated");
        } else {
          await createClientAction(payload);
          toast.success("Client created");
        }
        onClose();
      } catch {
        setError(true);
        toast.error(client ? "Failed to update client" : "Failed to create client");
      }
    });
  }

  return (
    <ModalShell title={client ? "Edit client" : "New client"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Name</label>
            <input name="name" defaultValue={client?.Name ?? ""} className={inputCls} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Company</label>
            <input name="company" defaultValue={client?.Company ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Email</label>
            <input name="email" type="email" defaultValue={client?.Email ?? ""} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Phone</label>
            <input name="phone" defaultValue={client?.Phone ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Status</label>
            <select name="status" defaultValue={client?.Status ?? "Active"} className={selectCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Owner</label>
            <input name="owner" defaultValue={client?.Owner ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400">Notes</label>
          <textarea name="notes" rows={3} defaultValue={client?.Notes ?? ""} className={inputCls} />
        </div>
        {error && <p className="text-xs text-[#ff4d8b]">Failed to save. Try again.</p>}
        <div className="flex gap-2 justify-between items-center mt-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs px-3 py-2 rounded-xl border border-[#ff4d8b]/30 text-[#ff4d8b] hover:bg-[#ff4d8b]/10 transition-colors"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
            >
              {pending ? "Saving…" : client ? "Save changes" : "Create client"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteClientModal({
  client,
  counts,
  onClose,
  onConfirm,
}: {
  client: Client;
  counts: { projectCount: number; invoiceCount: number };
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { projectCount, invoiceCount } = counts;
  const hasLinks = projectCount > 0 || invoiceCount > 0;

  return (
    <ModalShell title="Delete client" onClose={onClose}>
      <p className="text-sm text-zinc-300">
        Delete <span className="font-medium text-white">{client.Company || client.Name}</span>?
      </p>
      {hasLinks && (
        <div className="mt-3 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 p-3">
          <p className="text-xs text-[#fbbf24] leading-relaxed">
            This will detach {projectCount} {projectCount === 1 ? "project" : "projects"} and{" "}
            {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}. They are not deleted, but
            they will no longer belong to any client, will disappear from the client filter, and
            will stop counting toward Top Clients revenue. This cannot be undone.
          </p>
        </div>
      )}
      <div className="flex gap-2 justify-end mt-5">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#ff4d8b] text-black transition-colors hover:bg-[#ff4d8b]/80"
        >
          Delete client
        </button>
      </div>
    </ModalShell>
  );
}
```

- [ ] **Step 2: Render it under the leaderboard and repair the dead link**

`src/app/admin/clients/clients-view.tsx` becomes:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { TopClients } from "@/components/dashboard/top-clients";
import { ClientsList } from "@/components/dashboard/clients-list";
import type { Client, Invoice, Project } from "@/lib/db";

type Props = { clients: Client[]; invoices: Invoice[]; projects: Project[] };

export function ClientsView({ clients, invoices, projects }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <TopClients
        clients={clients}
        invoices={invoices}
        projects={projects}
        selectedClientId={null}
        onSelectClient={(clientId) => {
          // Was "/finance?client=" — a dead route since the move under /admin.
          if (clientId) router.push(`/admin/finance?client=${encodeURIComponent(clientId)}`);
        }}
      />
      <ClientsList clients={clients} invoices={invoices} projects={projects} />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

At `/admin/clients`: the leaderboard renders exactly as before, the list appears below it. Create a client, confirm it appears; edit it, confirm it persists; open delete and confirm the warning names the right counts. Expect the list to start empty — that is the documented migration state, not a failure.

- [ ] **Step 4: Build and commit**

```bash
cd business-dashboard && npm run build
git add business-dashboard/src
git commit -m "feat(clients): add a client list with CRUD below the leaderboard"
```

---

## Task 9: Cross-tab links

**Files:**
- Modify: `src/app/admin/overview/overview-view.tsx:31`
- Modify: `src/app/admin/projects/page.tsx`
- Modify: `src/components/dashboard/project-board.tsx`

- [ ] **Step 1: Repair the Overview dead link**

In `src/app/admin/overview/overview-view.tsx`, change:

```tsx
          onJumpToOverdue={() => router.push("/finance?status=Overdue")}
```

to:

```tsx
          onJumpToOverdue={() => router.push("/admin/finance?status=Overdue")}
```

- [ ] **Step 2: Teach the projects page to read `?client=`**

`src/app/admin/projects/page.tsx` becomes:

```tsx
import { ProjectBoard } from "@/components/dashboard/project-board";
import { getProjects, getClients } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const [projects, clients] = await Promise.all([getProjects(), getClients()]);
  return <ProjectBoard projects={projects} clients={clients} initialClientId={client ?? null} />;
}
```

This mirrors `finance/page.tsx` exactly, including awaiting `searchParams` — it is a Promise in this Next version.

- [ ] **Step 3: Add the client filter to the board**

In `src/components/dashboard/project-board.tsx`, extend the props (line ~71):

```tsx
type Props = { projects: Project[]; clients?: Client[]; initialClientId?: string | null };
```

and the component signature (line ~625):

```tsx
export function ProjectBoard({ projects, clients = [], initialClientId = null }: Props) {
```

Add state beside the existing `ownerFilter`:

```tsx
  const [clientFilter, setClientFilter] = useState<string | null>(initialClientId);
```

Extend the existing filter chain (line ~654):

```tsx
    .filter((p) => p.Status !== "Cancelled")
    .filter((p) => (ownerFilter === "All" ? true : p.Owner === ownerFilter))
    .filter((p) => (clientFilter === null ? true : p.Client?.[0] === clientFilter));
```

And render a clearable indicator next to the owner filter chips:

```tsx
          {clientFilter && (
            <button
              onClick={() => setClientFilter(null)}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-[#bfff3a]/10 text-[#bfff3a] border border-[#bfff3a]/30 hover:bg-[#bfff3a]/20 transition-colors"
            >
              {clients.find((c) => c.id === clientFilter)?.Company ??
                clients.find((c) => c.id === clientFilter)?.Name ??
                "Client"}{" "}
              ✕
            </button>
          )}
```

- [ ] **Step 4: Verify every link end to end**

With the dev server running, confirm all five:

| From | Action | Lands on |
|---|---|---|
| `/admin/overview` | click the overdue counter | `/admin/finance?status=Overdue`, filter applied |
| `/admin/clients` | click a leaderboard row | `/admin/finance?client=…`, filter applied |
| `/admin/clients` | click a row's "N inv" | `/admin/finance?client=…`, filter applied |
| `/admin/clients` | click a row's "N proj" | `/admin/projects?client=…`, board filtered, chip clearable |
| any | no 404s | — |

- [ ] **Step 5: Build and commit**

```bash
cd business-dashboard && npm run build
git add business-dashboard/src
git commit -m "fix(nav): repair two dead /finance links and add client cross-tab filters"
```

---

## Task 10: Lead → client conversion

**Files:**
- Modify: `src/components/dashboard/leads-table.tsx`

- [ ] **Step 1: Add the duplicate check**

Near the top of `leads-table.tsx`, below `statusOf`:

```tsx
/**
 * Find a client that already represents this lead. Email is the strong signal;
 * name is the fallback when the lead has no email. Prevents a second Won flip
 * from silently creating a duplicate client.
 */
function findExistingClient(lead: Lead, clients: Client[]): Client | undefined {
  const email = lead.Email?.trim().toLowerCase();
  if (email) {
    const byEmail = clients.find((c) => c.Email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const name = (lead["Business Name"] || lead.Name)?.trim().toLowerCase();
  if (!name) return undefined;
  return clients.find(
    (c) =>
      c.Company?.trim().toLowerCase() === name || c.Name.trim().toLowerCase() === name,
  );
}
```

- [ ] **Step 2: Offer the conversion when a lead moves to Won**

Add state:

```tsx
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
```

In `handleStatusChange`, after the successful status update:

```tsx
  function handleStatusChange(lead: Lead, next: LeadStatus) {
    startTransition(async () => {
      applyStatus({ id: lead.id, status: next });
      try {
        await updateLeadStatusAction(lead.id, next);
        toast.success(`Moved to ${next}`);
        // Won is the only status that offers conversion, and it only ever
        // offers — never converts automatically. A second Won flip would
        // otherwise create a duplicate client with no warning.
        if (next === "Won") setConvertLead(lead);
      } catch {
        toast.error("Failed to update status");
      }
    });
  }
```

- [ ] **Step 3: Render the conversion modal**

Alongside the other modals at the end of `LeadsTable`:

```tsx
      {convertLead && (
        <ConvertLeadModal
          lead={convertLead}
          existing={findExistingClient(convertLead, clients)}
          onClose={() => setConvertLead(null)}
        />
      )}
```

And the component itself, at the bottom of the file:

```tsx
function ConvertLeadModal({
  lead,
  existing,
  onClose,
}: {
  lead: Lead;
  existing?: Client;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  if (existing) {
    return (
      <ModalShell title="Client already exists" onClose={onClose}>
        <p className="text-sm text-zinc-300 leading-relaxed">
          <span className="font-medium text-white">{existing.Company || existing.Name}</span> already
          matches this lead, so no new client was created.
        </p>
        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl border border-[#2a2e34] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
          >
            Close
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Create client from this lead?" onClose={onClose}>
      <p className="text-sm text-zinc-300 leading-relaxed">
        Create a client record for{" "}
        <span className="font-medium text-white">{lead["Business Name"] || lead.Name}</span>? Name,
        business, email and phone are copied across. The lead itself is left as it is.
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
                await createClientAction({
                  Name: lead.Name,
                  Company: lead["Business Name"] || undefined,
                  Email: lead.Email || undefined,
                  Phone: lead["Phone/WhatsApp"] || undefined,
                  Status: "Active",
                });
                toast.success("Client created");
                onClose();
              } catch {
                toast.error("Failed to create client");
              }
            })
          }
          className="text-xs px-4 py-2 rounded-xl font-semibold bg-[#bfff3a] text-black disabled:opacity-40 transition-colors hover:bg-[#bfff3a]/80"
        >
          {pending ? "Creating…" : "Create client"}
        </button>
      </div>
    </ModalShell>
  );
}
```

Add `createClientAction` to the `@/app/actions` import.

- [ ] **Step 4: Verify both paths**

Move a lead to Won → the prompt appears → create the client → check `/admin/clients` lists it. Then move another lead with the same email to Won → the "already exists" variant must appear and must **not** create a second client.

- [ ] **Step 5: Build and commit**

```bash
cd business-dashboard && npm run build
git add business-dashboard/src
git commit -m "feat(leads): offer client conversion when a lead is won"
```

---

## Task 11: Full verification

**Files:** none

- [ ] **Step 1: Build and lint**

```bash
cd business-dashboard && npm run build && npm run lint
```

Expected: compiled successfully, no lint errors.

- [ ] **Step 2: Full browser suite**

With `npm run dev -- -p 5622` running:

```bash
cd business-dashboard && python scripts/auth-flow-test.py
```

Expected: 19/19 PASS (15 original + 4 mobile).

- [ ] **Step 3: Manual mobile sweep**

At 375×667 in the device toolbar, visit all five tabs. Confirm no horizontal body scroll anywhere, and open one modal on each of Finance, Projects and Overview to confirm the shared fix carried.

- [ ] **Step 4: Quality loop**

Run `/qc-loop`. Address anything it raises.

- [ ] **Step 5: Report, do not merge or deploy**

Summarise for Taylor: what shipped, what the browser suite reported, and anything found in Finance/Overview/Projects that was **reported rather than fixed** per the spec's scope limit. Merging, pushing and deploying are Taylor's decisions.

---

## Self-review notes

**Spec coverage:** §1 ModalShell → Tasks 3-4. §2 mobile pass → Task 5, verified in Task 6. §3 Leads CRUD → Tasks 1, 2, 7. §4 Clients list + CRUD + delete warning → Tasks 1, 2, 8. §5 cross-tab links → Tasks 8 (client→invoices), 9 (repairs, client→projects), 10 (lead→client). Testing section → Tasks 6 and 11.

**Naming consistency:** `LeadModal` (Task 7) is used by that name in Tasks 7 and 10. `ClientModal` and `DeleteClientModal` are local to `clients-list.tsx`. `createClientRow` is the aliased db helper in `actions.ts` only; components always call `createClientAction`. `linkCounts` returns `{ projectCount, invoiceCount }` and is consumed with those exact names in `DeleteClientModal`.

**Known trap flagged in-plan:** the `createClient` import collision in `actions.ts` (Task 2, Step 1) would silently break sign-out.
