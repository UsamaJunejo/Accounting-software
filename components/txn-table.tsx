import Link from "next/link";
import { ArrowRight, FolderKanban, Paperclip, Pencil, Trash2 } from "lucide-react";
import { deleteTransaction } from "@/app/actions/books";
import { friendlyDate, money, today } from "@/lib/format";
import type { TxnRow } from "@/lib/books";
import { Empty, TypeBadge } from "@/components/ui";
import { getT } from "@/lib/lang";

const tone = (type: string) => (type === "payment" ? "text-khata" : type === "receipt" ? "text-inflow" : "text-ink");

const editHref = (id: number, back: string) => `/voucher?edit=${id}&back=${encodeURIComponent(back)}`;

function Extras({ t, back = "/transactions" }: { t: TxnRow; back?: string }) {
  if (!t.currency && !t.project && !t.attachments) return null;
  return (
    <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
      {t.currency && <span className="rounded bg-ink-soft px-1.5 text-ink">{t.currency} {money(t.foreign_amount ?? 0)} @ {t.rate}</span>}
      {t.project && (
        <Link href={`/transactions?project=${t.project_id}`} className="inline-flex items-center gap-1 rounded bg-ink-soft px-1.5 text-ink">
          <FolderKanban className="h-3 w-3" />{t.project}
        </Link>
      )}
      {t.attachments > 0 && (
        <Link href={editHref(t.id, back)} className="inline-flex items-center gap-1 rounded bg-paper px-1.5 text-body">
          <Paperclip className="h-3 w-3" />{t.attachments}
        </Link>
      )}
    </div>
  );
}

function Actions({ t, back }: { t: TxnRow; back: string }) {
  return (
    <span className="no-print inline-flex">
      <Link href={editHref(t.id, back)} title="Edit" aria-label="Edit entry" className="inline-flex rounded-md p-2 text-ink hover:bg-ink-soft"><Pencil className="h-4 w-4" /></Link>
      <form action={deleteTransaction} className="inline">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="back" value={back} />
        <button title="Delete" aria-label="Delete entry" className="inline-flex rounded-md p-2 text-khata hover:bg-khata-soft"><Trash2 className="h-4 w-4" /></button>
      </form>
    </span>
  );
}

/**
 * Entries list. On phones each entry is a card; on bigger screens a table.
 * With groupByDay, entries sit under a heading per day with that day's money in and out.
 */
export async function TxnTable({ rows, back, groupByDay = false }: { rows: TxnRow[]; back: string; groupByDay?: boolean }) {
  const tr = await getT();
  if (!rows.length) return <Empty>No entries found.</Empty>;
  const now = today();
  const days: { date: string; rows: TxnRow[]; inflow: number; outflow: number }[] = [];
  for (const r of rows) {
    let g = days[days.length - 1];
    if (!groupByDay) {
      if (!g) days.push((g = { date: "", rows: [], inflow: 0, outflow: 0 }));
    } else if (!g || g.date !== r.date) days.push((g = { date: r.date, rows: [], inflow: 0, outflow: 0 }));
    g.rows.push(r);
    if (r.type === "receipt") g.inflow += r.amount;
    if (r.type === "payment") g.outflow += r.amount;
  }
  const DayHead = ({ g }: { g: (typeof days)[number] }) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="font-semibold text-ink">{friendlyDate(g.date, now)}</span>
      <span className="text-sm text-muted">
        {g.inflow > 0 && <span className="me-3 text-inflow">In {money(g.inflow)}</span>}
        {g.outflow > 0 && <span className="text-khata">Out {money(g.outflow)}</span>}
      </span>
    </div>
  );

  return (
    <>
      {/* Phones: cards */}
      <div className="sm:hidden">
        {days.map((g, gi) => (
          <section key={gi}>
            {groupByDay && <div className="border-b border-rule bg-white/50 px-4 py-2"><DayHead g={g} /></div>}
            <ul>
              {g.rows.map((t) => (
                <li key={t.id} className="flex items-start gap-3 border-b border-rule/70 px-4 py-3" style={t.highlight ? { background: t.highlight + "33" } : undefined}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[15px] text-ink">
                      <span className="truncate">{t.from_name}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="truncate font-semibold">{t.to_name}</span>
                    </div>
                    <div className="text-sm text-muted">{groupByDay ? "" : `${friendlyDate(t.date, now)} `}{t.note}</div>
                    <Extras t={t} back={back} />
                  </div>
                  <div className="text-end">
                    <div className={`font-bold tabular-nums ${tone(t.type)}`} dir="ltr">{money(t.amount)}</div>
                    <Actions t={t} back={back} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Bigger screens: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="table">
          <thead>
            <tr>
              {!groupByDay && <th>{tr("Date")}</th>}
              <th>{tr("Type")}</th><th>{tr("From")}</th><th>{tr("To")}</th><th className="hidden md:table-cell">{tr("Note")}</th><th className="num">{tr("Amount")}</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          {days.map((g, gi) => (
            <tbody key={gi}>
              {groupByDay && (
                <tr><td colSpan={7} className="bg-white/50"><DayHead g={g} /></td></tr>
              )}
              {g.rows.map((t) => (
                <tr key={t.id} style={t.highlight ? { background: t.highlight + "33" } : undefined}>
                  {!groupByDay && <td className="whitespace-nowrap">{friendlyDate(t.date, now)}</td>}
                  <td><TypeBadge type={t.type} /></td>
                  <td>{t.from_name}</td>
                  <td>{t.to_name}<div className="md:hidden"><Extras t={t} back={back} /></div></td>
                  <td className="hidden max-w-xs text-muted md:table-cell">{t.note}<Extras t={t} back={back} /></td>
                  <td className={`num font-semibold ${tone(t.type)}`}>{money(t.amount)}</td>
                  <td className="whitespace-nowrap text-right"><Actions t={t} back={back} /></td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}
