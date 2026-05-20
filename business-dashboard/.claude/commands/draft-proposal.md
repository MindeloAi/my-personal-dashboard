---
description: Draft a T&T restaurant proposal for a lead and stage it in Airtable (draft only, never sends)
argument-hint: "<lead name or business>"
---

# Draft Proposal

Draft a website + AI-automation proposal for a single lead and stage it in Airtable. **You only draft.** A human reviews and sends every proposal — never message, email, or WhatsApp the prospect yourself.

Lead to draft for: **$ARGUMENTS**

## Steps

1. **Read the playbook.** Read `business-dashboard/proposals/restaurant-playbook.md` in full. It defines tiers, T&T context, pricing (TTD), structure, and tone. The proposal you write must follow it.

2. **Find the lead (Airtable MCP).**
   - The dashboard base is the one configured by `AIRTABLE_BASE_ID` (see `business-dashboard/src/lib/airtable.ts`). Use `search_bases` to locate it if you don't have the id, then `list_tables_for_base` to get the **Leads** table id.
   - Find the lead in the **Leads** table matching `$ARGUMENTS` against the **Name** or **Business Name** fields. If more than one matches, list the matches and ask which one — do not guess. If none match, say so and stop.
   - Read these fields: `Name`, `Business Name`, `Email`, `Phone/WhatsApp`, `Service Interest`, `Current Website`, `Budget Range`, `Message`, `Status`, `Follow-up Date`, `Source`.

3. **Pick the tier.** Match `Budget Range` and `Service Interest` to a playbook tier. Tailor line items to what the lead actually asked for in `Message`. Quote in **TTD**.

4. **Write the proposal.** Follow the playbook's "Proposal structure" and tone exactly: greeting by name + business, what we understand they need, what we'd build (bulleted), investment in TTD, timeline, next step. Keep it warm, concrete, and short.

5. **Stage it in Airtable (write back to the lead record).**
   - Set `Proposal Draft` = the full proposal text you wrote.
   - Set `Status` = `Proposal Sent`.
   - Set `Follow-up Date` = **today + 3 days** (format `YYYY-MM-DD`).
   - Use the Airtable MCP `update_records_for_table` (or equivalent) to update the lead.

6. **Report back.** Show the lead name, the tier chosen, the follow-up date you set, and paste the drafted proposal so the human can review and send it. Remind them: **this is a draft — review before sending.**

## Guardrails

- Draft only. Do **not** send, email, or message the prospect.
- If the lead's contact info or message is too thin to tailor a real proposal, draft your best version and flag the gaps for the human rather than inventing specifics.
- Don't promise card-payment go-live dates (gateway approval is out of our control).
