import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, budgets, categories, listTransactions, monthlyTotals, summarizeIncome } from "@/lib/books";
import { money, monthRange, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, LinkButton, Money, PageHeader, TypeBadge } from "@/components/ui";
import { ExpensePie, MonthlyBars } from "@/components/charts";
import { getT } from "@/lib/lang";
import { CategoryBadge } from "@/components/icons";
import { ArrowDownLeft, ArrowUpRight, ChartPie, ChartColumn, HandCoins, LineChart, ListOrdered, Target, Truck, Wallet, type LucideIcon } from "lucide-react";

export const metadata = { title: "Dashboard" };

function Stat({ label, value, tone, href, Icon, iconBg }: { label: string; value: number; tone: string; href?: string; Icon: LucideIcon; iconBg: string }) {
  const body = (
    <div className={`card h-full border-l-4 p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}><Icon className="h-4 w-4" /></span>
      </div>
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
  const d = await db();
  const t = await getT();

  const base = new Date(to + "T00:00:00Z");
  const monthStarts = [5, 4, 3, 2, 1, 0].map((i) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1)));
  const [bStart, bEnd] = monthRange(today());

  // Load everything in parallel: one round trip each.
  const [all, period, cats0, monthly, budgetRows, recent] = await Promise.all([
    accountsWithBalances(d, user.id, { to }),
    accountsWithBalances(d, user.id, { from, to }),
    categories(d, user.id),
    monthlyTotals(d, user.id, monthStarts[0].toISOString().slice(0, 10), monthRange(to)[1]),
    budgets(d, user.id, bStart, bEnd),
    listTransactions(d, user.id, { limit: 8 }),
  ]);
  const sumBy = (rows: typeof all, f: (a: (typeof all)[0]) => boolean) => rows.filter(f).reduce((s, a) => s + a.balance, 0);

  const cashBank = sumBy(all, (a) => a.category === "Cash" || a.category === "Bank");
  const receivable = sumBy(all, (a) => a.category === "Receivables");
  const payable = sumBy(all, (a) => a.category === "Payables");
  const pl = summarizeIncome(period);

  const cats = cats0.map((c) =>
    c.kind === "income" || c.kind === "expense"
      ? { ...c, balance: sumBy(period, (a) => a.category_id === c.id), note: t("this period") }
      : { ...c, balance: sumBy(all, (a) => a.category_id === c.id), note: t("balance") },
  );

  const expensePie = period
    .filter((a) => a.kind === "expense" && a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((a) => ({ name: a.name, value: a.balance / 100 }));
  const top = expensePie.slice(0, 7);
  const rest = expensePie.slice(7).reduce((s, x) => s + x.value, 0);
  if (rest) top.push({ name: "Others", value: rest });

  const months = monthStarts.map((dt) => {
    const m = monthly.get(dt.toISOString().slice(0, 7));
    return {
      month: dt.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      income: (m?.income ?? 0) / 100,
      expense: (m?.expense ?? 0) / 100,
    };
  });

  return (
    <>
      <PageHeader
        title={`${t("Assalam-o-Alaikum")}, ${user.name.split(" ")[0]}`}
        subtitle={`${prettyDate(from)} ${t("to")} ${prettyDate(to)}`}
        actions={
          <>
            <LinkButton href="/voucher?type=receipt" variant="dark"><ArrowDownLeft className="h-4 w-4" />{t("Money In")}</LinkButton>
            <LinkButton href="/voucher?type=payment" variant="primary"><ArrowUpRight className="h-4 w-4" />{t("Money Out")}</LinkButton>
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
        <Stat label={t("Cash & Bank now")} value={cashBank} tone="border-blue-500" href="/accounts" Icon={Wallet} iconBg="bg-blue-50 text-blue-600" />
        <Stat label={t("Profit this period")} value={pl.profit} tone={pl.profit >= 0 ? "border-green-500" : "border-red-500"} href={`/reports/income?from=${from}&to=${to}`} Icon={LineChart} iconBg={pl.profit >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"} />
        <Stat label={t("Customers owe you")} value={receivable} tone="border-brand" href="/khata" Icon={HandCoins} iconBg="bg-orange-50 text-brand" />
        <Stat label={t("You owe suppliers")} value={payable} tone="border-slate-500" href="/khata" Icon={Truck} iconBg="bg-slate-100 text-slate-600" />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("Categories")}</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cats.map((c) => (
          <Link key={c.id} href={`/accounts#cat-${c.id}`} className="card flex items-center gap-3 p-3 transition hover:border-brand">
            <CategoryBadge name={c.name} kind={c.kind} />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold uppercase text-slate-500">{c.name}</div>
              <div className="font-bold text-ink"><Money value={c.balance} /></div>
              <div className="text-[11px] text-slate-400">{c.note}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-ink"><ChartPie className="h-5 w-5 text-brand" />{t("Where the money went")}</h2>
          <ExpensePie data={top} empty={t("No expenses in this period.")} />
        </div>
        <div className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-ink"><ChartColumn className="h-5 w-5 text-brand" />{t("Income vs expense (last 6 months)")}</h2>
          <MonthlyBars data={months} labels={{ income: t("Income"), expense: t("Expense") }} />
        </div>
      </div>

      {budgetRows.length > 0 && (
        <div className="card mb-6 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink"><Target className="h-5 w-5 text-brand" />{t("Budgets this month")}</h2>
          <div className="space-y-3">
            {budgetRows.map((b) => {
              const pct = Math.min(100, Math.round((b.spent / b.budget) * 100));
              const over = b.spent > b.budget;
              return (
                <div key={b.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{b.name}</span>
                    <span className={over ? "font-semibold text-red-600" : "text-slate-600"}>
                      {money(b.spent)} / {money(b.budget)} {over && `· ${t("over budget!")}`}
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
          <h2 className="flex items-center gap-2 font-semibold text-ink"><ListOrdered className="h-5 w-5 text-brand" />{t("Latest entries")}</h2>
          <Link href="/transactions" className="text-sm font-semibold text-brand">{t("See all")}</Link>
        </div>
        {recent.length === 0 ? (
          <Empty>{t("No entries yet. Add your first one with “Money In” or “Money Out”.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>{t("Date")}</th><th>{t("Type")}</th><th>{t("From")} → {t("To")}</th><th>{t("Note")}</th><th className="num">{t("Amount")}</th></tr>
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
