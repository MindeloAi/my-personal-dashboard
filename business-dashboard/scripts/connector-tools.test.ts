// connector-tools.test.ts — every connector tool, called as a function, against
// the THROWAWAY local database only.
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/connector-tools.test.ts
import postgres from "postgres";
import { z } from "zod";
import { TOOLS } from "../src/lib/connector/tools";
import { closeDb } from "../src/lib/db";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at localhost.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const ME = "founder@example.com";
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(name: string, args: unknown): Promise<any> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(tool.input.parse(args), ME);
}
async function refused(name: string, args: unknown, re: RegExp) {
  try {
    await call(name, args);
    check(`${name} refuses`, false, "did not throw");
  } catch (e) {
    check(`${name} refuses: ${re}`, re.test(String((e as Error).message)), String((e as Error).message));
  }
}

async function reset() {
  await sql.begin(async (tx) => {
    await tx`alter table activity disable trigger activity_append_only`;
    await tx`alter table document_versions disable trigger document_versions_frozen`;
    await tx`delete from activity`;
    await tx`delete from document_versions`;
    await tx`delete from documents`;
    await tx`delete from deals`;
    await tx`delete from invoices where project_id in (select id from projects where name like 'TEST %')`;
    await tx`delete from payee_accounts`;
    await tx`delete from projects where name like 'TEST %'`;
    await tx`delete from clients where name like 'TEST %'`;
    await tx`alter table activity enable trigger activity_append_only`;
    await tx`alter table document_versions enable trigger document_versions_frozen`;
  });
}

try {
  await reset();
  check("exactly the agreed tools", TOOLS.map((t) => t.name).sort().join(",") ===
    "create_client_and_project,create_invoice_from_deal,finalise_document,find,get_client_context,get_deal,get_document,list_documents,save_deal,save_draft,set_status");
  check("no em dashes in tool text", TOOLS.every((t) => !/\u2014/.test(t.title + t.description)));
  check("every tool input publishes as JSON Schema", TOOLS.every((t) => { try { z.toJSONSchema(t.input, { io: "input" }); return true; } catch { return false; } }));
  const cc = TOOLS.find((t) => t.name === "create_client_and_project")!.input;
  const trimmed = cc.parse({ name: "x", projectName: "y", email: "  a@example.com ", phone: " 123 " }) as { email: string; phone: string };
  check("email and phone are trimmed", trimmed.email === "a@example.com" && trimmed.phone === "123");
  check("a bad email is refused", !cc.safeParse({ name: "x", projectName: "y", email: "nope" }).success);
  check("a bad due date is refused", !TOOLS.find((t) => t.name === "create_invoice_from_deal")!.input.safeParse({ projectId: "11111111-1111-4111-8111-111111111111", line: 1, payee: "zane", dueDate: "2026-02-30" }).success);

  const made = await call("create_client_and_project", { name: "TEST Andrea", company: "TEST Bites", projectName: "TEST Bites site" });
  check("create_client_and_project", !!made.projectId && !!made.reference);
  check("find", (await call("find", { query: "test bites" })).some((h: { kind: string }) => h.kind === "client"));

  const deal = await call("save_deal", { projectId: made.projectId, priceTotal: 6500, scope: ["Five pages"],
    paymentSchedule: [{ label: "Payment 1", amount: 3250, trigger: "On acceptance" }, { label: "Payment 2", amount: 3250, trigger: "On handover" }] });
  check("save_deal merges into the existing deal and keeps its reference", deal.reference === made.reference && deal.priceTotal === 6500);
  const deal2 = await call("save_deal", { projectId: made.projectId, notes: "Asked about a gallery" });
  check("save_deal with one field keeps the rest", deal2.priceTotal === 6500 && deal2.notes === "Asked about a gallery" && deal2.paymentSchedule.length === 2);
  check("get_deal", (await call("get_deal", { projectId: made.projectId }))?.reference === made.reference);
  await refused("save_deal", { projectId: made.projectId, priceTotal: 100 }, /add up/);

  const draft = await call("save_draft", { type: "proposal", title: "Proposal TEST", projectId: made.projectId });
  check("save_draft creates from the template, linked to the client and deal", draft.status === "draft" && draft.draft.length === 5 && draft.clientId === made.clientId && !!draft.dealId);
  await refused("finalise_document", { documentId: draft.id }, /missing/i);
  await call("save_draft", { documentId: draft.id, sections: ["summary", "goals", "scope", "timeline", "next_steps"].map((key) => ({ key, heading: key, body: "Written." })) });
  await refused("save_draft", { type: "invoice", title: "x", projectId: made.projectId }, /create_invoice_from_deal/);

  const got = await call("get_document", { documentId: draft.id });
  check("get_document shows the draft and a preview link", got.draft[0].body === "Written." && /\/admin\/documents\/.+\/pdf$/.test(got.previewUrl));

  const fin = await call("finalise_document", { documentId: draft.id });
  // Storage is not configured in this test, so the PDF cannot be stored; the version must still be frozen.
  check("finalise_document freezes v1 even when the PDF cannot be stored", fin.version === 1 && typeof fin.pdfUrl === "string" && typeof fin.pdfNote === "string");
  check("set_status sent", (await call("set_status", { documentId: draft.id, status: "sent" })).status === "sent");
  // "signed" is not in the tool's enum, so the schema refuses it before run().
  await refused("set_status", { documentId: draft.id, status: "signed" }, /Invalid option/);

  const inv = await call("create_invoice_from_deal", { projectId: made.projectId, line: 1, payee: "zane" });
  check("create_invoice_from_deal", inv.document.payee === "zane" && !!inv.invoiceId);
  await refused("create_invoice_from_deal", { projectId: made.projectId, line: 2 }, /payee|Required|invalid/i);

  const ctx = await call("get_client_context", { clientId: made.clientId });
  check("get_client_context", ctx.projects[0].deal.reference === made.reference && ctx.documents.length === 2);
  check("no tool output carries bank details", !JSON.stringify(ctx).includes("account_number") && !JSON.stringify(inv).includes("accountNumber"));
  check("list_documents filters", (await call("list_documents", { clientId: made.clientId, type: "invoice" })).length === 1);
} finally {
  await reset();
  await sql.end();
  await closeDb();
}
console.log(failures ? `\n${failures} FAILED` : "\nAll connector-tools checks pass");
process.exit(failures ? 1 : 0);
