import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, categories, subcategories } from "@/lib/books";
import { categoryColorMap } from "@/lib/palette";
import { colorAt, defaultIconKey, friendlyCategory } from "@/lib/look";
import { currencySymbol } from "@/lib/currencies";
import { Flash, Money, PageHeader } from "@/components/ui";
import { CategoryBadge } from "@/components/icons";
import { Crumbs, DrillCharts, DrillTiles, type DrillItem } from "@/components/drill";
import { GroupForm } from "@/components/organize-forms";
import { OrganizeButtons } from "@/components/organize";
import { Dialog } from "@/components/dialog";

export default async function SubcategoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const id = Number((await params).id);
  const d = await db();
  const [cats, subs, accs] = await Promise.all([categories(d, user.id), subcategories(d, user.id), accountsWithBalances(d, user.id)]);
  const sub = subs.find((s) => s.id === id);
  if (!sub) notFound();
  const cat = cats.find((c) => c.id === sub.category_id)!;
  const color = sub.color ?? categoryColorMap(cats).get(cat.id) ?? null;
  const cur = currencySymbol(user.currency);
  const here = `/accounts/sub/${sub.id}`;
  const mine = accs.filter((a) => a.subcategory_id === sub.id && !a.archived);
  const total = mine.reduce((s, a) => s + a.balance, 0);
  const items: DrillItem[] = mine.map((a, i) => ({
    key: String(a.id),
    href: `/accounts/${a.id}`,
    name: a.name,
    balance: a.balance,
    native: a.currency && a.native !== null ? { amount: a.native, currency: a.currency } : null,
    color: mine.length === 1 && color ? color : colorAt(i),
    icon: sub.icon ?? cat.icon ?? defaultIconKey(cat.name, cat.kind),
    kind: cat.kind,
    note: a.phone ?? undefined,
  }));

  return (
    <>
      <Crumbs items={[{ href: "/accounts", label: "Accounts" }, { href: `/accounts/category/${cat.id}`, label: friendlyCategory(cat.name) }, { label: sub.name }]} />
      <PageHeader
        title={sub.name}
        subtitle={`${mine.length} ${mine.length === 1 ? "account" : "accounts"} in ${cat.name}`}
        actions={
          <>
            <OrganizeButtons user={user} back={here} categoryId={cat.id} subId={sub.id} only={["account"]} />
            <Dialog title={`Edit ${sub.name}`} triggerClass="btn-ghost" trigger={<><Pencil className="h-4 w-4" />Edit sub-category</>}>
              <GroupForm what="sub" mode="edit" categories={cats} primary={user.currency} back={here} deleteBack={`/accounts/category/${cat.id}`} item={{ id: sub.id, name: sub.name, color: sub.color, icon: sub.icon, currency: sub.currency, category_id: cat.id }} />
            </Dialog>
          </>
        }
      />
      <Flash sp={sp} />
      <div className="card mb-5 flex items-center gap-4 p-4">
        <CategoryBadge name={sub.name} kind={cat.kind} size="lg" color={color} icon={sub.icon ?? cat.icon ?? defaultIconKey(cat.name, cat.kind)} />
        <div>
          <div className="text-sm text-muted">Total in {sub.name}</div>
          <div className="text-2xl font-bold text-ink" dir="ltr"><span className="me-1 text-base text-muted">{cur}</span><Money value={total} /></div>
        </div>
      </div>
      <DrillTiles items={items} />
      <DrillCharts items={items} cur={cur} donutTitle={`Share within ${sub.name}`} barsTitle="Account balances" />
    </>
  );
}
