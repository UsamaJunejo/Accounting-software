import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { balanceSheet } from "@/lib/books";
import { prettyDate, today } from "@/lib/format";
import { Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ReportSection } from "@/components/report-section";

export const metadata = { title: "Balance Sheet" };

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const date = sp.date || today();
  const r = await balanceSheet(await db(), user.id, date);
  return (
    <>
      <PageHeader title="Balance Sheet" subtitle={`${user.business_name || user.name} · as of ${prettyDate(date)}`} actions={<PrintButton />} />
      <form className="card no-print mb-5 flex items-end gap-3 p-4">
        <div>
          <label className="label">As of date</label>
          <input type="date" name="date" defaultValue={date} className="input" />
        </div>
        <button className="btn-dark">Show</button>
      </form>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-sm text-slate-500">You own (assets)</div><div className="text-xl font-bold"><Money value={r.totalAssets} /></div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">You owe (liabilities)</div><div className="text-xl font-bold"><Money value={r.totalLiabilities} /></div></div>
        <div className="card border-brand p-4"><div className="text-sm text-slate-500">Net worth</div><div className="text-xl font-bold text-brand"><Money value={r.netWorth} /></div></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <ReportSection title="Assets" rows={r.assets} total={r.totalAssets} />
        </div>
        <div className="card p-5">
          <ReportSection title="Liabilities" rows={r.liabilities} total={r.totalLiabilities} />
          <table className="table">
            <thead><tr><th>Equity</th><th className="num">Rs</th></tr></thead>
            <tbody>
              {r.equity.map((e) => (
                <tr key={e.id}><td>{e.name}</td><td className="num"><Money value={e.balance} /></td></tr>
              ))}
              <tr><td>Profit / loss to date</td><td className="num"><Money value={r.profit} /></td></tr>
              <tr className="font-bold"><td>Total equity</td><td className="num"><Money value={r.totalEquity} /></td></tr>
              <tr className="font-bold"><td>Liabilities + equity</td><td className="num"><Money value={r.totalLiabilities + r.totalEquity} /></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className={`mt-4 text-sm ${r.balanced ? "text-green-700" : "text-red-600"}`}>
        {r.balanced ? "✓ Balanced: assets equal liabilities plus equity." : "Not balanced. Please report this."}
      </p>
    </>
  );
}
