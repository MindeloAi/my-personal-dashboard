# Mindelo Dashboard redesign

Date: 2026-10-28. Status: approved in conversation, awaiting written-spec review.

## Why

The admin dashboard has grown one feature at a time. Finance is a single long page, data has duplicates and missing links, and nothing explains itself. The dashboard is read by the two founders, by AI agents that analyse it, and soon by accountants. Every screen must say what it is for, and every record must connect to the records around it.

## Scope and order

Six pieces, each shipped as its own PR in this order. Piece 7 is recorded here but designed later.

| # | Piece | Depends on |
|---|---|---|
| 1 | Data cleanup and invoice numbering | – |
| 2 | Navigation: grouped sidebar, one URL per section | – |
| 3 | Purpose text on every page, section, tile and chart | 2 |
| 4 | Finance → Summary with KPIs and 11 charts | 1, 2, 3 |
| 5 | Summaries and charts on Overview, Leads, Clients, Projects | 1, 2, 3 |
| 6 | Lead → client → project → invoice → payment linked everywhere | 1 |
| 7 | Phone notifications and Google Calendar (later, separate design) | – |

## 1. Data cleanup and invoice numbering

One migration (`019`) with an up and a down file. It holds both the schema changes and the one-time data fixes, so the whole thing is rehearsed against a local copy, dry-run against production (rolled back), and reviewed as a before/after list before Taylor applies it.

### Schema

- `projects.lead_id uuid references leads(id) on delete set null`. A project belongs to a client, or to a lead before there is a client, or to neither (internal).
- `projects.internal boolean not null default false`. True for Mindelo's own projects (CariPromos, Cruz).
- Invoice numbers are unique ignoring case: unique index on `lower(invoice_number)`. Null is allowed (drafts).
- Invoice numbers are assigned by the database. A `before insert or update` trigger on `invoices` gives the next `INV-####` when an invoice is created as, or moves to, `Sent`, `Overdue` or `Paid` and has no number yet. The next number is one more than the highest existing `INV-####`. The trigger takes an advisory lock so two invoices created together never get the same number.
- Once an invoice has a number it never changes, including when it is voided later.

### One-time data fixes

| Area | Change |
|---|---|
| Jade | Delete the empty client "Jade / Jades Interior". Link the Won lead "Jade / Jades Interior" to client **Interior Jade**. |
| house hunters | Keep client and lead. Link the lead (josette Q, Proposal Sent) to the client. |
| Collabr, Fresh Start Natural Juices, PBS | Create a lead for each with the client's name, company, email and phone, status **Contacted**, source "Moved from client record". Move each one's project to the lead (`lead_id` set, `client_id` cleared). Delete the client record. |
| ZKN caffe | Lead only. Move project "Zkn" to the existing ZKN lead (`lead_id` set, `client_id` cleared). Inv-0021 (Void) keeps its project, loses its client. Delete the client record. |
| Five Islands | Project "Five Islands Website" links to lead Camile Campbell / Five Islands. No client. |
| Aeromarine | New lead: Robert Llanos, Aeromarine, status **Lost**. Project "Aeromarine Ltd. Website" (Cancelled) links to it. |
| CariPromos, Cruz | `internal = true`. No client or lead. |
| GLISCORE | Link the Won lead (Lyndon, GLISCORE Industrial sourcing) to client GLISCORE. Set INV-0018's client to GLISCORE (from its project). |
| Invoices with no project | Create projects **Taylor Engineering Website** and **Decle Realty Website** (status Done, their clients). Link Taylor Engineering's 002 and 0091 and Decle Realty's 003. Link COLE Safety's INV-002 to project Cole Safety. |
| Typos | "Cole Saftey" → "Cole Safety". "Five islands Webstite" → "Five Islands Website". |

### Renumbering

- Invoices that went to a client (status `Sent`, `Overdue` or `Paid`) are renumbered `INV-0001` upward, oldest issue date first; invoices with no issue date go last; ties broken by `sort_key`. On 27 Oct 2026 that is 20 invoices, `INV-0001` to `INV-0020`.
- Voided invoices are renumbered `VOID-0001` upward in the same order (3 today).
- Drafts stay unnumbered until sent.
- Every renumbered invoice keeps its old number in its notes, first line: `Previously issued as <old>.` (or `Previously unnumbered.`).
- The next invoice created is `INV-0021`.

### Lead conversion

When a lead is marked Won and converted to a client (existing flow from `768b0b9`), every project with that `lead_id` moves to the new client in the same transaction (`client_id` set, `lead_id` kept as history).

### UI changes in this piece

- Invoice forms: the number field is read-only. It shows the number, or "Assigned when sent" for a draft.
- Project forms: a Client or Lead selector, plus an Internal checkbox.

### Checks

`scripts/cleanup.test.ts` against the throwaway local Postgres: renumbering order and count, VOID numbering, old numbers kept in notes, uniqueness ignoring case, concurrent creation gets distinct numbers, a Draft gets a number on moving to Sent, a voided invoice keeps its number, lead conversion moves projects. Existing `ledger.test.ts` and `export.test.ts` keep passing.

## 2. Navigation

Sidebar groups that open and close. Each item is its own URL, so links, browser back and AI agents all address one section at a time.

```
Overview                  /admin/overview
Finance ▾
  Summary                 /admin/finance            (new, piece 4)
  Money received          /admin/finance/received
  Invoices                /admin/finance/invoices
  Founder pay             /admin/finance/founder-pay
  Cash & safe             /admin/finance/cash
  Expenses                /admin/finance/expenses
  Recurring               /admin/finance/recurring
  Export                  /admin/finance/export
Sales ▾
  Leads                   /admin/leads
  Clients                 /admin/clients
Projects ▾
  All projects            /admin/projects
  Internal                /admin/projects/internal
```

- The group holding the current page is open on load. Open/closed state is remembered per device (localStorage, wrapped in try/catch).
- The mobile drawer uses the same structure.
- Existing URL parameters keep working on their new pages (`?status=Overdue` on Invoices, `?client=<id>`).
- `/admin/finance?status=...` style links from older bookmarks redirect to the Invoices subpage with the same parameters.
- Each page fetches only the tables it needs (current rule).

## 3. Purpose text

A shared `<Section>` wrapper and `<Explain>` block render the text, so the format is identical everywhere.

- **Page header:** title plus one sentence on what the page is for.
- **Every section, table and chart:** `What it shows`, `How to read it`, and `What to watch for` where it adds something.
- **Every number tile:** what it counts and where the figure comes from (for example "Outstanding: total still owed on Sent and Overdue invoices").
- Plain visible text, not tooltips, in the page's HTML, so a person and an AI read the same words.
- Tone: short, specific, no jargon an accountant would not use.

## 4. Finance → Summary

Headline tiles: Collected this month · Outstanding · Overdue · Business cash · Net profit this month · Monthly recurring revenue.

Charts (Recharts, already installed), each wrapped in the piece-3 format:

1. Cash collected per month (bars).
2. Invoiced vs collected per month (paired bars).
3. Unpaid invoices by age: not yet due, 1–30, 31–60, 60+ days late (stacked bar).
4. Revenue by client, top 10 (horizontal bars).
5. Revenue by service type: Web Dev, AI Automation, Hybrid.
6. Expenses by category per month (stacked bars).
7. Profit per month: income minus expenses (line).
8. Where each payment goes: business share, Michael, Zane, per month (stacked bars).
9. Cash held over time: Business cash, Mikey, Zane (lines).
10. Recurring revenue trend (line).
11. Days to get paid: average days from issue to payment, per month (line).

Rules:
- All aggregation happens in SQL (views or queries in `db.ts`); components only draw. Same rule as the ledger.
- Money before the ledger cutover (22 Oct 2026) counts from invoice paid dates, as the accounts export already does. Charts that rely on ledger-only data (8, 9) start at the cutover and say so in their text.
- Colours and chart forms follow the `dataviz` skill; light and dark both readable.
- The other Finance subpages keep their working views and get a small summary strip at the top.

## 5. Other pages

| Page | Tiles | Charts |
|---|---|---|
| Overview | Collected this month, Outstanding, Business cash, Active projects, Open leads, Follow-ups due | Cash collected trend · Lead pipeline by stage · "Needs action" list (overdue invoices, unsorted collections, follow-ups due) |
| Leads | Open leads, Won this month, Win rate, Follow-ups due | Leads by stage · Leads by source · Win rate over time |
| Clients | Active clients, Total earned, Average per client, Owed to us | Revenue per client · Active vs inactive · New clients per month |
| Projects | In progress, In review, Value of active work | By stage · By service type · Value of work by stage |

## 6. Linked records

- **Lead page/row:** linked client (once Won), projects, invoices.
- **Client page:** the lead it came from, projects, invoices, payments, total paid. Builds on the existing client timeline (`/admin/clients/[id]`).
- **Project:** its client or lead, invoices, payments.
- **Invoices and Money received entries:** link to client or lead, and to the project.
- Every name is a link to that record. A deal can be followed from first contact to cash in the safe.

## 7. Later: notifications and Google Calendar

Recorded only. Push notifications to the installed web app (overdue invoices, money to hand over, lead follow-ups) and Google Calendar events for dashboard deadlines, with today's calendar shown on Overview. Designed separately after pieces 1–6.

## Delivery

- One PR per piece, in the order above. A piece with a migration ships as: Taylor applies the migration, then merges (a merge deploys).
- Every PR runs `tsc`, `eslint`, the database test scripts, and a rendered check of changed pages at desktop and phone widths.
- Nothing in this redesign changes how money is calculated. Ledger rules in the repo-root `CLAUDE.md` still hold.
