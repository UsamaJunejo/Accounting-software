import Link from "next/link";
import { Package, Plus, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listItems, stockValue } from "@/lib/items";
import { money } from "@/lib/format";
import { currencySymbol } from "@/lib/currencies";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { ItemForm } from "@/components/item-form";

export const metadata = { title: "Items & stock" };

const qty = (n: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 }).format(n);

export default async function Items({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; archived?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const items = await listItems(await db(), user.id, { archived: !!sp.archived });
  const cur = currencySymbol(user.currency);
  const groups = [...new Set(items.map((i) => i.group_name).filter(Boolean) as string[])];
  const low = items.filter((i) => i.low_stock !== null && i.stock <= i.low_stock);
  const byGroup = new Map<string, typeof items>();
  for (const i of items) byGroup.set(i.group_name ?? "Other items", [...(byGroup.get(i.group_name ?? "Other items") ?? []), i]);

  return (
    <>
      <PageHeader
        title="Items & stock"
        subtitle="What you sell and how many you have. Stock goes down when you make an invoice, and up when you add stock you bought."
        actions={
          <>
            <Dialog title="Add item" triggerClass="btn-primary" trigger={<><Plus className="h-4 w-4" />Add item</>}>
              <ItemForm groups={groups} />
            </Dialog>
            <Link href={sp.archived ? "/items" : "/items?archived=1"} className="btn-ghost">{sp.archived ? "Hide archived" : "Show archived"}</Link>
          </>
        }
      />
      <Flash sp={sp} />
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-sm text-muted">Items</div><div className="text-2xl font-bold">{items.length}</div></div>
        <div className="card p-4"><div className="text-sm text-muted">Stock value (at buying price)</div><div className="text-2xl font-bold" dir="ltr">{cur} {money(Math.round(stockValue(items)))}</div></div>
        <div className={`card p-4 ${low.length ? "border border-marigold/40 bg-marigold-soft" : ""}`}>
          <div className="text-sm text-muted">Running low</div>
          <div className={`text-2xl font-bold ${low.length ? "text-marigold" : ""}`}>{low.length}</div>
        </div>
      </section>
      {items.length === 0 ? (
        <Empty>No items yet. Tap &ldquo;Add item&rdquo; to add what you sell, with how many you have.</Empty>
      ) : (
        [...byGroup].map(([g, rows]) => (
          <section key={g} className="card mb-4 overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-rule bg-paper px-4 py-2.5 font-semibold text-ink"><Package className="h-4 w-4 text-brand" />{g}</h2>
            <ul>
              {rows.map((i) => {
                const isLow = i.low_stock !== null && i.stock <= i.low_stock;
                return (
                  <li key={i.id} className="border-b border-rule/70 last:border-0">
                    <Link href={`/items/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-soft/40">
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">{i.name}{i.archived && <span className="ms-2 text-xs text-muted">archived</span>}</span>
                        <span className="block text-sm text-muted" dir="ltr">Sells at {cur} {money(i.sale_price)} / {i.unit}</span>
                      </span>
                      <span className={`text-end font-bold tabular-nums ${i.stock <= 0 ? "text-khata" : isLow ? "text-marigold" : "text-ink"}`}>
                        {isLow && <TriangleAlert className="me-1 inline h-4 w-4 align-[-2px]" />}
                        {qty(i.stock)} <span className="text-sm font-normal text-muted">{i.unit}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
