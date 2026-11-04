# Document employee, Phase 3: agreements — design

**Date:** 2026-11-04 · **Status:** approved in conversation
Builds on `2026-11-03-document-employee-design.md` (Phases 1 and 2, live).

## Goal

Service agreements, care plans and change requests drafted from the deal and the client
record, in Mindelo's own clause wording, with a signature block; an accepted change request
updates the deal; a signed care plan becomes a monthly retainer with one founder click.

## Decisions (Michael, 4 November 2026)

- Client legal details live **on the client record**: `address`, `signatory_name`,
  `signatory_title` (the client's registered name is the existing `company`, else `name`).
  Editable on the client page and through a new connector tool `save_client_details`.
- Agreements are for **clients only**. A lead has no client record; convert it first.
- **Signing is unchanged:** finalise, send, client signs, founder attaches the signed copy,
  which marks the document `signed` (Phase 1 rule). No e-signature.
- **Change request accepted** (marked `accepted`, or `signed` by attaching the copy, whichever
  comes first): its items total is added to the deal's `price_total` and to the deal's last
  payment line, in the same transaction, logged in activity. Wording already in the clause
  library: "Approved additions are added to the final payment." Refused, with a plain
  message, when the last line's invoice already exists (not void): invoice the change
  separately instead.
- **Care plan → retainer:** a "Start care plan" box on a **signed** care plan, filled in from
  the deal (`care_plan.monthly_amount`), monthly, first invoice one month after the final
  payment. One founder click creates the `subscriptions` row. Never automatic.
  - Final payment = the project's `final` (or `one_off`) invoice reaching `Paid`; its date is
    the latest payment `paid_at` on that invoice. Not paid yet → the box says so and waits.
  - `subscriptions.start_date` is the **first invoice date** (start + 1 month, same day of
    month, clamped to month end), because `nextInvoiceDate()` bills a never-invoiced
    subscription on its start date. Notes record "Care began <date>".
  - `documents.subscription_id` links the care plan to its retainer; a second start is refused.

## Templates (`DEFAULT_SECTIONS`)

Clause text is taken word for word from `~/.claude/skills/doc/house-style.md` "Standard
terms" and "Care plan (default)". Facts come from the deal and client; anything absent is
`{{missing: …}}`, which blocks finalising.

- **service_agreement:** parties, scope, price and payment (from the deal), timeline,
  changes to scope, client responsibilities, running costs, ownership, reference and
  publication, liability, termination and governing law, payment terms (14 days).
- **care_plan:** what is included, what is not included, price (monthly amount), term
  (minimum 3 months then 30 days' notice), start and billing ("Your care plan begins on the
  day your final payment is received. Each month is invoiced at its end, so the first
  invoice is issued one month after the care plan begins." Payable within fourteen days of
  issue), if it ends.
- **change_request:** reference `<DEAL>-CR<n>`, what is being added, items
  (`description | amount`), effect on the timeline, "added to the final payment",
  approval.

Finalising rules added: agreements and care plans need a client with address and signatory
filled in; a change request needs valid items; a care plan needs the deal's care plan amount.

## PDFs

Same branded layout. For the three new types: the client block shows registered name,
address, signatory and title; a two-party signature block (name, title, signature line, date
line) for MINDELOAI LIMITED and the client ends the document; change requests show an items
table with total. Existing page numbering stays.

## Connector and skill

- New tool `save_client_details { clientId, address?, signatoryName?, signatoryTitle? }`.
- `get_client_context` returns the legal details.
- `/doc` skill and Claude app instructions: order of the three documents, CR numbering,
  "ask once, save to the client".

## Testing

Pure: defaults contain no em dashes and block finalising; schedule maths for a change
request; first-invoice date (incl. 31 Jan → 28/29 Feb). DB (local `docs-pg`): legal details
save; agreement finalise refused without them; CR accepted updates deal once (accepted then
signed does not double count) and is refused once the final invoice exists; start care plan
refused before final payment, creates one subscription after, refused twice. PDFs eyeballed.

## Not in scope

E-signature and online acceptance, automatic sending, `whats_outstanding`, SOPs.

## Rollout

Migration `026` applied to production by Michael before merge (merge deploys).
