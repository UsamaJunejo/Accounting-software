import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowRightLeft, Merge, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountImpact, accountsWithBalances } from "@/lib/books";
import { money, prettyDate } from "@/lib/format";
import { currencySymbol } from "@/lib/currencies";
import { AccountSelect, Flash, Money, PageHeader } from "@/components/ui";
import { deleteAccount, deleteAccountEverything, mergeAccount } from "@/app/actions/books";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata = { title: "Delete account" };

/** Before deleting an account: what it holds, what would change, and the ways to deal with its balance. */
export default async function DeleteAccount({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  const d = await db();
  let imp;
  try {
    imp = await accountImpact(d, user.id, id);
  } catch {
    notFound();
  }
  const a = imp.account;
  const cur = currencySymbol(user.currency);
  const n = imp?.entries ?? 0;
  const entriesWord = `${n} ${n === 1 ? "entry" : "entries"}`;
  const same = (await accountsWithBalances(d, user.id)).filter((x) => x.id !== a.id && !x.archived && (x.currency ?? null) === (a.currency ?? null));

  // Never used: nothing to sort out.
  if (imp.entries === 0)
    return (
      <>
        <PageHeader title={`Delete ${a.name}?`} subtitle="It has no entries, so nothing else changes." />
        <Flash sp={sp} />
        <form action={deleteAccount} className="card max-w-xl space-y-3 p-5">
          <input type="hidden" name="id" value={a.id} />
          <p>{imp.schedules > 0 && `Its ${imp.schedules} repeating ${imp.schedules === 1 ? "entry" : "entries"} will be removed too. `}This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button className="btn-danger"><Trash2 className="h-4 w-4" />Delete {a.name}</button>
            <Link href={`/accounts/${a.id}`} className="btn-ghost">Keep it</Link>
          </div>
        </form>
      </>
    );

  return (
    <>
      <PageHeader title={`Delete ${a.name}?`} subtitle="It is in use. Here is what it holds and the ways to deal with it." />
      <Flash sp={sp} />

      <section className="card mb-5 grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <div className="text-sm text-muted">Balance now</div>
          <div className="text-2xl font-bold" dir="ltr">{cur} <Money value={a.balance} /></div>
          {a.currency && a.native !== null && <div className="text-sm text-muted" dir="ltr">{a.currency} {money(a.native)}</div>}
        </div>
        <div>
          <div className="text-sm text-muted">Entries</div>
          <div className="text-2xl font-bold">{imp.entries}</div>
          {imp.first && <div className="text-sm text-muted">{prettyDate(imp.first)} to {prettyDate(imp.last!)}</div>}
        </div>
        <div className="text-sm text-muted">
          {imp.invoices > 0 && <div>{imp.invoices} invoice{imp.invoices === 1 ? "" : "s"} linked</div>}
          {imp.schedules > 0 && <div>{imp.schedules} repeating entr{imp.schedules === 1 ? "y" : "ies"}</div>}
          {imp.shares > 0 && <div>Shared with {imp.shares} {imp.shares === 1 ? "person" : "people"}</div>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 1. Recommended: move into another account */}
        <form action={mergeAccount} className="card space-y-3 border-2 border-brand/30 p-5">
          <input type="hidden" name="id" value={a.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold"><Merge className="h-5 w-5 text-brand" />Move it into another account <span className="rounded bg-peacock-soft px-1.5 text-xs font-semibold text-brand">Best</span></h2>
          <p className="text-[15px] text-body">
            {n === 1 ? "Its 1 entry" : `All ${n} entries`}{imp.invoices ? ", invoices" : ""}{imp.schedules ? " and repeating entries" : ""} move to the account you choose, so its
            balance of <b dir="ltr">{cur} {money(a.balance)}</b> moves there too. No totals change and nothing is lost.
          </p>
          {same.length ? (
            <>
              <div>
                <label className="label">Move into</label>
                <AccountSelect name="into" accounts={same} placeholder="Choose an account" />
              </div>
              <ConfirmButton className="btn-primary" message={`Move everything from ${a.name} into the chosen account and delete ${a.name}?`} confirmLabel="Move and delete">
                <ArrowRightLeft className="h-4 w-4" />Move and delete
              </ConfirmButton>
            </>
          ) : (
            <p className="text-sm text-muted">You have no other account in {a.currency ?? "your main currency"}. Add one first, or change this account&apos;s currency.</p>
          )}
        </form>

        {/* 2. Delete with its entries */}
        <form action={deleteAccountEverything} className="card space-y-3 border border-khata/30 p-5">
          <input type="hidden" name="id" value={a.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold text-khata"><Trash2 className="h-5 w-5" />Delete it with all its entries</h2>
          <p className="text-[15px] text-body">Its {entriesWord} {n === 1 ? "is" : "are"} removed for good, so these balances change:</p>
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-white/60 text-[15px]">
            <li className="flex justify-between px-3 py-2"><span>{a.name}</span><span className="font-semibold">deleted</span></li>
            {imp.others.map((o) => (
              <li key={o.id} className="flex justify-between gap-2 px-3 py-2">
                <span>{o.name}</span>
                <span className={`font-semibold tabular-nums ${o.change < 0 ? "text-khata" : "text-inflow"}`} dir="ltr">{o.change > 0 ? "+" : "−"}{cur} {money(Math.abs(o.change))}</span>
              </li>
            ))}
          </ul>
          {imp.invoices > 0 && <p className="text-sm text-muted">Invoices keep the customer&apos;s name but are no longer linked to an account.</p>}
          <div>
            <label className="label" htmlFor="del-confirm">Type DELETE to confirm</label>
            <input id="del-confirm" name="confirm" required autoComplete="off" className="input" />
          </div>
          <button className="btn-danger"><Trash2 className="h-4 w-4" />Delete {a.name} and its entries</button>
        </form>
      </div>

      {/* 3. Other ways */}
      <section className="card mt-5 space-y-2 p-5 text-[15px]">
        <h2 className="text-lg font-bold">Other ways to sort out the balance</h2>
        <p><b>Move just the money:</b> make a <Link href={`/voucher?type=transfer&from=${a.id}`} className="font-semibold text-brand underline">Transfer</Link> from {a.name} to another account for the balance, then archive it.</p>
        <p><b>Write it off:</b> if the money is really gone (e.g. a customer won&apos;t pay), record a <Link href={`/voucher?type=transfer&from=${a.id}`} className="font-semibold text-brand underline">Transfer</Link> from {a.name} to an expense like &ldquo;Bad debts&rdquo;.</p>
        <p><Archive className="me-1 inline h-4 w-4 align-[-2px] text-muted" /><b>Just hide it:</b> once its balance is zero, tick &ldquo;Archived&rdquo; on its <Link href={`/accounts/${a.id}/edit`} className="font-semibold text-brand underline">edit page</Link>. Its history stays.</p>
      </section>
    </>
  );
}
