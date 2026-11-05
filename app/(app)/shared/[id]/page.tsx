import { notFound } from "next/navigation";
import { Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sharedStatement } from "@/lib/sharing";
import { submitEntry } from "@/app/actions/sharing";
import { money, prettyDate, today } from "@/lib/format";
import { DateRange, Empty, Flash, Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default async function SharedAccount({
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
    s = await sharedStatement(await db(), user.id, Number(id), from, to);
  } catch {
    notFound();
  }
  const owner = s.share.owner_business || s.share.owner_name;

  return (
    <>
      <PageHeader title={s.share.account} subtitle={`Shared by ${owner} · ${prettyDate(from)} to ${prettyDate(to)}`} actions={<PrintButton />} />
      <Flash sp={sp} />
      <DateRange from={from} to={to} />
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div className="card p-3"><div className="text-slate-500">Opening balance</div><div className="font-bold"><Money value={s.opening} /></div></div>
        <div className="card p-3"><div className="text-slate-500">Balance now</div><div className="text-lg font-bold"><Money value={s.closing} /></div></div>
      </div>

      {s.share.can_add && (
        <form action={submitEntry} className="card no-print mb-5 grid gap-3 p-4 sm:grid-cols-4">
          <input type="hidden" name="share" value={s.share.id} />
          <h2 className="font-semibold text-ink sm:col-span-4">Add an entry (sent to {owner} for approval)</h2>
          <div>
            <label className="label">Type</label>
            <select name="direction" className="input" defaultValue="decrease">
              <option value="decrease">− Subtract from balance (e.g. I paid)</option>
              <option value="increase">+ Add to balance (e.g. I took goods)</option>
            </select>
          </div>
          <div>
            <label className="label">Amount (PKR)</label>
            <input name="amount" inputMode="decimal" required className="input" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" name="date" defaultValue={today()} required className="input" />
          </div>
          <div>
            <label className="label">Note</label>
            <input name="note" className="input" placeholder="e.g. Paid by JazzCash" />
          </div>
          <div className="sm:col-span-4">
            <button className="btn-primary"><Send className="h-4 w-4" />Send for approval</button>
          </div>
        </form>
      )}

      <div className="card mb-5 overflow-x-auto">
        {s.lines.length === 0 ? (
          <Empty>No entries in this period.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Date</th><th>Note</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th></tr></thead>
            <tbody>
              <tr className="bg-slate-50 font-medium"><td colSpan={4}>Opening balance</td><td className="num"><Money value={s.opening} /></td></tr>
              {s.lines.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{prettyDate(l.date)}</td>
                  <td className="text-slate-600">{l.note}</td>
                  <td className="num text-green-700">{l.moneyIn ? money(l.moneyIn) : ""}</td>
                  <td className="num text-orange-600">{l.moneyOut ? money(l.moneyOut) : ""}</td>
                  <td className="num font-medium"><Money value={l.balance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {s.submissions.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="p-4 font-semibold text-ink">Entries you sent</h2>
          <table className="table">
            <thead><tr><th>Date</th><th>Type</th><th>Note</th><th className="num">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {s.submissions.map((e) => (
                <tr key={e.id}>
                  <td>{prettyDate(e.date)}</td>
                  <td>{e.direction === "increase" ? "+ Add" : "− Subtract"}</td>
                  <td className="text-slate-600">{e.note}</td>
                  <td className="num">{money(e.amount)}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${STATUS[e.status]}`}>{e.status}</span>
                    {e.remarks && <div className="text-xs text-slate-500">{e.remarks}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
