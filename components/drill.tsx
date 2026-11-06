import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { CategoryBadge } from "@/components/icons";
import { Money } from "@/components/ui";
import { CategoryBars, CategoryDonut } from "@/components/charts";
import { Dialog } from "@/components/dialog";

export type DrillItem = {
  key: string;
  href: string;
  name: string;
  balance: number;
  /** For an account kept in another currency: its balance in that currency. */
  native?: { amount: number; currency: string } | null;
  color: string;
  icon?: string | null;
  kind: string;
  note?: string;
};

/** Breadcrumb: Accounts › Assets › Fixed assets */
export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {c.href ? <Link href={c.href} className="font-semibold text-peacock hover:underline">{c.label}</Link> : <span>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Coloured tiles for each item, plus an "Add" tile that opens a small form (like MunshiBaba). */
export function DrillTiles({ items, addLabel, addForm }: { items: DrillItem[]; addLabel?: string; addForm?: React.ReactNode }) {
  return (
    <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {items.map((it) => (
        <li key={it.key}>
          <Link href={it.href} className="card flex h-full items-center gap-3 p-3.5 transition-colors hover:border-peacock">
            <CategoryBadge name={it.name} kind={it.kind} size="lg" color={it.color} icon={it.icon} />
            <span className="min-w-0">
              <span className="block text-[15px] leading-snug text-body [overflow-wrap:anywhere]">{it.name}</span>
              <span className="block text-lg font-bold text-ink"><Money value={it.balance} /></span>
              {it.native && (
                <span className="block text-xs font-semibold text-muted" dir="ltr">{it.native.currency} <Money value={it.native.amount} /></span>
              )}
              {it.note && <span className="block text-xs text-muted">{it.note}</span>}
            </span>
          </Link>
        </li>
      ))}
      {addLabel && addForm && (
        <li>
          <Dialog
            title={addLabel}
            triggerClass="flex h-full w-full items-center gap-3 rounded-xl border-2 border-dashed border-rule-strong bg-white/40 p-3.5 text-start text-peacock transition-colors hover:border-peacock hover:bg-white/70"
            trigger={
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-peacock-soft"><Plus className="h-5 w-5" /></span>
                <span className="font-semibold">{addLabel}</span>
              </>
            }
          >
            {addForm}
          </Dialog>
        </li>
      )}
    </ul>
  );
}

/** Donut (share of each positive balance) and bars (every balance, above or below zero), like MunshiBaba. */
export function DrillCharts({ items, cur, donutTitle, barsTitle }: { items: DrillItem[]; cur: string; donutTitle: string; barsTitle: string }) {
  // Nothing to draw yet: say so once, instead of two empty charts.
  if (!items.some((i) => i.balance !== 0)) return null;
  const data = items.map((i) => ({ name: i.name, value: i.balance, color: i.color }));
  return (
    <section className="mb-6 grid gap-5 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-3 text-lg font-bold">{donutTitle}</h2>
        <CategoryDonut data={data} cur={cur} empty="No balances yet. Add an entry to see the chart." />
      </div>
      <div className="card p-5">
        <h2 className="mb-3 text-lg font-bold">{barsTitle}</h2>
        <CategoryBars data={data} cur={cur} />
      </div>
    </section>
  );
}
