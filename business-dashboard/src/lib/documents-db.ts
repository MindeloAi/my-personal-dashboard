// Deals, documents, versions, attachments and activity (migration 022).
// Plain SQL, snake_case rows mapped once, like timeline-db.ts. The rules live
// in lib/documents.ts; this file applies them inside transactions.
import type { Sql, TransactionSql } from "postgres";
import { getSql } from "./db";
import {
  REFERENCE_RE,
  canMove,
  mergeSections,
  missingFacts,
  scheduleProblem,
  type Attachable,
  type CarePlan,
  type DocStatus,
  type DocType,
  type FileKind,
  type Payee,
  type ScheduleLine,
  type Section,
} from "./documents";

/** A rule was broken (bad status move, missing fact, schedule mismatch). Safe to show to a founder. */
export class DocumentRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentRuleError";
  }
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = Sql | TransactionSql;
type Via = "dashboard" | "claude";
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));
const iso = (v: unknown) => new Date(v as string).toISOString();

// ─── Types ────────────────────────────────────────────────────────────────────

export type Deal = {
  id: string;
  projectId: string | null;
  reference: string;
  scope: string[];
  priceTotal: number | null;
  currency: string;
  paymentSchedule: ScheduleLine[];
  carePlan: CarePlan | null;
  deadline: string | null;
  goals: string | null;
  notes: string | null;
  payeeDefault: Payee | null;
  updatedBy: string;
  updatedVia: Via;
  updated: string;
};
export type DealInput = Omit<Deal, "id" | "currency" | "updatedBy" | "updatedVia" | "updated"> & { projectId: string };

export type DocumentVersion = {
  id: string;
  version: number;
  title: string;
  sections: Section[];
  pdfPath: string | null;
  finalisedBy: string;
  finalisedAt: string;
};
export type Doc = {
  id: string;
  type: DocType;
  clientId: string | null;
  projectId: string | null;
  dealId: string | null;
  invoiceId: string | null;
  title: string;
  status: DocStatus;
  draft: Section[];
  currentVersion: number;
  updatedBy: string;
  updatedVia: Via;
  created: string;
  updated: string;
};
export type DocWithVersions = Doc & { versions: DocumentVersion[] };

export type Attachment = {
  id: string;
  entityType: Attachable;
  entityId: string;
  storagePath: string;
  filename: string;
  contentType: string;
  size: number;
  kind: FileKind;
  uploadedBy: string;
  created: string;
};

export type Activity = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  actor: string;
  via: Via;
  created: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toDeal(r: Row): Deal {
  return {
    id: String(r.id),
    projectId: str(r.project_id),
    reference: r.reference,
    scope: r.scope ?? [],
    priceTotal: num(r.price_total),
    currency: r.currency,
    paymentSchedule: (r.payment_schedule ?? []).map((l: Row) => ({ label: l.label, amount: Number(l.amount), trigger: l.trigger })),
    carePlan: r.care_plan ?? null,
    deadline: r.deadline ? String(r.deadline).slice(0, 10) : null,
    goals: r.goals,
    notes: r.notes,
    payeeDefault: r.payee_default,
    updatedBy: r.updated_by,
    updatedVia: r.updated_via,
    updated: iso(r.updated),
  };
}

function toDoc(r: Row): Doc {
  return {
    id: String(r.id),
    type: r.type,
    clientId: str(r.client_id),
    projectId: str(r.project_id),
    dealId: str(r.deal_id),
    invoiceId: str(r.invoice_id),
    title: r.title,
    status: r.status,
    draft: r.draft ?? [],
    currentVersion: Number(r.current_version),
    updatedBy: r.updated_by,
    updatedVia: r.updated_via,
    created: iso(r.created),
    updated: iso(r.updated),
  };
}

function toVersion(r: Row): DocumentVersion {
  return {
    id: String(r.id),
    version: Number(r.version),
    title: r.title,
    sections: r.sections ?? [],
    pdfPath: r.pdf_path,
    finalisedBy: r.finalised_by,
    finalisedAt: iso(r.finalised_at),
  };
}

function toAttachment(r: Row): Attachment {
  return {
    id: String(r.id),
    entityType: r.entity_type,
    entityId: String(r.entity_id),
    storagePath: r.storage_path,
    filename: r.filename,
    contentType: r.content_type,
    size: Number(r.size),
    kind: r.kind,
    uploadedBy: r.uploaded_by,
    created: iso(r.created),
  };
}

function toActivity(r: Row): Activity {
  return {
    id: String(r.id),
    entityType: r.entity_type,
    entityId: String(r.entity_id),
    action: r.action,
    summary: r.summary,
    actor: r.actor,
    via: r.via,
    created: iso(r.created),
  };
}

// ─── Activity ─────────────────────────────────────────────────────────────────

/** The client a record belongs to, so every activity row can appear on the client file. */
async function clientOf(tx: Db, entityType: string, id: string): Promise<string | null> {
  const q =
    entityType === "client" ? tx`select ${id}::uuid as c`
    : entityType === "project" ? tx`select client_id as c from projects where id = ${id}`
    : entityType === "deal" ? tx`select p.client_id as c from deals d join projects p on p.id = d.project_id where d.id = ${id}`
    : entityType === "document" ? tx`select coalesce(d.client_id, p.client_id) as c from documents d left join projects p on p.id = d.project_id where d.id = ${id}`
    : entityType === "invoice" ? tx`select coalesce(i.client_id, p.client_id) as c from invoices i left join projects p on p.id = i.project_id where i.id = ${id}`
    : null;
  if (!q) return null;
  const [row] = await q;
  return row ? str(row.c) : null;
}

async function log(tx: Db, a: { entityType: string; entityId: string; action: string; summary: string; actor: string; via: Via; clientEntity?: { type: string; id: string } }) {
  const target = a.clientEntity ?? { type: a.entityType, id: a.entityId };
  const clientId = await clientOf(tx, target.type, target.id);
  await tx`
    insert into activity (entity_type, entity_id, client_id, action, summary, actor, via)
    values (${a.entityType}, ${a.entityId}, ${clientId}, ${a.action}, ${a.summary}, ${a.actor}, ${a.via})`;
}

export async function getClientActivity(clientId: string, limit = 50): Promise<Activity[]> {
  const sql = getSql();
  const rows = await sql`select * from activity where client_id = ${clientId} order by created desc limit ${limit}`;
  return rows.map(toActivity);
}

export async function getEntityActivity(entityType: string, entityId: string, limit = 50): Promise<Activity[]> {
  const sql = getSql();
  const rows = await sql`
    select * from activity where entity_type = ${entityType} and entity_id = ${entityId}
     order by created desc limit ${limit}`;
  return rows.map(toActivity);
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export async function getDealByProject(projectId: string): Promise<Deal | null> {
  const sql = getSql();
  const [row] = await sql`select * from deals where project_id = ${projectId}`;
  return row ? toDeal(row) : null;
}

export async function getDealsForClient(clientId: string): Promise<Deal[]> {
  const sql = getSql();
  const rows = await sql`
    select d.* from deals d join projects p on p.id = d.project_id
     where p.client_id = ${clientId} order by d.reference`;
  return rows.map(toDeal);
}

export async function getAllReferences(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`select reference from deals`;
  return rows.map((r) => r.reference as string);
}

/** Create or update the deal for a project (one per project). */
export async function saveDeal(input: DealInput, actor: string, via: Via = "dashboard"): Promise<Deal> {
  if (!REFERENCE_RE.test(input.reference)) throw new DocumentRuleError("The reference must look like IB-2026-01");
  const problem = scheduleProblem(input.priceTotal, input.paymentSchedule);
  if (problem) throw new DocumentRuleError(problem);
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      insert into deals (project_id, reference, scope, price_total, payment_schedule, care_plan, deadline, goals, notes,
                         payee_default, created_by, updated_by, updated_via)
      values (${input.projectId}, ${input.reference}, ${input.scope}, ${input.priceTotal},
              ${tx.json(input.paymentSchedule)}, ${input.carePlan ? tx.json(input.carePlan) : null},
              ${input.deadline}, ${input.goals}, ${input.notes}, ${input.payeeDefault}, ${actor}, ${actor}, ${via})
      on conflict (project_id) do update set
        reference = excluded.reference, scope = excluded.scope, price_total = excluded.price_total,
        payment_schedule = excluded.payment_schedule, care_plan = excluded.care_plan, deadline = excluded.deadline,
        goals = excluded.goals, notes = excluded.notes, payee_default = excluded.payee_default,
        updated_by = excluded.updated_by, updated_via = excluded.updated_via, updated = now()
      returning *, (xmax = 0) as inserted`;
    const deal = toDeal(row);
    await log(tx, {
      entityType: "deal", entityId: deal.id, action: row.inserted ? "created" : "updated",
      summary: `${row.inserted ? "Deal created" : "Deal updated"}: ${deal.reference}`, actor, via,
    });
    return deal;
  });
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function listDocuments(f: { clientId?: string; projectId?: string; type?: DocType; status?: DocStatus } = {}): Promise<Doc[]> {
  const sql = getSql();
  const rows = await sql`
    select * from documents
     where (${f.clientId ?? null}::uuid is null or client_id = ${f.clientId ?? null}::uuid)
       and (${f.projectId ?? null}::uuid is null or project_id = ${f.projectId ?? null}::uuid)
       and (${f.type ?? null}::text is null or type = ${f.type ?? null}::text)
       and (${f.status ?? null}::text is null or status = ${f.status ?? null}::text)
     order by updated desc`;
  return rows.map(toDoc);
}

export async function getDocument(id: string): Promise<DocWithVersions | null> {
  const sql = getSql();
  const [row] = await sql`select * from documents where id = ${id}`;
  if (!row) return null;
  const versions = await sql`select * from document_versions where document_id = ${id} order by version`;
  return { ...toDoc(row), versions: versions.map(toVersion) };
}

export async function createDocument(
  input: { type: DocType; title: string; clientId: string | null; projectId: string | null; dealId: string | null; invoiceId: string | null; sections: Section[] },
  actor: string,
  via: Via = "dashboard",
): Promise<Doc> {
  if (!input.title.trim()) throw new DocumentRuleError("A document needs a title");
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      insert into documents (type, title, client_id, project_id, deal_id, invoice_id, draft, created_by, updated_by, updated_via)
      values (${input.type}, ${input.title.trim()}, ${input.clientId}, ${input.projectId}, ${input.dealId}, ${input.invoiceId},
              ${tx.json(input.sections)}, ${actor}, ${actor}, ${via})
      returning *`;
    const doc = toDoc(row);
    await log(tx, { entityType: "document", entityId: doc.id, action: "created", summary: `${doc.title} drafted`, actor, via });
    return doc;
  });
}

async function lockDoc(tx: Db, id: string): Promise<Doc> {
  const [row] = await tx`select * from documents where id = ${id} for update`;
  if (!row) throw new DocumentRuleError("That document no longer exists");
  return toDoc(row);
}

/** Replace some sections of a draft. A finalised or sent document goes back to draft; its versions stay frozen. */
export async function saveDraftSections(id: string, changes: Section[], actor: string, via: Via = "dashboard"): Promise<Doc> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (doc.status !== "draft" && !canMove(doc.status, "draft"))
      throw new DocumentRuleError(`A ${doc.status} document cannot be edited`);
    const draft = mergeSections(doc.draft, changes);
    const [row] = await tx`
      update documents set draft = ${tx.json(draft)}, status = 'draft', updated_by = ${actor}, updated_via = ${via}, updated = now()
       where id = ${id} returning *`;
    await log(tx, {
      entityType: "document", entityId: id, action: "edited",
      summary: `${doc.title}: changed ${changes.map((c) => c.heading).join(", ")}`, actor, via,
    });
    return toDoc(row);
  });
}

/** Freeze the draft as the next version. Refused while any {{missing: …}} remains. */
export async function finaliseDocument(id: string, actor: string, via: Via = "dashboard"): Promise<DocumentVersion> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (!canMove(doc.status, "finalised")) throw new DocumentRuleError(`A ${doc.status} document cannot be finalised`);
    if (doc.draft.length === 0) throw new DocumentRuleError("An empty document cannot be finalised");
    const missing = missingFacts(doc.draft);
    if (missing.length) throw new DocumentRuleError(`Still missing: ${missing.join(", ")}`);
    const version = doc.currentVersion + 1;
    const [v] = await tx`
      insert into document_versions (document_id, version, title, sections, finalised_by)
      values (${id}, ${version}, ${doc.title}, ${tx.json(doc.draft)}, ${actor}) returning *`;
    await tx`
      update documents set status = 'finalised', current_version = ${version}, updated_by = ${actor}, updated_via = ${via}, updated = now()
       where id = ${id}`;
    await log(tx, { entityType: "document", entityId: id, action: "finalised", summary: `${doc.title} finalised as v${version}`, actor, via });
    return toVersion(v);
  });
}

/** Sent, accepted, declined, signed or void. Draft and finalised only happen through editing and finalising. */
export async function setDocumentStatus(id: string, to: DocStatus, actor: string, via: Via = "dashboard"): Promise<Doc> {
  if (to === "draft" || to === "finalised") throw new DocumentRuleError("Edit or finalise the document instead");
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (!canMove(doc.status, to)) throw new DocumentRuleError(`A document cannot go from ${doc.status} to ${to}`);
    const [row] = await tx`
      update documents set status = ${to}, updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${id} returning *`;
    await log(tx, { entityType: "document", entityId: id, action: to, summary: `${doc.title} marked ${to}`, actor, via });
    return toDoc(row);
  });
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function listAttachments(entityType: Attachable, ids: string[]): Promise<Attachment[]> {
  if (ids.length === 0) return [];
  const sql = getSql();
  const rows = await sql`
    select * from attachments where entity_type = ${entityType} and entity_id in ${sql(ids)} order by created desc`;
  return rows.map(toAttachment);
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const sql = getSql();
  const [row] = await sql`select * from attachments where id = ${id}`;
  return row ? toAttachment(row) : null;
}

/**
 * Record a file already uploaded to Storage. A signed copy attached to a
 * finalised, sent or accepted document marks that document signed.
 */
export async function addAttachment(
  a: { entityType: Attachable; entityId: string; storagePath: string; filename: string; contentType: string; size: number; kind: FileKind },
  actor: string,
  via: Via = "dashboard",
): Promise<Attachment> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      insert into attachments (entity_type, entity_id, storage_path, filename, content_type, size, kind, uploaded_by)
      values (${a.entityType}, ${a.entityId}, ${a.storagePath}, ${a.filename}, ${a.contentType}, ${a.size}, ${a.kind}, ${actor})
      returning *`;
    const att = toAttachment(row);
    await log(tx, {
      entityType: "attachment", entityId: att.id, action: "attached", summary: `${att.filename} attached`, actor, via,
      clientEntity: { type: a.entityType, id: a.entityId },
    });
    if (a.entityType === "document" && a.kind === "signed_copy") {
      const doc = await lockDoc(tx, a.entityId);
      if (canMove(doc.status, "signed")) {
        await tx`update documents set status = 'signed', updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${doc.id}`;
        await log(tx, { entityType: "document", entityId: doc.id, action: "signed", summary: `${doc.title} signed (copy attached)`, actor, via });
      }
    }
    return att;
  });
}

/** Remove the record and return its Storage path, so the caller can delete the file. */
export async function deleteAttachment(id: string, actor: string, via: Via = "dashboard"): Promise<string | null> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`delete from attachments where id = ${id} returning *`;
    if (!row) return null;
    const att = toAttachment(row);
    await log(tx, {
      entityType: "attachment", entityId: att.id, action: "removed", summary: `${att.filename} removed`, actor, via,
      clientEntity: { type: att.entityType, id: att.entityId },
    });
    return att.storagePath;
  });
}
