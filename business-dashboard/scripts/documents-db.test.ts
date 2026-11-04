// documents-db.test.ts — acceptance checks for migration 022 and documents-db.ts.
//
// Runs against the THROWAWAY database from plan Task 1 (container docs-pg,
// port 55433). It deletes rows, so it refuses anything that is not localhost.
//
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/documents-db.test.ts

import postgres from "postgres";
import {
  addAttachment,
  createDocument,
  deleteAttachment,
  finaliseDocument,
  getClientActivity,
  getDealByProject,
  getDocument,
  getEntityActivity,
  listAttachments,
  listDocuments,
  saveDeal,
  saveDraftSections,
  setDocumentStatus,
  DocumentRuleError,
} from "../src/lib/documents-db";
import { closeDb } from "../src/lib/db";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost. This script deletes data.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const ME = "founder@example.com";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
async function rejects(name: string, fn: () => Promise<unknown>, re: RegExp) {
  try {
    await fn();
    check(name, false, "did not throw");
  } catch (e) {
    check(name, re.test(String((e as Error).message)), String((e as Error).message));
  }
}

async function reset() {
  // activity and document_versions are protected by triggers; disable them for the wipe only.
  await sql.begin(async (tx) => {
    await tx`alter table activity disable trigger activity_append_only`;
    await tx`alter table document_versions disable trigger document_versions_frozen`;
    await tx`delete from activity`;
    await tx`delete from attachments`;
    await tx`delete from document_versions`;
    await tx`delete from documents`;
    await tx`delete from deals`;
    await tx`delete from projects where name like 'TEST %'`;
    await tx`delete from clients where name like 'TEST %'`;
    await tx`alter table activity enable trigger activity_append_only`;
    await tx`alter table document_versions enable trigger document_versions_frozen`;
  });
}

try {
  await reset();
  const [client] = await sql`insert into clients (name, company) values ('TEST Andrea', 'TEST Island Bites') returning id`;
  const [project] = await sql`insert into projects (name, client_id) values ('TEST Site', ${client.id}) returning id`;
  const clientId = String(client.id);
  const projectId = String(project.id);

  // Deals
  const deal = await saveDeal({
    projectId,
    reference: "IB-2026-01",
    scope: ["Five pages", "Pickup ordering"],
    priceTotal: 6500,
    paymentSchedule: [
      { label: "Payment 1", amount: 3250, trigger: "On acceptance" },
      { label: "Payment 2", amount: 3250, trigger: "On handover" },
    ],
    carePlan: { monthlyAmount: 800, minimumMonths: 3, noticeDays: 30, inclusions: ["Hosting"], exclusions: ["New features"] },
    deadline: "2026-12-19",
    goals: null,
    notes: null,
    payeeDefault: null,
  }, ME);
  check("deal saved", deal.reference === "IB-2026-01" && deal.priceTotal === 6500);
  const again = await saveDeal({ ...deal, projectId, notes: "She asked about a gallery" }, ME);
  check("saving the same project updates, not duplicates", again.id === deal.id && again.notes === "She asked about a gallery");
  check("getDealByProject", (await getDealByProject(projectId))?.id === deal.id);
  await rejects("schedule that does not add up is refused", () =>
    saveDeal({ ...deal, projectId, paymentSchedule: [{ label: "P1", amount: 100, trigger: "x" }] }, ME), /add up/);
  await rejects("bad reference is refused", () => saveDeal({ ...deal, projectId, reference: "nope" }, ME), /reference/i);
  const [second] = await sql`insert into projects (name, client_id) values ('TEST Second', ${client.id}) returning id`;
  await rejects("a reference used by another deal is refused", () =>
    saveDeal({ ...deal, projectId: String(second.id) }, ME), /already used/);

  // Documents
  const doc = await createDocument({
    type: "proposal",
    title: "Proposal IB-2026-01",
    clientId,
    projectId,
    dealId: deal.id,
    invoiceId: null,
    sections: [
      { key: "intro", heading: "Introduction", body: "For {{missing: client address}}" },
      { key: "fees", heading: "Fees", body: "TT$6,500" },
    ],
  }, ME);
  check("document created as draft v0", doc.status === "draft" && doc.currentVersion === 0);
  await rejects("finalising with a missing fact is refused", () => finaliseDocument(doc.id, ME), /client address/);

  await saveDraftSections(doc.id, [{ key: "intro", heading: "Introduction", body: "For 1 Main Street" }], ME);
  const v1 = await finaliseDocument(doc.id, ME);
  check("finalise makes v1", v1.version === 1);
  let full = await getDocument(doc.id);
  check("document is finalised at v1", full?.status === "finalised" && full.currentVersion === 1 && full.versions.length === 1);

  await setDocumentStatus(doc.id, "sent", ME);
  await saveDraftSections(doc.id, [{ key: "fees", heading: "Fees", body: "TT$6,000" }], ME);
  full = await getDocument(doc.id);
  check("editing a sent document returns it to draft and keeps v1", full?.status === "draft" && full.versions[0].sections[1].body === "TT$6,500");
  await finaliseDocument(doc.id, ME);
  full = await getDocument(doc.id);
  check("second finalise makes v2", full?.currentVersion === 2 && full.versions.length === 2);

  await rejects("versions cannot be edited in the database", () =>
    sql`update document_versions set title = 'x' where document_id = ${doc.id}`, /cannot be changed/);
  await rejects("versions cannot be deleted", () =>
    sql`delete from document_versions where document_id = ${doc.id}`, /cannot be deleted/);
  await rejects("draft to sent is refused (must finalise)", async () => {
    const d2 = await createDocument({ type: "quote", title: "Q", clientId, projectId, dealId: null, invoiceId: null, sections: [] }, ME);
    await setDocumentStatus(d2.id, "sent", ME);
  }, /cannot go from draft to sent/);

  // Attachments: a signed copy on a sent document marks it signed
  await setDocumentStatus(doc.id, "sent", ME);
  await rejects("signed cannot be set directly", () => setDocumentStatus(doc.id, "signed", ME), /signed copy/);
  const att = await addAttachment({
    entityType: "document", entityId: doc.id, storagePath: `document/${doc.id}/a1`,
    filename: "signed.pdf", contentType: "application/pdf", size: 1234, kind: "signed_copy",
  }, ME);
  full = await getDocument(doc.id);
  check("signed copy marks the document signed", full?.status === "signed");
  await rejects("signed document cannot be edited", () =>
    saveDraftSections(doc.id, [{ key: "fees", heading: "Fees", body: "x" }], ME), /signed/);
  await rejects("a signed document cannot be changed in the database", () =>
    sql`update documents set title = 'x' where id = ${doc.id}`, /cannot be changed/);
  await rejects("a signed document cannot be moved to another project", () =>
    sql`update documents set project_id = ${second.id} where id = ${doc.id}`, /cannot be changed/);
  {
    // Deleting a linked record still works: ON DELETE SET NULL may clear the link.
    const [p] = await sql`insert into projects (name, client_id) values ('TEST Gone', ${clientId}) returning id`;
    const [d] = await sql`insert into documents (type, title, project_id, status, created_by, updated_by)
                          values ('sop', 'TEST signed', ${p.id}, 'signed', ${ME}, ${ME}) returning id`;
    await sql`delete from projects where id = ${p.id}`;
    const [after] = await sql`select project_id from documents where id = ${d.id}`;
    check("deleting a project clears a signed document's link instead of failing", after.project_id === null);
  }
  check("listAttachments finds it", (await listAttachments("document", [doc.id])).length === 1);
  const removedPath = await deleteAttachment(att.id, ME);
  check("deleteAttachment returns the storage path", removedPath === `document/${doc.id}/a1`);
  await addAttachment({
    entityType: "project", entityId: projectId, storagePath: `project/${projectId}/a2`,
    filename: "brief.pdf", contentType: "application/pdf", size: 10, kind: "other",
  }, ME);
  check("attaching a file logs against the owning record", (await getEntityActivity("project", projectId)).length >= 1);

  // Lists and activity
  check("listDocuments by client", (await listDocuments({ clientId })).length === 2);
  const feed = await getClientActivity(clientId);
  check("activity recorded against the client", feed.length >= 6 && feed.every((a) => a.actor === ME));
  await rejects("activity is append-only", () => sql`delete from activity`, /append-only/);

  check("DocumentRuleError is exported", typeof DocumentRuleError === "function");
} finally {
  await reset();
  await sql.end();
  await closeDb();
}

console.log(failures ? `\n${failures} FAILED` : "\nAll documents-db checks pass");
process.exit(failures ? 1 : 0);
