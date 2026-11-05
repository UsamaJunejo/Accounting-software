import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Reports" };

const REPORTS = [
  ["/reports/income", "Profit & Loss", "Income minus expenses for any period. Are you making money?"],
  ["/reports/balance-sheet", "Balance Sheet & Net Worth", "What you own, what you owe, and what the business is worth on a date."],
  ["/reports/ledger", "Group Ledger", "Every account with money in, money out and balance, grouped by category."],
  ["/khata", "Khata (Receivables & Payables)", "Balances of every customer and supplier, with WhatsApp reminders."],
  ["/transactions", "All Entries", "Search and filter all entries, and download them for Excel."],
  ["/reports/deleted", "Deleted Entries & History", "Every deleted entry (restorable) and a full log of changes."],
];

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Every report can be printed or saved as PDF from your browser." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map(([href, t, d]) => (
          <Link key={href} href={href} className="card p-5 transition hover:border-brand">
            <h2 className="font-semibold text-ink">{t}</h2>
            <p className="mt-2 text-sm text-slate-600">{d}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
