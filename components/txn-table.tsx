import Link from "next/link";
import { FolderKanban, Paperclip, Pencil, Trash2 } from "lucide-react";
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
              <td className="max-w-xs text-slate-500">
                {t.note}
                <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                  {t.currency && (
                    <span className="rounded bg-blue-50 px-1.5 text-blue-700">
                      {t.currency} {money(t.foreign_amount ?? 0)} @ {t.rate}
                    </span>
                  )}
                  {t.project && (
                    <Link href={`/transactions?project=${t.project_id}`} className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 text-purple-700">
                      <FolderKanban className="h-3 w-3" />{t.project}
                    </Link>
                  )}
                  {t.attachments > 0 && (
                    <Link href={`/voucher?edit=${t.id}`} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 text-slate-700">
                      <Paperclip className="h-3 w-3" />{t.attachments}
                    </Link>
                  )}
                </div>
              </td>
              <td className="num font-medium">{money(t.amount)}</td>
              <td className="no-print whitespace-nowrap text-right">
                <Link href={`/voucher?edit=${t.id}`} title="Edit" aria-label="Edit" className="mr-1 inline-flex rounded-md p-1.5 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Link>
                <form action={deleteTransaction} className="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value={back} />
                  <button title="Delete" aria-label="Delete" className="inline-flex rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
