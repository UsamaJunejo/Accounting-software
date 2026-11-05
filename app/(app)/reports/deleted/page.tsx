import { RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog, listTransactions } from "@/lib/books";
import { restoreTransaction } from "@/app/actions/books";
import { money, prettyDate } from "@/lib/format";
import { Empty, Flash, PageHeader, TypeBadge } from "@/components/ui";

export const metadata = { title: "Deleted & History" };

const ACTION_LABEL: Record<string, string> = { create: "Added", update: "Edited", delete: "Deleted", restore: "Restored" };

export default async function Deleted({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const rows = await listTransactions(d, user.id, { deleted: true });
  const log = await auditLog(d, user.id, 100);
  return (
    <>
      <PageHeader title="Deleted entries & history" subtitle="Nothing is ever lost. Deleted entries can be restored." />
      <Flash sp={sp} />
      <div className="card mb-6 overflow-x-auto">
        <h2 className="p-4 font-semibold text-ink">Deleted entries</h2>
        {rows.length === 0 ? (
          <Empty>No deleted entries.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Type</th><th>From → To</th><th>Note</th><th className="num">Amount</th><th>Deleted on</th><th></th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{prettyDate(t.date)}</td>
                  <td><TypeBadge type={t.type} /></td>
                  <td>{t.from_name} → {t.to_name}</td>
                  <td className="text-muted">{t.note}</td>
                  <td className="num">{money(t.amount)}</td>
                  <td className="whitespace-nowrap text-muted">{t.deleted_at}</td>
                  <td>
                    <form action={restoreTransaction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="inline-flex items-center gap-1 text-sm font-semibold text-ink"><RotateCcw className="h-4 w-4" />Restore</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card overflow-x-auto">
        <h2 className="p-4 font-semibold text-ink">Recent activity</h2>
        {log.length === 0 ? (
          <Empty>No activity yet.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>When (UTC)</th><th>Action</th><th>Entry #</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{l.created_at}</td>
                  <td>{ACTION_LABEL[l.action] ?? l.action}</td>
                  <td>{l.transaction_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
