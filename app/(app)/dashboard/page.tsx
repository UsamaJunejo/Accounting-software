import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, budgets, categoryTotals, incomeStatement, listTransactions } from "@/lib/books";
import { money, monthRange, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, LinkButton, Money, PageHeader, TypeBadge } from "@/components/ui";
import { ExpensePie, MonthlyBars } from "@/components/charts";

export const metadata = { title: "Dashboard" };

function Stat({ label, value, tone, href }: { label: string; value: number; tone: string; href?: string }) {
  const body = (
    <div className={`card h-full border-l-4 p-4 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">
        <span className="mr-1 text-sm font-medium text-slate-400">Rs</span>
        <Money value={value} />
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; welcome?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [mStart, mEnd] = monthRange();
  const from = sp.from || mStart;
  const to = sp.to || mEnd;
  const d = db();

  const all = accountsWithBalances(d, user.id, { to });
  const period = accountsWithBalances(d, user.id, { from, to });
  const sumBy = (rows: typeof all, f: (a: (typeof all)[0]) => boolean) => rows.filter(f).reduce((s, a) => s + a.balance, 0);

  const cashBank = sumBy(all, (a) => a.category === "Cash" || a.category === "Bank");
  const receivable = sumBy(all, (a) => a.category === "Receivables");
  const payable = sumBy(all, (a) => a.category === "Payables");
  const pl = incomeStatement(d, user.id, from, to);

  const cats = categoryTotals(d, user.id, { to }).map((c) =>
    c.kind === "income" || c.kind === "expense"
      ? { ...c, balance: sumBy(period, (a) => a.category_id === c.id), note: "this period" }
      : { ...c, note: "balance" },
  );

  const expensePie = period
    .filter((a) => a.kind === "expense" && a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((a) => ({ name: a.name, value: a.balance / 100 }));
  const top = expensePie.slice(0, 7);
  const rest = expensePie.slice(7).reduce((s, x) => s + x.value, 0);
  if (rest) top.push({ name: "Others", value: rest });

  const months: { month: string; income: number; expense: number }[] = [];
  const base = new Date(to + "T00:00:00Z");
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const [a, b] = monthRange(dt.toISOString().slice(0, 10));
    const r = incomeStatement(d, user.id, a, b);
    months.push({
      month: dt.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      income: r.totalIncome / 100,
      expense: r.totalExpense / 100,
    });
  }

  const [bStart, bEnd] = monthRange(today());
  const budgetRows = budgets(d, user.id, bStart, bEnd);
  const recent = listTransactions(d, user.id, { limit: 8 });

  return (
    <>
      <PageHeader
        title={`Assalam-o-Alaikum, ${user.name.split(" ")[0]}`}
        subtitle={`${prettyDate(from)} to ${prettyDate(to)}`}
        actions={
          <>
            <LinkButton href="/voucher?type=receipt" variant="dark">+ Money In</LinkButton>
            <LinkButton href="/voucher?type=payment" variant="primary">+ Money Out</LinkButton>
          </>
        }
      />
      {sp.welcome && (
        <div className="card mb-5 border-brand/40 bg-orange-50 p-4 text-sm text-slate-700">
          <b>Welcome!</b> Your accounts are ready: Cash, Bank, JazzCash, Easypaisa, Sales, Rent and more. Start by adding
          your opening cash as a <Link className="font-semibold text-brand" href="/voucher?type=receipt">Money In</Link> entry from
          &ldquo;Owner Capital&rdquo; to &ldquo;Cash&rdquo;, then record sales and expenses as they happen.
        </div>
      )}
      <DateRange from={from} to={to} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cash & Bank now" value={cashBank} tone="border-blue-500" href="/accounts" />
        <Stat label="Profit this period" value={pl.profit} tone={pl.profit >= 0 ? "border-green-500" : "border-red-500"} href={`/reports/income?from=${from}&to=${to}`} />
        <Stat label="Customers owe you" value={receivable} tone="border-brand" href="/khata" />
        <Stat label="You owe suppliers" value={payable} tone="border-slate-500" href="/khata" />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Categories</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cats.map((c) => (
          <Link key={c.id} href={`/accounts#cat-${c.id}`} className="card p-3 transition hover:border-brand">
            <div className="text-xs font-semibold uppercase text-slate-500">{c.name}</div>
            <div className="mt-1 font-bold text-ink"><Money value={c.balance} /></div>
            <div className="text-[11px] text-slate-400">{c.note}</div>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-ink">Where the money went</h2>
          <ExpensePie data={top} />
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-ink">Income vs expense (last 6 months)</h2>
          <MonthlyBars data={months} />
        </div>
      </div>

      {budgetRows.length > 0 && (
        <div className="card mb-6 p-4">
          <h2 className="mb-3 font-semibold text-ink">Budgets this month</h2>
          <div className="space-y-3">
            {budgetRows.map((b) => {
              const pct = Math.min(100, Math.round((b.spent / b.budget) * 100));
              const over = b.spent > b.budget;
              return (
                <div key={b.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{b.name}</span>
                    <span className={over ? "font-semibold text-red-600" : "text-slate-600"}>
                      {money(b.spent)} / {money(b.budget)} {over && "· over budget!"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-semibold text-ink">Latest entries</h2>
          <Link href="/transactions" className="text-sm font-semibold text-brand">See all</Link>
        </div>
        {recent.length === 0 ? (
          <Empty>No entries yet. Add your first one with &ldquo;Money In&rdquo; or &ldquo;Money Out&rdquo;.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>From → To</th><th>Note</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} style={t.highlight ? { background: t.highlight + "33" } : undefined}>
                    <td className="whitespace-nowrap">{prettyDate(t.date)}</td>
                    <td><TypeBadge type={t.type} /></td>
                    <td>{t.from_name} → {t.to_name}</td>
                    <td className="text-slate-500">{t.note}</td>
                    <td className="num font-medium">{money(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
