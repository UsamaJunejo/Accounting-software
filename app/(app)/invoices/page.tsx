import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceStatus, listInvoices, type InvoiceStatus } from "@/lib/invoices";
import { StatusPill } from "@/components/invoice-status";
import { money, prettyDate, today } from "@/lib/format";
import { Empty, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Invoices" };

const TABS: [string, string][] = [["", "All"], ["due", "Not paid"], ["overdue", "Overdue"], ["paid", "Paid"]];

export default async function Invoices({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = today();
  const all = (await listInvoices(await db(), user.id)).map((r) => ({ ...r, status: invoiceStatus(r, now) as InvoiceStatus }));
  const rows = all.filter((r) =>
    sp.show === "due" ? ["unpaid", "part", "overdue"].includes(r.status) : sp.show === "overdue" ? r.status === "overdue" : sp.show === "paid" ? r.status === "paid" : true,
  );
  const outstanding = all.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);
  return (
    <>
      <PageHeader title="Invoices" subtitle="Bills you've made for customers." actions={<LinkButton href="/invoices/new" variant="primary"><FilePlus2 className="h-4 w-4" />New invoice</LinkButton>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex overflow-hidden rounded-md border border-white/80 bg-white/60 backdrop-blur" aria-label="Filter invoices">
          {TABS.map(([k, label]) => (
            <Link key={k} href={k ? `/invoices?show=${k}` : "/invoices"} aria-current={(sp.show ?? "") === k ? "page" : undefined}
              className={`px-3 py-2 text-sm font-semibold ${(sp.show ?? "") === k ? "bg-peacock text-white" : "text-peacock"}`}>{label}</Link>
          ))}
        </nav>
        <div className="text-[15px] text-body">Still to collect: <b className="text-ink">{money(outstanding)}</b></div>
      </div>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>{all.length ? "No invoices match this filter." : "No invoices yet."}</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Customer</th><th className="num">Total</th><th className="num">Balance due</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.cancelled ? "opacity-50" : ""}>
                  <td><Link href={`/invoices/${r.id}`} className="font-semibold text-brand">#{r.number}</Link></td>
                  <td>{prettyDate(r.date)}</td>
                  <td>{r.customer_name}</td>
                  <td className="num font-medium">{money(r.total)}</td>
                  <td className="num">{r.status === "cancelled" ? "" : money(Math.max(0, r.total - r.paid))}</td>
                  <td><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
