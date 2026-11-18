import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, FolderKanban, HandCoins, PackagePlus, Pencil, Trash2, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { avgCost, bookStock, getItem, itemMoves, listItems } from "@/lib/items";
import { accountsWithBalances, isMoney, projects } from "@/lib/books";
import { money, prettyDate, today } from "@/lib/format";
import { currencySymbol } from "@/lib/currencies";
import { AccountSelect, Flash, PageHeader } from "@/components/ui";
import { Crumbs } from "@/components/drill";
import { Dialog } from "@/components/dialog";
import { ItemForm } from "@/components/item-form";
import { ConfirmButton } from "@/components/confirm-button";
import { addStockAction, countStockAction, deleteItemAction, removeMoveAction, sellStockAction, useStockAction } from "@/app/actions/items";
import { PriceBox } from "@/components/price-box";

export const metadata = { title: "Item" };

const qty = (n: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 }).format(n);
const REASON: Record<string, string> = { opening: "Had at the start", purchase: "Bought", sale: "Sold", count: "Count correction", return: "Returned", use: "Used" };

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  await bookStock(d, user.id);
  const item = await getItem(d, user.id, Number((await params).id));
  if (!item) notFound();
  const [moves, all, accs, projs] = await Promise.all([itemMoves(d, user.id, item.id), listItems(d, user.id, { archived: true }), accountsWithBalances(d, user.id), projects(d, user.id)]);
  const openProjects = projs.filter((p) => !p.archived);
  // Optional on buying and selling: which project it was for (shows in that project's entries).
  const projectPick = (id: string) => openProjects.length > 0 && (
    <div>
      <label className="label" htmlFor={id}>Project (optional)</label>
      <select id={id} name="project" className="input" defaultValue="">
        <option value="">None</option>
        {openProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
  const groups = [...new Set(all.map((i) => i.group_name).filter(Boolean) as string[])];
  const payFrom = accs.filter((a) => !a.archived && !a.currency && (isMoney(a) || a.role === "payable"));
  const into = accs.filter((a) => !a.archived && !a.currency && isMoney(a));
  const avg = avgCost(item);
  const lot = item.pricing === "lot";
  const sales = moves.filter((m) => m.reason === "sale" && m.sale_amount !== null);
  const profit = sales.reduce((s, m) => s + (m.sale_amount ?? 0) + (m.value ?? 0), 0);
  const rs = (p: number) => (p ? (p / 100).toFixed(2) : "");
  const cur = currencySymbol(user.currency);
  const isLow = item.low_stock !== null && item.stock <= item.low_stock;

  return (
    <>
      <Crumbs items={[{ href: "/items", label: "Stock" }, { label: item.name }]} />
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
        {lot ? (
          <div className="card p-4 sm:col-span-2"><div className="text-sm text-muted">Bought as a lot</div><div className="text-xl font-bold">Each piece sold at its own price</div></div>
        ) : (
          <>
            <div className="card p-4"><div className="text-sm text-muted">Selling price</div><div className="text-xl font-bold" dir="ltr">{cur} {money(item.sale_price)}</div></div>
            <div className="card p-4"><div className="text-sm text-muted">Cost (each, average)</div><div className="text-xl font-bold" dir="ltr">{cur} {money(Math.round(avg))}</div></div>
          </>
        )}
        <div className="card p-4">
          <div className="text-sm text-muted">Stock value</div>
          <div className="text-xl font-bold" dir="ltr">{cur} {money(Math.max(0, item.value))}</div>
          {sales.length > 0 && <div className={`text-sm font-semibold ${profit >= 0 ? "text-ledger" : "text-khata"}`} dir="ltr">{profit >= 0 ? "Profit" : "Loss"} so far: {cur} {money(Math.abs(profit))}</div>}
        </div>
      </section>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <form action={sellStockAction} className="card space-y-3 p-5">
          <input type="hidden" name="id" value={item.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold"><HandCoins className="h-5 w-5 text-ledger" />Sell</h2>
          <PriceBox idPrefix="sl" unit={item.unit} defaultQty="1" each={lot ? "" : rs(item.sale_price)} totalOnly={lot} qtyLabel="How many" eachLabel="Price (each)" totalLabel={lot ? "Sold for (total)" : "Total received"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="sl-date">Date</label><input id="sl-date" type="date" name="date" defaultValue={today()} className="input" /></div>
            <div>
              <label className="label">Money went into</label>
              <AccountSelect name="into" accounts={into} value={into.find((a) => a.role === "cash")?.id} addInto={["cash", "bank"]} suggest="money" />
            </div>
          </div>
          <input id="sl-note" name="note" placeholder="Note (optional), e.g. serial no. or buyer" className="input" />
          {projectPick("sl-project")}
          <button className="btn w-full bg-ledger text-white hover:bg-ledger-dark" disabled={item.stock <= 0}>{item.stock <= 0 ? "Out of stock" : "Save sale"}</button>
          {item.stock > 0 && (
            <Link id="sl-udhaar" href={`/invoices/new?item=${item.id}`} className="block text-center text-sm font-semibold text-brand underline">
              Selling on udhaar? Make an invoice
            </Link>
          )}
        </form>
        <form action={addStockAction} className="card space-y-3 p-5">
          <input type="hidden" name="id" value={item.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold"><PackagePlus className="h-5 w-5 text-brand" />Add stock you bought</h2>
          <PriceBox idPrefix="st" unit={item.unit} each={lot ? "" : rs(item.cost_price)} totalOnly={lot} qtyLabel="How many" eachLabel="Price paid (each)" totalLabel="Total paid" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="st-date">Date</label><input id="st-date" type="date" name="date" defaultValue={today()} className="input" /></div>
            <div>
              <label className="label">Paid from</label>
              <AccountSelect name="from" accounts={payFrom} noneLabel="I already entered this payment" addInto={["cash", "bank", "payable"]} suggest="money" />
            </div>
          </div>
          {projectPick("st-project")}
          <button className="btn-primary w-full">Add stock</button>
        </form>
        <form action={useStockAction} className="card space-y-3 p-5">
          <input type="hidden" name="id" value={item.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold"><FolderKanban className="h-5 w-5 text-brand" />Use for a project</h2>
          {openProjects.length === 0 ? (
            <p className="text-sm text-muted">
              Taking items for a job or site? <Link href="/projects" className="font-semibold text-brand underline">Make a project</Link> first.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="us-project">Project</label>
                  <select id="us-project" name="project" required className="input">
                    {openProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label className="label" htmlFor="us-qty">How many ({item.unit})</label><input id="us-qty" name="qty" inputMode="decimal" required className="input" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="us-date">Date</label><input id="us-date" type="date" name="date" defaultValue={today()} className="input" /></div>
                <div><label className="label" htmlFor="us-note">Note (optional)</label><input id="us-note" name="note" placeholder="e.g. to the site" className="input" /></div>
              </div>
              <button className="btn-dark w-full" disabled={item.stock <= 0}>{item.stock <= 0 ? "Out of stock" : "Take for project"}</button>
            </>
          )}
        </form>
        <form action={countStockAction} className="card space-y-3 p-5">
          <input type="hidden" name="id" value={item.id} />
          <h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardCheck className="h-5 w-5 text-brand" />Count correction</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="ct-qty">Counted ({item.unit})</label><input id="ct-qty" name="counted" inputMode="decimal" required className="input" /></div>
            <div><label className="label" htmlFor="ct-date">Date</label><input id="ct-date" type="date" name="date" defaultValue={today()} className="input" /></div>
          </div>
          <input id="ct-note" name="note" placeholder="Reason (optional), e.g. 2 bags torn" className="input" />
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
              <thead><tr><th>Date</th><th>What</th><th className="num">In</th><th className="num">Out</th><th className="num">Money</th><th className="num">Stock</th><th><span className="sr-only">Undo</span></th></tr></thead>
              <tbody>
                {[...moves].reverse().map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{prettyDate(m.date)}</td>
                    <td>
                      {REASON[m.reason] ?? m.reason}
                      {m.invoice_id && <> · <Link href={`/invoices/${m.invoice_id}`} className="font-semibold text-brand">Invoice #{m.invoice_number}</Link></>}
                      {m.project && <> · <Link href={`/transactions?project=${m.project_id}`} className="font-semibold text-brand">{m.project}</Link></>}
                      {m.note && <span className="block text-sm text-muted">{m.note}</span>}
                    </td>
                    <td className="num text-inflow">{m.qty > 0 ? qty(m.qty) : ""}</td>
                    <td className="num text-khata">{m.qty < 0 ? qty(-m.qty) : ""}</td>
                    <td className="num whitespace-nowrap" dir="ltr">
                      {m.sale_amount !== null ? (
                        <>
                          {cur} {money(m.sale_amount)}
                          {m.value !== null && (
                            <span className={`block text-xs font-semibold ${m.sale_amount + m.value >= 0 ? "text-ledger" : "text-khata"}`}>
                              {m.sale_amount + m.value >= 0 ? "profit" : "loss"} {money(Math.abs(m.sale_amount + m.value))}
                            </span>
                          )}
                        </>
                      ) : m.value ? <span className="text-muted">{cur} {money(Math.abs(m.value))}</span> : ""}
                    </td>
                    <td className="num font-semibold">{qty(m.balance)}</td>
                    <td className="w-10">
                      {!m.invoice_id && m.reason !== "opening" && (
                        <form action={removeMoveAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="move" value={m.id} />
                          <ConfirmButton className="rounded p-1.5 text-muted hover:bg-khata-soft hover:text-khata" message="Remove this line? Its money entries are removed too." confirmLabel="Remove" ariaLabel="Remove this line">
                            <Undo2 className="h-4 w-4" />
                          </ConfirmButton>
                        </form>
                      )}
                    </td>
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
      </form>
    </>
  );
}
