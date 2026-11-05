import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listInvoices } from "@/lib/invoices";
import { money, prettyDate } from "@/lib/format";
import { Empty, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Invoices" };

export default async function Invoices() {
  const user = await requireUser();
  const rows = await listInvoices(await db(), user.id);
  return (
    <>
      <PageHeader title="Invoices" subtitle="Bills you've made for customers." actions={<LinkButton href="/invoices/new" variant="primary"><FilePlus2 className="h-4 w-4" />New invoice</LinkButton>} />
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>No invoices yet.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Customer</th><th className="num">Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.cancelled ? "opacity-50" : ""}>
                  <td><Link href={`/invoices/${r.id}`} className="font-semibold text-brand">#{r.number}</Link></td>
                  <td>{prettyDate(r.date)}</td>
                  <td>{r.customer_name}</td>
                  <td className="num font-medium">{money(r.total)}</td>
                  <td className="text-xs">{r.cancelled ? "Cancelled" : r.transaction_id ? "In books" : "Not in books"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
