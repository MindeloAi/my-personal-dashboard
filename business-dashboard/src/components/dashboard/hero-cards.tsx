"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";
import { isOverdue } from "@/lib/invoices";
import { today } from "@/lib/subscriptions";
import { holderLine, owedLine, tt } from "@/lib/ledger";
import type { Invoice, Ledger } from "@/lib/db";

type Props = { ledger: Ledger; invoices: Invoice[] };

export function HeroCards({ ledger, invoices }: Props) {
  const { overdueCount, sentCount } = useMemo(() => {
    const now = new Date();
    const outstanding = invoices.filter((i) => i.Status === "Sent" || i.Status === "Overdue");
    const overdueCount = outstanding.filter((i) => isOverdue(i, now)).length;
    return { overdueCount, sentCount: outstanding.length - overdueCount };
  }, [invoices]);

  const owedToFounders = owedLine(ledger.owedToFounders);

  const { payments, expenses, payoutsPaidOut, net } = ledger.month;
  const todayStr = today();
  const cutoverMonth = ledger.cutover.slice(0, 7);
  const sinceLabel = todayStr.startsWith(cutoverMonth)
    ? `Since ${format(parseISO(ledger.cutover.slice(0, 10)), "d MMM")}`
    : format(parseISO(todayStr), "MMMM");

  const owedParts = [
    overdueCount > 0 ? `${overdueCount} overdue` : null,
    sentCount > 0 ? `${sentCount} sent` : null,
  ].filter(Boolean);

  const animatedCash = useCountUp(ledger.cash.total);
  const animatedOwed = useCountUp(ledger.owedToUs.total);
  const animatedNet = useCountUp(net);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-gradient-to-b from-[#14181d] to-[#0f1215] border border-[#2a2e34] rounded-[20px] p-6 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
        <p className="text-[10px] text-[#bfff3a] font-medium tracking-wider uppercase">Business cash</p>
        <p
          className={`text-4xl font-bold tracking-tight mt-1.5 tabular-nums ${ledger.cash.total < 0 ? "text-[#ff4d8b]" : "text-white"}`}
        >
          {tt(animatedCash)}
        </p>
        <p className="text-xs text-zinc-500 mt-1">{holderLine(ledger.cash)}</p>
        {owedToFounders && <p className="text-xs text-zinc-500 mt-1">Owed to founders: {owedToFounders}</p>}
      </div>

      <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
        <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Owed to us</p>
        <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: "#fbbf24" }}>
          {tt(animatedOwed)}
        </p>
        <p className="text-xs text-zinc-500 mt-3">
          {owedParts.length > 0 ? owedParts.join(", ") : "No outstanding invoices"}
        </p>
      </div>

      <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-5 hover:-translate-y-0.5 hover:shadow-lg transition-transform">
        <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">This month net · {sinceLabel}</p>
        <p className={`text-2xl font-bold mt-1 tabular-nums ${net < 0 ? "text-[#ff4d8b]" : "text-white"}`}>
          {tt(animatedNet)}
        </p>
        <p className="text-xs text-zinc-500 mt-3">
          {tt(payments)} in, {tt(expenses)} expenses, {tt(payoutsPaidOut)} founder pay
        </p>
      </div>
    </div>
  );
}
