import { NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { getClients, getInvoices, getSubscriptions } from "@/lib/db";
import { dueSubscriptions, today } from "@/lib/subscriptions";

/**
 * Daily reminder that a retainer is due to be invoiced.
 *
 * Scheduled from vercel.json. Reads nothing but subscriptions, invoices and
 * clients, and writes nothing at all — it emails, and the invoice itself is
 * still raised by hand from Finance → Recurring. A cron that quietly created
 * invoices would be sending money requests nobody had looked at.
 *
 * The due list comes from the same lib/subscriptions.ts the dashboard renders,
 * so the email and the screen can never disagree.
 *
 * ─── Access ────────────────────────────────────────────────────────────────
 * src/proxy.ts guards /admin only, so this route is on the public internet.
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env var is
 * set; without the check anyone could trigger the mail. Missing secret is a
 * 500, not an open door — it fails closed.
 */

export const dynamic = "force-dynamic";

const NOTIFY_TO = process.env.CONTACT_NOTIFY_TO || "admin@mindelo.site";
const NOTIFY_FROM = process.env.CONTACT_NOTIFY_FROM || "Mindelo <onboarding@resend.dev>";
const DASHBOARD_URL = "https://mindelo.site/admin/finance";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Same raw-fetch call as api/contact/route.ts: one request, no SDK, and the
// failure body stays visible in the logs.
async function send(subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: NOTIFY_FROM, to: [NOTIFY_TO], subject, html }),
  });

  if (!res.ok) {
    throw new Error(`Resend returned ${res.status}: ${await res.text()}`);
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/retainers] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const on = today();

  let due, clients;
  try {
    const [subscriptions, invoices, clientRows] = await Promise.all([
      getSubscriptions(),
      getInvoices(),
      getClients(),
    ]);
    due = dueSubscriptions(subscriptions, invoices, on);
    clients = clientRows;
  } catch (err) {
    console.error("[cron/retainers] failed to read subscriptions:", err);
    return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });
  }

  // Nothing owing is the normal case. A daily "all clear" email would be
  // trained out of within a week, and then the one that mattered would be too.
  if (due.length === 0) {
    return NextResponse.json({ ok: true, checkedOn: on, due: 0 });
  }

  const clientName = (id: string | undefined) => {
    const c = id ? clients.find((x) => x.id === id) : undefined;
    return c ? c.Company || c.Name : "—";
  };

  const rows = due
    .map(({ sub, due: dueDate, daysOverdue }) => {
      const amount = `$${Math.round(sub.Amount ?? 0).toLocaleString()}`;
      const when =
        daysOverdue === 0
          ? "today"
          : `${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} ago`;
      return (
        `<tr>` +
        `<td>${esc(sub.Name)}</td>` +
        `<td>${esc(clientName(sub.Client?.[0]))}</td>` +
        `<td>${amount}</td>` +
        `<td>${format(parseISO(dueDate), "d MMM yyyy")} (${when})</td>` +
        `</tr>`
      );
    })
    .join("");

  const subject =
    due.length === 1
      ? `1 retainer is due to be invoiced`
      : `${due.length} retainers are due to be invoiced`;

  try {
    await send(
      subject,
      `<h2>${subject}</h2>` +
        `<table cellpadding="6"><tr><th align="left">Subscription</th>` +
        `<th align="left">Client</th><th align="left">Amount</th>` +
        `<th align="left">Due</th></tr>${rows}</table>` +
        `<p><a href="${DASHBOARD_URL}">Raise them in the dashboard →</a></p>`,
    );
  } catch (err) {
    // Loud on purpose. A reminder that silently stops arriving is worse than no
    // reminder at all, because it reads as "nothing is due".
    console.error("[cron/retainers] failed to send the reminder:", err);
    return NextResponse.json({ error: "Reminder failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checkedOn: on, due: due.length });
}
