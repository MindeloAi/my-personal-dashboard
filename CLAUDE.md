# Mindelo Dashboard

The app lives in `business-dashboard/` (see its `AGENTS.md`). Read this first in every session.

## Source of truth

The Mindelo Dashboard database is the only source of truth for money. The Airtable base "Mindelo Ledger" (`appINidO7vs4naJpp`) is archived history from before 22 October 2026.

- Never read figures from the Airtable ledger to calculate anything.
- Never write to the Airtable ledger, except through the one-way dashboard to Airtable mirror, and only if Taylor asks for it.
- If a figure in Airtable disagrees with the dashboard, the dashboard is correct.
- The `airtable_id` columns on `clients`, `projects`, `invoices`, `expenses` and other tables come from an earlier Airtable import. They are reference only and never a reason to sync. Leave them alone.

## Founder ledger (migration 011)

- All money arithmetic happens in the database: the `on_payment_insert` trigger splits each payment and creates payouts; views (`business_cash`, `cash_by_location`, `cash_check`, `owed_to_us`, `founder_pay`, `owed_to_founders`) do every total. The UI may preview a split in TypeScript (`src/lib/ledger.ts`) for display only.
- An invoice reaches `Paid` only by recording payments. Never write `status = 'Paid'` from application code.
- Split percentages live in `split_rules`. To change one, insert a new version with a later `effective_from`; never hardcode percentages.
- Acceptance checks: `scripts/ledger.test.ts` (runs against a throwaway local Postgres only; see the header of that file).
