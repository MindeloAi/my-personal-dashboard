// connector-db.test.ts — search, client context and new client/project, against
// the THROWAWAY local database only (container docs-pg).
//   DATABASE_URL=postgres://postgres:pg@localhost:55433/postgres bun scripts/connector-db.test.ts
import postgres from "postgres";
import { createClientAndProject, findRecords, getClientContext } from "../src/lib/connector-db";
import { DocumentRuleError } from "../src/lib/documents-db";
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

async function reset() {
  await sql.begin(async (tx) => {
    await tx`alter table activity disable trigger activity_append_only`;
    await tx`delete from activity`;
    await tx`delete from deals where reference like 'TB-%' or reference like 'TA-%' or reference like 'TZ-%' or reference like 'TT-%'`;
    await tx`delete from projects where name like 'TEST %'`;
    await tx`delete from leads where name like 'TEST %'`;
    await tx`delete from clients where name like 'TEST %'`;
    await tx`alter table activity enable trigger activity_append_only`;
  });
}

try {
  await reset();
  const made = await createClientAndProject(
    { name: "TEST Andrea", company: "TEST Bites", email: "andrea@example.com", phone: null, asLead: false, projectName: "TEST Bites site" },
    ME,
  );
  check("client, project and empty deal created", !!made.clientId && !!made.projectId && /^TB-\d{4}-01$/.test(made.reference), made.reference);
  const [deal] = await sql`select price_total, payment_schedule from deals where project_id = ${made.projectId}`;
  check("the deal starts empty", deal.price_total === null && deal.payment_schedule.length === 0);

  try {
    await createClientAndProject({ name: "TEST andrea", company: null, email: null, phone: null, asLead: false, projectName: "TEST Other" }, ME);
    check("a duplicate client is refused", false, "did not throw");
  } catch (e) {
    check("a duplicate client is refused", e instanceof DocumentRuleError && /already/.test(e.message), String(e));
  }

  const lead = await createClientAndProject(
    { name: "TEST Lead Person", company: "TEST Acme", email: null, phone: null, asLead: true, projectName: "TEST Acme app" },
    ME,
  );
  const [leadRow] = await sql`select status from leads where id = ${lead.leadId}`;
  const [leadProject] = await sql`select lead_id, client_id, status from projects where id = ${lead.projectId}`;
  check("a lead gets a lead, a project on the lead, and a deal", leadRow?.status === "New" && String(leadProject.lead_id) === lead.leadId && leadProject.client_id === null && /^TA-\d{4}-01$/.test(lead.reference), lead.reference);

  const refused = async (name: string, fn: () => Promise<unknown>, re: RegExp) => {
    try {
      await fn();
      check(name, false, "did not throw");
    } catch (e) {
      check(name, e instanceof DocumentRuleError && re.test(e.message), String(e));
    }
  };
  // Duplicates are checked across clients and leads, and say which one exists.
  await refused("a lead named like an existing client is refused", () =>
    createClientAndProject({ name: "TEST Andrea", company: null, email: null, phone: null, asLead: true, projectName: "TEST X" }, ME),
    /TEST Andrea already exists as a client\. Use find/);
  await refused("a client with an existing lead's company is refused", () =>
    createClientAndProject({ name: "TEST Someone", company: "test acme", email: null, phone: null, asLead: false, projectName: "TEST X" }, ME),
    /TEST Lead Person already exists as a lead\. Use find/);

  // Email and phone are trimmed; blank becomes null.
  const trimmed = await createClientAndProject(
    { name: "TEST Trim", company: null, email: "  trim@example.com ", phone: "   ", asLead: false, projectName: "TEST Trim site" },
    ME,
  );
  const [trimRow] = await sql`select email, phone from clients where id = ${trimmed.clientId}`;
  check("email trimmed and blank phone stored as null", trimRow.email === "trim@example.com" && trimRow.phone === null, JSON.stringify(trimRow));

  // Two records made at once can pick the same reference; the loser gets a plain retry message.
  {
    const ref = `TZ-${new Date().getFullYear()}-01`;
    const [blocker] = await sql`insert into projects (name) values ('TEST blocker') returning id`;
    let inserted!: () => void;
    let release!: () => void;
    const didInsert = new Promise<void>((r) => (inserted = r));
    const gate = new Promise<void>((r) => (release = r));
    const held = sql.begin(async (tx) => {
      await tx`insert into deals (project_id, reference, created_by, updated_by) values (${blocker.id}, ${ref}, ${ME}, ${ME})`;
      inserted();
      await gate;
    });
    await didInsert;
    const racing = createClientAndProject({ name: "TEST Zed", company: "TEST Zulu", email: null, phone: null, asLead: false, projectName: "TEST Zulu site" }, ME);
    await new Promise((r) => setTimeout(r, 300)); // let it read the references and block on the unique index
    release();
    await held;
    await refused("a reference race becomes a retry message", () => racing, /Two records were created at once\. Try again\./);
  }

  const hits = await findRecords("test bit");
  check("find matches clients and projects by name, case-insensitive", hits.some((h) => h.kind === "client" && h.id === made.clientId) && hits.some((h) => h.kind === "project" && h.id === made.projectId));
  check("find matches a deal reference and returns its project id", (await findRecords(made.reference)).some((h) => h.kind === "deal" && h.id === made.projectId));
  check("find treats % as a literal", (await findRecords("%%")).length === 0);
  check("find ignores one-letter queries", (await findRecords("a")).length === 0);

  const ctx = await getClientContext(made.clientId!);
  check("client context has the project with its deal", ctx?.projects.length === 1 && ctx.projects[0].deal?.reference === made.reference);
  check("client context has the activity", (ctx?.activity.length ?? 0) >= 3);
  check("unknown client gives null", (await getClientContext("00000000-0000-0000-0000-000000000000")) === null);
} finally {
  await reset();
  await sql.end();
  await closeDb();
}
console.log(failures ? `\n${failures} FAILED` : "\nAll connector-db checks pass");
process.exit(failures ? 1 : 0);
