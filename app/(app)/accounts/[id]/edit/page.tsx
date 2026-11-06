import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, categories, startingBalanceOf, subcategories } from "@/lib/books";
import { addStartingBalance } from "@/app/actions/books";
import { AccountForm } from "@/components/organize-forms";
import { money, prettyDate, today } from "@/lib/format";
import { Flash, PageHeader } from "@/components/ui";
import { CurrencyPick } from "@/components/currency-pick";

export default async function EditAccount({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await db();
  const a = (await accountsWithBalances(d, user.id)).find((x) => x.id === Number(id));
  if (!a) notFound();
  const cats = await categories(d, user.id);
  const subs = await subcategories(d, user.id);
  const start = await startingBalanceOf(d, user.id, a.id);
  const startHelp =
    a.role === "cash" || a.role === "bank"
      ? `How much money was already in ${a.name} before you started using FinanceChachu.`
      : a.role === "receivable"
        ? `How much ${a.name} already owed you before you started.`
        : a.role === "payable"
          ? `How much you already owed ${a.name} before you started.`
          : `The balance ${a.name} already had before you started.`;

  return (
    <>
      <PageHeader title={`Edit: ${a.name}`} />
      <Flash sp={sp} />
      <div className="card mb-4 max-w-2xl p-5">
        <AccountForm
          mode="edit"
          categories={cats}
          subs={subs}
          level={user.level}
          primary={user.currency}
          back={`/accounts/${a.id}/edit`}
          account={{ id: a.id, name: a.name, subcategory_id: a.subcategory_id, category_id: a.category_id, phone: a.phone, budget: a.budget_monthly, currency: a.currency, archived: a.archived }}
        />
        <Link href={`/accounts/${a.id}`} className="btn-ghost mt-3 w-full justify-center"><FileText className="h-4 w-4" />View statement</Link>
      </div>
      {(a.kind === "asset" || a.kind === "liability") && (
      <form id="opening" action={addStartingBalance} className="card mb-4 grid max-w-2xl gap-4 p-5 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <input type="hidden" name="id" value={a.id} />
        <h2 className="text-lg font-bold sm:col-span-3">{start ? "Change starting balance" : "Set starting balance"}</h2>
        <p className="-mt-2 text-sm text-muted sm:col-span-3">
          {startHelp}
          {start && (
            <span className="mt-1 block font-semibold text-ink">
              Now: {a.currency && start.foreign_amount ? `${a.currency} ${money(start.foreign_amount)} (${user.currency} ${money(start.amount)})` : `${user.currency} ${money(start.amount)}`} as of {prettyDate(start.date)}. A new amount replaces it.
            </span>
          )}
        </p>
        <div>
          <label className="label" htmlFor="opening-amount">Amount ({a.currency ?? user.currency})</label>
          <input id="opening-amount" name="opening" inputMode="decimal" required placeholder="e.g. 300000" defaultValue={start ? String((start.foreign_amount ?? start.amount) / 100) : undefined} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="opening-date">As of</label>
          <input id="opening-date" name="date" type="date" defaultValue={start?.date ?? today()} className="input" />
        </div>
        {a.currency && (
          <div className="sm:col-span-3">
            <CurrencyPick primary={user.currency} fixed={a.currency} needRate />
          </div>
        )}
        <button className="btn-dark">{start ? "Change" : "Save"}</button>
      </form>
      )}
      <div className="max-w-2xl">
        <Link href={`/accounts/${a.id}/delete`} className="btn-danger"><Trash2 className="h-4 w-4" />Delete account</Link>
        <p className="mt-1 text-xs text-muted">You&apos;ll see what it affects, and how to deal with its balance, before anything is deleted.</p>
      </div>

    </>
  );
}
