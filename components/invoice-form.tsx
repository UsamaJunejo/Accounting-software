"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createInvoice, type InvoiceFormState } from "@/app/actions/invoices";
import { currencySymbol } from "@/lib/currencies";

type Row = { name: string; qty: string; price: string; itemId?: number | null };
export type InvoiceStockItem = { id: number; name: string; unit: string; group: string | null; price: number; stock: number };
const n = (s: string) => Number(String(s).replace(/,/g, "")) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export function InvoiceForm({ customerPicker, today, currency = "PKR", stockItems = [] }: { customerPicker: React.ReactNode; today: string; currency?: string; stockItems?: InvoiceStockItem[] }) {
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(createInvoice, {});
  const [rows, setRows] = useState<Row[]>([{ name: "", qty: "1", price: "" }]);
  const [customer, setCustomer] = useState("");
  // The customer box is the same searchable account chooser as everywhere else; it tells us what was picked.
  useEffect(() => {
    const onPick = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; id?: number }>).detail;
      if (d.name === "customer") setCustomer(d.id ? String(d.id) : "");
    };
    window.addEventListener("fc-pick", onPick);
    return () => window.removeEventListener("fc-pick", onPick);
  }, []);
  const [tax, setTax] = useState("0");
  const [discount, setDiscount] = useState("");
  // Kept in state so a mistake doesn't wipe what was typed (React clears plain fields after sending).
  const [f, setF] = useState({ name: "", phone: "", date: today, due: "", notes: "" });
  const [check, setCheck] = useState("");
  const field = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });
  const subtotal = rows.reduce((s, r) => s + n(r.qty) * n(r.price), 0);
  const taxable = Math.max(0, subtotal - n(discount));
  const taxAmt = (taxable * n(tax)) / 100;
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  // Typing (or picking) the exact name of one of your items links the line to it: price filled, stock shown.
  const setName = (i: number, v: string) =>
    setRows(
      rows.map((r, j) => {
        if (j !== i) return r;
        const it = stockItems.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
        if (!it) return { ...r, name: v, itemId: null };
        return { ...r, name: it.name, itemId: it.id, price: r.itemId === it.id && r.price ? r.price : (it.price / 100).toFixed(2) };
      }),
    );

  return (
    <form
      action={action}
      className="space-y-5"
      onSubmit={(e) => {
        // Point out the usual slips before sending, so nothing has to be typed again.
        const items = rows.filter((r) => r.name.trim() || n(r.price));
        const problem = !items.length
          ? "Add at least one item with a name and a price."
          : items.some((r) => !r.name.trim())
            ? "Every item needs a name."
            : items.some((r) => !(n(r.qty) > 0))
              ? "Every item needs a quantity of more than zero."
              : n(discount) < 0
                ? "The discount can't be below zero."
                : taxable + taxAmt <= 0
                  ? "The total is zero. Check the prices, or make the discount smaller than the subtotal."
                  : f.due && f.due < f.date
                    ? "The due date can't be before the invoice date."
                    : "";
        setCheck(problem);
        if (problem) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
    >
      {(check || state.error) && <div role="alert" className="rounded-lg border border-khata/30 bg-khata-soft px-4 py-3 text-sm font-semibold text-khata">{check || state.error}</div>}
      <input type="hidden" name="items" value={JSON.stringify(rows)} />
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label">Customer</label>
          {customerPicker}
        </div>
        {!customer && (
          <>
            <div>
              <label className="label">Customer name</label>
              <input name="customer_name" required {...field("name")} className="input" placeholder="e.g. Ahmed Traders" />
            </div>
            <div>
              <label className="label">Customer mobile (optional)</label>
              <input name="customer_phone" {...field("phone")} className="input" placeholder="03XX-XXXXXXX" />
            </div>
          </>
        )}
        <div>
          <label className="label">Invoice date</label>
          <input type="date" name="date" {...field("date")} required className="input" />
        </div>
        <div>
          <label className="label">Due date (optional)</label>
          <input type="date" name="due_date" {...field("due")} className="input" />
        </div>
      </div>

      <div className="card p-5">
        {/* One line per item. On phones each line is a small card: the item on top, quantity and price under it. */}
        <div className="hidden grid-cols-[1fr_90px_130px_120px_32px] gap-3 border-b border-rule pb-2 text-sm font-semibold text-muted sm:grid">
          <span>Item</span><span className="text-end">Qty</span><span className="text-end">Price ({currency})</span><span className="text-end">Amount</span><span />
        </div>
        <ul className="divide-y divide-rule">
          {rows.map((r, i) => {
            const it = stockItems.find((x) => x.id === r.itemId);
            const left = it ? it.stock - n(r.qty) : 0;
            return (
              <li key={i} className="grid grid-cols-2 gap-x-3 gap-y-2 py-3 sm:grid-cols-[1fr_90px_130px_120px_32px] sm:items-start">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label sm:sr-only" htmlFor={`line-${i}-name`}>Item</label>
                  <input id={`line-${i}-name`} value={r.name} onChange={(e) => setName(i, e.target.value)} list="inv-stock-items" placeholder={stockItems.length ? "Type to pick an item" : "e.g. Cement bag"} className="input" />
                  {it && (
                    <span className={`mt-1 block text-xs ${left < 0 ? "font-semibold text-khata" : "text-muted"}`}>
                      In stock: {it.stock} {it.unit}{left < 0 ? ` · only ${it.stock} left` : ` · ${left} after this`}
                    </span>
                  )}
                </div>
                <div>
                  <label className="label sm:sr-only" htmlFor={`line-${i}-qty`}>Qty</label>
                  <input id={`line-${i}-qty`} value={r.qty} onChange={(e) => set(i, "qty", e.target.value)} inputMode="decimal" className="input text-right" />
                </div>
                <div>
                  <label className="label sm:sr-only" htmlFor={`line-${i}-price`}>Price ({currency})</label>
                  <input id={`line-${i}-price`} value={r.price} onChange={(e) => set(i, "price", e.target.value)} inputMode="decimal" className="input text-right" />
                </div>
                <div className="flex items-center justify-between sm:block sm:pt-2.5 sm:text-end">
                  <span className="text-sm text-muted sm:hidden">Amount</span>
                  <span className="font-semibold tabular-nums">{fmt(n(r.qty) * n(r.price))}</span>
                </div>
                <div className="flex items-center justify-end sm:pt-2">
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove item" className="inline-flex items-center gap-1 text-sm text-khata">
                      <Trash2 className="h-4 w-4" /><span className="sm:hidden">Remove</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <datalist id="inv-stock-items">
          {stockItems.map((it) => <option key={it.id} value={it.name}>{[it.group, `${it.stock} ${it.unit} in stock`].filter(Boolean).join(" · ")}</option>)}
        </datalist>
        <button type="button" onClick={() => setRows([...rows, { name: "", qty: "1", price: "" }])} className="btn-ghost mt-3"><Plus className="h-4 w-4" />Add item</button>
        <div className="ml-auto mt-4 max-w-sm space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-2"><span>Discount ({currency})</span><input name="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" className="input w-32 text-right" /></div>
          <div className="flex items-center justify-between gap-2">
            <span>Sales tax / GST (%)</span>
            <select name="tax" value={tax} onChange={(e) => setTax(e.target.value)} className="input w-32">
              {["0", "5", "10", "13", "15", "16", "17", "18"].map((t) => <option key={t} value={t}>{t}%</option>)}
            </select>
          </div>
          {taxAmt > 0 && <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{fmt(taxAmt)}</span></div>}
          <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span className="tabular-nums">{currencySymbol(currency)} {fmt(taxable + taxAmt)}</span></div>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Notes (optional)</label>
          <textarea name="notes" rows={2} {...field("notes")} className="input" placeholder="e.g. Bank: Meezan 0123… · Thank you for your business!" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="record" defaultChecked className="mt-1" />
          <span><b>Add to my books</b> as an udhaar sale: the customer&apos;s khata goes up by the total, Sales and Sales Tax are recorded. When they pay, use &ldquo;Payment received&rdquo; in Khata.</span>
        </label>
        <button className="btn-primary" disabled={pending}><Save className="h-4 w-4" />{pending ? "Saving…" : "Create invoice"}</button>
      </div>
    </form>
  );
}
