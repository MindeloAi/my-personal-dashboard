// Deals, documents, versions, attachments and activity (migration 022).
// Plain SQL, snake_case rows mapped once, like timeline-db.ts. The rules live
// in lib/documents.ts; this file applies them inside transactions.
import postgres, { type Sql, type TransactionSql } from "postgres";
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
  PAYEE_LABEL,
} from "./documents";
import { INVOICE_DUE_DAYS, addDays, invoiceTypeFor, itemsProblem } from "./doc-templates";
import { today } from "./subscriptions";

/** A rule was broken (bad status move, missing fact, schedule mismatch). Safe to show to a founder. */
export class DocumentRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentRuleError";
  }
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Db = Sql | TransactionSql;
export type Via = "dashboard" | "claude";
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
  payee: Payee | null;
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
    payee: r.payee ?? null,
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

export async function logActivity(tx: Db, a: { entityType: string; entityId: string; action: string; summary: string; actor: string; via: Via }) {
  const clientId = await clientOf(tx, a.entityType, a.entityId);
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
  try {
    return await sql.begin(async (tx) => {
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
      await logActivity(tx, {
        entityType: "deal", entityId: deal.id, action: row.inserted ? "created" : "updated",
        summary: `${row.inserted ? "Deal created" : "Deal updated"}: ${deal.reference}`, actor, via,
      });
      return deal;
    });
  } catch (e) {
    if (e instanceof postgres.PostgresError && e.code === "23505" && e.constraint_name === "deals_reference_key")
      throw new DocumentRuleError(`${input.reference} is already used by another deal`);
    throw e;
  }
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function listDocuments(f: { clientId?: string; projectId?: string; invoiceId?: string; type?: DocType; status?: DocStatus } = {}): Promise<Doc[]> {
  const sql = getSql();
  const rows = await sql`
    select * from documents
     where (${f.clientId ?? null}::uuid is null or client_id = ${f.clientId ?? null}::uuid)
       and (${f.projectId ?? null}::uuid is null or project_id = ${f.projectId ?? null}::uuid)
       and (${f.invoiceId ?? null}::uuid is null or invoice_id = ${f.invoiceId ?? null}::uuid)
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
  input: { type: DocType; title: string; clientId: string | null; projectId: string | null; dealId: string | null; invoiceId: string | null; sections: Section[]; payee?: Payee | null },
  actor: string,
  via: Via = "dashboard",
): Promise<Doc> {
  if (!input.title.trim()) throw new DocumentRuleError("A document needs a title");
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      insert into documents (type, title, client_id, project_id, deal_id, invoice_id, payee, draft, created_by, updated_by, updated_via)
      values (${input.type}, ${input.title.trim()}, ${input.clientId}, ${input.projectId}, ${input.dealId}, ${input.invoiceId}, ${input.payee ?? null},
              ${tx.json(input.sections)}, ${actor}, ${actor}, ${via})
      returning *`;
    const doc = toDoc(row);
    await logActivity(tx, { entityType: "document", entityId: doc.id, action: "created", summary: `${doc.title} drafted`, actor, via });
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
    await logActivity(tx, {
      entityType: "document", entityId: id, action: "edited",
      summary: `${doc.title}: changed ${changes.map((c) => c.heading).join(", ")}`, actor, via,
    });
    return toDoc(row);
  });
}

/** Rules a template adds on top of "nothing missing". Runs inside the finalise transaction. */
async function checkTemplate(tx: Db, doc: Doc): Promise<void> {
  const items = doc.draft.find((s) => s.key === "items");
  if (doc.type === "quote" && items) {
    const p = itemsProblem(items.body, null);
    if (p) throw new DocumentRuleError(p);
  }
  if (doc.type !== "invoice") return;
  if (!items) throw new DocumentRuleError("An invoice needs an Items section");
  if (!doc.invoiceId) throw new DocumentRuleError("This invoice document is not linked to an invoice");
  if (!doc.payee) throw new DocumentRuleError("Choose who is being paid (Michael, Zane or the company account) first");
  const [acct] = await tx`select 1 from payee_accounts where payee = ${doc.payee}`;
  if (!acct) throw new DocumentRuleError(`Bank details for ${PAYEE_LABEL[doc.payee]} are not saved yet (Documents, Bank details)`);
  const [inv] = await tx`select amount, status from invoices where id = ${doc.invoiceId} for update`;
  if (!inv) throw new DocumentRuleError("The linked invoice no longer exists");
  if (inv.status === "Void") throw new DocumentRuleError("The linked invoice is void");
  if (inv.status == null) throw new DocumentRuleError("Set the invoice's status in Finance first");
  if (inv.amount == null) throw new DocumentRuleError("The linked invoice has no amount");
  const p = itemsProblem(items.body, Number(inv.amount));
  if (p) throw new DocumentRuleError(p);
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
    await checkTemplate(tx, doc);
    const version = doc.currentVersion + 1;
    const [v] = await tx`
      insert into document_versions (document_id, version, title, sections, finalised_by)
      values (${id}, ${version}, ${doc.title}, ${tx.json(doc.draft)}, ${actor}) returning *`;
    await tx`
      update documents set status = 'finalised', current_version = ${version}, updated_by = ${actor}, updated_via = ${via}, updated = now()
       where id = ${id}`;
    // A finalised invoice is the one the client receives, so it needs its number.
    // The database numbers an invoice the first time it is Sent (migration 019).
    if (doc.type === "invoice" && doc.invoiceId) {
      const [issued] = await tx`
        update invoices set status = 'Sent' where id = ${doc.invoiceId} and status = 'Draft' returning invoice_number`;
      if (issued) await logActivity(tx, {
        entityType: "invoice", entityId: doc.invoiceId, action: "sent",
        summary: `${issued.invoice_number} issued with ${doc.title}`, actor, via,
      });
    }
    await logActivity(tx, { entityType: "document", entityId: id, action: "finalised", summary: `${doc.title} finalised as v${version}`, actor, via });
    return toVersion(v);
  });
}

/** Sent, accepted, declined or void. Draft and finalised only happen through editing and finalising; signed only by attaching the signed copy. */
export async function setDocumentStatus(id: string, to: DocStatus, actor: string, via: Via = "dashboard"): Promise<Doc> {
  if (to === "draft" || to === "finalised") throw new DocumentRuleError("Edit or finalise the document instead");
  if (to === "signed") throw new DocumentRuleError("Attach the signed copy to mark it signed");
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (!canMove(doc.status, to)) throw new DocumentRuleError(`A document cannot go from ${doc.status} to ${to}`);
    const [row] = await tx`
      update documents set status = ${to}, updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${id} returning *`;
    await logActivity(tx, { entityType: "document", entityId: id, action: to, summary: `${doc.title} marked ${to}`, actor, via });
    return toDoc(row);
  });
}

/** Who is being paid on an invoice document. Only while it is a draft: the bank details on a finalised PDF never change. */
export async function setDocumentPayee(id: string, payee: Payee, actor: string, via: Via = "dashboard"): Promise<Doc> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const doc = await lockDoc(tx, id);
    if (doc.type !== "invoice") throw new DocumentRuleError("Only invoices have a payee");
    if (doc.status !== "draft") throw new DocumentRuleError("Change the payee while the invoice is a draft");
    const [row] = await tx`
      update documents set payee = ${payee}, updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${id} returning *`;
    await logActivity(tx, { entityType: "document", entityId: id, action: "payee", summary: `${doc.title}: paid to ${PAYEE_LABEL[payee]}`, actor, via });
    return toDoc(row);
  });
}

/** Record where a version's PDF is stored. Only the first call writes; returns whether it did. */
export async function setVersionPdf(documentId: string, version: number, path: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    update document_versions set pdf_path = ${path}
     where document_id = ${documentId} and version = ${version} and pdf_path is null returning id`;
  return rows.length === 1;
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
    await logActivity(tx, {
      entityType: a.entityType, entityId: a.entityId, action: "attached", summary: `${att.filename} attached`, actor, via,
    });
    if (a.entityType === "document" && a.kind === "signed_copy") {
      const doc = await lockDoc(tx, a.entityId);
      if (canMove(doc.status, "signed")) {
        await tx`update documents set status = 'signed', updated_by = ${actor}, updated_via = ${via}, updated = now() where id = ${doc.id}`;
        await logActivity(tx, { entityType: "document", entityId: doc.id, action: "signed", summary: `${doc.title} signed (copy attached)`, actor, via });
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
    await logActivity(tx, {
      entityType: att.entityType, entityId: att.entityId, action: "removed", summary: `${att.filename} removed`, actor, via,
    });
    return att.storagePath;
  });
}

// ─── Bank details ───────────────────────────────────────────────────────────

export type PayeeAccount = {
  payee: Payee;
  accountName: string;
  bankName: string;
  branch: string | null;
  accountNumber: string;
  accountType: string | null;
  updatedBy: string;
  updated: string;
};
export type PayeeAccountInput = Omit<PayeeAccount, "updatedBy" | "updated">;

function toPayeeAccount(r: Row): PayeeAccount {
  return {
    payee: r.payee, accountName: r.account_name, bankName: r.bank_name, branch: r.branch,
    accountNumber: r.account_number, accountType: r.account_type, updatedBy: r.updated_by, updated: iso(r.updated),
  };
}

export async function getPayeeAccounts(): Promise<PayeeAccount[]> {
  const sql = getSql();
  return (await sql`select * from payee_accounts order by payee`).map(toPayeeAccount);
}

export async function getPayeeAccount(payee: Payee): Promise<PayeeAccount | null> {
  const sql = getSql();
  const [row] = await sql`select * from payee_accounts where payee = ${payee}`;
  return row ? toPayeeAccount(row) : null;
}

/** Not written to the activity log: the log appears on client pages and must never hold bank details. */
export async function savePayeeAccount(a: PayeeAccountInput, actor: string): Promise<PayeeAccount> {
  const sql = getSql();
  const [row] = await sql`
    insert into payee_accounts (payee, account_name, bank_name, branch, account_number, account_type, updated_by)
    values (${a.payee}, ${a.accountName.trim()}, ${a.bankName.trim()}, ${a.branch?.trim() || null},
            ${a.accountNumber.trim()}, ${a.accountType?.trim() || null}, ${actor})
    on conflict (payee) do update set
      account_name = excluded.account_name, bank_name = excluded.bank_name, branch = excluded.branch,
      account_number = excluded.account_number, account_type = excluded.account_type,
      updated_by = excluded.updated_by, updated = now()
    returning *`;
  return toPayeeAccount(row);
}

/**
 * Draft an invoice for one line of a project's payment schedule (1-based),
 * plus its invoice document. The invoice stays a Draft (unnumbered) until the
 * document is finalised. Bonus shares are left unset: founders set them on the
 * invoice before any payment, as with every other draft.
 */
export async function createInvoiceFromDeal(
  input: { projectId: string; line: number; payee: Payee; dueDate: string | null },
  actor: string,
  via: Via = "dashboard",
): Promise<{ invoiceId: string; document: Doc }> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [d] = await tx`
      select d.*, p.client_id as project_client from deals d join projects p on p.id = d.project_id
       where d.project_id = ${input.projectId} for update of d`;
    if (!d) throw new DocumentRuleError("That project has no deal yet");
    const deal = toDeal(d);
    const line = deal.paymentSchedule[input.line - 1];
    if (!line) throw new DocumentRuleError(`The deal has no payment line ${input.line} (it has ${deal.paymentSchedule.length})`);
    const title = `Invoice: ${line.label}`;
    // A voided document still holds its line while its invoice is live.
    // ponytail: matched on the line's label, so renaming a line after invoicing it lets it be
    // invoiced again; upgrade path is matching on invoices.notes.
    const [dupe] = await tx`
      select d.id from documents d left join invoices i on i.id = d.invoice_id
       where d.deal_id = ${deal.id} and d.type = 'invoice' and d.title = ${title}
         and (d.status <> 'void' or (i.status is not null and i.status <> 'Void'))`;
    if (dupe) throw new DocumentRuleError(`${title} already exists (document ${dupe.id})`);

    const issued = today();
    const [inv] = await tx`
      insert into invoices (project_id, amount, invoice_type, status, issue_date, due_date, notes)
      values (${input.projectId}, ${line.amount}, ${invoiceTypeFor(input.line - 1, deal.paymentSchedule.length)}, 'Draft',
              ${issued}, ${input.dueDate ?? addDays(issued, INVOICE_DUE_DAYS)}, ${`${deal.reference} ${line.label}`})
      returning id`;
    const invoiceId = String(inv.id);
    await logActivity(tx, { entityType: "invoice", entityId: invoiceId, action: "created", summary: `Draft invoice for ${deal.reference} ${line.label}`, actor, via });

    const [row] = await tx`
      insert into documents (type, title, client_id, project_id, deal_id, invoice_id, payee, draft, created_by, updated_by, updated_via)
      values ('invoice', ${title}, ${d.project_client}, ${input.projectId}, ${deal.id}, ${invoiceId}, ${input.payee},
              ${tx.json([
                { key: "items", heading: "Items", body: `${line.label} (${deal.reference}) | ${line.amount.toFixed(2)}` },
                { key: "notes", heading: "Notes", body: line.trigger ? `${line.trigger}.` : "" },
              ])}, ${actor}, ${actor}, ${via})
      returning *`;
    const document = toDoc(row);
    await logActivity(tx, { entityType: "document", entityId: document.id, action: "created", summary: `${title} drafted`, actor, via });
    return { invoiceId, document };
  });
}
