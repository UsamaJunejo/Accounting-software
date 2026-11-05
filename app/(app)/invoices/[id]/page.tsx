import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Ban, Banknote, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInvoice, invoicePayments, invoiceStatus } from "@/lib/invoices";
import { accountsWithBalances } from "@/lib/books";
import { StatusPill } from "@/components/invoice-status";
import { cancelInvoice, payInvoice } from "@/app/actions/invoices";
import { money, prettyDate, today } from "@/lib/format";
import { currencySymbol } from "@/lib/currencies";
import { Flash, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { InvoiceView } from "@/components/invoice-view";
import { CodeBox } from "@/components/code-box";
import { ConfirmButton } from "@/components/confirm-button";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const inv = await getInvoice(await db(), user.id, Number((await params).id));
  if (!inv) notFound();
  const sp = await searchParams;
  const d = await db();
  const [payments, accounts] = await Promise.all([invoicePayments(d, user.id, inv.id), accountsWithBalances(d, user.id)]);
  const status = invoiceStatus(inv, today());
  const due = Math.max(0, inv.total - inv.paid);
  const into = accounts.filter((a) => (a.category === "Cash" || a.category === "Bank") && !a.archived);
  const h = await headers();
  const link = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/i/${inv.share_token}`;
  const phone = inv.customer_phone?.replace(/\D/g, "").replace(/^0/, "92");
  const text = encodeURIComponent(`Assalam-o-Alaikum ${inv.customer_name}, here is invoice #${inv.number} from ${inv.business} for ${currencySymbol(inv.currency)} ${money(inv.total)}:\n${link}`);
  return (
    <>
      <PageHeader
        title={`Invoice #${inv.number}`}
        actions={
          <>
            <a href={`https://wa.me/${phone ?? ""}?text=${text}`} target="_blank" rel="noreferrer" className="btn bg-ledger text-white hover:bg-ledger-dark">
              <MessageCircle className="h-4 w-4" />Send on WhatsApp
            </a>
            <PrintButton />
            {!inv.cancelled && (
              <form action={cancelInvoice}>
                <input type="hidden" name="id" value={inv.id} />
                <ConfirmButton className="btn-danger" message={`Cancel invoice #${inv.number}? Its entries (and any payments on it) are removed from your books.`} confirmLabel="Cancel invoice"><Ban className="h-4 w-4" />Cancel invoice</ConfirmButton>
              </form>
            )}
          </>
        }
      />
      <Flash sp={sp} />
      <div className="no-print mb-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Payment</h2>
            <StatusPill status={status} />
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-paper p-2"><dt className="text-sm text-muted">Total</dt><dd className="font-bold text-ink">{money(inv.total)}</dd></div>
            <div className="rounded-lg bg-paper p-2"><dt className="text-sm text-muted">Paid</dt><dd className="font-bold text-ledger">{money(inv.paid)}</dd></div>
            <div className="rounded-lg bg-paper p-2"><dt className="text-sm text-muted">Balance due</dt><dd className="font-bold text-khata">{money(due)}</dd></div>
          </dl>
          {payments.length > 0 && (
            <ul className="mt-3 text-sm">
              {payments.map((p) => (
                <li key={p.id} className={`flex justify-between border-b border-rule/70 py-1.5 ${p.deleted ? "line-through opacity-60" : ""}`}>
                  <span>{prettyDate(p.date)}</span><span className="tabular-nums">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {due > 0 && !inv.cancelled && (
          <form action={payInvoice} className="card grid gap-3 p-5 sm:grid-cols-2">
            <h2 className="text-lg font-bold sm:col-span-2">Record a payment</h2>
            <input type="hidden" name="id" value={inv.id} />
            <div>
              <label className="label" htmlFor="pay-amount">Amount received</label>
              <input id="pay-amount" name="amount" inputMode="decimal" required defaultValue={(due / 100).toFixed(2)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="pay-date">Date</label>
              <input id="pay-date" type="date" name="date" required defaultValue={today()} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pay-into">Received into</label>
              <select id="pay-into" name="into" className="input">
                {into.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button className="btn-primary sm:col-span-2"><Banknote className="h-4 w-4" />Record payment</button>
          </form>
        )}
      </div>
      <div className="no-print mb-5 space-y-2">
        <p className="text-sm text-muted">Customer link (anyone with it can view this invoice, nothing else):</p>
        <CodeBox value={link} />
      </div>
      <InvoiceView inv={inv} />
    </>
  );
}
