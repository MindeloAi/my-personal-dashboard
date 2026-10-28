// The Analytics chart builder's fixed menu: what can be measured, how it can be
// broken down, and which combinations make sense. Shared by the page (to build
// the controls) and db.ts (to build the query). No free-form queries.

export const MEASURES = {
  collected: "Money collected",
  invoiced: "Value invoiced",
  outstanding: "Still owed (by due date)",
  expenses: "Expenses",
  profit: "Profit (collected minus expenses)",
  founder_pay: "Founder pay",
  cash: "Cash held",
} as const;
export type Measure = keyof typeof MEASURES;

export const BREAKDOWNS = {
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  client: "Client",
  project: "Project",
  service: "Service type",
  category: "Expense category",
  founder: "Founder",
  collector: "Who holds / received it",
} as const;
export type Breakdown = keyof typeof BREAKDOWNS;

export const TIME: Breakdown[] = ["month", "quarter", "year"];

/** Breakdowns each measure supports, time first. */
export const ALLOWED: Record<Measure, Breakdown[]> = {
  collected: [...TIME, "client", "project", "service", "collector"],
  invoiced: [...TIME, "client", "project", "service"],
  outstanding: [...TIME, "client", "project", "service"],
  expenses: [...TIME, "category", "collector"],
  profit: [...TIME],
  founder_pay: [...TIME, "client", "project", "founder"],
  cash: [...TIME, "collector"],
};

export const CHART_TYPES = { bar: "Bar", stacked: "Stacked bar", line: "Line", area: "Area", pie: "Pie", table: "Table only" } as const;
export type ChartType = keyof typeof CHART_TYPES;

/** What "collector" means for each measure, for the control label. */
export const COLLECTOR_MEANING: Partial<Record<Measure, string>> = {
  collected: "Who received the payment",
  expenses: "Who paid the expense",
  cash: "Where the money is",
  founder_pay: "Who received the payment",
};

const COLLECTOR_LABEL: Record<string, string> = {
  mikey: "Mikey",
  zane: "Zane",
  business: "Business cash (safe)",
  before: "Before the ledger",
  personal_michael: "Paid personally by Michael",
  personal_zane: "Paid personally by Zane",
  unrecorded: "Not recorded (before the ledger)",
  michael: "Michael",
};
/** Turns stored codes (mikey, personal_zane) into the words the dashboard uses. */
export const labelOf = (v: string) => COLLECTOR_LABEL[v] ?? v;

export type AnalyticsQuery = { measure: Measure; breakdown: Breakdown; split: Breakdown | null; from: string; to: string };
export type AnalyticsRow = { key: string; series: string; value: number };

/** A query the menu allows: the breakdown and split both fit the measure and differ. */
export function isAllowed(q: Pick<AnalyticsQuery, "measure" | "breakdown" | "split">): boolean {
  const ok = ALLOWED[q.measure];
  if (!ok.includes(q.breakdown)) return false;
  if (q.split == null) return true;
  return ok.includes(q.split) && q.split !== q.breakdown && !TIME.includes(q.split);
}
