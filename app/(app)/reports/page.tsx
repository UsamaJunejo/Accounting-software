import Link from "next/link";
import { Coins, FolderKanban, History, LineChart, ListTree, Paperclip, Scale, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Reports" };

const REPORTS: [string, string, string, LucideIcon][] = [
  ["/reports/income", "Profit & Loss", "Income minus expenses for any period. Are you making money?", LineChart],
  ["/reports/balance-sheet", "What I own & owe", "What you own, what you owe, and what the business is worth on a date.", Scale],
  ["/reports/ledger", "All account balances", "Every account with money in, money out and balance, grouped by category.", ListTree],
  ["/projects", "Projects", "Profit of each project or branch, from entries tagged with it.", FolderKanban],
  ["/reports/currency", "Other currencies", "Entries made in USD, AED, SAR and other currencies, with totals and rates.", Coins],
  ["/reports/attachments", "Bill photos", "Every bill and receipt photo, with the entry it belongs to.", Paperclip],
  ["/reports/deleted", "Deleted entries", "Every deleted entry (restorable) and a full log of changes.", History],
];

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map(([href, t, , Icon]) => (
          <Link key={href} href={href} className="card flex items-center gap-3 p-4 transition hover:border-brand">
            <span className="inline-flex h-10 shrink-0 w-10 items-center justify-center rounded-lg bg-ink-soft text-brand"><Icon className="h-5 w-5" /></span>
            <h2 className="font-semibold text-ink">{t}</h2>
          </Link>
        ))}
      </div>
    </>
  );
}
