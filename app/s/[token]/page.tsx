import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { accountByToken, accountStatement } from "@/lib/books";
import { friendlyDate, money, numberStyle, prettyDate, today } from "@/lib/format";
import { currencySymbol } from "@/lib/currencies";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Statement", robots: { index: false, follow: false } };

// Public statement a shop sends to a customer or supplier (no login). Shows the last 6 months.
export default async function PublicStatement({ params }: { params: Promise<{ token: string }> }) {
  const d = await db();
  const acc = await accountByToken(d, (await params).token);
  if (!acc) notFound();
  numberStyle().v = acc.num_format;
  const to = today();
  const from = new Date(Date.parse(to) - 182 * 86_400_000).toISOString().slice(0, 10);
  const s = await accountStatement(d, acc.user_id, acc.id, from, to);
  const cur = currencySymbol(acc.currency);
  const isCustomer = s.account.role === "receivable";
  const bal = s.closing;
  // Worded from the reader's side: a customer owes the shop; a supplier is owed by the shop.
  const headline =
    bal === 0 ? "All settled. Nothing is due." : isCustomer ? (bal > 0 ? `You owe ${acc.business}` : `${acc.business} owes you`) : bal > 0 ? `${acc.business} owes you` : `You owe ${acc.business}`;
  return (
    <div className="min-h-screen px-4 py-8 print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-4 flex justify-end"><PrintButton label="Save as PDF / Print" /></div>
        <div className="card overflow-hidden bg-white">
          <div className="bg-brand px-6 py-5 text-white">
            <div className="text-sm text-white/80">Statement from {acc.business}{acc.phone ? ` (${acc.phone})` : ""}</div>
            <div className="text-2xl font-bold">{s.account.name}</div>
            <div className="mt-3 text-white/90">{headline}</div>
            {bal !== 0 && <div className="text-4xl font-bold tabular-nums" dir="ltr">{cur} {money(Math.abs(bal))}</div>}
            <div className="mt-1 text-sm text-white/75">As of {prettyDate(to)}</div>
          </div>
          <table className="table">
            <thead><tr><th>Date</th><th>Details</th><th className="num">{isCustomer ? "Bought" : "Supplied"}</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
            <tbody>
              <tr className="bg-white/50"><td colSpan={4}>Balance on {prettyDate(from)}</td><td className="num">{money(s.opening)}</td></tr>
              {s.lines.map((l) => {
                const { up, down } = l;
                return (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{friendlyDate(l.date, to)}</td>
                    <td className="text-muted">{l.note}</td>
                    <td className="num">{up ? money(up) : ""}</td>
                    <td className="num text-ledger">{down ? money(down) : ""}</td>
                    <td className="num font-semibold">{money(l.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-4 text-center text-xs text-muted">Made with <Logo className="text-muted" /></div>
        </div>
      </div>
    </div>
  );
}
