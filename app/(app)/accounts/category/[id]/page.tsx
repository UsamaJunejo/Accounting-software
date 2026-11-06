import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, categories, KIND_LABEL, subcategories } from "@/lib/books";
import { categoryColorMap } from "@/lib/palette";
import { accountingTerm, colorAt, defaultIconKey, friendlyCategory } from "@/lib/look";
import { currencySymbol } from "@/lib/currencies";
import { Flash, Money, PageHeader } from "@/components/ui";
import { CategoryBadge } from "@/components/icons";
import { Crumbs, DrillCharts, DrillTiles, type DrillItem } from "@/components/drill";
import { AddAccountForm, AddSubcategoryForm, EditGroupForm } from "@/components/account-forms";
import { Dialog } from "@/components/dialog";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const id = Number((await params).id);
  const d = await db();
  const [cats, subs, accs] = await Promise.all([categories(d, user.id), subcategories(d, user.id), accountsWithBalances(d, user.id)]);
  const cat = cats.find((c) => c.id === id);
  if (!cat) notFound();
  const color = categoryColorMap(cats).get(cat.id) ?? null;
  const cur = currencySymbol(user.currency);
  const here = `/accounts/category/${cat.id}`;
  const mine = accs.filter((a) => a.category_id === cat.id && !a.archived);
  const total = mine.reduce((s, a) => s + a.balance, 0);

  let items: DrillItem[];
  let add: { label: string; form: React.ReactNode };
  if (user.level === 3) {
    items = subs
      .filter((s) => s.category_id === cat.id)
      .map((s, i) => {
        const inSub = mine.filter((a) => a.subcategory_id === s.id);
        return {
          key: String(s.id),
          href: `/accounts/sub/${s.id}`,
          name: s.name,
          balance: inSub.reduce((t, a) => t + a.balance, 0),
          color: s.color ?? colorAt(i),
          icon: s.icon ?? cat.icon ?? defaultIconKey(cat.name, cat.kind),
          kind: cat.kind,
          note: `${inSub.length} ${inSub.length === 1 ? "account" : "accounts"}`,
        };
      });
    add = { label: `Add to ${cat.name}`, form: <AddSubcategoryForm categoryId={cat.id} back={here} /> };
  } else {
    items = mine.map((a, i) => {
      const s = subs.find((x) => x.id === a.subcategory_id);
      return { key: String(a.id), href: `/accounts/${a.id}`, name: a.name, balance: a.balance, native: a.currency && a.native !== null ? { amount: a.native, currency: a.currency } : null, color: s?.color ?? colorAt(i), icon: s?.icon ?? cat.icon ?? defaultIconKey(cat.name, cat.kind), kind: cat.kind };
    });
    add = { label: `Add account to ${cat.name}`, form: <AddAccountForm categoryId={cat.id} back={here} /> };
  }

  return (
    <>
      <Crumbs items={[{ href: "/accounts", label: "Accounts" }, { label: friendlyCategory(cat.name) }]} />
      <PageHeader
        title={friendlyCategory(cat.name)}
        subtitle={`${accountingTerm(cat.name) ? `${cat.name}, ` : ""}${KIND_LABEL[cat.kind]} | ${mine.length} ${mine.length === 1 ? "account" : "accounts"}`}
        actions={
          <Dialog title={`Edit ${cat.name}`} triggerClass="btn-ghost" trigger={<><Pencil className="h-4 w-4" />Edit category</>}>
            <EditGroupForm kind="category" id={cat.id} name={cat.name} color={cat.color} icon={cat.icon} back={here} deleteBack="/accounts" />
          </Dialog>
        }
      />
      <Flash sp={sp} />
      <div className="card mb-5 flex items-center gap-4 p-4">
        <CategoryBadge name={cat.name} kind={cat.kind} size="lg" color={color} icon={cat.icon} />
        <div>
          <div className="text-sm text-muted">Total {cat.name.toLowerCase()}</div>
          <div className="text-2xl font-bold text-ink" dir="ltr"><span className="me-1 text-base text-muted">{cur}</span><Money value={total} /></div>
        </div>
      </div>
      <DrillTiles items={items} addLabel={add.label} addForm={add.form} />
      <DrillCharts items={items} cur={cur} donutTitle={`Share within ${cat.name}`} barsTitle="Balances" />
    </>
  );
}
