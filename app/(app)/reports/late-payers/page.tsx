import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { receivableAging } from "@/lib/aging";
import { money, prettyDate, today } from "@/lib/format";
import { currencySymbol } from "@/lib/currencies";
import { Empty, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Who is late paying" };

// Age groups, from fresh to worrying. Colour shows how late; the column heading always says it too.
const BUCKETS: { key: "b0" | "b30" | "b60" | "b90"; label: string; tone: string }[] = [
  { key: "b0", label: "Up to 30 days", tone: "" },
  { key: "b30", label: "31–60 days", tone: "text-marigold" },
  { key: "b60", label: "61–90 days", tone: "text-khata" },
  { key: "b90", label: "Over 90 days", tone: "font-bold text-khata" },
];

export default async function LatePayers() {
  const user = await requireUser();
  const now = today();
  const rows = await receivableAging(await db(), user.id, now);
  const cur = currencySymbol(user.currency);
  const sum = (k: "balance" | "b0" | "b30" | "b60" | "b90") => rows.reduce((s, r) => s + r[k], 0);
  const total = sum("balance");
  return (
    <>
      <PageHeader title="Who is late paying" subtitle={`Money customers owe you, by how long it has been waiting. As of ${prettyDate(now)}.`} actions={<PrintButton />} />
      {rows.length > 0 && (
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BUCKETS.map((b) => {
            const v = sum(b.key);
            return (
              <div key={b.key} className="card p-4">
                <div className="text-sm text-muted">{b.label}</div>
                <div className={`text-xl font-bold ${v ? b.tone || "text-ink" : "text-muted"}`} dir="ltr">{cur} {money(v)}</div>
                <div className="mt-2 h-1.5 rounded-full bg-paper">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${total ? Math.round((v / total) * 100) : 0}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>Nobody owes you money right now. Customers appear here when they have an unpaid balance in Khata.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                {BUCKETS.map((b) => <th key={b.key} className="num">{b.label}</th>)}
                <th className="num">Total owed</th>
                <th className="hidden md:table-cell">Last paid</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const phone = r.phone?.replace(/\D/g, "").replace(/^0/, "92");
                const text = encodeURIComponent(
                  `Assalam-o-Alaikum ${r.name}, a reminder that ${cur} ${money(r.balance)} is pending with ${user.business_name || user.name}${r.oldest ? ` since ${prettyDate(r.oldest)}` : ""}. Thank you.`,
                );
                return (
                  <tr key={r.id}>
                    <td><Link href={`/accounts/${r.id}`} className="font-semibold text-ink hover:underline">{r.name}</Link>{r.oldest && <div className="text-sm text-muted">Oldest unpaid: {prettyDate(r.oldest)}</div>}</td>
                    {BUCKETS.map((b) => <td key={b.key} className={`num ${r[b.key] ? b.tone : "text-muted/60"}`}>{r[b.key] ? money(r[b.key]) : "–"}</td>)}
                    <td className="num font-bold text-ink">{money(r.balance)}</td>
                    <td className="hidden whitespace-nowrap md:table-cell">{r.lastPayment ? prettyDate(r.lastPayment) : "Never"}</td>
                    <td className="no-print">
                      {phone && (
                        <a href={`https://wa.me/${phone}?text=${text}`} target="_blank" rel="noreferrer" className="inline-flex rounded-md p-1.5 text-ledger hover:bg-ledger-soft" title="Send a reminder on WhatsApp" aria-label={`Remind ${r.name} on WhatsApp`}>
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-bold [&>td]:border-t [&>td]:border-ink">
                <td>Total</td>
                {BUCKETS.map((b) => <td key={b.key} className="num">{money(sum(b.key))}</td>)}
                <td className="num">{money(total)}</td>
                <td className="hidden md:table-cell"></td>
                <td className="no-print"></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">Payments are matched to the oldest unpaid amounts first, the way khata is usually settled.</p>
    </>
  );
}
