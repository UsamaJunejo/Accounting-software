import { Download, Filter, Plus, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTransactions, type TxnType } from "@/lib/books";
import { money, monthRange } from "@/lib/format";
import { Flash, LinkButton, PageHeader } from "@/components/ui";
import { TxnTable } from "@/components/txn-table";

export const metadata = { title: "Entries" };

export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; q?: string; error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const [mStart, mEnd] = monthRange();
  const from = sp.from ?? mStart;
  const to = sp.to ?? mEnd;
  const type = ["payment", "receipt", "transfer"].includes(sp.type ?? "") ? (sp.type as TxnType) : undefined;
  const rows = listTransactions(db(), user.id, { from, to, type, search: sp.q, limit: 2000 });
  const total = (t: TxnType) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);
  const qs = new URLSearchParams({ from, to, ...(type ? { type } : {}), ...(sp.q ? { q: sp.q } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="All entries"
        subtitle={`${rows.length} entries`}
        actions={
          <>
            <LinkButton href={`/export?${qs}`}><Download className="h-4 w-4" />Download Excel (CSV)</LinkButton>
            <LinkButton href="/voucher" variant="primary"><Plus className="h-4 w-4" />New entry</LinkButton>
          </>
        }
      />
      <Flash sp={sp} />
      <form className="card no-print mb-5 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">From</label>
          <input type="date" name="from" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" name="to" defaultValue={to} className="input" />
        </div>
        <div>
          <label className="label">Type</label>
          <select name="type" defaultValue={type ?? ""} className="input">
            <option value="">All</option>
            <option value="payment">Money Out</option>
            <option value="receipt">Money In</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="label">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input name="q" defaultValue={sp.q} placeholder="Account or note…" className="input pl-9" />
          </div>
        </div>
        <button className="btn-dark"><Filter className="h-4 w-4" />Filter</button>
      </form>
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="card p-3"><div className="text-slate-500">Money in</div><div className="font-bold text-green-700">{money(total("receipt"))}</div></div>
        <div className="card p-3"><div className="text-slate-500">Money out</div><div className="font-bold text-orange-600">{money(total("payment"))}</div></div>
        <div className="card p-3"><div className="text-slate-500">Transfers</div><div className="font-bold">{money(total("transfer"))}</div></div>
      </div>
      <div className="card overflow-hidden">
        <TxnTable rows={rows} back={`/transactions?${qs}`} />
      </div>
    </>
  );
}
