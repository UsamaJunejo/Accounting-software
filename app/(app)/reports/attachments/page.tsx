import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachmentReport, MAX_STORAGE_BYTES } from "@/lib/books";
import { money, prettyDate } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { currencySymbol } from "@/lib/currencies";

export const metadata = { title: "Attachments" };

const mb = (b: number) => (b / 1024 / 1024).toFixed(1);

export default async function Attachments() {
  const user = await requireUser();
  const rows = await attachmentReport(await db(), user.id);
  const used = rows.reduce((s, r) => s + r.size, 0);
  return (
    <>
      <PageHeader title="Attachments" subtitle={`Bills and receipts attached to entries · ${mb(used)} MB of ${mb(MAX_STORAGE_BYTES)} MB used`} />
      <div className="mb-5 h-2 rounded-full bg-paper">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (used / MAX_STORAGE_BYTES) * 100)}%` }} />
      </div>
      {rows.length === 0 ? (
        <div className="card"><Empty>No attachments yet. Use &ldquo;Attach bill / receipt&rdquo; on the New Entry form.</Empty></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => (
            <div key={r.id} className="card overflow-hidden">
              <a href={`/api/attachments/${r.id}`} target="_blank" rel="noreferrer" className="block h-40 bg-paper">
                {r.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/attachments/${r.id}`} alt={r.filename} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted/80"><FileText className="h-12 w-12" /></div>
                )}
              </a>
              <div className="p-3 text-sm">
                <div className="truncate font-medium">{r.filename}</div>
                <div className="text-xs text-muted">{prettyDate(r.date)} · {r.from_name} → {r.to_name}</div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">{currencySymbol(user.currency)} {money(r.amount)}</span>
                  <Link href={`/voucher?edit=${r.transaction_id}`} className="font-semibold text-brand">Open entry</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
