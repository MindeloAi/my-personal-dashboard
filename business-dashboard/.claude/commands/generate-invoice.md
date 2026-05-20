---
description: Mint a numbered TT$ invoice for a project and create a matching Airtable Invoices record.
---

# /generate-invoice

Generate an invoice for a Project, minting an `INV-YYYYMMDD-XXXX` number and
writing a matching record to the Airtable **Invoices** table. Designed to be run
by a terminal that has claimed a `Generate invoice` Task queued from the
Automation Launcher (Kind `ops`).

## Inputs

Read from the claimed Task's `Inputs` JSON (or ask if run directly):

- `projectId` — Airtable record id of the Project to bill (**required**).
- `invoiceType` — one of `deposit | milestone | final | recurring | one_off`.
- `amount` — TT$ amount. If blank, fall back to the project's `Total Value`.
- `dueDate` — `YYYY-MM-DD`. If blank, default to issue date + agency
  `paymentDueDays` (14 by default) via `addDaysISO`.

## Steps

1. **Read the project.** Use `getProjects` from `@/lib/airtable` (filter to the
   `projectId`) to get `Name`, `Client`, `Total Value`. Resolve the client name
   via `getClients` if you need it for the printed body.

2. **Mint the number + build the body.** Import from `@/lib/invoice-format`:

   ```ts
   import {
     generateInvoiceNumber,
     buildInvoiceBody,
     getAgencyConfig,
     addDaysISO,
   } from "@/lib/invoice-format";

   const today = new Date().toISOString().slice(0, 10);
   const agency = getAgencyConfig();
   const invoiceNumber = generateInvoiceNumber();
   const amount = inputs.amount ? Number(inputs.amount) : (project["Total Value"] ?? 0);
   const dueDate = inputs.dueDate || addDaysISO(today, agency.paymentDueDays);

   const body = buildInvoiceBody({
     invoiceNumber,
     client: clientName,
     projectName: project.Name,
     projectId: project.id,
     invoiceType: inputs.invoiceType,
     amount,
     issueDate: today,
     dueDate,
   });
   ```

   The agency block (name / IDs / phone / address) comes from `AgencyConfig` —
   **never hard-code Vantage details**. Set `AGENCY_NAME`, `AGENCY_BUSINESS_ID`,
   `AGENCY_BUSINESS_NUMBER`, `AGENCY_PHONE`, `AGENCY_ADDRESS`,
   `AGENCY_PAYMENT_TERMS`, `AGENCY_PAYMENT_DUE_DAYS` in `.env.local` to customize.

3. **(Optional) Telegram review.** If `TELEGRAM_BOT_TOKEN` and
   `TELEGRAM_CHAT_ID` are set, POST the body to
   `https://api.telegram.org/bot<token>/sendMessage` (`chat_id`, `text`,
   `parse_mode: "Markdown"`, the body fenced in triple backticks) before
   persisting. Skip silently if either var is missing — the invoice is still
   created.

4. **Create the Airtable record.** Call the existing `createInvoice` helper from
   `@/lib/airtable` (do **not** modify it). Map ONLY to fields that exist on
   `InvoiceWriteSchema` (airtable.ts L178–196) — the Vantage script's field
   names (`Total`, `Client Name`, `Amount Paid`, `Payment Terms`) do **not**
   exist here:

   ```ts
   import { createInvoice } from "@/lib/airtable";

   await createInvoice({
     "Invoice Number": invoiceNumber,           // string — minted above
     Project: [project.id],                     // linked record (array of ids)
     Amount: amount,                            // number
     "Invoice Type": inputs.invoiceType,        // deposit|milestone|final|recurring|one_off
     Status: "Sent",                            // Draft|Sent|Paid|Overdue|Void
     "Issue Date": today,                       // YYYY-MM-DD
     "Due Date": dueDate,                        // YYYY-MM-DD
     Notes: `Auto-generated ${invoiceNumber}`,
   });
   ```

   If the project has a linked `Client`, pass it through as `Client: project.Client`.

5. **Report.** Print the invoice number, the rendered body, and confirm the
   Airtable record was created.

## Acceptance

- A numbered `INV-YYYYMMDD-XXXX` invoice in TT$ is produced.
- A matching Invoices record is created via `createInvoice` (Telegram optional).
- No agency details are hard-coded — everything comes from `AgencyConfig`.
