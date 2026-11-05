import type { Invoice } from "@/lib/invoices";
import { money, prettyDate } from "@/lib/format";
import { Logo } from "@/components/logo";
import { currencySymbol } from "@/lib/currencies";

/** The invoice as the customer sees it (also used for printing / PDF). */
export function InvoiceView({ inv }: { inv: Invoice }) {
  return (
    <div className="card relative mx-auto max-w-3xl overflow-hidden bg-white p-6 sm:p-10 print:max-w-none print:p-0">
      {inv.cancelled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-12 rounded-xl border-4 border-khata px-6 py-2 text-5xl font-black text-khata/70">CANCELLED</span>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="text-2xl font-bold text-ink">{inv.business}</div>
          {inv.business_address && <div className="whitespace-pre-line text-sm text-muted">{inv.business_address}</div>}
          {inv.business_phone && <div className="text-sm text-muted">{inv.business_phone}</div>}
          {inv.business_ntn && <div className="text-sm text-muted">NTN: {inv.business_ntn}</div>}
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tracking-tight text-brand">INVOICE</div>
          <div className="text-sm text-muted"># {inv.number}</div>
          <div className="text-sm text-muted">Date: {prettyDate(inv.date)}</div>
          {inv.due_date && <div className="text-sm text-muted">Due: {prettyDate(inv.due_date)}</div>}
        </div>
      </div>
      <div className="py-6">
        <div className="text-xs font-semibold text-muted">Bill to</div>
        <div className="text-lg font-semibold text-ink">{inv.customer_name}</div>
        {inv.customer_phone && <div className="text-sm text-muted">{inv.customer_phone}</div>}
      </div>
      <table className="table">
        <thead>
          <tr><th>#</th><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i}>
              <td className="text-muted/80">{i + 1}</td>
              <td>{it.name}</td>
              <td className="num">{it.qty}</td>
              <td className="num">{money(it.price)}</td>
              <td className="num">{money(Math.round(it.qty * it.price))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(inv.subtotal)}</span></div>
        {inv.discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">− {money(inv.discount)}</span></div>}
        {inv.tax > 0 && <div className="flex justify-between"><span>Sales tax ({inv.tax_percent}%)</span><span className="tabular-nums">{money(inv.tax)}</span></div>}
        <div className="flex justify-between border-t border-rule-strong pt-2 text-lg font-bold text-ink">
          <span>Total</span><span className="tabular-nums">{currencySymbol(inv.currency)} {money(inv.total)}</span>
        </div>
      </div>
      {inv.notes && <div className="mt-6 whitespace-pre-line rounded-lg bg-paper p-3 text-sm text-body">{inv.notes}</div>}
      <div className="mt-10 text-center text-xs text-muted/80">
        Made with <Logo className="text-muted" />
      </div>
    </div>
  );
}
