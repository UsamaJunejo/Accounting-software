"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createInvoice, type InvoiceFormState } from "@/app/actions/invoices";
import { currencySymbol } from "@/lib/currencies";

type Row = { name: string; qty: string; price: string };
const n = (s: string) => Number(String(s).replace(/,/g, "")) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export function InvoiceForm({ customers, today, currency = "PKR" }: { customers: { id: number; name: string; phone: string | null }[]; today: string; currency?: string }) {
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(createInvoice, {});
  const [rows, setRows] = useState<Row[]>([{ name: "", qty: "1", price: "" }]);
  const [customer, setCustomer] = useState("");
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
          <select name="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="input">
            <option value="">New / walk-in customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
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

      <div className="card overflow-x-auto p-5">
        <table className="table">
          <thead><tr><th className="w-1/2">Item</th><th className="num">Qty</th><th className="num">Price ({currency})</th><th className="num">Amount</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input value={r.name} onChange={(e) => set(i, "name", e.target.value)} placeholder="e.g. Cement bag" className="input" /></td>
                <td><input value={r.qty} onChange={(e) => set(i, "qty", e.target.value)} inputMode="decimal" className="input w-20 text-right" /></td>
                <td><input value={r.price} onChange={(e) => set(i, "price", e.target.value)} inputMode="decimal" className="input w-28 text-right" /></td>
                <td className="num align-middle">{fmt(n(r.qty) * n(r.price))}</td>
                <td className="align-middle">
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove item" className="text-khata"><Trash2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
