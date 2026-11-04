import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getProjects } from "@/lib/db";
import { listDocuments } from "@/lib/documents-db";
import { DOC_STATUSES, DOC_STATUS_LABEL, DOC_TYPES, DOC_TYPE_LABEL, type DocStatus, type DocType } from "@/lib/documents";
import { PageHeader, Explain } from "@/components/dashboard/explain";
import { DocumentsTable } from "@/components/dashboard/documents-table";

export const dynamic = "force-dynamic";

const chip = (on: boolean) =>
  `rounded-[4px] border px-2 py-1 text-xs ${on ? "border-[#1D4ED8] bg-[#1D4ED8] text-white" : "border-[#DCE1E8] bg-white text-[#334155] hover:bg-[#0E1A2B]/5"}`;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string; client?: string }> }) {
  const sp = await searchParams;
  await requireAdminPage();
  const type = DOC_TYPES.includes(sp.type as DocType) ? (sp.type as DocType) : undefined;
  const status = DOC_STATUSES.includes(sp.status as DocStatus) ? (sp.status as DocStatus) : undefined;
  const clientId = sp.client && /^[0-9a-f-]{36}$/.test(sp.client) ? sp.client : undefined;
  const [docs, clients, projects] = await Promise.all([listDocuments({ type, status, clientId }), getClients(), getProjects()]);
  const names: Record<string, string> = Object.fromEntries([
    ...clients.map((c) => [c.id, c.Company || c.Name]),
    ...projects.map((p) => [p.id, p.Name]),
  ]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ type, status, client: clientId, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return `/admin/documents${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Documents" purpose="Every proposal, quote, agreement, care plan, change request, invoice document and SOP, with its status and version." />
      <Explain
        shows="One row per document. Drafts can still change; a finalised version is frozen."
        read="Open a document to see its versions, status history and files. Names open the client or project."
        watch="Documents sent but not yet accepted or signed."
      />
      <div className="flex flex-wrap gap-2">
        <Link className={chip(!type)} href={qs({ type: undefined })}>All types</Link>
        {DOC_TYPES.map((t) => <Link key={t} className={chip(type === t)} href={qs({ type: t })}>{DOC_TYPE_LABEL[t]}</Link>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={chip(!status)} href={qs({ status: undefined })}>Any status</Link>
        {DOC_STATUSES.map((s) => <Link key={s} className={chip(status === s)} href={qs({ status: s })}>{DOC_STATUS_LABEL[s]}</Link>)}
      </div>
      {clientId && <p className="text-xs text-[#4A5568]">Showing {names[clientId] ?? "one client"} only. <Link className="font-medium text-[#1D4ED8] hover:underline" href={qs({ client: undefined })}>Show all clients</Link></p>}
      <DocumentsTable docs={docs} names={names} />
    </div>
  );
}
