import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getItem, itemMoves, listItems } from "@/lib/items";
import { accountsWithBalances, isMoney } from "@/lib/books";
import { money, prettyDate, today } from "@/lib/format";
import { currencySymbol } from "@/lib/currencies";
import { AccountSelect, Flash, PageHeader } from "@/components/ui";
import { Crumbs } from "@/components/drill";
import { Dialog } from "@/components/dialog";
import { ItemForm } from "@/components/item-form";
import { ConfirmButton } from "@/components/confirm-button";
import { addStockAction, countStockAction, deleteItemAction } from "@/app/actions/items";

export const metadata = { title: "Item" };

const qty = (n: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 }).format(n);
const REASON: Record<string, string> = { opening: "Had at the start", purchase: "Bought", sale: "Sold", count: "Count correction", return: "Returned" };

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const item = await getItem(d, user.id, Number((await params).id));
  if (!item) notFound();
  const [moves, all, accs] = await Promise.all([itemMoves(d, user.id, item.id), listItems(d, user.id, { archived: true }), accountsWithBalances(d, user.id)]);
  const groups = [...new Set(all.map((i) => i.group_name).filter(Boolean) as string[])];
  const payFrom = accs.filter((a) => !a.archived && !a.currency && (isMoney(a) || a.role === "payable"));
  const cur = currencySymbol(user.currency);
  const isLow = item.low_stock !== null && item.stock <= item.low_stock;

  return (
    <>
      <Crumbs items={[{ href: "/items", label: "Items & stock" }, { label: item.name }]} />
      <PageHeader
        title={item.name}
        subtitle={`${item.group_name ? `${item.group_name} · ` : ""}sold per ${item.unit}`}
        actions={
          <Dialog title={`Edit ${item.name}`} triggerClass="btn-ghost" trigger={<><Pencil className="h-4 w-4" />Edit item</>}>
            <ItemForm groups={groups} item={item} />
          </Dialog>
        }
      />
      <Flash sp={sp} />
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`card p-4 ${isLow ? "border border-marigold/40 bg-marigold-soft" : ""}`}>
          <div className="text-sm text-muted">In stock</div>
          <div className={`text-2xl font-bold ${item.stock <= 0 ? "text-khata" : isLow ? "text-marigold" : ""}`}>{qty(item.stock)} <span className="text-base font-normal text-muted">{item.unit}</span></div>
          {isLow && <div className="text-sm font-semibold text-marigold">{item.stock <= 0 ? "Out of stock" : "Running low"}</div>}
        </div>
        <div className="card p-4"><div className="text-sm text-muted">Selling price</div><div className="text-xl font-bold" dir="ltr">{cur} {money(item.sale_price)}</div></div>
        <div className="card p-4"><div className="text-sm text-muted">Buying price</div><div className="text-xl font-bold" dir="ltr">{cur} {money(item.cost_price)}</div></div>
        <div className="card p-4"><div className="text-sm text-muted">Stock value</div><div className="text-xl font-bold" dir="ltr">{cur} {money(Math.round(Math.max(0, item.stock) * item.cost_price))}</div></div>
      </section>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <form action={addStockAction} className="card space-y-3 p-5">
          <input type="hidden" name="id" value={item.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold"><PackagePlus className="h-5 w-5 text-brand" />Add stock you bought</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="st-qty">How many ({item.unit})</label><input id="st-qty" name="qty" inputMode="decimal" required className="input" /></div>
            <div><label className="label" htmlFor="st-cost">Price paid (each)</label><input id="st-cost" name="unit_cost" inputMode="decimal" defaultValue={item.cost_price ? (item.cost_price / 100).toFixed(2) : ""} className="input" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="st-date">Date</label><input id="st-date" type="date" name="date" defaultValue={today()} className="input" /></div>
            <div>
              <label className="label">Paid from</label>
              <AccountSelect name="from" accounts={payFrom} noneLabel="Don't record the payment" addInto={["cash", "bank", "payable"]} suggest="money" />
            </div>
          </div>
          <p className="text-sm text-muted">Choose Cash/Bank if you paid, or the supplier if you bought on credit. The amount is added to your Purchases. Choose &ldquo;Don&apos;t record&rdquo; if you already entered the payment.</p>
          <button className="btn-primary w-full">Add stock</button>
        </form>
        <form action={countStockAction} className="card space-y-3 p-5">
          <input type="hidden" name="id" value={item.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardCheck className="h-5 w-5 text-brand" />Count correction</h2>
          <p className="text-sm text-muted">Counted the shelf and the number is different? Type what is really there. The difference is noted in the history (for breakage, loss or a mistake).</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="ct-qty">Counted ({item.unit})</label><input id="ct-qty" name="counted" inputMode="decimal" required className="input" /></div>
            <div><label className="label" htmlFor="ct-date">Date</label><input id="ct-date" type="date" name="date" defaultValue={today()} className="input" /></div>
          </div>
          <input name="note" placeholder="Reason (optional), e.g. 2 bags torn" className="input" />
          <button className="btn-dark w-full">Save count</button>
        </form>
      </div>

      <section className="card mb-5 overflow-hidden">
        <h2 className="border-b border-rule px-4 py-3 text-lg font-bold">History</h2>
        {moves.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">No stock yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Date</th><th>What</th><th className="num">In</th><th className="num">Out</th><th className="num">Stock</th></tr></thead>
              <tbody>
                {[...moves].reverse().map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{prettyDate(m.date)}</td>
                    <td>
                      {REASON[m.reason] ?? m.reason}
                      {m.invoice_id && <> · <Link href={`/invoices/${m.invoice_id}`} className="font-semibold text-brand">Invoice #{m.invoice_number}</Link></>}
                      {m.note && <span className="block text-sm text-muted">{m.note}</span>}
                    </td>
                    <td className="num text-inflow">{m.qty > 0 ? qty(m.qty) : ""}</td>
                    <td className="num text-khata">{m.qty < 0 ? qty(-m.qty) : ""}</td>
                    <td className="num font-semibold">{qty(m.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form action={deleteItemAction} className="max-w-xl">
        <input type="hidden" name="id" value={item.id} />
        <ConfirmButton className="btn-danger" message={`Delete ${item.name}? This can't be undone.`} confirmLabel="Delete"><Trash2 className="h-4 w-4" />Delete item</ConfirmButton>
        <p className="mt-1 text-xs text-muted">Only possible if it was never bought or sold. Otherwise archive it from &ldquo;Edit item&rdquo;.</p>
      </form>
    </>
  );
}
