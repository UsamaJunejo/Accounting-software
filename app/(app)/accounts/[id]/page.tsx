import { fixRange } from "@/lib/format";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, MessageCircle, Pencil, PlusCircle, Share2 } from "lucide-react";
import { sharesOfAccount } from "@/lib/sharing";
import { headers } from "next/headers";
import { friendlyCategory } from "@/lib/look";
import { setStatementLink } from "@/app/actions/books";
import { currencySymbol } from "@/lib/currencies";
import { removeShare, shareAccount } from "@/app/actions/sharing";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountStatement, isMoney, shareTokenOf, statementColumns } from "@/lib/books";
import { money, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, Flash, LinkButton, Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { BalanceLine } from "@/components/charts";
import { ConfirmButton } from "@/components/confirm-button";

export default async function Statement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = fixRange(await searchParams);
  const to = sp.to || today();
  const from = sp.from || `${to.slice(0, 4)}-01-01`;
  let s;
  try {
    s = await accountStatement(await db(), user.id, Number(id), from, to);
  } catch {
    notFound();
  }
  const shares = await sharesOfAccount(await db(), user.id, s.account.id);
  const a = s.account;
  const cols = statementColumns(a);
  const isParty = a.role === "receivable" || a.role === "payable";
  const phone = a.phone?.replace(/\D/g, "").replace(/^0/, "92");
  const token = isParty ? await shareTokenOf(await db(), user.id, a.id) : null;
  const h = await headers();
  const link = token ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/s/${token}` : "";
  const cur = currencySymbol(user.currency);
  const waText = encodeURIComponent(
    `Assalam-o-Alaikum ${a.name}, your balance with ${user.business_name || user.name} is ${cur} ${money(Math.abs(s.closing))} as of ${prettyDate(to)}.${link ? `\nFull statement: ${link}` : ""}\nThank you.`,
  );
  // Khata wording: lena (you will receive) / dena (you will give).
  const isCustomer = a.role === "receivable";
  const lena = isParty && s.closing !== 0 ? ((isCustomer ? s.closing > 0 : s.closing < 0) ? "receive" : "give") : null;

  return (
    <>
      <PageHeader
        title={a.name}
        subtitle={`${friendlyCategory(a.category)} › ${a.subcategory} | Statement ${prettyDate(from)} to ${prettyDate(to)}`}
        actions={
          <>
            {isParty && phone && (
              <a href={`https://wa.me/${phone}?text=${waText}`} target="_blank" rel="noreferrer" className="btn bg-ledger text-white hover:bg-ledger-dark">
                <MessageCircle className="h-4 w-4" />
                Send on WhatsApp
              </a>
            )}
            {isMoney(a) && (
              <>
                {/* Money that comes into or goes out of this account, with the account already filled in. */}
                <Link href={`/voucher?type=receipt&to=${a.id}`} className="btn bg-inflow text-white hover:opacity-90"><ArrowDownLeft className="h-4 w-4" />Money In</Link>
                <Link href={`/voucher?type=payment&from=${a.id}`} className="btn bg-khata text-white hover:opacity-90"><ArrowUpRight className="h-4 w-4" />Money Out</Link>
              </>
            )}
            <PrintButton />
            <LinkButton href={`/accounts/${a.id}/edit#opening`}><PlusCircle className="h-4 w-4" />Starting balance</LinkButton>
            <LinkButton href={`/accounts/${a.id}/edit`}><Pencil className="h-4 w-4" />Edit account</LinkButton>
          </>
        }
      />
      {isParty && (
        <section className={`mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 text-white ${lena === "give" ? "bg-khata" : "bg-brand"}`}>
          <div>
            <div className="text-white/85">{lena === "receive" ? `You will receive from ${a.name}` : lena === "give" ? `You will give to ${a.name}` : "All settled"}</div>
            <div className="text-4xl font-bold tabular-nums" dir="ltr">{cur} {money(Math.abs(s.closing))}</div>
          </div>
          <form action={setStatementLink} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={a.id} />
            {token ? (
              <>
                <a href={`/s/${token}`} target="_blank" rel="noreferrer" className="rounded-md bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25">Open statement link</a>
                <input type="hidden" name="on" value="0" />
                <button className="rounded-md px-3 py-2 text-sm text-white/85 underline hover:text-white">Turn link off</button>
              </>
            ) : (
              <>
                <input type="hidden" name="on" value="1" />
                <button className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink">Make a statement link to send</button>
              </>
            )}
          </form>
        </section>
      )}
      {a.currency && a.native !== null && (
        <section className="card mb-5 flex flex-wrap items-baseline justify-between gap-3 p-5">
          <div>
            <div className="text-sm text-muted">Balance today</div>
            <div className="text-3xl font-bold tabular-nums text-ink" dir="ltr">{cur} <Money value={a.balance} /></div>
            <div className="text-lg font-semibold tabular-nums text-muted" dir="ltr">{a.currency} <Money value={a.native} /></div>
          </div>
          <div className="text-sm text-muted">
            This account is kept in {a.currency}.
            <span className="block text-xs">{cur} values use the rates you entered.</span>
          </div>
        </section>
      )}
      <DateRange from={from} to={to} />
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        {s.inCurrency && <p className="col-span-3 -mb-1 text-sm text-muted">Amounts below are in {s.inCurrency}.</p>}
        <div className="card p-3"><div className="text-muted">Opening balance</div><div className="font-bold"><Money value={s.opening} /></div></div>
        <div className="card p-3"><div className="text-muted">Entries</div><div className="font-bold">{s.lines.length}</div></div>
        <div className="card p-3"><div className="text-muted">Closing balance</div><div className="font-bold"><Money value={s.closing} /></div></div>
      </div>
      {s.lines.length > 1 && (
        <div className="card no-print mb-4 p-5">
          <h2 className="text-lg font-bold">Balance over time</h2>
          <p className="mb-3 text-sm text-muted">After each entry in this period</p>
          <BalanceLine
            data={[{ date: from, balance: s.opening }, ...s.lines.map((l) => ({ date: l.date, balance: l.balance }))]}
            cur={currencySymbol(s.inCurrency ?? user.currency)}
            name={a.name}
          />
        </div>
      )}
      <div className="card overflow-hidden">
        {s.lines.length === 0 ? (
          <Empty>No entries in this period.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Details</th><th>Note</th><th className="num">{cols[0]}</th><th className="num">{cols[1]}</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                <tr className="bg-paper font-medium"><td colSpan={5}>Opening balance</td><td className="num"><Money value={s.opening} /></td></tr>
                {s.lines.map((l) => (
                  <tr key={l.id} style={l.highlight ? { background: l.highlight + "33" } : undefined}>
                    <td className="whitespace-nowrap">{prettyDate(l.date)}</td>
                    <td>
                      <Link href={`/voucher?edit=${l.id}&back=${encodeURIComponent(`/accounts/${a.id}?from=${from}&to=${to}`)}`} className="hover:text-brand">{l.moneyIn ? "From " : "To "}{l.other}</Link>
                    </td>
                    <td className="text-muted">
                      {l.note}
                      {l.currency && l.foreign_amount ? <span className="block text-xs" dir="ltr">{l.currency} {money(l.foreign_amount)} @ {l.rate}</span> : null}
                    </td>
                    <td className="num text-inflow">{l.up ? money(l.up) : ""}</td>
                    <td className="num text-khata">{l.down ? money(l.down) : ""}</td>
                    <td className="num font-medium"><Money value={l.balance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <section id="sharing" className="card no-print mt-6 overflow-hidden">
        <h2 className="flex items-center gap-2 px-4 py-3 font-semibold text-ink"><Share2 className="h-5 w-5 text-brand" />Share this account</h2>
        <p className="px-4 text-sm text-muted">
          Let a partner, staff member or customer see this account&apos;s statement. They need a FinanceChachu account.
          If you let them add entries, each one waits for your approval in <Link href="/shared" className="font-semibold text-brand">Shared</Link>.
        </p>
        <Flash sp={sp} />
        <form action={shareAccount} className="flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="account" value={a.id} />
          <div className="min-w-56 flex-1">
            <label className="label">Their email</label>
            <input name="email" type="email" required className="input" placeholder="name@example.com" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="can_add" /> Can add entries
          </label>
          <button className="btn-dark"><Share2 className="h-4 w-4" />Share</button>
        </form>
        {shares.length > 0 && (
          <ul className="border-t border-rule">
            {shares.map((sh) => (
              <li key={sh.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2 text-sm">
                <div>
                  <b>{sh.user_name}</b> <span className="text-muted">{sh.user_email}</span>
                  <div className="text-xs text-muted">
                    {sh.status === "pending" ? "Invitation sent" : "Accepted"} · {sh.can_add ? "can add entries" : "view only"}
                  </div>
                </div>
                <form action={removeShare}>
                  <input type="hidden" name="id" value={sh.id} />
                  <input type="hidden" name="account" value={a.id} />
                  <ConfirmButton className="text-sm font-semibold text-khata" message={`Stop sharing "${a.name}" with ${sh.user_name}? They will no longer see it.`} confirmLabel="Stop sharing">Stop sharing</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
