import { requireAdminPage } from "@/lib/auth";
import { getPayeeAccounts } from "@/lib/documents-db";
import { PAYEES, PAYEE_LABEL } from "@/lib/documents";
import { PageHeader } from "@/components/dashboard/explain";
import { PayeeForm } from "./payee-form";

export const dynamic = "force-dynamic";

export default async function PayeesPage() {
  await requireAdminPage();
  const accounts = await getPayeeAccounts();
  return (
    <div className="space-y-3">
      <PageHeader
        title="Bank details"
        purpose="What goes in the payment box of an invoice PDF, and nowhere else. Each founder fills in their own account; Claude always asks who is being paid and never sees these numbers."
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {PAYEES.map((p) => {
          const a = accounts.find((x) => x.payee === p) ?? null;
          return (
            <section key={p} className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold text-[#1B2533]">{PAYEE_LABEL[p]}</h2>
              <p className="mt-0.5 mb-3 text-xs text-[#5A6678]">
                {a ? `Last changed by ${a.updatedBy.split("@")[0]} on ${a.updated.slice(0, 10)}` : "Not saved yet"}
              </p>
              <PayeeForm payee={p} account={a} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
