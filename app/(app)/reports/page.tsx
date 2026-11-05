import Link from "next/link";
import { BookUser, Coins, Hourglass, Download, FolderKanban, History, LineChart, ListTree, Paperclip, Scale, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Reports" };

const REPORTS: [string, string, string, LucideIcon][] = [
  ["/reports/income", "Profit & Loss", "Income minus expenses for any period. Are you making money?", LineChart],
  ["/reports/balance-sheet", "Balance Sheet & Net Worth", "What you own, what you owe, and what the business is worth on a date.", Scale],
  ["/reports/ledger", "Group Ledger", "Every account with money in, money out and balance, grouped by category.", ListTree],
  ["/reports/late-payers", "Who is late paying", "Customers who owe you, grouped by how long the money has been waiting. Remind them on WhatsApp.", Hourglass],
  ["/khata", "Khata (Receivables & Payables)", "Balances of every customer and supplier, with WhatsApp reminders.", BookUser],
  ["/projects", "Projects", "Profit of each project or branch, from entries tagged with it.", FolderKanban],
  ["/reports/currency", "Currency Ledger", "Entries made in USD, AED, SAR and other currencies, with totals and rates.", Coins],
  ["/reports/attachments", "Attachments", "Every bill and receipt photo, with the entry it belongs to.", Paperclip],
  ["/transactions", "All Entries", "Search and filter all entries, and download them for Excel.", Download],
  ["/reports/deleted", "Deleted Entries & History", "Every deleted entry (restorable) and a full log of changes.", History],
];

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Every report can be printed or saved as PDF from your browser." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map(([href, t, d, Icon]) => (
          <Link key={href} href={href} className="card p-5 transition hover:border-brand">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink-soft text-brand"><Icon className="h-5 w-5" /></span>
            <h2 className="font-semibold text-ink">{t}</h2>
            <p className="mt-2 text-sm text-muted">{d}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
