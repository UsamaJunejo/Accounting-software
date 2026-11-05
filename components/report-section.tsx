import Link from "next/link";
import type { AccountRow } from "@/lib/books";
import { Money } from "@/components/ui";

export function ReportSection({ title, rows, total, totalLabel, currency = "PKR" }: { title: string; rows: AccountRow[]; total: number; totalLabel?: string; currency?: string }) {
  return (
    <table className="table mb-4">
      <thead>
        <tr><th>{title}</th><th className="num">{currency}</th></tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={2} className="text-muted/80">Nothing yet</td></tr>
        )}
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link href={`/accounts/${r.id}`} className="hover:text-brand">{r.name}</Link>
              <span className="ml-2 text-xs text-muted/80">{r.subcategory}</span>
            </td>
            <td className="num"><Money value={r.balance} /></td>
          </tr>
        ))}
        <tr className="font-bold [&>td]:border-t [&>td]:border-ink">
          <td>{totalLabel ?? `Total ${title.toLowerCase()}`}</td>
          <td className="num"><Money value={total} /></td>
        </tr>
      </tbody>
    </table>
  );
}
