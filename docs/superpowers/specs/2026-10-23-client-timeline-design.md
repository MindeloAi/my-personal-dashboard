# Client timeline page

Status: approved by Zane, 23 October 2026. Branch `feat/client-timeline`.

**Note:** This repository is public. This document names no client and holds no client data. The
first two clients to load, their history, and the seed plan live in local notes outside the
repository (`C:\Users\zanea\client-timeline-brainstorm\`).

## Intent

Mindelo works with a handful of clients at a time, and every client relationship runs on promises
in both directions: a quote we said we would send, a purchase order they said they would raise, a
date that moved. Today those promises live in email threads, notetaker summaries, WhatsApp, and
memory. Nothing in the dashboard records an interaction or a promise. Clients and projects each
have one free-text notes field.

The client timeline page answers two questions at any moment, for one client:

- What do we (Mindelo) owe this client, and by when?
- What does this client owe us, and by when?

It also shows the history behind those dates: every call, meeting, email, message, and document,
and which promises came out of each one.

"We" means Zane and Mikkey. Both have admin logins.

## Goals

The page succeeds when it does these things:

- Opening a client shows both lists of open promises, with late and due-soon items marked, without
  scrolling on a laptop.
- Adding an interaction takes one paste. The page suggests the promises it finds, and a founder
  confirms or corrects them before anything is saved.
- A promise that moves keeps its history. The page shows that a date was replaced, by which
  interaction, and what the old date was.
- Any client can have a timeline. The first two clients are loaded with their full history before
  the page is called done.

## Non-goals

This version does not do these things:

- Read email, WhatsApp, or calendars automatically. A founder pastes the text.
- Remind anyone. There are no notifications or emails.
- Show clients anything. The page is admin-only.
- Change money. It reads unpaid invoices but never writes to invoices, projects, or the ledger.
- Store files. A document entry holds a link, not an upload.
- Replace the Projects board or project milestones.

## Anti-goals

The feature fails, even if it technically works, in these cases:

- A suggestion is saved without a founder confirming it.
- The page invents a promise or a due date that the pasted text does not state.
- A moved date overwrites the old one so nobody can see it moved.
- Client names, emails, prices, or history end up in this public repository.

## Constraints

These come from the repository and are not negotiable:

- **Framework:** Next.js 16.2.4 and React 19. `business-dashboard/AGENTS.md` says this version
  breaks older conventions. Read `node_modules/next/dist/docs/` before writing the dynamic route.
- **Data layer:** postgres.js in `src/lib/db.ts`. New code follows the ledger-era style (plain SQL
  with snake_case types, as in `recordPayment`), not the Airtable-shaped shim.
- **Writes:** Server Actions in `src/app/actions.ts`. Each one calls `requireAdmin()` itself,
  because the proxy does not cover Server Actions (`src/lib/auth.ts`). Each admin page calls
  `requireAdminPage()`.
- **Schema rules** (`scripts/schema.sql` header): every foreign key is `ON DELETE SET NULL`, never
  `CASCADE`. Date columns are `date`, not `timestamp`.
- **Table security:** row-level security (RLS) on with no policies, and all privileges revoked
  from `anon` and `authenticated`, as in `007_subscriptions.up.sql`.
- **Migrations:** `015_client_timeline.up.sql` and `.down.sql` in `scripts/migrations/`. `013` is
  the highest on `origin/main`, and `feat/sunday-review` has claimed `014`. Apply to production
  only after Zane gives the go-ahead.
- **Money rule** (root `CLAUDE.md`): totals come from the database. The page displays invoice
  balances the way the Finance page already computes them.
- **Phone:** the admin area installs as a phone app. The page works at 390 px wide.
- **Today:** Trinidad's date (`America/Port_of_Spain`), as in `src/app/admin/layout.tsx`, never
  the server's UTC date.
- **Parallel work:** `feat/sunday-review` also edits `db.ts` and adds `projects.kind`. Expect to
  rebase.

## Decided by Zane

Zane settled these points:

- The page answers "what we owe and by when" and "what they owe and by when", plus the history.
- An entry is a call, a meeting, an email, or a message. Zane pastes the notetaker summary or the
  raw email or message text.
- The page suggests promises and due dates on each side. A founder confirms or corrects them
  before they are saved.
- It works per client, for any client the founders pick.
- **Layout C:** a date line across the top, then the two who-owes-what lists side by side, then
  the history in full width.
- The dots and diamonds on the date line are interactive (see "The date line" below). Zane
  approved the clickable prototype on 23 October.
- The AI that suggests promises is Claude, with a new `ANTHROPIC_API_KEY` on Vercel.
- The first two clients are loaded with their history.

## Where the page lives

The page is `/admin/clients/[id]`. These changes connect it to the existing Clients page:

- On `/admin/clients`, clicking a client's name opens its timeline. Today the name opens the edit
  dialog, so the row gains an **Edit** button for that.
- The timeline header also has an **Edit** button that opens the same dialog.
- The sidebar keeps **Clients** highlighted on `/admin/clients/[id]`. Today `sidebar.tsx` matches
  the path exactly, so the match becomes a prefix match.

*My call:* every client has a timeline page, and there is no on or off switch. A client with no
entries shows an empty state with the **Add** button. "Turning it on" for a client means adding
the first entry.

## The page

The page has four parts, top to bottom. The approved prototype is
`client-timeline-brainstorm/.superpowers/brainstorm/*/content/layout-c-interactive.html`.

### Header

The header shows the company (or the client name when there is no company), the contact name, the
client status badge, and the client's projects with their status. On the right are
**+ Add call, email or message** and **Edit**.

### The date line

The date line is a horizontal strip with two rows:

- **Top row, dots:** one dot per entry, placed by date. Colour shows direction: green for
  received, blue for sent, amber for a two-way call or meeting. Entries on the same day share one
  dot with a count.
- **Bottom row, diamonds:** one diamond per open promise that has a due date, and one per unpaid
  invoice at its due date. The outline is amber when the client owes it and blue when we owe it.
  A late diamond is filled red. Items due the same day on the same side share one diamond with a
  count. Items without a due date do not appear on the line.
- **Today:** a vertical blue line labelled **Today**. Month names mark the first of each month.
- **Window:** *my call:* it starts 45 days before today, or at the oldest late item if that is
  earlier, so a late item is never off the line. It ends 7 days after the latest open due date,
  and at least 30 days after today. Older entries stay in the history.

The markers respond to the pointer, the keyboard, and touch:

- **Hover or focus:** a card shows the date, the kind, and the text.
- **Click a dot:** the entry lights up in the history and scrolls into view. The promises that
  came from it light up in the lists, with their diamonds.
- **Click a diamond:** the promises due that day light up, along with the entries they came from.
  A promise hidden behind **Show more** opens.
- **Click a promise or an entry:** this works in reverse and lights up its marker on the line.

Every marker is a `button` with an `aria-label`. The hit area is at least 24 px even though the
mark is 12 px.

### Who-owes-what lists

Two lists sit side by side, titled **[Client] owes us** and **We owe [client]**. On a phone they
stack. Each list shows these items:

- Open promises, sorted by due date, with undated promises last. Each row has a tick box, the
  promise, and a due label.
- The due label is grey for a future date, amber when the date is within 7 days, red with
  "N days late" when the date has passed, and "no date" when there is none.
- A promise that replaced an earlier one shows "moved from [old date]" under its due label.
- **[Client] owes us** also lists the client's unpaid invoices: invoice number, outstanding
  balance, and due date. They sort in with the promises by due date and use the same due labels.
  These rows are read-only and link to the Finance page, where payments are recorded. *My call:*
  an unpaid invoice is exactly "what the client owes us", and the data already exists.
- The first 5 open items show. **Show N more** reveals the rest. **Show N closed** reveals done,
  dropped, and replaced promises with their closing date and who closed them.
- **+ Add promise** adds one by hand, without an entry.

### History

The history lists entries newest first. Each entry shows the date and weekday, a tag ("Email
received", "Email sent", "Call", "Meeting", "Message received", "Document sent", and so on), the
one-line summary, and the people involved. Chips under the summary say what the entry did: "3
promises from this", "Ticked off: tool spreadsheet", "Moved 2 dates". Opening an entry shows the
full pasted text and the link, with **Edit** and **Delete**. The last 20 entries show, with
**Show older**.

## Adding an entry

A founder adds an entry in three steps:

1. Click **+ Add call, email or message**. A dialog asks for the kind (call, meeting, email,
   message, or document), the direction (received, sent, or both; calls and meetings default to
   both), the date (default today), the pasted text, and an optional link.
2. Click **Suggest promises**. The page sends the text to Claude and shows a summary line, the
   people involved, and a card for each suggestion. Each card has a keep box (ticked by default),
   editable fields, and the sentence it came from. A suggestion is one of these:
   - **New promise:** who owes it, what, and the due date or no date.
   - **Done:** an open promise that this entry fulfils.
   - **Replace:** an open promise whose date or terms this entry changes, shown as old and new.
3. Click **Save**. The entry and every kept suggestion save in one transaction. Nothing is saved
   before this step.

**Save without suggestions** is always available. If Claude fails, refuses, or the key is not set,
the dialog says so, keeps the pasted text, and the founder adds promises by hand.

## Done, late, replaced, and dropped

A promise is in one of four states:

| State | How it gets there | What the page shows |
|---|---|---|
| Open | Created by a suggestion or by hand | In its list, on the date line if dated |
| Done | Ticked, or a **Done** suggestion | Under **Show closed**, with the date and who ticked it. Unticking reopens it. |
| Replaced | A **Replace** suggestion, or **Replace** on the row | The old promise closes and links to the new one. The new one shows "moved from [old date]". |
| Dropped | **Drop** on the row, with an optional note | Under **Show closed**, with the note |

Late is not a state. An open promise is late when its due date is before Trinidad's today.

A replace keeps two rows instead of editing one, because the wording often changes along with the
date. For example, "purchase order, payment and spreadsheet by 29 Sep" becomes "purchase order,
payment and staff list by 2 Nov".

*My calls* on fixing mistakes, as opposed to recording a real change:

- **Edit** on a promise corrects its wording, side, or due date in place. Use it for a typo or a
  wrong suggestion. A date that the client or we actually moved goes through **Replace**, so the
  old date stays visible. The edit dialog says this in one line.
- Any closed promise (done, dropped, or replaced) can be reopened. Reopening clears its closing
  fields and its `replaced_by` link. The replacement promise stays, and a founder deletes it if it
  was wrong.
- **Delete** on a promise removes the row. A promise that it had replaced reopens.
- Deleting an entry keeps the promises it created and the ticks and replaces it caused. Their
  links to the entry become empty.

## Data

Migration `015_client_timeline` adds the following two tables:

```sql
create table client_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete set null,
  occurred_on date not null,
  kind        text not null check (kind in ('call','meeting','email','message','document')),
  direction   text not null check (direction in ('received','sent','both')),
  summary     text not null,
  people      text,
  body        text,   -- the pasted text, verbatim
  link        text,
  created_by  text not null,   -- admin email from requireAdmin()
  created     timestamptz not null default now()
);

create table client_promises (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete set null,
  entry_id        uuid references client_entries(id) on delete set null,   -- where it came from
  owed_by         text not null check (owed_by in ('us','client')),
  what            text not null,
  due_on          date,
  status          text not null default 'open'
                  check (status in ('open','done','dropped','replaced')),
  replaced_by     uuid references client_promises(id) on delete set null,
  closed_on       date,
  closed_by       text,
  closed_entry_id uuid references client_entries(id) on delete set null,   -- what closed it
  note            text,
  created_by      text not null,
  created         timestamptz not null default now(),
  check ((status = 'open') = (closed_on is null)),
  check (status <> 'replaced' or replaced_by is not null)
);
```

The migration also adds indexes on `client_entries (client_id, occurred_on desc)` and
`client_promises (client_id, status)`, enables RLS on both tables, and revokes all privileges from
`anon` and `authenticated`. The down migration drops both tables.

**Important:** Deleting a promise that replaced another must reopen the older promise first, in
the same transaction. Otherwise `ON DELETE SET NULL` empties the older row's `replaced_by` while
its status is still `replaced`, and the second `check` constraint rejects the delete.

**Note:** `ON DELETE SET NULL` on `client_id` follows the schema rule, so deleting a client leaves
its entries and promises without a client. The client delete warning in `clients-list.tsx` adds
the entry and promise counts to the project and invoice counts it already shows.

## The suggestion step

A Server Action, `suggestPromisesAction`, calls `requireAdmin()`, loads the client's name and open
promises, and calls Claude. It never writes to the database.

- **Client library:** the official `@anthropic-ai/sdk` package. Licence Apache-2.0 (Green), not
  archived, pushed 23 October 2026. It is the one new dependency.
- **Model:** `claude-opus-5-5`, with `output_config.effort` set to `medium` explicitly.
- **Output:** structured outputs (`output_config.format` with a JSON schema), then a zod parse on
  the server. The response has the following shape:

  ```json
  {
    "summary": "one line",
    "people": "names as written",
    "suggestions": [
      {
        "action": "new | done | replace",
        "promise_id": "uuid of an open promise, or null for new",
        "owed_by": "us | client",
        "what": "the promise in a few words",
        "due_on": "YYYY-MM-DD or null",
        "quote": "the sentence it came from"
      }
    ]
  }
  ```

- **Prompt inputs:** the entry date with its weekday, the kind and direction, the client name,
  that "us" means Mindelo (Zane and Mikkey), the open promises with their ids, and the pasted text.
- **Prompt rules:** suggest only promises the text states; resolve "by Friday" against the entry
  date; return `null` when no date is stated; propose **Done** or **Replace** only for listed ids;
  quote the source sentence.
- **Ranges and vague dates** (*my call*): a range ("the week of 5 Oct", "9 to 10 Nov") takes the
  last day of the range as its due date and keeps the range in the promise text, because the
  promise is late only after the range ends. A date that depends on an event that has not happened
  ("3 to 4 weeks after the quote is approved") is `null`, with the wording kept in the text. The
  seed files follow the same rule.
- **Server checks:** drop any suggestion whose `promise_id` is not one of this client's open
  promises.
- **Refusals:** send the server-side fallback (`fallbacks: "default"` with the
  `server-side-fallback-2026-07-01` beta header). Check `stop_reason` before reading the content.
  On a refusal, the dialog falls back to manual entry.
- **Key:** `ANTHROPIC_API_KEY` in Vercel (Production and Preview) and in `.env.local`. When it is
  missing, the action logs an error, as `api/chat/route.ts` does, and the dialog says suggestions
  are off.
- **Cost:** Opus 5.5 costs US$4 per million input tokens and US$20 per million output tokens. A
  typical paste with ten open promises is a few thousand tokens in and about a thousand out, which
  is roughly US$0.02 to US$0.05 a suggestion. This is an estimate; the builder measures one real
  call.
- **Duration:** a call can take 10 to 30 seconds. Set the route's maximum duration if the Vercel
  default is shorter, and show progress in the dialog.

**Note:** Suggesting promises sends the pasted client text to Anthropic's API.

## Loading the first two clients

The history of the first two clients is in local files outside the repository: one history file
per client and `seed-plan.md`, all in `C:\Users\zanea\client-timeline-brainstorm\`. Each history
row is marked sourced or inferred. The builder does not research history. The builder loads each
client in these steps:

1. Show Zane every inferred row in one list. Zane answers keep, fix, or drop for each. (Zane
   answered both lists on 23 October; the answers are in `seed-plan.md`.)
2. Write one SQL file per client in `C:\Users\zanea\client-timeline-brainstorm\`, never in the
   repository. Past promises that were replaced load as `replaced`, linked to their replacements,
   so the "moved from" history shows from day one.
3. Run each file with `scripts/run-migration.mjs --dry-run` against production and show Zane the
   row counts.
4. After Zane's go-ahead, run it for real.

## Verification

The feature is done when each of these is checked and its result reported:

- `npm run build` and `npm run lint` pass.
- One test file covers the logic that can break silently: the due label for late, soon, future,
  and undated promises against a fixed today; the date line window; marker grouping; and the save
  transaction for new, done, and replace against a throwaway local Postgres, following the harness
  in `scripts/ledger.test.ts`. It also proves the two `check` constraints reject a bad row.
- In a browser, against a local Postgres with `schema.sql` and the migrations applied (never
  production before Zane's go-ahead): add an entry, save suggestions, tick, untick, replace, drop,
  and click every kind of marker. Check the page at 390 px.
- One real Claude call with a real pasted email, checking that dates resolve against the entry
  date and that nothing is invented. Report the token counts and cost.
- The existing Clients page still creates, edits, and deletes clients.

## Release

Each step needs Zane's go-ahead:

1. Add `ANTHROPIC_API_KEY` to Vercel.
2. Apply `015_client_timeline` to production.
3. Merge the pull request. Vercel deploys `main` to mindelo.site.
4. Load the first two clients.

## Build or adopt

I searched GitHub for timeline components. The most-starred TypeScript result, `react-chrono`
(MIT), draws cards on a vertical or horizontal axis. None of the results links a two-row date
strip to two promise lists. The strip is about 100 lines of TSX and Tailwind, so it is built here.
Promise extraction is one API call, so there is nothing to adopt there either.

## Calls I made

Zane should check these while reading:

- Every client has a timeline page, with no on or off switch.
- Documents (quotes, timelines, invoices, forms) count as entries, with an optional link and no
  file upload.
- Unpaid invoices appear read-only in **[Client] owes us**, sorted in with promises, and as
  diamonds on the date line.
- A replaced promise keeps its old row and links to the new one, instead of having its date
  edited. **Edit** in place is for correcting mistakes only.
- Closed promises can be reopened, and deleting a replacement reopens the promise it replaced.
- A range takes its last day as the due date. A date that depends on a future event is no date.
- "Due soon" means within 7 days.
- The date line window is 45 days back (or the oldest late item) to 7 days past the latest open
  due date.
- Deleting an entry keeps the promises it created and the changes it caused.
- The client data and seed files stay outside the repository because the repository is public.
- The model is `claude-opus-5-5` at medium effort, through the official SDK.

## Left to the builder

These are the builder's choices:

- Component structure, file names, and the split between Server and Client Components.
- How a creator's email displays (for example, a short name per admin account).
- Exact colours, spacing, and the empty state, within the dashboard's existing look.
- Whether **+ Add promise** and **Edit** use one dialog or two.

## Outside this feature

These are separate decisions for Zane. The page surfaces them but does not fix them:

- Project values and invoices that no longer match what a client agreed. A mismatched unpaid
  invoice shows as late in **[Client] owes us** and on the date line until someone corrects it on
  the Finance page.
