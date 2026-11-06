import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, budgets, cashBankDaily, categories, listTransactions, monthlyTotals, summarizeIncome } from "@/lib/books";
import { friendlyDate, money, monthRange, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, Money, PageHeader } from "@/components/ui";
import { TxnTable } from "@/components/txn-table";
import { BalanceLine, CategoryBars, CategoryDonut, InOutBars, RankedBars } from "@/components/charts";
import { categoryColor } from "@/lib/palette";
import { currencySymbol } from "@/lib/currencies";
import { getT } from "@/lib/lang";
import { CategoryBadge } from "@/components/icons";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookUser, Circle, CircleCheck, FileText } from "lucide-react";
import { cookies } from "next/headers";
import { hideChecklist } from "@/app/actions/lang";
import { friendlyCategory } from "@/lib/look";

const QUICK = [
  { href: "/voucher?type=receipt", label: "Money In", Icon: ArrowDownLeft },
  { href: "/voucher?type=payment", label: "Money Out", Icon: ArrowUpRight },
  { href: "/voucher?type=transfer", label: "Transfer", Icon: ArrowLeftRight },
  { href: "/invoices/new", label: "Invoice", Icon: FileText },
  { href: "/khata", label: "Khata", Icon: BookUser },
];

export const metadata = { title: "Dashboard" };

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

  const cashBank = sumBy(all, (a) => a.role === "cash" || a.role === "bank");
  const receivable = sumBy(all, (a) => a.role === "receivable");
  const payable = sumBy(all, (a) => a.role === "payable");
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
  // Net worth counts everything: stock, equipment and loans too, not only cash and khata.
  const net = sumBy(all, (a) => a.kind === "asset") - sumBy(all, (a) => a.kind === "liability");

  // "Getting started" checklist for new users; disappears when done or hidden.
  const anyEntry = all.some((a) => a.money_in || a.money_out);
  const steps = [
    { title: "Add the cash you have today", how: "Money In from Owner Capital to Cash", href: "/voucher?type=receipt", done: anyEntry },
    { title: "Add your first customer", how: "Khata → add their name and mobile", href: "/khata", done: all.some((a) => a.role === "receivable") },
    { title: "Record a sale", how: "Money In from Sales, or make an invoice", href: "/voucher?type=receipt", done: all.some((a) => a.kind === "income" && a.balance > 0) },
    { title: "Save your recovery code", how: "So you can get back in if you forget your password", href: "/recovery-code", done: user.has_recovery },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const showStart = doneCount < steps.length && (await cookies()).get("hide-start")?.value !== "1";

  return (
    <>
      <PageHeader
        title={`${t("Assalam-o-Alaikum")}, ${user.name.split(" ")[0]}`}
        subtitle={`${prettyDate(from)} ${t("to")} ${prettyDate(to)}`}
      />
      {showStart && (
        <section className="card mb-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Getting started</h2>
              <p className="text-sm text-muted">{doneCount} of {steps.length} done. Four small steps and your books are set up.</p>
            </div>
            <form action={hideChecklist}><button className="text-sm font-semibold text-muted underline hover:text-ink">Hide this</button></form>
          </div>
          <div className="my-3 h-2 rounded-full bg-paper"><div className="h-2 rounded-full bg-ledger" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.title}>
                <Link href={s.href} className={`flex items-start gap-3 rounded-lg border p-3 ${s.done ? "border-ledger/30 bg-ledger-soft/60" : "border-rule bg-white/60 hover:border-peacock"}`}>
                  {s.done ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-ledger" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                  <span>
                    <span className={`block font-semibold ${s.done ? "text-ledger line-through decoration-1" : "text-ink"}`}>{s.title}</span>
                    {!s.done && <span className="block text-sm text-muted">{s.how}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* The balance card, like the top of a banking app. */}
        <div className="rounded-2xl bg-brand p-6 text-white shadow-[0_18px_40px_-20px_var(--color-brand)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[15px] text-white/85">{t("Net worth")}</div>
              <div className="mt-1 text-[2.5rem] font-bold leading-tight tracking-tight tabular-nums sm:text-5xl" dir="ltr">
                <span className="me-2 text-2xl font-semibold text-white/80">{cur}</span>
                {money(net)}
              </div>
              <div className="mt-1 text-sm text-white/80">{t("Everything you own minus everything you owe")}</div>
            </div>
            <Link
              href={`/reports/income?from=${from}&to=${to}`}
              className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink"
            >
              {pl.profit >= 0 ? t("Profit this period") : t("Loss this period")}:{" "}
              <span className={pl.profit >= 0 ? "text-ledger" : "text-khata"} dir="ltr">{cur} {money(Math.abs(pl.profit))}</span>
            </Link>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              [t("Cash & bank"), cashBank, "/accounts"],
              [t("Customers owe you"), receivable, "/khata"],
              [t("You owe suppliers"), payable, "/khata"],
            ].map(([label, value, href]) => (
              <Link key={String(label)} href={String(href)} className="rounded-xl bg-white/12 px-2.5 py-2.5 ring-1 ring-white/15 hover:bg-white/20 sm:px-4 sm:py-3">
                <dt className="text-xs leading-snug text-white/85 sm:text-sm">{label}</dt>
                <dd className="text-[15px] font-bold tabular-nums sm:text-xl" dir="ltr">{money(Number(value))}</dd>
              </Link>
            ))}
          </dl>
          <nav className="mt-6 grid grid-cols-5 gap-2" aria-label={t("Quick actions")}>
            {QUICK.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="group flex flex-col items-center gap-1.5 text-center text-sm text-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand shadow-sm transition-transform group-hover:-translate-y-0.5">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="leading-tight">{t(label)}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold">{t("Cash & bank balance")}</h2>
          <p className="mb-3 text-sm text-muted">{t("How much money you held each day")}</p>
          <BalanceLine data={flow.days} cur={cur} name={t("Cash & bank")} empty={t("No entries in this period.")} />
        </div>
      </section>

      <DateRange from={from} to={to} />

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
              <Link href={`/accounts/category/${c.id}`} className="card flex h-full items-center gap-3 p-3.5 transition-colors hover:border-peacock">
                <CategoryBadge name={c.name} kind={c.kind} size="lg" color={c.color} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-body">{friendlyCategory(c.name)}</span>
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
          <TxnTable rows={recent} back="/dashboard" />
        )}
      </div>
    </>
  );
}
