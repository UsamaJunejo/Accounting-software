import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Inbox } from "lucide-react";
import { money } from "@/lib/format";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/lang";
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
  return <span dir="ltr" className={`tabular-nums ${value < 0 ? "text-red-600" : ""} ${className}`}>{money(value)}</span>;
}

/** Account dropdown grouped by category, the way users think about them. */
/** Account dropdown. Grouped by category, except in the Simple (1-level) view. */
export async function AccountSelect({
  name,
  accounts,
  value,
  required = true,
  placeholder,
}: {
  name: string;
  accounts: AccountRow[];
  value?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const level = (await currentUser())?.level ?? 3;
  placeholder = placeholder ?? (await getT())("Select account");
  const visible = accounts.filter((a) => !a.archived || a.id === value);
  if (level === 1)
    return (
      <select name={name} defaultValue={value ?? ""} required={required} className="input">
        <option value="" disabled>{placeholder}</option>
        {[...visible].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    );
  const groups = new Map<string, AccountRow[]>();
  for (const a of visible) groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  return (
    <select name={name} defaultValue={value ?? ""} required={required} className="input">
      <option value="" disabled>
        {placeholder}
      </option>
      {[...groups].map(([cat, accs]) => (
        <optgroup key={cat} label={cat}>
          {accs.map((a) => (
            <option key={a.id} value={a.id}>
              {level === 3 ? `${a.name} — ${a.subcategory}` : a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export async function DateRange({ from, to, extra }: { from: string; to: string; extra?: React.ReactNode }) {
  const t = await getT();
  return (
    <form className="card no-print mb-5 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label className="label">{t("From")}</label>
        <input type="date" name="from" defaultValue={from} className="input" />
      </div>
      <div>
        <label className="label">{t("To")}</label>
        <input type="date" name="to" defaultValue={to} className="input" />
      </div>
      {extra}
      <button className="btn-dark">{t("Show")}</button>
    </form>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-500">
      <Inbox className="h-8 w-8 text-slate-300" />
      {children}
    </div>
  );
}

export async function TypeBadge({ type }: { type: string }) {
  const t = await getT();
  const c =
    type === "payment" ? "bg-orange-100 text-orange-700" : type === "receipt" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700";
  const Icon = type === "payment" ? ArrowUpRight : type === "receipt" ? ArrowDownLeft : ArrowLeftRight;
  const label = t.lang === "ur" ? t(type === "payment" ? "Money Out" : type === "receipt" ? "Money In" : "Transfer") : type === "payment" ? "Out" : type === "receipt" ? "In" : "Transfer";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${c}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function LinkButton(props: React.ComponentProps<typeof Link> & { variant?: "primary" | "dark" | "ghost" }) {
  const { variant = "ghost", className = "", ...rest } = props;
  return <Link {...rest} className={`btn-${variant} ${className}`} />;
}
