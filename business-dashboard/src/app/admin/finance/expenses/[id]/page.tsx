import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getExpenses } from "@/lib/db";
import { getEntityActivity, listAttachments } from "@/lib/documents-db";
import { FOUNDER_LABEL, HOLDER_LABEL, tt } from "@/lib/ledger";
import { PageHeader, StatTile } from "@/components/dashboard/explain";
import { FilesPanel } from "@/components/dashboard/files-panel";
import { ActivityList } from "@/components/dashboard/activity-list";

export const dynamic = "force-dynamic";

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage();
  if (!z.uuid().safeParse(id).success) notFound();

  const [expenses, files, activity] = await Promise.all([getExpenses(), listAttachments("expense", [id]), getEntityActivity("expense", id)]);
  const exp = expenses.find((e) => e.id === id);
  if (!exp) notFound();

  const paidBy = exp["Paid From"]
    ? `${HOLDER_LABEL[exp["Paid From"]]}'s cash`
    : exp["Paid Personally By"] ? `${FOUNDER_LABEL[exp["Paid Personally By"]]}, personally` : "Not recorded";
  const reimbursed = !exp["Paid Personally By"]
    ? "Not needed"
    : exp["Reimbursed At"]
      ? `On ${exp["Reimbursed At"].slice(0, 10)}${exp["Reimbursed From"] ? ` from ${HOLDER_LABEL[exp["Reimbursed From"]]}` : ""}`
      : "Not yet";

  return (
    <div className="space-y-3">
      <Link href="/admin/finance/expenses" className="text-xs text-[#5A6678] hover:text-[#334155]">Expenses</Link>
      <PageHeader title={exp.Name} purpose={`${exp.Category ?? "Other"}. ${exp.Date ? `Spent on ${exp.Date}.` : "No date set."} Change it on the Expenses page.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Amount" value={tt(exp.Amount ?? 0)} note={exp["USD Amount"] ? `US$${exp["USD Amount"].toFixed(2)} charged.` : "In TT dollars."} />
        <StatTile label="Paid from" value={paidBy} note="Whose money paid for it." />
        <StatTile label="Reimbursed" value={reimbursed} note="Only when a founder paid personally." />
        <StatTile label="Reference" value={exp.Reference || "None"} note="The bill or receipt number." />
      </div>
      {exp.Notes && (
        <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-[#1B2533]">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-[#1B2533]">{exp.Notes}</p>
        </section>
      )}
      <FilesPanel entityType="expense" entityId={id} files={files} defaultKind="proof_of_payment" title="Receipts"
        note="Attach the bill or slip for this expense. Photos from your phone work. Private to admins." />
      <ActivityList items={activity} />
    </div>
  );
}
