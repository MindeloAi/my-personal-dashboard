import Link from "next/link";
import { href } from "@/lib/record-graph";
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL, type DocStatus } from "@/lib/documents";
import type { Doc } from "@/lib/documents-db";

const link = "font-medium text-[#1D4ED8] hover:underline";
const th = "border-b border-[#DCE1E8] px-3 py-2 text-left text-xs font-semibold text-[#4A5568]";
const td = "border-b border-[#EEF1F5] px-3 py-2";
const STATUS_TONE: Record<DocStatus, string> = {
  draft: "text-[#5A6678]", finalised: "text-[#1D4ED8]", sent: "text-[#1D4ED8]",
  accepted: "text-[#1E6B3A]", signed: "text-[#1E6B3A]", declined: "text-[#B23A0A]", void: "text-[#6B7789] line-through",
};

/** Documents with every name a link. `names` maps client and project ids to display names. */
export function DocumentsTable({ docs, names, showClient = true }: { docs: Doc[]; names: Record<string, string>; showClient?: boolean }) {
  return (
    <div className="overflow-x-auto border border-[#DCE1E8] bg-white">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#F7F8FA]">
            <th className={th}>Document</th><th className={th}>Type</th>
            {showClient && <th className={th}>Client</th>}
            <th className={th}>Project</th><th className={th}>Status</th><th className={th}>Version</th><th className={th}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && <tr><td className={td} colSpan={showClient ? 7 : 6}>No documents yet.</td></tr>}
          {docs.map((d) => (
            <tr key={d.id}>
              <td className={td}><Link className={link} href={href.document(d.id)}>{d.title}</Link></td>
              <td className={td}>{DOC_TYPE_LABEL[d.type]}</td>
              {showClient && <td className={td}>{d.clientId ? <Link className={link} href={href.client(d.clientId)}>{names[d.clientId] ?? "Client"}</Link> : ""}</td>}
              <td className={td}>{d.projectId ? <Link className={link} href={href.project(d.projectId)}>{names[d.projectId] ?? "Project"}</Link> : ""}</td>
              <td className={`${td} font-medium ${STATUS_TONE[d.status]}`}>{DOC_STATUS_LABEL[d.status]}</td>
              <td className={td}>{d.currentVersion ? `v${d.currentVersion}` : "Not finalised"}</td>
              <td className={`${td} whitespace-nowrap text-[#5A6678]`}>{d.updated.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
