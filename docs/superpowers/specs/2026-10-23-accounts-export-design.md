# Accounts export: design

**Date:** 2026-10-23
**Status:** approved in conversation, awaiting spec review
**For:** Taylor (Michael) and Zane, and the accountant they hand files to

## Goal

Get the dashboard's money data out, for any date range, in two forms:

- **One Excel workbook** (`.xlsx`) to hand to an accountant or use for tax.
- **A zip of CSVs** (same tables, one file each) for the founders' own spreadsheets.

Export only. Nothing is imported. Add import later only if a real need shows up.

## Where it lives

An **Export** button in the Finance header opens a panel built on `ModalShell` (the same modal component as every other dashboard modal). The panel has:

- Presets: This month, Last month, This quarter, This year, Last year, All time. "All time" starts at the earliest dated invoice or expense.
- From and To date inputs. Presets fill them in, and they can be edited.
- **Download Excel** and **Download CSVs**: plain `<a href>` links to the route below. No form state is saved and no record is changed.

Dates are Trinidad dates: presets use `today()` from `lib/subscriptions.ts`, like every other date in the dashboard.

## Route

`GET /admin/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|csv`

- It sits under `/admin`, so the proxy demands a session. It also calls `requireAdminPage()` itself, like every admin page, because the proxy only proves a session exists.
- Query params are validated with zod. A missing or malformed date, `to` before `from`, or an unknown format returns **400** with a plain-text reason, never an empty file.
- Both dates are **inclusive**.
- The response is `Content-Disposition: attachment; filename="mindelo-accounts-<from>-to-<to>.xlsx"` (or `.zip`).
- It is read-only: every query runs inside a `read only` transaction.

## Contents

The same six tables go into both formats: a tab each in the workbook, and a file each in the zip (`summary.csv`, `income.csv`, ...).

In the workbook, amounts are numbers formatted `TT$#,##0.00` and dates are real dates, so sorting and totalling work. CSV amounts are plain numbers (`1234.50`) and CSV dates are `YYYY-MM-DD`.

### Summary

| Line | Definition |
|---|---|
| Period | from to to, and when it was exported |
| Income | sum of the Income tab |
| Expenses | sum of the Expenses tab |
| Net profit | Income minus Expenses (founder pay is NOT deducted, matching the dashboard's Net Profit) |
| Founder pay paid out | Founder pay tab rows with status `paid_out` |
| Founder pay still due | Founder pay tab rows with status `due` |
| Business cash, Mikey / Zane / Vantage | each pot's balance **as at the To date**: `cash_flows` rows with `on_date <= to`, so the same rules as `cash_by_location` |
| Owed to us | `owed_to_us` total **as of today**, labelled "as of <today>" because it is not period-based |
| Note | only when From is before the ledger cutover: "Founder pay, cash and transfers start on 22 Oct 2026. Earlier income comes from invoice paid dates." |

### Income: one row per amount received in the period

- **Ledger era:** every `payments` row with `paid_at` in range. Columns: date, invoice number, client, project, amount, method, received by, note, source = `Ledger`.
- **Before the ledger:** every invoice with status `Paid` and `paid_date` in range **and before the cutover**, with no `payments` rows. Amount = invoice amount. Method comes from `invoices.payment_method`. Received by and note are blank. Source = `Before ledger`.
- Paid invoices with no paid date cannot be placed in a period, so they are left out. The Summary does not count them.

### Expenses: one row per expense dated in the period

Date, name, category, amount, USD amount, paid from (holder), paid personally by (founder), reimbursed on, reimbursed from, recurring (Yes/No), reference, notes. Every expense in range is included, whether before or after the cutover.

### Founder pay: one row per payout whose client payment is in the period

Grouped by payment date, like the `founder_pay` view. Columns: payout number, founder, invoice number, payment date, base, bonus, total, status (`Due` / `Paid out`), paid out on, paid from.

### Cash movements: one row per transfer or opening balance in the period

Date, type (`Opening` / `Transfer`), from, to, amount, note.

### Invoices: one row per invoice issued in the period

Number, client, project, type, issue date, due date, amount, paid so far (sum of its payments, or the full amount for a pre-ledger Paid invoice), status, paid date. Status is the **effective** status from `lib/invoices.ts`, so Overdue is derived the same way the dashboard derives it.

## Code layout

| Unit | Does | Depends on |
|---|---|---|
| `getAccountsExport(from, to, today)` in `src/lib/db.ts` | The read-only queries. Returns plain typed rows for the six tables plus the Summary figures. | Postgres |
| `src/lib/accounts-export.ts` | Pure. `toXlsx(data): Promise<Uint8Array>` and `toCsvZip(data): Uint8Array`. Also the CSV cell escaping. No DB. | `exceljs`, `fflate` |
| `src/app/admin/export/route.ts` | Auth, param validation, calls the two above, sets the download headers. | both above |
| `src/components/dashboard/export-modal.tsx` | The panel and presets. Only builds link URLs. | `ModalShell` |

New dependencies, both used only on the server inside the route: `exceljs` (workbook) and `fflate` (zip). Neither is imported by a client component.

## Safety

- **CSV formula injection:** any CSV text cell starting with `=`, `+`, `-`, `@`, tab or carriage return gets a leading `'`. Numbers are written as numbers and are not prefixed. The `.xlsx` stores strings as strings (never formulas), so it needs no prefix.
- CSV quoting follows RFC 4180: a field containing a comma, quote or newline is wrapped in quotes, with inner quotes doubled. CSVs carry a UTF-8 BOM so Excel opens accented names correctly.
- Read-only transaction, so an export can never write.

## Testing

`scripts/export.test.ts` runs under bun against the throwaway `ledger-pg` database only (it refuses any non-localhost URL, like `ledger.test.ts`). It seeds:

- pre-ledger paid invoices
- ledger payments
- payouts, both paid out and due
- a transfer
- expenses on and just outside the range edges
- a client named `=HYPERLINK("x")`, and a note containing a comma, a quote and a newline

It asserts:

1. The Summary's Income, Expenses, founder-pay and cash figures equal the sums of their tabs, and the cash figures equal `cash_by_location` when To is today.
2. Rows dated exactly on From and on To are included, and rows a day outside are not.
3. Pre-ledger income rows have source `Before ledger`, and no invoice appears in Income twice.
4. The CSV round-trips the tricky values, and the formula-looking name is prefixed.
5. Reopening the `.xlsx` with exceljs gives exactly the six tab names, in order.

On top of that, the panel gets the same 390px / 1280px screenshot check as the other admin UI, using a throwaway preview page that is never committed.

## Out of scope

Importing anything, cash counts, subscriptions, leads and projects tabs, scheduled or emailed exports, PDF.

## Shipping

No migration: the feature only reads. It is a normal PR, and a merge deploys it.
