# Document employee

Status: approved by Michael, 3 November 2026. Branch `feat/document-employee`.

**Note:** This repository is public. This document names no client and holds no client data, prices
or bank details. Examples use a made-up client, "Island Bites". The house-style guideline and clause
library hold real terms and live outside this repository (see "Where the playbook lives").

## Intent

Mindelo's paperwork (proposals, quotes, service agreements, care plans, change requests, invoices,
SOPs) is produced by hand, one PDF at a time, and stored in a downloads folder. What was offered to a
client lives in those PDFs and in memory. The dashboard records invoices and payments but not what
was promised, and it cannot store a file.

The goal is a **document employee**: Claude, briefed like a good member of staff, that a founder
talks to in plain words, from the terminal or from the Claude app on a phone. It:

- turns "new client, this is what I told them" into a proposal, asking only what it cannot find;
- remembers every deal, so later documents (agreement, invoices, change requests) follow from it;
- lets the founder discuss and change any part of a draft, explains its choices, and offers options;
- never sends anything to a client, and never alters a finalised document;
- saves everything to the dashboard, where both founders can see it.

The dashboard is upgraded alongside it so that every record is properly linked, dated and
attachable.

"We" means Michael and Zane. Both have admin logins.

## Goals

The work succeeds when:

- A founder can describe a new deal in a few sentences and get a branded draft proposal after
  answering at most one round of questions.
- Any section of a draft can be changed by asking, from the terminal or the Claude app, and the
  change appears in the dashboard straight away.
- "What did we promise <client>?" is answered from the dashboard, not from memory.
- Finalising produces a PDF in the new logo, frozen as a numbered version that nobody can edit.
- Opening a client shows their projects, deals, documents, invoices, payments, files, timeline and
  money charts on one page.
- Every client, project, invoice, document and lead name anywhere in `/admin` links to its record.
- Files can be attached to a client, project, invoice or document.

## Non-goals

- Sending email or WhatsApp to clients automatically. The employee drafts; a founder sends, or says
  "send it" and it sends from Gmail in that conversation.
- E-signature. A signed copy is attached as a file, which marks the document Signed.
- A chat box inside the dashboard. Conversations happen in Claude Code and the Claude app.
- Writing legal advice. The clause library is drawn from agreements Mindelo has already used; an
  attorney-drafted master agreement can replace it later.
- Replacing the invoices table. Invoices stay where they are.

## Architecture

```
  Claude Code (/doc skill)            Claude app (Project instructions)
  + Obsidian + GitHub (local)         + GitHub connector
            └───────────────┬───────────────┘
                            ▼
           Mindelo connector  mindelo.site/api/mcp  (OAuth, admin only)
                            ▼
           Supabase Postgres + Storage  ──►  /admin pages, PDF print routes
```

Three new parts:

1. **Data**: deals, documents, document versions, attachments, an audit log (migrations).
2. **Connector**: a remote MCP server inside the existing Next.js app, exposing a fixed list of tools.
   Every tool runs the same admin check as the dashboard's server actions and reuses `lib/db.ts`.
3. **Employee**: the `/doc` Claude Code skill, plus the same playbook loaded as instructions in a
   Claude Project for the phone app.

Claude never connects to the database directly. There is no dev database, so the connector's tool
list is the safety boundary.

## Data model

All new tables follow existing conventions in `scripts/schema.sql`. Each mutable table carries
`created_by`, `updated_by` (admin email) and `updated_via` (`dashboard` | `claude`).

**deals**: one per project (unique `project_id`).
- `reference`: engagement code `CLIENT-YYYY-NN` (e.g. `IB-2026-01`), unique, shared by every
  document of that engagement.
- `scope`: plain-language list of what was offered.
- `price_total`, `currency` (default TTD).
- `payment_schedule`: ordered list of `{label, amount, trigger}` (e.g. "on acceptance",
  "on handover"). Amounts must sum to `price_total`; checked in pure code and by a constraint trigger.
- `care_plan`: `{monthly_amount, minimum_months, notice_days, inclusions[], exclusions[]}` or null.
- `deadline`, `goals`, `notes` (what was discussed, objections, concessions).
- `payee_default`: `michael` | `zane` | `company` | null. Never assumed; set only when a founder says so.

**documents**
- `type`: `proposal` | `quote` | `service_agreement` | `care_plan` | `change_request` | `invoice` |
  `sop` (extendable by adding a template, see below).
- `client_id`, `project_id`, `deal_id` (all nullable; an SOP has none).
- `invoice_id`: set only for `type = invoice`, pointing at the existing invoices row.
- `title`, `status`: `draft` → `finalised` → `sent` → `accepted` | `signed` | `declined`, or `void`.
- `draft`: JSON list of sections `{key, heading, body}`. Sections are addressable so "change
  clause 6" is precise.
- `current_version`: integer, 0 while never finalised.

**document_versions**: immutable.
- `document_id`, `version`, `sections` (frozen copy), `pdf_path` (Storage), `finalised_by`,
  `finalised_at`. No UPDATE or DELETE grants; a trigger rejects both.

**attachments**
- `entity_type` (`client` | `project` | `invoice` | `document`), `entity_id`, `storage_path`,
  `filename`, `content_type`, `size`, `kind` (`signed_copy` | `proof_of_payment` | `asset` | `other`),
  `uploaded_by`. A private Supabase Storage bucket, read through short-lived signed URLs.
- Attaching a `signed_copy` to a finalised agreement or care plan sets its status to `signed`.

**activity**: append-only log of every create, update, finalise, status change and upload, with who,
how and when. Feeds the client timeline.

### Rules

- A finalised version is never edited. Changing a sent document starts a new draft from the latest
  version; finalising it creates the next version number. `signed` and `void` are final states.
- Invoices keep their existing auto-numbering (INV-0001…, drafts unnumbered) and stay the only source
  for Finance, Money Received and founder pay. An invoice document only renders an existing invoice.
- Bank details on an invoice come from the payee chosen for that invoice (`michael`, `zane`,
  `company`). The account details themselves are stored in a settings table, admin-only, never in the
  repo.
- Contracts name **MINDELOAI LIMITED**, trading as Mindelo. Headers and logo say Mindelo.

## Templates and PDFs

Each document type has a template in code: a section list with defaults, plus a print layout.
Templates read from the deal, client, project and invoice, never from free text the template
invents. Missing facts (an address, a signatory's title) render as a visible "missing" marker in a
draft and block finalising.

PDFs are rendered by the dashboard, not by Claude: a print route per document type
(`/admin/documents/[id]/print?version=N`) laid out for A4, using the new Mindelo logo (green dot +
wordmark, with a dark-ink variant for white paper) and the dashboard's Corporate Navy palette and
IBM Plex Sans. Finalising renders the route to PDF on the server and stores it in Storage, so any
version can be reprinted identically.

The first templates are built from Mindelo's existing documents: the two signed service agreements
(clause structure), the itemised invoice layout, and the one-page proposal and quote.

## The connector

A remote MCP endpoint at `/api/mcp` in the same app, built with Vercel's `mcp-handler` and its
OAuth helper. Sign-in uses the existing Supabase Auth login page; the issued token maps to the
founder's admin account, and every tool calls `requireAdmin()` before doing anything. `src/proxy.ts`
keeps guarding `/admin` only; the MCP route authenticates itself, like the cron route.

Tools (the full list; anything else is impossible):

| Tool | Does |
|---|---|
| `find` | Search clients, leads, projects, documents by name or reference |
| `get_client_context` | One client with projects, deals, documents, invoices, payments, open promises |
| `get_deal` / `save_deal` | Read or create/update a project's deal |
| `create_client_and_project` | New lead or client plus project and empty deal |
| `list_documents` | Filter by client, type, status |
| `get_document` | Draft sections, versions, status history |
| `save_draft` | Create a draft or replace given sections of one |
| `finalise_document` | Freeze a version and render its PDF; returns the PDF link |
| `set_status` | Sent, accepted, declined, void (signed comes from a signed-copy upload) |
| `create_invoice_from_deal` | Draft invoice for one payment-schedule line; requires a payee |
| `attach_file` | Attach a file from a URL or upload to a record |
| `whats_outstanding` | Overdue invoices, unsigned agreements, care plans due to start or renew, deadlines in the next 14 days, drafts untouched for 7 days |

No tool deletes anything, runs SQL, or touches founder pay, splits or cash movements.

## The employee

### Behaviour

- Asks only what it cannot find in the dashboard, Obsidian or GitHub, a few questions at a time, and
  suggests a default from past deals where it can.
- Always asks who is being paid (Michael, Zane, or the company account) before putting bank details
  on anything.
- Flags, without blocking, anything that departs from the defaults: no care-plan minimum, a price
  below comparable past deals, an unusual payment split.
- Discusses drafts: changes any section on request, explains why something is there (citing the
  deal or a past document), offers options when asked about objections.
- Only "finalise" freezes a version. A draft can be reopened in any later conversation.
- Never sends to a client without an explicit "send it". Never invents facts; asks instead.
- When sources disagree, the dashboard wins and the employee says so.
- If the connector fails or the login has expired, it says so plainly and keeps the draft in the
  conversation. It never claims a save that did not happen.

### Where the playbook lives

The playbook (behaviour, house style, defaults, clause library) is private:

- `C:\Users\taylo\.claude\skills\doc\` holds the `/doc` skill for Claude Code.
- The same text is pasted into a Claude Project's instructions for the phone app.
- Clause library and defaults are drawn from Mindelo's `SOP and Documentation Standard` v1.0 and its
  signed agreements. House style: no em dashes, plain and concise, offer to expand rather than pad.
- Care-plan default: minimum term (3 months), then month to month until either side gives 30 days'
  notice. Inclusions are standard; the price is set per deal.

## Dashboard upgrades

**Every name is a link.** Wherever a client, project, invoice, document or lead appears in `/admin`
(tables, charts' record lists, timeline, Money Received, founder pay rows, Overview), it links to its
page. Planning includes a sweep of every page for plain-text names.

**Pages:**
- `/admin/clients/[id]`, the client file (upgrade of the existing timeline page): header summary
  (client since, projects, billed, paid, owed, care-plan MRR), money charts (billed vs paid vs owed,
  revenue by month, revenue split by project, average days to pay, following the chart rule: parts of
  a total are pies, values over time are bars or lines), projects with deal cards, documents,
  invoices and payments with dates, files, and the timeline including document events.
- `/admin/projects/[id]` (new): deal card, documents, invoices, files, repo and live URL, timeline.
- `/admin/finance/invoices/[id]` (new): lines, dates, payments against it and who collected them,
  payee, notes, files, PDF.
- `/admin/documents` (new): all documents, filterable by client, type, status.
- `/admin/documents/[id]` (new): draft or version preview, version list, status history, files,
  finalise and status buttons.

Each page links up the chain: invoice → project → client.

## Testing

- Pure logic (payment-schedule sums, reference codes, version and status transitions, missing-fact
  detection, outstanding-items rules) in `lib/` with a `bun scripts/documents.test.ts` assert script,
  like `subscriptions.test.mjs`.
- Database rules (immutable versions, status triggers, schedule constraint) tested against a
  throwaway local Postgres, never prod, like `ledger.test.ts`.
- Connector tools tested against the same local database with a stub admin.
- UI checked through a temporary preview page with mock data, not committed.

## Delivery

Migrations are applied to production before the code that depends on them is merged, because a merge
to `main` deploys.

1. **Foundations**: deals, documents, versions, attachments, activity, settings (migrations); the
   client file, project, invoice and documents pages; attachments upload; the every-name-is-a-link
   sweep.
2. **Connector and `/doc` skill**: proposal, quote and invoice templates and PDFs in the new logo;
   Claude app Project setup.
3. **Agreements**: service agreement, care plan and change request templates (clause library).
4. **Outstanding**: `whats_outstanding` and its dashboard view.
5. **SOPs**, plus the Projects and Leads summary charts left over from redesign piece 5.

Each phase ships on its own. Each gets its own implementation plan.
