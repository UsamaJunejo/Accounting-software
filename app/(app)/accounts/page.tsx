import Link from "next/link";
import { Archive, ChevronRight, Download, FolderPlus, Layers, Pencil, Plus } from "lucide-react";
import { CategoryBadge } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, categories, KIND_LABEL, subcategories, type Kind } from "@/lib/books";
import * as A from "@/app/actions/books";
import { Flash, Money, PageHeader } from "@/components/ui";

export const metadata = { title: "Accounts" };

export default async function Accounts({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; archived?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const cats = await categories(d, user.id);
  const subs = await subcategories(d, user.id);
  const accs = (await accountsWithBalances(d, user.id)).filter((a) => sp.archived || !a.archived);

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Category → Sub-category → Account. Click an account to see its full statement."
        actions={
          <>
          <Link href="/export?what=accounts" className="btn-ghost"><Download className="h-4 w-4" />Download</Link>
          <Link href={sp.archived ? "/accounts" : "/accounts?archived=1"} className="btn-ghost">
            <Archive className="h-4 w-4" />
            {sp.archived ? "Hide archived" : "Show archived"}
          </Link>
          </>
        }
      />
      <Flash sp={sp} />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <form action={A.addAccount} className="card space-y-3 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Plus className="h-5 w-5 text-brand" />Add account</h2>
          <select name="subcategory" required className="input" defaultValue="">
            <option value="" disabled>Choose sub-category</option>
            {cats.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {subs.filter((s) => s.category_id === c.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <input name="name" required placeholder="Account name, e.g. Ahmed Traders" className="input" />
          <input name="phone" placeholder="Mobile (for khata reminders)" className="input" />
          <input name="budget" inputMode="decimal" placeholder="Monthly budget (optional)" className="input" />
          <button className="btn-primary w-full">Add account</button>
        </form>
        <form action={A.addSubcategory} className="card space-y-3 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Layers className="h-5 w-5 text-brand" />Add sub-category</h2>
          <select name="category" required className="input" defaultValue="">
            <option value="" disabled>Choose category</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="name" required placeholder="e.g. Marketing" className="input" />
          <button className="btn-dark w-full">Add sub-category</button>
        </form>
        <form action={A.addCategory} className="card space-y-3 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><FolderPlus className="h-5 w-5 text-brand" />Add category</h2>
          <input name="name" required placeholder="e.g. Online Business" className="input" />
          <select name="kind" required className="input" defaultValue="">
            <option value="" disabled>What type is it?</option>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <p className="text-xs text-slate-500">Type decides where it shows in reports: Asset (things you own), Liability (what you owe), Income, Expense or Equity (owner&apos;s money).</p>
          <button className="btn-dark w-full">Add category</button>
        </form>
      </div>

      <div className="space-y-5">
        {cats.map((c) => {
          const cAccs = accs.filter((a) => a.category_id === c.id);
          const cSubs = subs.filter((s) => s.category_id === c.id);
          return (
            <section key={c.id} id={`cat-${c.id}`} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <CategoryBadge name={c.name} kind={c.kind} size="sm" />
                  <span className="font-semibold">{c.name}</span>
                  <span className="ml-2 rounded bg-white/15 px-2 py-0.5 text-xs">{KIND_LABEL[c.kind]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Money value={cAccs.reduce((s, a) => s + a.balance, 0)} className="font-semibold" />
                  <details className="relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-slate-300 hover:text-white"><Pencil className="h-3.5 w-3.5" />Edit</summary>
                    <div className="absolute right-0 z-10 mt-2 w-64 space-y-2 rounded-lg bg-white p-3 text-slate-800 shadow-lg">
                      <form action={A.renameCategory} className="flex gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="name" defaultValue={c.name} className="input" />
                        <button className="btn-dark">Save</button>
                      </form>
                      <form action={A.deleteCategory}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn-danger w-full">Delete category</button>
                      </form>
                    </div>
                  </details>
                </div>
              </div>
              {cSubs.map((s) => {
                const sAccs = cAccs.filter((a) => a.subcategory_id === s.id);
                return (
                  <div key={s.id} className="border-t border-[var(--line)]">
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm">
                      <span className="font-semibold text-slate-700">{s.name}</span>
                      <div className="flex items-center gap-3">
                        <Money value={sAccs.reduce((t, a) => t + a.balance, 0)} className="text-slate-600" />
                        <details className="relative">
                          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-slate-500 hover:text-ink"><Pencil className="h-3.5 w-3.5" />Edit</summary>
                          <div className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-lg bg-white p-3 shadow-lg">
                            <form action={A.renameSubcategory} className="space-y-2">
                              <input type="hidden" name="id" value={s.id} />
                              <input name="name" defaultValue={s.name} className="input" />
                              <select name="category" defaultValue={c.id} className="input">
                                {cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                              </select>
                              <button className="btn-dark w-full">Save / Move</button>
                            </form>
                            <form action={A.deleteSubcategory}>
                              <input type="hidden" name="id" value={s.id} />
                              <button className="btn-danger w-full">Delete sub-category</button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                    {sAccs.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-slate-400">No accounts yet.</div>
                    ) : (
                      <ul>
                        {sAccs.map((a) => (
                          <li key={a.id} className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2 text-sm hover:bg-orange-50/40">
                            <Link href={`/accounts/${a.id}`} className="flex items-center gap-1 font-medium text-ink hover:text-brand">
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                              {a.name}
                              {a.archived ? <span className="ml-2 text-xs text-slate-400">(archived)</span> : null}
                            </Link>
                            <div className="flex items-center gap-4">
                              <Money value={a.balance} />
                              <Link href={`/accounts/${a.id}/edit`} title="Edit account" aria-label="Edit account" className="inline-flex rounded-md p-1 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Link>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
