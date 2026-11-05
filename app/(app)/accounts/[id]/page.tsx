import Link from "next/link";
import { MessageCircle, Pencil, Share2 } from "lucide-react";
import { sharesOfAccount } from "@/lib/sharing";
import { currencySymbol } from "@/lib/currencies";
import { removeShare, shareAccount } from "@/app/actions/sharing";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountStatement } from "@/lib/books";
import { money, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, Flash, LinkButton, Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { BalanceLine } from "@/components/charts";

export default async function Statement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
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
  const isParty = a.category === "Receivables" || a.category === "Payables";
  const phone = a.phone?.replace(/\D/g, "").replace(/^0/, "92");
  const waText = encodeURIComponent(
    `Assalam-o-Alaikum ${a.name}, your balance with ${user.business_name || user.name} is ${currencySymbol(user.currency)} ${money(Math.abs(s.closing))} as of ${prettyDate(to)}. Thank you.`,
  );

  return (
    <>
      <PageHeader
        title={a.name}
        subtitle={`${a.category} › ${a.subcategory} · Statement ${prettyDate(from)} to ${prettyDate(to)}`}
        actions={
          <>
            {isParty && phone && (
              <a href={`https://wa.me/${phone}?text=${waText}`} target="_blank" rel="noreferrer" className="btn bg-ledger text-white hover:bg-ledger-dark">
                <MessageCircle className="h-4 w-4" />
                Send on WhatsApp
              </a>
            )}
            <PrintButton />
            <LinkButton href={`/accounts/${a.id}/edit`}><Pencil className="h-4 w-4" />Edit account</LinkButton>
          </>
        }
      />
      <DateRange from={from} to={to} />
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
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
            cur={currencySymbol(user.currency)}
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
                <tr><th>Date</th><th>Details</th><th>Note</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                <tr className="bg-paper font-medium"><td colSpan={5}>Opening balance</td><td className="num"><Money value={s.opening} /></td></tr>
                {s.lines.map((l) => (
                  <tr key={l.id} style={l.highlight ? { background: l.highlight + "33" } : undefined}>
                    <td className="whitespace-nowrap">{prettyDate(l.date)}</td>
                    <td>
                      <Link href={`/voucher?edit=${l.id}`} className="hover:text-brand">{l.moneyIn ? "From " : "To "}{l.other}</Link>
                    </td>
                    <td className="text-muted">{l.note}</td>
                    <td className="num text-inflow">{l.moneyIn ? money(l.moneyIn) : ""}</td>
                    <td className="num text-khata">{l.moneyOut ? money(l.moneyOut) : ""}</td>
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
                  <button className="text-sm font-semibold text-khata">Stop sharing</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
