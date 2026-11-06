import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Eraser, FileText, Save, Trash2, type LucideIcon } from "lucide-react";
import { DateField } from "@/components/date-field";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { type AccountChoice, accountsWithBalances, getTransaction, lastAccounts, listAttachments, listTransactions, MAX_ATTACHMENTS, projects, type TxnType } from "@/lib/books";

// What the two account boxes are called, in plain words, for each kind of entry.
const LABELS: Record<TxnType, [string, string]> = {
  payment: ["Paid from", "Paid for / to"],
  receipt: ["Received from", "Received into"],
  transfer: ["Move from", "Move to"],
};
import { deleteAttachment, saveTransaction } from "@/app/actions/books";
import { MoneyFields } from "@/components/money-fields";
import { EntryPreview } from "@/components/entry-preview";
import { EntryCheck } from "@/components/entry-check";
import { currencySymbol } from "@/lib/currencies";
import { getT } from "@/lib/lang";
import { AttachmentPicker } from "@/components/attachment-picker";
import { today } from "@/lib/format";
import { AccountSelect, Flash, PageHeader } from "@/components/ui";
import { TxnTable } from "@/components/txn-table";

export const metadata = { title: "New Entry" };

const TABS: { type: TxnType; label: string; help: string; active: string; Icon: LucideIcon }[] = [
  { type: "payment", label: "Money out", help: "You paid someone: expense, purchase, supplier, salary…", active: "bg-khata text-white border-khata", Icon: ArrowUpRight },
  { type: "receipt", label: "Money in", help: "You received money: sale, customer payment, loan…", active: "bg-inflow text-white border-inflow", Icon: ArrowDownLeft },
  { type: "transfer", label: "Move money", help: "Move money between your own accounts (e.g. Cash → Bank), or give goods on udhaar.", active: "bg-ink text-white border-ink", Icon: ArrowLeftRight },
];

/**
 * The everyday jobs from the Home page. Each opens this same form with the right kind of entry,
 * accounts already chosen where the app can know them, and labels in the job's own words.
 */
type Job = "sale" | "expense" | "udhaar" | "udhaar-back";
const JOBS: Record<Job, { type: TxnType; title: string; help: string; labels: [string, string]; suggest: [AccountChoice, AccountChoice] }> = {
  sale: { type: "receipt", title: "Record a sale", help: "Money a customer paid you now.", labels: ["Sale of", "Money went into"], suggest: ["income", "money"] },
  expense: { type: "payment", title: "Record an expense", help: "Money you spent: rent, bills, tea, salary…", labels: ["Paid from", "Spent on"], suggest: ["money", "expense"] },
  udhaar: { type: "transfer", title: "Udhaar given", help: "Goods given now, to be paid later. The customer's khata goes up.", labels: ["Sale of", "Given to (customer)"], suggest: ["income", "customer"] },
  "udhaar-back": { type: "receipt", title: "Udhaar paid back", help: "A customer paid back what they owed. Their khata goes down.", labels: ["Paid by (customer)", "Money went into"], suggest: ["customer", "money"] },
};

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
  searchParams: Promise<{ type?: string; do?: string; edit?: string; from?: string; to?: string; error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const t = await getT();
  const tr = t;
  const editing = sp.edit ? await getTransaction(d, user.id, Number(sp.edit)) : undefined;
  if (sp.edit && (!editing || editing.deleted_at)) notFound();
  const job = !editing && sp.do && sp.do in JOBS ? JOBS[sp.do as Job] : undefined;
  const type = (editing?.type ?? job?.type ?? (TABS.some((t) => t.type === sp.type) ? sp.type : "payment")) as TxnType;
  const tab = TABS.find((t) => t.type === type)!;

  const accounts = await accountsWithBalances(d, user.id);
  const cash = accounts.find((a) => a.role === "cash")?.id;
  const bank = accounts.find((a) => a.role === "bank")?.id;
  const pre = (v?: string) => (v && accounts.some((a) => a.id === Number(v)) ? Number(v) : undefined);
  // For the everyday jobs the app already knows one side: Sales, or Cash.
  const sales = accounts.find((a) => a.kind === "income" && a.name === "Sales" && !a.archived)?.id ?? accounts.find((a) => a.kind === "income" && !a.archived)?.id;
  const jobFrom = sp.do === "sale" || sp.do === "udhaar" ? sales : sp.do === "expense" ? cash : undefined;
  const jobTo = sp.do === "sale" || sp.do === "udhaar-back" ? cash : undefined;
  // Start from what the user picked last time for this kind of entry.
  const last = editing ? undefined : await lastAccounts(d, user.id, type);
  // An everyday job (from Home) starts from what the app knows; otherwise from the user's last choice.
  const defFrom = editing?.from_account_id ?? pre(sp.from) ?? (job ? jobFrom : pre(String(last?.from_account_id ?? "")) ?? (type === "payment" || type === "transfer" ? cash : undefined));
  const defTo = editing?.to_account_id ?? pre(sp.to) ?? (job ? jobTo : type === "receipt" ? pre(String(last?.to_account_id ?? "")) ?? cash : type === "transfer" ? pre(String(last?.to_account_id ?? "")) ?? bank : undefined);
  const [recent, projectList, existing] = await Promise.all([
    listTransactions(d, user.id, { type, limit: 10 }),
    projects(d, user.id),
    editing ? listAttachments(d, user.id, editing.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title={editing ? `Edit entry #${editing.id}` : job ? job.title : t("New entry")} subtitle={job ? job.help : t(tab.help)} />
      {job && (
        <p className="-mt-2 mb-4 text-sm"><Link href="/voucher" className="font-semibold text-brand underline">Another kind of entry</Link></p>
      )}
      {!editing && !job && (
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.type}
              href={`/voucher?type=${t.type}`}
              className={`btn border ${t.type === type ? t.active : "border-white/80 bg-white/60 text-body backdrop-blur hover:bg-white/90"}`}
            >
              <t.Icon className="h-4 w-4" />
              {tr(t.label)}
            </Link>
          ))}
        </div>
      )}
      <Flash sp={sp} />
      <form id="entry-form" action={saveTransaction} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2" key={`${type}-${editing?.id ?? "new"}-${sp.ok ?? ""}`}>
        <input type="hidden" name="type" value={type} />
        {job && <input type="hidden" name="do" value={sp.do} />}
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <MoneyFields
          amount={editing ? (editing.amount / 100).toFixed(2) : ""}
          primary={user.currency}
          currency={editing?.currency ?? user.currency}
          foreignAmount={editing?.foreign_amount ? (editing.foreign_amount / 100).toFixed(2) : ""}
          rate={editing?.rate ? String(editing.rate) : ""}
          accountCurrencies={Object.fromEntries(accounts.filter((a) => a.currency && a.currency !== user.currency).map((a) => [a.id, a.currency!]))}
        />
        <DateField defaultValue={editing?.date ?? today()} label={t("Date")} />
        <div>
          <label className="label">{job ? job.labels[0] : t(LABELS[type][0])}</label>
          <AccountSelect name="from" accounts={accounts} value={defFrom} suggest={job ? job.suggest[0] : type === "receipt" ? "income" : "money"} />
        </div>
        <div>
          <label className="label">{job ? job.labels[1] : t(LABELS[type][1])}</label>
          <AccountSelect name="to" accounts={accounts} value={defTo} suggest={job ? job.suggest[1] : type === "payment" ? "expense" : "money"} />
        </div>
        <EntryPreview
          tab={type}
          cur={currencySymbol(user.currency)}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, role: a.role, currency: a.currency, native: a.native, balance: editing && (a.id === editing.from_account_id) ? a.balance + editing.amount : a.balance }))}
        />
        <div className="sm:col-span-2">
          <label className="label">{t("Note")}</label>
          <textarea name="note" rows={2} defaultValue={editing?.note ?? ""} className="input" placeholder="e.g. Bill no. 245, 10 bags cement" />
        </div>
        {/* Extras most people don't need every time, kept out of the way. */}
        <details className="group sm:col-span-2" open={Boolean(editing && (editing.project_id || editing.highlight || existing.length))}>
          <summary className="cursor-pointer select-none py-1 text-[15px] font-semibold text-brand">
            {t("More options")} <span className="font-normal text-muted">({t("project, colour, bill photo")})</span>
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
          </div>
        </details>
        <EntryCheck formId="entry-form" />
        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:items-end sm:justify-end [&>*]:justify-center [&>*]:whitespace-nowrap">
          {editing ? (
            <Link href="/transactions" className="btn-ghost">{t("Cancel")}</Link>
          ) : (
            <button type="reset" className="btn-ghost"><Eraser className="h-4 w-4" />{t("Clear")}</button>
          )}
          {editing ? (
            <button className="btn-primary px-8"><Save className="h-4 w-4" />{t("Save changes")}</button>
          ) : (
            <>
              <button name="next" value="close" className="btn-ghost"><Check className="h-4 w-4" />{t("Save & close")}</button>
              <button name="next" value="again" className="btn-primary px-6"><Save className="h-4 w-4" />{t("Save & add another")}</button>
            </>
          )}
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
