// What the Claude connector reads and creates beyond documents-db.ts: search
// across records, everything about one client, and a new client or lead with
// its project and an empty deal. Reuses db.ts and documents-db.ts loaders
// rather than writing new queries for the same data.
import postgres from "postgres";
import { getClientById, getInvoices, getProjects, getSql } from "./db";
import {
  DocumentRuleError,
  getClientActivity,
  getDealsForClient,
  listDocuments,
  logActivity,
  type Via,
} from "./documents-db";
import { nextReference, suggestPrefix } from "./documents";

export type Hit = { kind: "client" | "lead" | "project" | "deal" | "document"; id: string; name: string; detail: string };

/** Up to ten of each kind whose name (or deal reference) contains the query. A deal's id is its project's id. */
export async function findRecords(query: string): Promise<Hit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const sql = getSql();
  const rows = await sql`
    (select 'client' as kind, id, name, coalesce(company, '') as detail from clients
      where name ilike ${like} or company ilike ${like} limit 10)
    union all
    (select 'lead', id, name, coalesce(business_name, '') || ' (' || coalesce(status, 'New') || ')' from leads
      where name ilike ${like} or business_name ilike ${like} limit 10)
    union all
    (select 'project', id, name, coalesce(status, '') from projects where name ilike ${like} limit 10)
    union all
    (select 'deal', d.project_id, d.reference, coalesce(p.name, '') from deals d join projects p on p.id = d.project_id
      where d.reference ilike ${like} limit 10)
    union all
    (select 'document', id, title, type || ', ' || status from documents where title ilike ${like} limit 10)`;
  return rows.map((r) => ({ kind: r.kind, id: String(r.id), name: r.name, detail: r.detail }));
}

/** One client with projects (and each project's deal), documents, invoices and recent activity. Null if unknown. */
export async function getClientContext(clientId: string) {
  const client = await getClientById(clientId);
  if (!client) return null;
  const [projects, invoices, deals, documents, activity] = await Promise.all([
    getProjects(),
    getInvoices(),
    getDealsForClient(clientId),
    listDocuments({ clientId }),
    getClientActivity(clientId, 15),
  ]);
  return {
    client,
    projects: projects
      .filter((p) => p.Client?.[0] === clientId)
      .map((p) => ({ ...p, deal: deals.find((d) => d.projectId === p.id) ?? null })),
    documents: documents.map(({ draft: _draft, ...d }) => d), // eslint-disable-line @typescript-eslint/no-unused-vars
    invoices: invoices.filter((i) => i.Client?.[0] === clientId),
    activity,
  };
}

/**
 * A new client (or lead) with one project and an empty deal, in one transaction.
 * Refuses a name or company that already exists as a client or a lead, so Claude
 * finds it instead of making a duplicate. The project starts at status Lead; founders move it on.
 */
export async function createClientAndProject(
  input: { name: string; company: string | null; email: string | null; phone: string | null; asLead: boolean; projectName: string },
  actor: string,
  via: Via = "dashboard",
): Promise<{ clientId: string | null; leadId: string | null; projectId: string; reference: string }> {
  const name = input.name.trim();
  const company = input.company?.trim() || null;
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const projectName = input.projectName.trim();
  if (!name || !projectName) throw new DocumentRuleError("A name and a project name are needed");
  const sql = getSql();
  try {
    return await sql.begin(async (tx) => {
      const [dupe] = await tx`
        (select 'client' as kind, name from clients
          where lower(name) = lower(${name}) or (${company}::text is not null and lower(company) = lower(${company})) limit 1)
        union all
        (select 'lead', name from leads
          where lower(name) = lower(${name}) or (${company}::text is not null and lower(business_name) = lower(${company})) limit 1)`;
      if (dupe) throw new DocumentRuleError(`${dupe.name} already exists as a ${dupe.kind}. Use find to open it.`);

      let clientId: string | null = null;
      let leadId: string | null = null;
      if (input.asLead) {
        const [l] = await tx`
          insert into leads (name, business_name, email, phone_whatsapp, status, source)
          values (${name}, ${company}, ${email}, ${phone}, 'New', 'Claude') returning id`;
        leadId = String(l.id);
      } else {
        const [c] = await tx`
          insert into clients (name, company, email, phone, status)
          values (${name}, ${company}, ${email}, ${phone}, 'Active') returning id`;
        clientId = String(c.id);
      }
      const [p] = await tx`
        insert into projects (name, client_id, lead_id, status) values (${projectName}, ${clientId}, ${leadId}, 'Lead') returning id`;
      const projectId = String(p.id);

      const taken = (await tx`select reference from deals`).map((r) => r.reference as string);
      const reference = nextReference(suggestPrefix(company ?? name), new Date().getFullYear(), taken);
      const [d] = await tx`
        insert into deals (project_id, reference, created_by, updated_by, updated_via)
        values (${projectId}, ${reference}, ${actor}, ${actor}, ${via}) returning id`;

      if (clientId) await logActivity(tx, { entityType: "client", entityId: clientId, action: "created", summary: `${name} added`, actor, via });
      await logActivity(tx, { entityType: "project", entityId: projectId, action: "created", summary: `${projectName} added`, actor, via });
      await logActivity(tx, { entityType: "deal", entityId: String(d.id), action: "created", summary: `Deal created: ${reference}`, actor, via });
      return { clientId, leadId, projectId, reference };
    });
  } catch (e) {
    // Two records made at once can pick the same next reference.
    if (e instanceof postgres.PostgresError && e.code === "23505" && e.constraint_name === "deals_reference_key")
      throw new DocumentRuleError("Two records were created at once. Try again.");
    throw e;
  }
}
