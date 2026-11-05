import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { incomeStatement } from "@/lib/books";
import { monthRange, prettyDate } from "@/lib/format";
import { DateRange, Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ReportSection } from "@/components/report-section";

export const metadata = { title: "Profit & Loss" };

export default async function Income({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [a, b] = monthRange();
  const from = sp.from || a;
  const to = sp.to || b;
  const r = incomeStatement(db(), user.id, from, to);
  return (
    <>
      <PageHeader title="Profit & Loss" subtitle={`${user.business_name || user.name} · ${prettyDate(from)} to ${prettyDate(to)}`} actions={<PrintButton />} />
      <DateRange from={from} to={to} />
      <div className="card max-w-3xl p-5">
        <ReportSection title="Income" rows={r.income} total={r.totalIncome} />
        <ReportSection title="Expenses" rows={r.expense} total={r.totalExpense} />
        <div className={`flex justify-between rounded-lg px-3 py-3 text-lg font-bold ${r.profit >= 0 ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          <span>{r.profit >= 0 ? "Profit" : "Loss"}</span>
          <Money value={r.profit} />
        </div>
      </div>
    </>
  );
}
