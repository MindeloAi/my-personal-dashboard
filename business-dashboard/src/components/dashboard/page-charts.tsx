"use client";

import { useMemo } from "react";
import { SeriesChart, RankedBars, Donut } from "./chart-kit";
import type { ChartTable } from "./chart-card";
import { leadsSummary, clientsSummary, projectsSummary, sourceOf, PROJECT_STAGES } from "@/lib/pages-data";
import { leadsByStage, names, OTHER } from "@/lib/overview-data";
import { today as todayTT } from "@/lib/subscriptions";
import { tt } from "@/lib/ledger";
import type { Client, Project, Invoice, Lead } from "@/lib/db";

type Props =
  | { page: "leads"; leads: Lead[] }
  | { page: "clients"; clients: Client[]; invoices: Invoice[]; projects: Project[] }
  | { page: "projects"; projects: Project[]; clients: Client[] };

const LEAD_COLS = ["Lead", "Business", "Stage", "Source", "Came in", "Follow-up"];
const leadRow = (l: Lead) => [l.Name, l["Business Name"] ?? "", l.Status ?? "New", l.Source ?? "", l.Created?.slice(0, 10) ?? "", l["Follow-up Date"] ?? ""];
const table = (columns: string[], rows: string[][]): ChartTable => ({ columns, rows });

/** The charts under the Leads, Clients and Projects working views. */
export function PageCharts(props: Props) {
  const today = todayTT();
  const charts = useMemo(() => {
    if (props.page === "leads") {
      const { leads } = props;
      const s = leadsSummary(leads, today);
      const month = (label: string) => s.arrivedByMonth.find((m) => m.label === label)?.key ?? "";
      return [
        <SeriesChart key="stage" kind="bar" format="count" title="Leads at each stage" labelHeader="Stage"
          rows={leadsByStage(leads).map((x) => ({ label: x.name, leads: x.value }))} series={[{ key: "leads", name: "Leads" }]}
          records={(stage) => table(LEAD_COLS, leads.filter((l) => (l.Status ?? "New") === stage).map(leadRow))}
          description="How many leads sit at each step, from first contact to won or lost. A pile-up at one stage shows where deals stall." />,
        <Donut key="source" format="count" title="Where leads come from" data={s.bySource} centre="Leads"
          records={(src) => table(LEAD_COLS, leads.filter((l) => (src === OTHER ? !s.bySource.some((x) => x.name === sourceOf(l)) : sourceOf(l) === src)).map(leadRow))}
          description="Every lead by how it found Mindelo. Shows which channels are worth the effort. Click a slice to see those leads." />,
        <SeriesChart key="win" kind="line" format="percent" title="Win rate by the month leads came in" labelHeader="Month"
          rows={s.winRateByMonth} series={[{ key: "rate", name: "Win rate" }]}
          records={(label) => table(LEAD_COLS, leads.filter((l) => l.Created?.slice(0, 7) === month(label) && (l.Status === "Won" || l.Status === "Lost")).map(leadRow))}
          description="Of the leads that came in each month and have been decided (won or lost), the share that were won. Months with no decided leads show 0%." />,
        <SeriesChart key="new" kind="bar" format="count" title="New leads per month" labelHeader="Month"
          rows={s.arrivedByMonth} series={[{ key: "leads", name: "New leads" }]}
          records={(label) => table(LEAD_COLS, leads.filter((l) => l.Created?.slice(0, 7) === month(label)).map(leadRow))}
          description="How many leads came in each month, by the date they were added." />,
      ];
    }
    if (props.page === "clients") {
      const { clients, invoices, projects } = props;
      const s = clientsSummary(clients, invoices, projects, today);
      const nameOf = names(clients, projects);
      const shown = s.revenueTop.map((r) => r.name);
      const CL = ["Client", "Contact", "Status", "Added"];
      const clientRow = (c: Client) => [c.Company || c.Name, c.Company ? c.Name : "", c.Status ?? "", c.Created?.slice(0, 10) ?? ""];
      const month = (label: string) => s.newByMonth.find((m) => m.label === label)?.key ?? "";
      return [
        <RankedBars key="rev" title="Revenue per client (all time)" data={s.revenueTop} valueLabel="Paid revenue"
          records={(name) => table(["Invoice", "Client", "Paid", "Amount", "Notes"], invoices
            .filter((i) => i.Status === "Paid" && (name === OTHER ? !shown.includes(nameOf(i)) && nameOf(i) !== "No client" : nameOf(i) === name))
            .map((i) => [i["Invoice Number"] ?? "", nameOf(i), i["Paid Date"] ?? "", tt(i.Amount ?? 0), i.Notes ?? ""]))}
          description="Paid invoices per client since the business started; smaller clients are grouped as Everything else. Click a bar to see the invoices." />,
        <Donut key="status" format="count" title="Clients by status" data={s.byStatus} centre="Clients"
          records={(st) => table(CL, clients.filter((c) => (c.Status ?? "Not set") === st).map(clientRow))}
          description="Active clients are being worked for or billed now; inactive ones are past clients. Click a slice to see who." />,
        <SeriesChart key="new" kind="bar" format="count" title="New clients per month" labelHeader="Month"
          rows={s.newByMonth} series={[{ key: "clients", name: "New clients" }]}
          records={(label) => table(CL, clients.filter((c) => c.Created?.slice(0, 7) === month(label)).map(clientRow))}
          description="Clients added each month, by the date they were created in the dashboard." />,
      ];
    }
    const { projects, clients } = props;
    const s = projectsSummary(projects);
    const clientName = new Map(clients.map((c) => [c.id, c.Company || c.Name]));
    const PR = ["Project", "Client", "Stage", "Service type", "Value"];
    const projectRow = (p: Project) => [p.Name, (p.Client?.[0] && clientName.get(p.Client[0])) || (p.Internal ? "Internal" : ""), p.Status ?? "Lead", p["Service Type"] ?? "", tt(p["Total Value"] ?? 0)];
    const shownServices = s.byService.map((x) => x.name);
    return [
      <SeriesChart key="stage" kind="bar" format="count" title="Projects at each stage" labelHeader="Stage"
        rows={s.byStage} series={[{ key: "projects", name: "Projects" }]}
        records={(st) => table(PR, projects.filter((p) => (p.Status ?? "Lead") === st).map(projectRow))}
        description="How many projects are at each stage, from lead to done. Click a bar to see them." />,
      <Donut key="service" format="count" title="Projects by service type" data={s.byService} centre="Projects"
        records={(t) => table(PR, projects.filter((p) => (t === OTHER ? !shownServices.includes(p["Service Type"] || "Unspecified") : (p["Service Type"] || "Unspecified") === t)).map(projectRow))}
        description="What kind of work the projects are. Click a slice to see them." />,
      <SeriesChart key="value" kind="bar" title="Value of work at each stage" labelHeader="Stage"
        rows={s.byStage} series={[{ key: "value", name: "Total value" }]}
        records={(st) => table(PR, projects.filter((p) => (p.Status ?? "Lead") === st).map(projectRow))}
        description={`The total value of the projects at each stage (${PROJECT_STAGES.join(", ")}). Money in Lead is possible work; In Progress and Review is work being delivered.`} />,
    ];
  }, [props, today]);

  return (
    <section aria-label="Charts" className="space-y-3">
      <h2 className="text-[15px] font-semibold text-[#1B2533]">Charts</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{charts}</div>
    </section>
  );
}
