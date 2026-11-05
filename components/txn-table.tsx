import Link from "next/link";
import { FolderKanban, Paperclip, Pencil, Trash2 } from "lucide-react";
import { deleteTransaction } from "@/app/actions/books";
import { money, prettyDate } from "@/lib/format";
import type { TxnRow } from "@/lib/books";
import { Empty, TypeBadge } from "@/components/ui";
import { getT } from "@/lib/lang";

export async function TxnTable({ rows, back }: { rows: TxnRow[]; back: string }) {
  const t = await getT();
  if (!rows.length) return <Empty>No entries found.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th className="hidden md:table-cell">#</th><th>{t("Date")}</th><th className="hidden sm:table-cell">{t("Type")}</th><th>{t("From")}</th><th>{t("To")}</th><th>{t("Note")}</th><th className="num">{t("Amount")}</th>
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={t.highlight ? { background: t.highlight + "33" } : undefined}>
              <td className="hidden text-muted/80 md:table-cell">{t.id}</td>
              <td className="whitespace-nowrap">{prettyDate(t.date)}</td>
              <td className="hidden sm:table-cell"><TypeBadge type={t.type} /></td>
              <td>{t.from_name}</td>
              <td>{t.to_name}</td>
              <td className="max-w-xs text-muted">
                {t.note}
                <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                  {t.currency && (
                    <span className="rounded bg-ink-soft px-1.5 text-ink">
                      {t.currency} {money(t.foreign_amount ?? 0)} @ {t.rate}
                    </span>
                  )}
                  {t.project && (
                    <Link href={`/transactions?project=${t.project_id}`} className="inline-flex items-center gap-1 rounded bg-ink-soft px-1.5 text-ink">
                      <FolderKanban className="h-3 w-3" />{t.project}
                    </Link>
                  )}
                  {t.attachments > 0 && (
                    <Link href={`/voucher?edit=${t.id}`} className="inline-flex items-center gap-1 rounded bg-paper px-1.5 text-body">
                      <Paperclip className="h-3 w-3" />{t.attachments}
                    </Link>
                  )}
                </div>
              </td>
              <td className="num font-medium">{money(t.amount)}</td>
              <td className="no-print whitespace-nowrap text-right">
                <Link href={`/voucher?edit=${t.id}`} title="Edit" aria-label="Edit" className="mr-1 inline-flex rounded-md p-1.5 text-ink hover:bg-ink-soft"><Pencil className="h-4 w-4" /></Link>
                <form action={deleteTransaction} className="inline">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value={back} />
                  <button title="Delete" aria-label="Delete" className="inline-flex rounded-md p-1.5 text-khata hover:bg-khata-soft"><Trash2 className="h-4 w-4" /></button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
