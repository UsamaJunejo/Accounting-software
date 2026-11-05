import Link from "next/link";
import { money } from "@/lib/format";
import type { AccountRow } from "@/lib/books";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Flash({ sp }: { sp: { error?: string; ok?: string } }) {
  if (sp.error)
    return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sp.error}</div>;
  if (sp.ok)
    return <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{sp.ok}</div>;
  return null;
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tabular-nums ${value < 0 ? "text-red-600" : ""} ${className}`}>{money(value)}</span>;
}

/** Account dropdown grouped by category, the way users think about them. */
export function AccountSelect({
  name,
  accounts,
  value,
  required = true,
  placeholder = "Select account",
}: {
  name: string;
  accounts: AccountRow[];
  value?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const groups = new Map<string, AccountRow[]>();
  for (const a of accounts.filter((a) => !a.archived || a.id === value)) {
    const key = a.category;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return (
    <select name={name} defaultValue={value ?? ""} required={required} className="input">
      <option value="" disabled>
        {placeholder}
      </option>
      {[...groups].map(([cat, accs]) => (
        <optgroup key={cat} label={cat}>
          {accs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.subcategory}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function DateRange({ from, to, extra }: { from: string; to: string; extra?: React.ReactNode }) {
  return (
    <form className="card no-print mb-5 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label className="label">From</label>
        <input type="date" name="from" defaultValue={from} className="input" />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" name="to" defaultValue={to} className="input" />
      </div>
      {extra}
      <button className="btn-dark">Show</button>
    </form>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function TypeBadge({ type }: { type: string }) {
  const c =
    type === "payment" ? "bg-orange-100 text-orange-700" : type === "receipt" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${c}`}>{type}</span>;
}

export function LinkButton(props: React.ComponentProps<typeof Link> & { variant?: "primary" | "dark" | "ghost" }) {
  const { variant = "ghost", className = "", ...rest } = props;
  return <Link {...rest} className={`btn-${variant} ${className}`} />;
}
