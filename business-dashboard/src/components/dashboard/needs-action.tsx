import Link from "next/link";
import type { ActionItem } from "@/lib/pages-data";

const TAG: Record<ActionItem["kind"], { text: string; cls: string }> = {
  overdue: { text: "Overdue", cls: "bg-[#FCEBE3] text-[#B23A0A]" },
  "due-soon": { text: "Due soon", cls: "bg-[#FEF3E2] text-[#B45309]" },
  "follow-up": { text: "Follow up", cls: "bg-[#EFF4FF] text-[#1D4ED8]" },
  retainer: { text: "Invoice to raise", cls: "bg-[#EFF4FF] text-[#1D4ED8]" },
  "to-sort": { text: "Money to sort", cls: "bg-[#FEF3E2] text-[#B45309]" },
};

/** Everything that needs doing today, most urgent first, each linking to where it is done. */
export function NeedsAction({ items }: { items: ActionItem[] }) {
  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5 break-inside-avoid">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#1B2533]">Needs action</h2>
        <span className="text-xs text-[#5A6678]">{items.length} {items.length === 1 ? "item" : "items"}</span>
      </div>
      <p className="mt-0.5 text-xs text-[#4A5568]">
        Overdue invoices, invoices due in the next 3 days, lead follow-ups due, retainer invoices to raise and money not sorted yet. Each line opens the page where it is dealt with.
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[#5A6678]">Nothing needs doing right now.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEF1F5]">
          {items.map((it, i) => (
            <li key={i}>
              <Link href={it.href} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:bg-[#F7F8FA]">
                <span className={`shrink-0 rounded-[4px] px-2 py-0.5 text-[11px] font-medium ${TAG[it.kind].cls}`}>{TAG[it.kind].text}</span>
                <span className="text-sm font-medium text-[#1B2533]">{it.title}</span>
                <span className="text-xs text-[#5A6678]">{it.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
