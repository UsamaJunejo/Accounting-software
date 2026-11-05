import Link from "next/link";
import { deleteTransaction } from "@/app/actions/books";
import { money, prettyDate } from "@/lib/format";
import type { TxnRow } from "@/lib/books";
import { Empty, TypeBadge } from "@/components/ui";

export function TxnTable({ rows, back }: { rows: TxnRow[]; back: string }) {
  if (!rows.length) return <Empty>No entries found.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>#</th><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Note</th><th className="num">Amount</th>
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={t.highlight ? { background: t.highlight + "33" } : undefined}>
              <td className="text-slate-400">{t.id}</td>
              <td className="whitespace-nowrap">{prettyDate(t.date)}</td>
              <td><TypeBadge type={t.type} /></td>
              <td>{t.from_name}</td>
              <td>{t.to_name}</td>
              <td className="max-w-xs text-slate-500">{t.note}</td>
              <td className="num font-medium">{money(t.amount)}</td>
              <td className="no-print whitespace-nowrap text-right">
                <Link href={`/voucher?edit=${t.id}`} className="mr-3 text-sm font-semibold text-blue-600">Edit</Link>
                <form action={deleteTransaction} className="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value={back} />
                  <button className="text-sm font-semibold text-red-600">Delete</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
