import { NextResponse } from "next/server";
import { createLead } from "@/lib/db";

/**
 * Replaces Netlify Forms, which does not survive the move off Netlify.
 *
 * The form on /contact posts the same urlencoded body it always has, so the
 * markup and the submit script are unchanged: only the endpoint moved. Two
 * things happen with each submission, in this order:
 *
 *   1. a row in `leads`, which is what the dashboard's Leads page reads, and
 *   2. a notification email through Resend, replacing the Netlify Forms
 *      notification that used to go to admin@mindelo.site.
 *
 * The row is written first and deliberately. If the email fails, the enquiry is
 * already captured and recoverable from the dashboard.
 *
 * ─── Note for whoever picks this up ────────────────────────────────────────
 * `integrations/google-sheets-sync.gs` in the Mindelo-Website repo reads
 * Netlify Forms submissions. It breaks the moment the domain leaves Netlify and
 * nothing here replaces it. It either needs repointing at the `leads` table or
 * retiring.
 */

const NOTIFY_TO = process.env.CONTACT_NOTIFY_TO || "admin@mindelo.site";
const NOTIFY_FROM = process.env.CONTACT_NOTIFY_FROM || "Mindelo <onboarding@resend.dev>";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendNotification(fields: Record<string, string>) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const rows = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`)
    .join("");

  // Resend's REST API directly rather than the SDK: one call, one dependency
  // fewer, and the failure mode stays visible in the response body.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: [NOTIFY_TO],
      reply_to: fields.Email || undefined,
      subject: `New enquiry from ${fields.Name || "the contact form"}`,
      html: `<h2>New contact form enquiry</h2><table>${rows}</table>`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend returned ${res.status}: ${await res.text()}`);
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission" }, { status: 400 });
  }

  const value = (k: string) => (form.get(k) ?? "").toString().trim();

  // Honeypot, carried over from the Netlify Forms setup. A bot that fills it in
  // gets a 200 and nothing is written, so it has no signal to retry against.
  if (value("bot-field")) {
    return NextResponse.json({ ok: true });
  }

  const name = value("name");
  const email = value("email");
  const projectType = value("project_type");
  const message = value("message");

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  try {
    await createLead({
      Name: name,
      Email: email,
      "Service Interest": projectType || undefined,
      Message: message || undefined,
      Source: "Website contact form",
      Status: "New",
    });
  } catch (err) {
    console.error("[contact] failed to write lead:", err);
    return NextResponse.json({ error: "Could not save your message" }, { status: 500 });
  }

  try {
    await sendNotification({
      Name: name,
      Email: email,
      "Project type": projectType,
      Message: message,
    });
  } catch (err) {
    // The lead is safely stored, so this is not a lost enquiry. It still
    // returns 500: a notification that silently stops arriving is exactly the
    // kind of failure that goes unnoticed for months.
    console.error("[contact] lead saved but notification failed:", err);
    return NextResponse.json(
      { error: "Message received but the notification failed", leadSaved: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
