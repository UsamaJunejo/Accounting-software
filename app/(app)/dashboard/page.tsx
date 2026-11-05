import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, budgets, cashBankDaily, categories, listTransactions, monthlyTotals, summarizeIncome } from "@/lib/books";
import { money, monthRange, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, Money, PageHeader, TypeBadge } from "@/components/ui";
import { BalanceLine, CategoryBars, CategoryDonut, InOutBars, RankedBars } from "@/components/charts";
import { categoryColor } from "@/lib/palette";
import { currencySymbol } from "@/lib/currencies";
import { getT } from "@/lib/lang";
import { CategoryBadge } from "@/components/icons";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const metadata = { title: "Dashboard" };

/** One line of the position ledger: label on the left, amount on the right, like a khata page. */
function Row({ label, value, sign, href, cur }: { label: string; value: number; sign?: "+" | "−"; href: string; cur: string }) {
  return (
    <Link href={href} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5 hover:bg-ink-soft/40">
      <span className="text-body">{label}</span>
      <span className="tabular-nums text-lg text-ink" dir="ltr">
        <span className="me-1 text-muted">{sign ?? ""}</span>
        <span className="me-1 text-sm text-muted">{cur}</span>
        <Money value={value} />
      </span>
    </Link>
  );
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
  const [all, period, cats0, monthly, budgetRows, recent, flow] = await Promise.all([
    accountsWithBalances(d, user.id, { to }),
    accountsWithBalances(d, user.id, { from, to }),
    categories(d, user.id),
    monthlyTotals(d, user.id, monthStarts[0].toISOString().slice(0, 10), monthRange(to)[1]),
    budgets(d, user.id, bStart, bEnd),
    listTransactions(d, user.id, { limit: 8 }),
    cashBankDaily(d, user.id, from, to),
  ]);
  const cur = currencySymbol(user.currency);
  const sumBy = (rows: typeof all, f: (a: (typeof all)[0]) => boolean) => rows.filter(f).reduce((s, a) => s + a.balance, 0);

  const cashBank = sumBy(all, (a) => a.category === "Cash" || a.category === "Bank");
  const receivable = sumBy(all, (a) => a.category === "Receivables");
  const payable = sumBy(all, (a) => a.category === "Payables");
  const pl = summarizeIncome(period);

  // Balance-sheet categories get a colour each (same colour on tile, donut and bars);
  // income and expense are flows for the period and stay in the neutral teal.
  let slot = 0;
  const cats = cats0.map((c) =>
    c.kind === "income" || c.kind === "expense"
      ? { ...c, balance: sumBy(period, (a) => a.category_id === c.id), note: t("this period"), color: undefined as string | undefined }
      : { ...c, balance: sumBy(all, (a) => a.category_id === c.id), note: "", color: categoryColor(slot++) },
  );
  const balanceCats = cats.filter((c) => c.color).map((c) => ({ name: c.name, value: c.balance, color: c.color! }));
  const owned = cats.filter((c) => c.color && c.kind === "asset").map((c) => ({ name: c.name, value: c.balance, color: c.color! }));

  const expenses = period
    .filter((a) => a.kind === "expense" && a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((a) => ({ name: a.name, value: a.balance }));
  const topExpenses = expenses.slice(0, 6);
  const rest = expenses.slice(6).reduce((s, x) => s + x.value, 0);
  if (rest) topExpenses.push({ name: t("Everything else"), value: rest });

  const months = monthStarts.map((dt) => {
    const m = monthly.get(dt.toISOString().slice(0, 7));
    return { label: dt.toLocaleString("en", { month: "short", timeZone: "UTC" }), in: m?.income ?? 0, out: m?.expense ?? 0 };
  });
  const net = cashBank + receivable - payable;

  return (
    <>
      <PageHeader
        title={`${t("Assalam-o-Alaikum")}, ${user.name.split(" ")[0]}`}
        subtitle={`${prettyDate(from)} ${t("to")} ${prettyDate(to)}`}
        actions={
          <>
            <Link href="/voucher?type=receipt" className="btn-in"><ArrowDownLeft className="h-4 w-4" />{t("Money In")}</Link>
            <Link href="/voucher?type=payment" className="btn-out"><ArrowUpRight className="h-4 w-4" />{t("Money Out")}</Link>
          </>
        }
      />
      {sp.welcome && (
        <div className="card mb-5 border-ink/30 bg-ink-soft p-4 text-sm text-body">
          <b>Your accounts are ready.</b> Cash, Bank, JazzCash, Easypaisa, Sales, Rent and more are set up. Start with the cash
          you have today: add a <Link className="font-semibold underline" href="/voucher?type=receipt">Money In</Link> entry from
          &ldquo;Owner Capital&rdquo; to &ldquo;Cash&rdquo;.
        </div>
      )}
      <DateRange from={from} to={to} />

      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="card p-5">
          <h2 className="text-lg font-bold">{t("Where you stand")}</h2>
          <p className="mb-2 text-sm text-muted">{t("Today, across all your accounts")}</p>
          <Row label={t("Cash & bank")} value={cashBank} href="/accounts" cur={cur} />
          <Row label={t("Customers owe you")} value={receivable} sign="+" href="/khata" cur={cur} />
          <Row label={t("You owe suppliers")} value={payable} sign="−" href="/khata" cur={cur} />
          <div className="total mt-3 flex items-baseline justify-between">
            <span>{t("Net position")}</span>
            <span className="tabular-nums text-2xl" dir="ltr"><span className="me-1 text-base font-semibold text-muted">{cur}</span><Money value={net} /></span>
          </div>
          <Link
            href={`/reports/income?from=${from}&to=${to}`}
            className={`mt-4 flex items-baseline justify-between rounded px-3 py-2 ${pl.profit >= 0 ? "bg-ledger-soft text-ledger" : "bg-khata-soft text-khata"}`}
          >
            <span className="font-semibold">{pl.profit >= 0 ? t("Profit this period") : t("Loss this period")}</span>
            <span className="tabular-nums font-bold" dir="ltr">{cur} {money(Math.abs(pl.profit))}</span>
          </Link>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold">{t("Cash & bank balance")}</h2>
          <p className="mb-3 text-sm text-muted">{t("How much money you held each day")}</p>
          <BalanceLine data={flow.days} cur={cur} name={t("Cash & bank")} empty={t("No entries in this period.")} />
        </div>
      </section>

      <section className="mb-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-bold">{t("Income and expenses")}</h2>
          <p className="mb-3 text-sm text-muted">{t("Last 6 months")}</p>
          <InOutBars data={months} cur={cur} labels={{ in: t("Income"), out: t("Expense") }} />
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold">{t("Biggest expenses")}</h2>
          <p className="mb-3 text-sm text-muted">{t("This period, largest first")}</p>
          <RankedBars data={topExpenses} cur={cur} name={t("Expense")} empty={t("No expenses in this period.")} color="#c2263a" />
        </div>
      </section>

      {budgetRows.length > 0 && (
        <div className="card mb-6 p-5">
          <h2 className="mb-3 text-lg font-bold">{t("Budgets this month")}</h2>
          <div className="space-y-3">
            {budgetRows.map((b) => {
              const pct = Math.min(100, Math.round((b.spent / b.budget) * 100));
              const over = b.spent > b.budget;
              return (
                <div key={b.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{b.name}</span>
                    <span className={over ? "font-semibold text-khata" : "text-muted"}>
                      {money(b.spent)} / {money(b.budget)} {over && <b className="ms-2">{t("over budget!")}</b>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-paper">
                    <div className={`h-2 rounded-full ${over ? "bg-khata" : pct > 80 ? "bg-marigold" : "bg-ledger"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{t("Categories")}</h2>
          <Link href="/accounts" className="text-sm font-semibold text-peacock underline">{t("All accounts")}</Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {cats.map((c) => (
            <li key={c.id}>
              <Link href={`/accounts#cat-${c.id}`} className="card flex h-full items-center gap-3 p-3.5 transition-colors hover:border-peacock">
                <CategoryBadge name={c.name} kind={c.kind} size="lg" color={c.color} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-body">{c.name}</span>
                  <span className="block text-lg font-bold text-ink"><Money value={c.balance} /></span>
                  {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-bold">{t("What you own")}</h2>
          <p className="mb-3 text-sm text-muted">{t("Your assets, by category")}</p>
          <CategoryDonut data={owned} cur={cur} empty={t("No entries yet.")} />
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold">{t("Category balances")}</h2>
          <p className="mb-3 text-sm text-muted">{t("What you own, owe and put in, side by side")}</p>
          <CategoryBars data={balanceCats} cur={cur} />
        </div>
      </section>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold">{t("Latest entries")}</h2>
          <Link href="/transactions" className="text-sm font-semibold text-peacock underline">{t("See all")}</Link>
        </div>
        {recent.length === 0 ? (
          <Empty>{t("No entries yet. Add your first one with “Money In” or “Money Out”.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>{t("Date")}</th><th className="hidden sm:table-cell">{t("Type")}</th><th>{t("From")} → {t("To")}</th><th className="hidden md:table-cell">{t("Note")}</th><th className="num">{t("Amount")}</th></tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} style={t.highlight ? { background: t.highlight + "33" } : undefined}>
                    <td className="whitespace-nowrap">{prettyDate(t.date)}</td>
                    <td className="hidden sm:table-cell"><TypeBadge type={t.type} /></td>
                    <td>{t.from_name} → {t.to_name}</td>
                    <td className="hidden text-muted md:table-cell">{t.note}</td>
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
