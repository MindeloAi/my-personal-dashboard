# Phone notifications and Google Calendar (redesign piece 7)

Date: 2026-10-28. Status: proposed, awaiting Taylor's approval.

## Decisions already made (Taylor, 2026-10-28)

- Notify on: invoices due or overdue, lead follow-ups due, retainer invoices to raise.
- Timing: one morning digest, plus an instant alert for urgent things.
- Recipients: both founders get the same alerts.
- Google Calendar: both ways. Dashboard dates go into a shared calendar, and the founders' calendar events show on the dashboard.

## Part A: phone notifications

**How.** Standard web push to the dashboard installed on the home screen (iPhone iOS 16.4 or later, Android, and desktop Chrome or Edge). No app store and no third-party service.

- **Turn on:** a "Turn on notifications" button under the account in the menu. Each phone or computer is switched on once. iPhones only allow it from the installed home-screen app.
- **Morning digest, 8:00am Trinidad:** "5 things need doing: 3 invoices overdue (TT$6,350), 1 follow-up, 1 retainer invoice to raise". Tapping it opens the Overview's Needs action list. It uses the same `needsAction()` list the Overview shows, so the two always agree. Nothing is sent on a day with nothing to do.
- **Instant alert:** sent when a payment is recorded ("GLISCORE paid TT$4,200, collected by Zane"), the one urgent event. Taylor did not pick "money to sort" as a digest item, so that alert is the only instant one. Easy to switch off.
- **Who:** every device either founder has switched on.

**What's needed**

1. **Migration 021:** a `push_subscriptions` table (device address and keys, who switched it on, when it last worked). Devices that stop accepting notifications are removed automatically. Taylor applies it; there's a down file.
2. **Notification keys:** a VAPID key pair that I generate, set as Vercel environment variables `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`.
3. **The `web-push` library:** one small, widely used dependency that signs and sends the messages.
4. **The daily job:** a second Vercel cron at `0 12 * * *` (8am Trinidad), next to the existing retainer email cron, protected by the same `CRON_SECRET`. If the plan's cron limit is reached, the digest joins the existing cron instead.
5. **A service worker (`public/sw.js`):** shows the notification and opens the right page when it's tapped.

## Part B: Google Calendar

**How.** A Google service account, which is a robot Google user that belongs to Mindelo. The dashboard uses it to write to one shared calendar and to read the founders' calendars once they share them with it. Nobody signs into Google through the dashboard, and no passwords are stored.

**Dashboard into a "Mindelo" calendar**

- **What goes in:** all-day events for unpaid invoice due dates, lead follow-up dates and retainer billing dates. Each event's description links to the record in the dashboard.
- **Event names:**
  - "Due: INV-0017 COLE Safety TT$2,000"
  - "Follow up: Melanie (Pilates)"
  - "Raise invoice: Hyline QC app TT$500"
- **Kept in step:** each event has a fixed ID derived from its record. When an invoice is paid, a follow-up date changes or a lead is closed, the event updates or disappears.
- **When it syncs:**
  - A full sync every morning in the daily job.
  - The record's own event also updates straight away whenever an invoice, lead or subscription is saved in the dashboard.
- **Reliability:** a failed sync never blocks saving. It's logged, and the next morning's sync puts it right.

**Founders' calendars onto the dashboard**

- **Overview gets "This week":** the next 7 days of events from each founder's calendar (time, title, whose calendar), next to Needs action.
- **Read-only:** the dashboard never changes anyone's personal events.

**What Taylor sets up (about 15 minutes, step-by-step guide provided)**

1. In Google Cloud: create a project, turn on the Google Calendar API, create a service account and download its key.
2. In Google Calendar: create a calendar called "Mindelo" and share it with the service account ("Make changes to events") and with Zane.
3. Each founder shares their own calendar with the service account ("See all event details") so the dashboard can show it.
4. Vercel environment variables: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_CALENDAR_ID` (the Mindelo calendar) and `GOOGLE_READ_CALENDAR_IDS` (the founders' calendars).
5. Access is through Google's REST API with a signed token, using the key above. No Google SDK is added.

**Privacy:** client names and amounts will be in a Google calendar that only the two founders can see.

## Build order

1. Notifications: service worker, the Turn on button, migration 021, the digest cron and the payment alert. Tested on desktop Chrome first, then on Taylor's iPhone.
2. Calendar write, then calendar read, once the Google setup is done. Each part works on its own; without the Google keys, calendar sync quietly does nothing.

## Checks

- `needsAction()` is already tested (`scripts/pages-data.test.ts`).
- New script tests cover: digest wording and the empty-day skip, calendar event IDs being stable per record, and events for paid or closed records being removed.
- The push and calendar senders are behind small functions, so the cron can be tested with fakes and never reaches Google or real phones in a test.
