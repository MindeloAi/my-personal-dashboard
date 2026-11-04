import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getClients, getInvoices, getLeads, getProject, getProjects } from "@/lib/db";
import { getAllReferences, getDealByProject, getEntityActivity, listAttachments, listDocuments } from "@/lib/documents-db";
import { nextReference, suggestPrefix } from "@/lib/documents";
import { href } from "@/lib/record-graph";
import { PageHeader } from "@/components/dashboard/explain";
import { LinkedRecords } from "@/components/dashboard/linked-records";
import { DealCard } from "@/components/dashboard/deal-card";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";
import { today } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  if (!z.uuid().safeParse(id).success) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  const [deal, docs, files, activity, references, clients, leads, projects, invoices] = await Promise.all([
    getDealByProject(id),
    listDocuments({ projectId: id }),
    listAttachments("project", [id]),
    getEntityActivity("project", id),
    getAllReferences(),
    getClients(),
    getLeads(),
    getProjects(),
    getInvoices(),
  ]);
  const client = clients.find((c) => c.id === project.Client?.[0]);
  const clientName = client ? client.Company || client.Name : project.Name;
  const suggestedReference = nextReference(suggestPrefix(clientName), Number(today().slice(0, 4)), references);
  const names: Record<string, string> = { [id]: project.Name, ...(client ? { [client.id]: clientName } : {}) };

  return (
    <div className="space-y-3">
      <Link href="/admin/projects" className="text-xs text-[#5A6678] hover:text-[#334155]">All projects</Link>
      <PageHeader
        title={project.Name}
        purpose={`${project.Status ?? "No status"}${project["Service Type"] ? ` · ${project["Service Type"]}` : ""}. The deal, documents, invoices and files for this project.`}
      />
      <LinkedRecords kind="project" id={id} graph={{ clients, leads, projects, invoices }} hide={["projects"]} />
      {(project["GitHub Repo URL"] || project["Deploy URL"]) && (
        <p className="flex flex-wrap gap-4 text-xs">
          {project["GitHub Repo URL"] && <a className="font-medium text-[#1D4ED8] hover:underline" href={project["GitHub Repo URL"]} target="_blank" rel="noopener">Code on GitHub</a>}
          {project["Deploy URL"] && <a className="font-medium text-[#1D4ED8] hover:underline" href={project["Deploy URL"]} target="_blank" rel="noopener">Live site</a>}
        </p>
      )}
      <DealCard projectId={id} deal={deal} suggestedReference={suggestedReference} />
      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Documents</h2>
        <DocumentsTable docs={docs} names={names} showClient={false} />
      </section>
      <FilesPanel entityType="project" entityId={id} files={files} defaultKind="asset" />
      <ActivityList items={activity} />
      {client && <p className="text-xs"><Link className="font-medium text-[#1D4ED8] hover:underline" href={href.client(client.id)}>Open {clientName}&apos;s client file</Link></p>}
    </div>
  );
}
