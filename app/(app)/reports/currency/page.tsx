import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTransactions } from "@/lib/books";
import { money, monthRange, prettyDate } from "@/lib/format";
import { CURRENCIES } from "@/lib/currencies";
import { DateRange, Empty, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Currency Ledger" };

export default async function CurrencyReport({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; currency?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [, end] = monthRange();
  const to = sp.to || end;
  const from = sp.from || `${to.slice(0, 4)}-01-01`;
  const all = (await listTransactions(await db(), user.id, { from, to, limit: 5000 })).filter((t) => t.currency);
  const rows = sp.currency ? all.filter((t) => t.currency === sp.currency) : all;
  const totals = new Map<string, { foreign: number; pkr: number; n: number }>();
  for (const t of all) {
    const x = totals.get(t.currency!) ?? { foreign: 0, pkr: 0, n: 0 };
    x.foreign += t.foreign_amount ?? 0;
    x.pkr += t.amount;
    x.n++;
    totals.set(t.currency!, x);
  }
  return (
    <>
      <PageHeader title="Currency Ledger" subtitle={`Entries made in other currencies · ${prettyDate(from)} to ${prettyDate(to)}`} actions={<PrintButton />} />
      <DateRange
        from={from}
        to={to}
        extra={
          <div>
            <label className="label">Currency</label>
            <select name="currency" defaultValue={sp.currency ?? ""} className="input">
              <option value="">All</option>
              {CURRENCIES.filter(([c]) => c !== "PKR").map(([c]) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        }
      />
      {totals.size > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[...totals].map(([c, x]) => (
            <div key={c} className="card p-4">
              <div className="text-xs font-semibold uppercase text-slate-500">{c} · {x.n} entries</div>
              <div className="text-xl font-bold text-ink">{c} {money(x.foreign)}</div>
              <div className="text-sm text-slate-500">= Rs {money(x.pkr)} (avg rate {(x.pkr / x.foreign).toFixed(2)})</div>
            </div>
          ))}
        </div>
      )}
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>No foreign-currency entries in this period. Choose a currency on the New Entry form to add one.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Date</th><th>From → To</th><th>Note</th><th className="num">Foreign</th><th className="num">Rate</th><th className="num">PKR</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{prettyDate(t.date)}</td>
                  <td>{t.from_name} → {t.to_name}</td>
                  <td className="text-slate-500">{t.note}</td>
                  <td className="num">{t.currency} {money(t.foreign_amount ?? 0)}</td>
                  <td className="num">{t.rate}</td>
                  <td className="num font-medium">{money(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
