// Summaries and charts for Leads, Clients and Projects, and the "Needs action"
// list the Overview shows (and the morning notification digest will send).
// Pure, so scripts/pages-data.test.ts can check it.
import type { Client, Project, Invoice, Lead, Subscription, Ledger } from "@/lib/db";
import { isOverdue } from "@/lib/invoices";
import { dueSubscriptions } from "@/lib/subscriptions";
import { names, revenueByClient, topWithOther, OTHER, type Slice } from "@/lib/overview-data";
import { lastMonths } from "@/lib/finance-data";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const monthLabel = (key: string) => MONTH.format(new Date(`${key}-01T00:00:00Z`));
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const count = <T>(xs: T[], key: (x: T) => string) =>
  [...xs.reduce((m, x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1), new Map<string, number>())]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

export const OPEN_STAGES = ["New", "Contacted", "Proposal Sent"];
export const isOpen = (l: Lead) => OPEN_STAGES.includes(l.Status ?? "New");
/** An open lead whose follow-up date has arrived. */
export const followUpDue = (l: Lead, today: string) => isOpen(l) && !!l["Follow-up Date"] && l["Follow-up Date"] <= today;

/** A lead's source, with "referral" and "Referral" counted as one. */
export const sourceOf = (l: Lead) => {
  const t = l.Source?.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "Not recorded";
};

export function leadsSummary(leads: Lead[], today: string) {
  const won = leads.filter((l) => l.Status === "Won").length;
  const lost = leads.filter((l) => l.Status === "Lost").length;
  const months = lastMonths(today);
  return {
    open: leads.filter(isOpen).length,
    won,
    winRate: won + lost ? (won / (won + lost)) * 100 : 0,
    followUps: leads.filter((l) => followUpDue(l, today)).length,
    bySource: topWithOther(count(leads, sourceOf), 5),
    /** Of the leads that came in each month and have been decided, the share won. */
    winRateByMonth: months.map((k) => {
      const cohort = leads.filter((l) => l.Created?.slice(0, 7) === k && (l.Status === "Won" || l.Status === "Lost"));
      const w = cohort.filter((l) => l.Status === "Won").length;
      return { key: k, label: monthLabel(k), rate: cohort.length ? (w / cohort.length) * 100 : 0, decided: cohort.length };
    }),
    arrivedByMonth: months.map((k) => ({ key: k, label: monthLabel(k), leads: leads.filter((l) => l.Created?.slice(0, 7) === k).length })),
  };
}

export function clientsSummary(clients: Client[], invoices: Invoice[], projects: Project[], today: string) {
  const revenue = revenueByClient(invoices, projects, clients).filter((r) => r.name !== "No client");
  const earned = sum(revenue, (r) => r.value);
  const months = lastMonths(today);
  return {
    active: clients.filter((c) => c.Status === "Active").length,
    earned,
    average: revenue.length ? earned / revenue.length : 0,
    paying: revenue.length,
    revenueTop: topWithOther(revenue, 10),
    byStatus: count(clients, (c) => c.Status ?? "Not set"),
    newByMonth: months.map((k) => ({ key: k, label: monthLabel(k), clients: clients.filter((c) => c.Created?.slice(0, 7) === k).length })),
  };
}

export const ACTIVE_WORK = ["In Progress", "Review"];
export const PROJECT_STAGES = ["Lead", "In Progress", "Review", "Done", "Cancelled"];

export function projectsSummary(projects: Project[]) {
  const value = (p: Project) => p["Total Value"] ?? 0;
  return {
    inProgress: projects.filter((p) => p.Status === "In Progress").length,
    inReview: projects.filter((p) => p.Status === "Review").length,
    activeValue: sum(projects.filter((p) => ACTIVE_WORK.includes(p.Status ?? "")), value),
    byStage: PROJECT_STAGES.map((s) => {
      const xs = projects.filter((p) => (p.Status ?? "Lead") === s);
      return { key: s, label: s, projects: xs.length, value: sum(xs, value) };
    }),
    byService: topWithOther(count(projects, (p) => p["Service Type"] || "Unspecified"), 5),
  };
}

export type ActionItem = { kind: "overdue" | "due-soon" | "follow-up" | "retainer" | "to-sort"; title: string; detail: string; href: string };

/**
 * Everything that needs doing, most urgent first: overdue invoices, invoices
 * due in the next 3 days, lead follow-ups due, retainer invoices to raise,
 * and collected money not sorted yet.
 */
export function needsAction(
  { invoices, leads, subscriptions, clients, projects, ledger }:
  { invoices: Invoice[]; leads: Lead[]; subscriptions: Subscription[]; clients: Client[]; projects: Project[]; ledger: Pick<Ledger, "toSort"> },
  today: string,
  money: (n: number) => string,
): ActionItem[] {
  const nameOf = names(clients, projects);
  const soon = new Date(`${today}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 3);
  const soonIso = soon.toISOString().slice(0, 10);
  const now = new Date(`${today}T12:00:00`);
  const left = (i: Invoice) => (i.Amount ?? 0) - (i["Paid So Far"] ?? 0);
  const unpaid = invoices.filter((i) => i.Status === "Sent" || i.Status === "Overdue");
  const items: ActionItem[] = [
    ...unpaid.filter((i) => isOverdue(i, now)).sort((a, b) => (a["Due Date"] ?? "").localeCompare(b["Due Date"] ?? "")).map((i) => ({
      kind: "overdue" as const,
      title: `${i["Invoice Number"] ?? "Invoice"} overdue: ${nameOf(i)}`,
      detail: `${money(left(i))} still owed, due ${i["Due Date"] ?? "no date"}`,
      href: "/admin/finance/invoices?status=Overdue",
    })),
    ...unpaid.filter((i) => !isOverdue(i, now) && i["Due Date"] && i["Due Date"] <= soonIso).map((i) => ({
      kind: "due-soon" as const,
      title: `${i["Invoice Number"] ?? "Invoice"} due ${i["Due Date"]}: ${nameOf(i)}`,
      detail: `${money(left(i))} to collect`,
      href: "/admin/finance/invoices?status=Sent",
    })),
    ...leads.filter((l) => followUpDue(l, today)).map((l) => ({
      kind: "follow-up" as const,
      title: `Follow up ${l.Name}${l["Business Name"] ? ` (${l["Business Name"]})` : ""}`,
      detail: `Follow-up date ${l["Follow-up Date"]}, stage ${l.Status ?? "New"}`,
      href: "/admin/leads",
    })),
    ...dueSubscriptions(subscriptions, invoices, today).map((d) => ({
      kind: "retainer" as const,
      title: `Raise the invoice for ${d.sub.Name}`,
      detail: `${money(d.sub.Amount ?? 0)} was due ${d.due}${d.daysOverdue ? `, ${d.daysOverdue} days ago` : ", today"}`,
      href: "/admin/finance/recurring",
    })),
  ];
  const { handover, business } = ledger.toSort;
  if (handover > 0) items.push({ kind: "to-sort", title: "Zane to hand money to Mikey", detail: `${money(handover)} collected and not handed over`, href: "/admin/finance/received" });
  if (business > 0) items.push({ kind: "to-sort", title: "Put the business share in the safe", detail: `${money(business)} not in the safe yet`, href: "/admin/finance/received" });
  return items;
}

export { OTHER };
export type { Slice };
