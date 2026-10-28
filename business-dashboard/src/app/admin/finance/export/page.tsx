import { requireAdminPage } from "@/lib/auth";
import { getInvoices, getExpenses } from "@/lib/db";
import { ExportButton } from "@/components/dashboard/export-modal";
import { PageHeader } from "@/components/dashboard/explain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExportPage() {
  await requireAdminPage();
  const [invoices, expenses] = await Promise.all([getInvoices(), getExpenses()]);
  // Earliest date anything happened, for the export's "All time" preset.
  const firstDate = [
    ...invoices.flatMap((i) => [i["Issue Date"], i["Paid Date"]]),
    ...expenses.map((e) => e.Date),
  ].reduce<string>((min, d) => (d && d < min ? d : min), "9999-12-31");

  return (
    <>
      <PageHeader title="Export" purpose="Download the books for a date range as a spreadsheet, for the accountant or for a backup." />
      <div className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-4 sm:p-6 space-y-3">
      <p className="text-sm text-[#334155]">
        Download invoices, payments and expenses for a date range, for the accountant or for a backup.
      </p>
      <ExportButton firstDate={firstDate} />
    </div>
    </>
  );
}
