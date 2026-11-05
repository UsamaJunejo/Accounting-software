import Link from "next/link";
import { FileText, Save, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, categories, subcategories } from "@/lib/books";
import { deleteAccount, updateAccount } from "@/app/actions/books";
import { Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";

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

  return (
    <>
      <PageHeader title={`Edit: ${a.name}`} />
      <Flash sp={sp} />
      <form action={updateAccount} className="card mb-4 grid max-w-2xl gap-4 p-5">
        <input type="hidden" name="id" value={a.id} />
        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={a.name} required className="input" />
        </div>
        <div>
          <label className="label">Sub-category (move account)</label>
          <select name="subcategory" defaultValue={a.subcategory_id} className="input">
            {cats.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {subs.filter((s) => s.category_id === c.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Mobile</label>
            <input name="phone" defaultValue={a.phone ?? ""} className="input" placeholder="03XX-XXXXXXX" />
          </div>
          <div>
            <label className="label">Monthly budget ({user.currency})</label>
            <input name="budget" inputMode="decimal" defaultValue={a.budget_monthly ? (a.budget_monthly / 100).toFixed(2) : ""} className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" defaultChecked={!!a.archived} /> Archived (hide from lists, keep history)
        </label>
        <div className="flex gap-2">
          <button className="btn-primary"><Save className="h-4 w-4" />Save</button>
          <Link href={`/accounts/${a.id}`} className="btn-ghost"><FileText className="h-4 w-4" />View statement</Link>
        </div>
      </form>
      <form action={deleteAccount} className="max-w-2xl">
        <input type="hidden" name="id" value={a.id} />
        <ConfirmButton className="btn-danger" message={`Delete the account "${a.name}"? This cannot be undone.`} confirmLabel="Delete"><Trash2 className="h-4 w-4" />Delete account</ConfirmButton>
        <p className="mt-1 text-xs text-muted">Only possible if it has no entries. Otherwise archive it.</p>
      </form>
    </>
  );
}
