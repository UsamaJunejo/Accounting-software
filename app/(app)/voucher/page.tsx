import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Eraser, Save, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, getTransaction, listTransactions, type TxnType } from "@/lib/books";
import { saveTransaction } from "@/app/actions/books";
import { today } from "@/lib/format";
import { AccountSelect, Flash, PageHeader } from "@/components/ui";
import { TxnTable } from "@/components/txn-table";

export const metadata = { title: "New Entry" };

const TABS: { type: TxnType; label: string; help: string; active: string; Icon: LucideIcon }[] = [
  { type: "payment", label: "Money Out (Payment)", help: "You paid someone: expense, purchase, supplier, salary…", active: "bg-brand text-white", Icon: ArrowUpRight },
  { type: "receipt", label: "Money In (Receipt)", help: "You received money: sale, customer payment, loan…", active: "bg-green-600 text-white", Icon: ArrowDownLeft },
  { type: "transfer", label: "Transfer", help: "Move money between your own accounts, e.g. Cash → Bank.", active: "bg-ink text-white", Icon: ArrowLeftRight },
];

const HIGHLIGHTS = [
  ["", "None"],
  ["#facc15", "Yellow"],
  ["#4ade80", "Green"],
  ["#60a5fa", "Blue"],
  ["#f472b6", "Pink"],
];

export default async function Voucher({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; edit?: string; from?: string; to?: string; error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = db();
  const editing = sp.edit ? getTransaction(d, user.id, Number(sp.edit)) : undefined;
  if (sp.edit && (!editing || editing.deleted_at)) notFound();
  const type = (editing?.type ?? (TABS.some((t) => t.type === sp.type) ? sp.type : "payment")) as TxnType;
  const tab = TABS.find((t) => t.type === type)!;

  const accounts = accountsWithBalances(d, user.id);
  const cash = accounts.find((a) => a.category === "Cash")?.id;
  const bank = accounts.find((a) => a.category === "Bank")?.id;
  const pre = (v?: string) => (v && accounts.some((a) => a.id === Number(v)) ? Number(v) : undefined);
  const defFrom = editing?.from_account_id ?? pre(sp.from) ?? (type === "payment" || type === "transfer" ? cash : undefined);
  const defTo = editing?.to_account_id ?? pre(sp.to) ?? (type === "receipt" ? cash : type === "transfer" ? bank : undefined);
  const recent = listTransactions(d, user.id, { type, limit: 10 });

  return (
    <>
      <PageHeader title={editing ? `Edit entry #${editing.id}` : "New entry"} subtitle={tab.help} />
      {!editing && (
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.type}
              href={`/voucher?type=${t.type}`}
              className={`btn ${t.type === type ? t.active : "border border-slate-300 bg-white text-slate-700"}`}
            >
              <t.Icon className="h-4 w-4" />
              {t.label}
            </Link>
          ))}
        </div>
      )}
      <Flash sp={sp} />
      <form action={saveTransaction} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2" key={`${type}-${editing?.id ?? "new"}-${sp.ok ?? ""}`}>
        <input type="hidden" name="type" value={type} />
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div>
          <label className="label">Amount (PKR)</label>
          <input
            name="amount"
            inputMode="decimal"
            required
            autoFocus
            placeholder="0.00"
            defaultValue={editing ? (editing.amount / 100).toFixed(2) : ""}
            className="input text-lg font-semibold"
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" name="date" required defaultValue={editing?.date ?? today()} className="input" />
        </div>
        <div>
          <label className="label">{type === "receipt" ? "Received from" : "From (money leaves)"}</label>
          <AccountSelect name="from" accounts={accounts} value={defFrom} />
        </div>
        <div>
          <label className="label">{type === "payment" ? "Paid to / for" : "To (money goes into)"}</label>
          <AccountSelect name="to" accounts={accounts} value={defTo} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Note</label>
          <textarea name="note" rows={2} defaultValue={editing?.note ?? ""} className="input" placeholder="e.g. Bill no. 245, 10 bags cement" />
        </div>
        <div>
          <label className="label">Highlight</label>
          <div className="flex flex-wrap gap-3 pt-1">
            {HIGHLIGHTS.map(([c, n]) => (
              <label key={n} className="flex items-center gap-1 text-sm">
                <input type="radio" name="highlight" value={c} defaultChecked={(editing?.highlight ?? "") === c} />
                <span className="inline-block h-4 w-4 rounded border" style={{ background: c || "white" }} />
                {n}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          {editing ? (
            <Link href="/transactions" className="btn-ghost">Cancel</Link>
          ) : (
            <button type="reset" className="btn-ghost"><Eraser className="h-4 w-4" />Clear</button>
          )}
          <button className="btn-primary px-8"><Save className="h-4 w-4" />{editing ? "Save changes" : "Save"}</button>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2">
          Can&apos;t find the account? <Link href="/accounts" className="font-semibold text-brand">Add it here</Link>.
        </p>
      </form>

      {!editing && (
        <div className="card overflow-hidden">
          <h2 className="p-4 font-semibold text-ink">Recent {tab.label.toLowerCase()} entries</h2>
          <TxnTable rows={recent} back={`/voucher?type=${type}`} />
        </div>
      )}
    </>
  );
}
