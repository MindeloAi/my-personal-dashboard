"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  DocumentRuleError,
  addAttachment,
  attachableExists,
  createReceiptForPayment,
  deleteAttachment,
  finaliseDocument,
  saveDeal,
  saveClientDetails,
  savePayeeAccount,
  setDocumentPayee,
  setDocumentStatus,
  startCarePlan,
} from "@/lib/documents-db";
import { ATTACHABLE, DOC_STATUSES, FILE_KINDS, PAYEES } from "@/lib/documents";
import { ensurePdf } from "@/lib/pdf/store";
import { MAX_FILE_BYTES, exists, removeFile, signedUpload } from "@/lib/storage";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Rule errors are shown as written; anything else is logged and reported generically. */
function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof DocumentRuleError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "That did not save. Try again, and tell Claude if it keeps happening." };
}

const ScheduleLine = z.object({ label: z.string().trim().min(1), amount: z.number().positive(), trigger: z.string().trim().min(1) });
const DealForm = z.object({
  projectId: z.uuid(),
  reference: z.string().trim(),
  scope: z.array(z.string().trim().min(1)),
  priceTotal: z.number().nonnegative().nullable(),
  paymentSchedule: z.array(ScheduleLine),
  carePlan: z
    .object({
      monthlyAmount: z.number().nonnegative(),
      minimumMonths: z.number().int().nonnegative(),
      noticeDays: z.number().int().nonnegative(),
      inclusions: z.array(z.string().trim().min(1)),
      exclusions: z.array(z.string().trim().min(1)),
    })
    .nullable(),
  deadline: z.iso.date().nullable(),
  goals: z.string().nullable(),
  notes: z.string().nullable(),
  payeeDefault: z.enum(PAYEES).nullable(),
});

/** Money is stored to the cent. Only numbers are rounded, so anything else still fails validation as itself. */
const cents = (x: unknown) => (typeof x === "number" ? Math.round(x * 100) / 100 : x);

export async function saveDealAction(input: z.input<typeof DealForm>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = DealForm.safeParse({
    ...input,
    priceTotal: cents(input.priceTotal),
    paymentSchedule: Array.isArray(input.paymentSchedule)
      ? input.paymentSchedule.map((l) => ({ ...l, amount: cents(l?.amount) }))
      : input.paymentSchedule,
    carePlan: input.carePlan ? { ...input.carePlan, monthlyAmount: cents(input.carePlan.monthlyAmount) } : input.carePlan,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    await saveDeal(parsed.data, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function finaliseDocumentAction(id: string): Promise<Result<{ version: number; pdfError?: string }>> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown document" };
  try {
    const v = await finaliseDocument(id, admin.email);
    revalidatePath("/", "layout");
    try {
      await ensurePdf(id, v.version);
      return { ok: true, data: { version: v.version } };
    } catch (e) {
      console.error("[finalise] PDF", e);
      return { ok: true, data: { version: v.version, pdfError: "Finalised, but the PDF could not be made yet. Open it again from the version list." } };
    }
  } catch (e) {
    return fail(e);
  }
}

/** Draft a receipt for one recorded payment. Returns the new document's id. */
export async function createReceiptAction(paymentId: string): Promise<Result<{ id: string }>> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "Unknown payment" };
  try {
    const doc = await createReceiptForPayment(paymentId, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: doc.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function setDocumentStatusAction(id: string, status: string): Promise<Result> {
  const admin = await requireAdmin();
  const s = z.enum(DOC_STATUSES).safeParse(status);
  if (!z.uuid().safeParse(id).success || !s.success) return { ok: false, error: "Unknown document or status" };
  try {
    await setDocumentStatus(id, s.data, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const UploadStart = z.object({
  entityType: z.enum(ATTACHABLE),
  entityId: z.uuid(),
  size: z.number().int().positive().max(MAX_FILE_BYTES, "Files can be up to 25 MB"),
});

/** Step 1 of an upload: a one-time signed URL. The key is ids only, never the filename. */
export async function startUploadAction(input: z.input<typeof UploadStart>): Promise<Result<{ path: string; token: string }>> {
  await requireAdmin();
  const parsed = UploadStart.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the file" };
  try {
    const { entityType, entityId } = parsed.data;
    if (!(await attachableExists(entityType, entityId))) return { ok: false, error: "That expense no longer exists" };
    return { ok: true, data: await signedUpload(`${entityType}/${entityId}/${randomUUID()}`) };
  } catch (e) {
    return fail(e);
  }
}

const UploadDone = z.object({
  entityType: z.enum(ATTACHABLE),
  entityId: z.uuid(),
  path: z.string().regex(/^(client|project|invoice|document|expense)\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  kind: z.enum(FILE_KINDS),
});

/** Step 2: record the file once it is really in Storage. */
export async function finishUploadAction(input: z.input<typeof UploadDone>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = UploadDone.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the file" };
  const a = parsed.data;
  if (!a.path.startsWith(`${a.entityType}/${a.entityId}/`)) return { ok: false, error: "That upload belongs to another record" };
  try {
    if (!(await exists(a.path))) return { ok: false, error: "The upload did not finish. Try again." };
    await addAttachment(
      { entityType: a.entityType, entityId: a.entityId, storagePath: a.path, filename: a.filename, contentType: a.contentType, size: a.size, kind: a.kind },
      admin.email,
    );
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    // A refused attachment (e.g. its expense was deleted) rolls back,
    // so the file already in Storage has no record. Remove it rather than orphan it.
    if (e instanceof DocumentRuleError) await removeFile(a.path).catch((err) => console.error("Could not remove refused upload", a.path, err));
    return fail(e);
  }
}

export async function deleteFileAction(id: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown file" };
  try {
    const path = await deleteAttachment(id, admin.email);
    // The record goes first: a file left behind in Storage is harmless; a record pointing at nothing is not.
    if (path) {
      try {
        await removeFile(path);
      } catch (e) {
        console.error("File record removed but its Storage object was not", path, e);
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const PayeeForm = z.object({
  payee: z.enum(PAYEES),
  accountName: z.string().trim().min(1, "Account name is needed"),
  bankName: z.string().trim().min(1, "Bank is needed"),
  branch: z.string().trim().nullable(),
  accountNumber: z.string().trim().min(1, "Account number is needed"),
  accountType: z.string().trim().nullable(),
});

export async function savePayeeAccountAction(input: z.input<typeof PayeeForm>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = PayeeForm.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  try {
    await savePayeeAccount(parsed.data, admin.email);
    revalidatePath("/admin/settings/payees");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setDocumentPayeeAction(id: string, payee: string): Promise<Result> {
  const admin = await requireAdmin();
  const p = z.enum(PAYEES).safeParse(payee);
  if (!z.uuid().safeParse(id).success || !p.success) return { ok: false, error: "Unknown document or payee" };
  try {
    await setDocumentPayee(id, p.data, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

const ClientDetailsForm = z.object({
  clientId: z.uuid(),
  address: z.string().max(500),
  signatoryName: z.string().max(200),
  signatoryTitle: z.string().max(200),
});

/** Address and signatory printed on agreements, care plans and change requests. Empty clears a field. */
export async function saveClientDetailsAction(input: z.input<typeof ClientDetailsForm>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = ClientDetailsForm.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { clientId, ...d } = parsed.data;
  try {
    await saveClientDetails(clientId, d, admin.email);
    revalidatePath(`/admin/clients/${clientId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Starts the monthly retainer for a signed care plan. */
export async function startCarePlanAction(id: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown document" };
  try {
    await startCarePlan(id, admin.email);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
