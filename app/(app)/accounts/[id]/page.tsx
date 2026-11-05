import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountStatement } from "@/lib/books";
import { money, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, LinkButton, Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export default async function Statement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const to = sp.to || today();
  const from = sp.from || `${to.slice(0, 4)}-01-01`;
  let s;
  try {
    s = accountStatement(db(), user.id, Number(id), from, to);
  } catch {
    notFound();
  }
  const a = s.account;
  const isParty = a.category === "Receivables" || a.category === "Payables";
  const phone = a.phone?.replace(/\D/g, "").replace(/^0/, "92");
  const waText = encodeURIComponent(
    `Assalam-o-Alaikum ${a.name}, your balance with ${user.business_name || user.name} is Rs ${money(Math.abs(s.closing))} as of ${prettyDate(to)}. Thank you.`,
  );

  return (
    <>
      <PageHeader
        title={a.name}
        subtitle={`${a.category} › ${a.subcategory} · Statement ${prettyDate(from)} to ${prettyDate(to)}`}
        actions={
          <>
            {isParty && phone && (
              <a href={`https://wa.me/${phone}?text=${waText}`} target="_blank" rel="noreferrer" className="btn bg-green-600 text-white hover:bg-green-700">
                Send on WhatsApp
              </a>
            )}
            <PrintButton />
            <LinkButton href={`/accounts/${a.id}/edit`}>Edit account</LinkButton>
          </>
        }
      />
      <DateRange from={from} to={to} />
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="card p-3"><div className="text-slate-500">Opening balance</div><div className="font-bold"><Money value={s.opening} /></div></div>
        <div className="card p-3"><div className="text-slate-500">Entries</div><div className="font-bold">{s.lines.length}</div></div>
        <div className="card p-3"><div className="text-slate-500">Closing balance</div><div className="font-bold"><Money value={s.closing} /></div></div>
      </div>
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
                <tr className="bg-slate-50 font-medium"><td colSpan={5}>Opening balance</td><td className="num"><Money value={s.opening} /></td></tr>
                {s.lines.map((l) => (
                  <tr key={l.id} style={l.highlight ? { background: l.highlight + "33" } : undefined}>
                    <td className="whitespace-nowrap">{prettyDate(l.date)}</td>
                    <td>
                      <Link href={`/voucher?edit=${l.id}`} className="hover:text-brand">{l.moneyIn ? "From " : "To "}{l.other}</Link>
                    </td>
                    <td className="text-slate-500">{l.note}</td>
                    <td className="num text-green-700">{l.moneyIn ? money(l.moneyIn) : ""}</td>
                    <td className="num text-orange-600">{l.moneyOut ? money(l.moneyOut) : ""}</td>
                    <td className="num font-medium"><Money value={l.balance} /></td>
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
