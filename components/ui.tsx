import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Inbox } from "lucide-react";
import { money } from "@/lib/format";
import { cache } from "react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountUsage } from "@/lib/books";
import { friendlyCategory } from "@/lib/look";
import { AccountPicker, type PickerOption } from "@/components/account-picker";
import { PeriodSelect } from "@/components/period-select";
import { today as todayIso } from "@/lib/format";
import { getT } from "@/lib/lang";
import type { AccountRow } from "@/lib/books";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Messages are now shown as fading pop-ups by <Toaster /> in the layout; this stays for older pages. */
export function Flash(_: { sp: { error?: string; ok?: string } }) {
  return null;
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span dir="ltr" className={`tabular-nums ${value < 0 ? "text-khata" : ""} ${className}`}>{money(value)}</span>;
}

/** Account dropdown grouped by category, the way users think about them. */
const usageFor = cache(async (userId: number) => accountUsage(await db(), userId));

/** Account chooser: searchable, most-used first, grouped by category (flat in the Simple view). */
export async function AccountSelect({
  name,
  accounts,
  value,
  placeholder,
}: {
  name: string;
  accounts: AccountRow[];
  value?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const user = await currentUser();
  const level = user?.level ?? 3;
  const t = await getT();
  const uses = user ? await usageFor(user.id) : new Map<number, number>();
  const visible = accounts.filter((a) => !a.archived || a.id === value);
  const options: PickerOption[] = (level === 1 ? [...visible].sort((a, b) => a.name.localeCompare(b.name)) : visible).map((a) => ({
    id: a.id,
    name: a.name,
    group: level === 1 ? "All accounts" : friendlyCategory(a.category),
    hint: level === 3 ? a.subcategory : undefined,
    uses: uses.get(a.id) ?? 0,
  }));
  return <AccountPicker name={name} options={options} value={value} placeholder={placeholder ?? t("Select account")} />;
}

export async function DateRange({ from, to, extra }: { from: string; to: string; extra?: React.ReactNode }) {
  const t = await getT();
  return (
    <form className="card no-print mb-5 flex flex-wrap items-end gap-3 p-4">
      <PeriodSelect from={from} to={to} today={todayIso()} />
      {extra}
      <button className="btn-dark">{t("Show")}</button>
    </form>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
      <Inbox className="h-8 w-8 text-muted/60" />
      {children}
    </div>
  );
}

export async function TypeBadge({ type }: { type: string }) {
  const t = await getT();
  const c =
    type === "payment" ? "bg-khata-soft text-khata" : type === "receipt" ? "bg-inflow-soft text-inflow" : "bg-paper text-body";
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
