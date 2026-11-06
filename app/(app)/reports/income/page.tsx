import { fixRange } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { incomeStatement } from "@/lib/books";
import { monthRange, prettyDate } from "@/lib/format";
import { DateRange, Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ReportSection } from "@/components/report-section";
import { RankedBars } from "@/components/charts";
import { currencySymbol } from "@/lib/currencies";

export const metadata = { title: "Profit & Loss" };

export default async function Income({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireUser();
  const sp = fixRange(await searchParams);
  const [a, b] = monthRange();
  const from = sp.from || a;
  const to = sp.to || b;
  const r = await incomeStatement(await db(), user.id, from, to);
  return (
    <>
      <PageHeader title="Profit & Loss" subtitle={`${user.business_name || user.name} · ${prettyDate(from)} to ${prettyDate(to)}`} actions={<PrintButton />} />
      <DateRange from={from} to={to} />
      <div className="mb-5 grid gap-5 lg:grid-cols-2 no-print">
        <div className="card p-5">
          <h2 className="text-lg font-bold">Where income came from</h2>
          <RankedBars data={[...r.income].sort((a, b) => b.balance - a.balance).slice(0, 8).map((a) => ({ name: a.name, value: a.balance }))} cur={currencySymbol(user.currency)} name="Income" color="#2a78d6" empty="No income in this period." />
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold">Where money was spent</h2>
          <RankedBars data={[...r.expense].sort((a, b) => b.balance - a.balance).slice(0, 8).map((a) => ({ name: a.name, value: a.balance }))} cur={currencySymbol(user.currency)} name="Expense" color="#a4282b" empty="No expenses in this period." />
        </div>
      </div>
      <div className="card max-w-3xl p-5">
        <ReportSection currency={user.currency} title="Income" rows={r.income} total={r.totalIncome} />
        <ReportSection currency={user.currency} title="Expenses" rows={r.expense} total={r.totalExpense} />
        <div className={`total flex justify-between px-1 text-lg ${r.profit >= 0 ? "text-ledger" : "text-khata"}`}>
          <span>{r.profit >= 0 ? "Profit" : "Loss"}</span>
          <Money value={r.profit} />
        </div>
      </div>
    </>
  );
}
