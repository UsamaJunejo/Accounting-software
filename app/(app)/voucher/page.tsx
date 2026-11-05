import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Eraser, FileText, Save, Trash2, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, getTransaction, listAttachments, listTransactions, MAX_ATTACHMENTS, projects, type TxnType } from "@/lib/books";
import { deleteAttachment, saveTransaction } from "@/app/actions/books";
import { MoneyFields } from "@/components/money-fields";
import { getT } from "@/lib/lang";
import { AttachmentPicker } from "@/components/attachment-picker";
import { today } from "@/lib/format";
import { AccountSelect, Flash, PageHeader } from "@/components/ui";
import { TxnTable } from "@/components/txn-table";

export const metadata = { title: "New Entry" };

const TABS: { type: TxnType; label: string; help: string; active: string; Icon: LucideIcon }[] = [
  { type: "payment", label: "Money Out (Payment)", help: "You paid someone: expense, purchase, supplier, salary…", active: "bg-khata text-white border-khata", Icon: ArrowUpRight },
  { type: "receipt", label: "Money In (Receipt)", help: "You received money: sale, customer payment, loan…", active: "bg-inflow text-white border-inflow", Icon: ArrowDownLeft },
  { type: "transfer", label: "Transfer", help: "Move money between your own accounts, e.g. Cash → Bank.", active: "bg-ink text-white border-ink", Icon: ArrowLeftRight },
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
  const d = await db();
  const t = await getT();
  const tr = t;
  const editing = sp.edit ? await getTransaction(d, user.id, Number(sp.edit)) : undefined;
  if (sp.edit && (!editing || editing.deleted_at)) notFound();
  const type = (editing?.type ?? (TABS.some((t) => t.type === sp.type) ? sp.type : "payment")) as TxnType;
  const tab = TABS.find((t) => t.type === type)!;

  const accounts = await accountsWithBalances(d, user.id);
  const cash = accounts.find((a) => a.category === "Cash")?.id;
  const bank = accounts.find((a) => a.category === "Bank")?.id;
  const pre = (v?: string) => (v && accounts.some((a) => a.id === Number(v)) ? Number(v) : undefined);
  const defFrom = editing?.from_account_id ?? pre(sp.from) ?? (type === "payment" || type === "transfer" ? cash : undefined);
  const defTo = editing?.to_account_id ?? pre(sp.to) ?? (type === "receipt" ? cash : type === "transfer" ? bank : undefined);
  const [recent, projectList, existing] = await Promise.all([
    listTransactions(d, user.id, { type, limit: 10 }),
    projects(d, user.id),
    editing ? listAttachments(d, user.id, editing.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title={editing ? `Edit entry #${editing.id}` : t("New entry")} subtitle={t(tab.help)} />
      {!editing && (
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.type}
              href={`/voucher?type=${t.type}`}
              className={`btn border ${t.type === type ? t.active : "border-rule-strong bg-sheet text-body hover:bg-ink-soft"}`}
            >
              <t.Icon className="h-4 w-4" />
              {tr(t.label)}
            </Link>
          ))}
        </div>
      )}
      <Flash sp={sp} />
      <form action={saveTransaction} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2" key={`${type}-${editing?.id ?? "new"}-${sp.ok ?? ""}`}>
        <input type="hidden" name="type" value={type} />
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <MoneyFields
          amount={editing ? (editing.amount / 100).toFixed(2) : ""}
          primary={user.currency}
          currency={editing?.currency ?? user.currency}
          foreignAmount={editing?.foreign_amount ? (editing.foreign_amount / 100).toFixed(2) : ""}
          rate={editing?.rate ? String(editing.rate) : ""}
        />
        <div>
          <label className="label">{t("Date")}</label>
          <input type="date" name="date" required defaultValue={editing?.date ?? today()} className="input" />
        </div>
        <div>
          <label className="label">{t("Project (optional)")}</label>
          <select name="project" defaultValue={editing?.project_id ?? ""} className="input">
            <option value="">{t("No project")}</option>
            {projectList.filter((p) => !p.archived || p.id === editing?.project_id).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t(type === "receipt" ? "Received from" : "From (money leaves)")}</label>
          <AccountSelect name="from" accounts={accounts} value={defFrom} />
        </div>
        <div>
          <label className="label">{t(type === "payment" ? "Paid to / for" : "To (money goes into)")}</label>
          <AccountSelect name="to" accounts={accounts} value={defTo} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">{t("Note")}</label>
          <textarea name="note" rows={2} defaultValue={editing?.note ?? ""} className="input" placeholder="e.g. Bill no. 245, 10 bags cement" />
        </div>
        <div>
          <label className="label">{t("Highlight")}</label>
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
        <div className="sm:col-span-2">
          {existing.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {existing.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border border-rule bg-paper px-2 py-1 text-xs">
                  <a href={`/api/attachments/${f.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-ink">
                    {f.mime.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/attachments/${f.id}`} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {f.filename}
                  </a>
                  <button formAction={deleteAttachment} name="attachment" value={f.id} formNoValidate className="text-khata" aria-label="Remove attachment">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AttachmentPicker max={MAX_ATTACHMENTS - existing.length} />
        </div>
        <div className="flex items-end justify-end gap-2 sm:col-span-2">
          {editing ? (
            <Link href="/transactions" className="btn-ghost">{t("Cancel")}</Link>
          ) : (
            <button type="reset" className="btn-ghost"><Eraser className="h-4 w-4" />{t("Clear")}</button>
          )}
          <button className="btn-primary px-8"><Save className="h-4 w-4" />{t(editing ? "Save changes" : "Save")}</button>
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          {t("Can't find the account?")} <Link href="/accounts" className="font-semibold text-brand">{t("Add it here")}</Link>.
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
