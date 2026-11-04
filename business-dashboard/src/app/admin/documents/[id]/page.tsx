import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getClientById, getProject } from "@/lib/db";
import { getDocument, getEntityActivity, listAttachments } from "@/lib/documents-db";
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL, missingFacts } from "@/lib/documents";
import { href } from "@/lib/record-graph";
import { PageHeader } from "@/components/dashboard/explain";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";
import { DocumentActions } from "./document-actions";

export const dynamic = "force-dynamic";
const link = "font-medium text-[#1D4ED8] hover:underline";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireAdminPage();
  if (!z.uuid().safeParse(id).success) notFound();
  const doc = await getDocument(id);
  if (!doc) notFound();
  const [client, project, files, activity] = await Promise.all([
    doc.clientId ? getClientById(doc.clientId) : null,
    doc.projectId ? getProject(doc.projectId) : null,
    listAttachments("document", [id]),
    getEntityActivity("document", id),
  ]);

  const asked = Number(sp.version);
  const shown = doc.versions.find((v) => v.version === asked) ?? (doc.status === "draft" ? null : doc.versions.at(-1) ?? null);
  const sections = shown ? shown.sections : doc.draft;
  const missing = missingFacts(doc.draft);

  return (
    <div className="space-y-3">
      <Link href="/admin/documents" className="text-xs text-[#5A6678] hover:text-[#334155]">Documents</Link>
      <PageHeader
        title={doc.title}
        purpose={`${DOC_TYPE_LABEL[doc.type]} · ${DOC_STATUS_LABEL[doc.status]} · ${doc.currentVersion ? `latest version v${doc.currentVersion}` : "never finalised"}`}
        action={<DocumentActions id={id} status={doc.status} missing={missing} />}
      />
      <p className="flex flex-wrap gap-x-4 text-xs text-[#4A5568]">
        {client && <span>Client <Link className={link} href={href.client(client.id)}>{client.Company || client.Name}</Link></span>}
        {project && <span>Project <Link className={link} href={href.project(project.id)}>{project.Name}</Link></span>}
        {doc.invoiceId && <span>Invoice <Link className={link} href={href.invoice(doc.invoiceId)}>open</Link></span>}
      </p>
      {doc.status === "draft" && missing.length > 0 && (
        <p className="border border-[#B23A0A]/30 bg-[#B23A0A]/5 p-3 text-sm text-[#B23A0A]">Still missing before it can be finalised: {missing.join(", ")}.</p>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_16rem]">
        <article className="border border-[#DCE1E8] bg-white p-4 sm:p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5A6678]">{shown ? `Version ${shown.version}, finalised ${shown.finalisedAt.slice(0, 10)}` : "Draft"}</p>
          {sections.length === 0 && <p className="text-sm text-[#6B7789]">Empty. Ask Claude to draft it.</p>}
          {sections.map((s) => (
            <section key={s.key} className="mb-4">
              <h2 className="text-[15px] font-semibold text-[#1B2533]">{s.heading}</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-[#1B2533]">{s.body}</p>
            </section>
          ))}
        </article>
        <aside className="border border-[#DCE1E8] bg-white p-4">
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Versions</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {doc.status === "draft" && <li><Link className={link} href={href.document(id)}>Current draft</Link></li>}
            {[...doc.versions].reverse().map((v) => (
              <li key={v.id}>
                <Link className={link} href={`${href.document(id)}?version=${v.version}`}>v{v.version}</Link>
                <span className="text-xs text-[#5A6678]"> · {v.finalisedAt.slice(0, 10)} · {v.finalisedBy.split("@")[0]}</span>
              </li>
            ))}
            {doc.versions.length === 0 && <li className="text-[#6B7789]">None yet</li>}
          </ul>
        </aside>
      </div>
      <FilesPanel entityType="document" entityId={id} files={files} defaultKind="signed_copy" />
      <ActivityList items={activity} />
    </div>
  );
}
