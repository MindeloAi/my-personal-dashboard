---
description: List leads whose follow-up is due and draft follow-up messages for a human to send (never auto-sends)
---

# Follow-ups

Find every lead whose **Follow-up Date** is due and draft a follow-up message for each — **for the human to send**. You never auto-send, email, or WhatsApp anyone. This is human-led sales; your job is to make sending easy, not to send.

## Steps

1. **Find the leads (Airtable MCP).**
   - The dashboard base is the one configured by `AIRTABLE_BASE_ID` (see `business-dashboard/src/lib/airtable.ts`). Use `search_bases` / `list_tables_for_base` to get the **Leads** table id if you don't have it.
   - List leads from the **Leads** table where `Follow-up Date` is **on or before today** and `Status` is **not** `Won` or `Lost`.
   - Read for each: `Name`, `Business Name`, `Status`, `Service Interest`, `Budget Range`, `Message`, `Proposal Draft`, `Follow-up Date`, `Email`, `Phone/WhatsApp`.
   - If none are due, say so and stop.

2. **Draft a follow-up per lead.** Tailor the tone and content to where the lead is in the pipeline:
   - `Proposal Sent` → a warm nudge referencing the proposal: check if they had questions, offer a quick call/WhatsApp.
   - `Contacted` → re-engage: reference their original message and ask if they're ready to move forward.
   - `New` → a first-touch intro thanking them for reaching out and proposing a next step.
   - Keep it short, friendly, Trinidadian-professional. Reference the business by name. Suggest the best channel (WhatsApp if a number is on file, else email).

3. **Present for sending.** For each due lead, output a compact block:
   - Lead name + business, current status, how overdue the follow-up is, and the best contact channel/handle.
   - The drafted message, ready to copy-paste.

4. **(Optional) Reschedule.** Only if the human explicitly asks, bump the lead's `Follow-up Date` forward in Airtable. Do not change `Status` or send anything on your own.

## Guardrails

- **Never auto-send.** Draft only — the human copies and sends.
- Don't move leads to `Won`/`Lost` or alter records unless explicitly asked.
- If a lead has no usable contact info, still draft the message but flag that contact details are missing.
