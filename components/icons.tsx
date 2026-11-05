import {
  Banknote, BookUser, Building2, HandCoins, Landmark, Package, PiggyBank, Receipt, Scale, Tag,
  TrendingDown, TrendingUp, Truck, Users, type LucideIcon,
} from "lucide-react";
import type { Kind } from "@/lib/books";

// Icon + colour per category, like the coloured tiles in the original app.
const BY_NAME: Record<string, [LucideIcon, string]> = {
  cash: [Banknote, "bg-blue-500"],
  bank: [Landmark, "bg-emerald-700"],
  receivables: [Users, "bg-orange-500"],
  assets: [Package, "bg-green-600"],
  payables: [Truck, "bg-amber-500"],
  liabilities: [Scale, "bg-slate-500"],
  equity: [PiggyBank, "bg-purple-600"],
  income: [TrendingUp, "bg-teal-600"],
  expense: [TrendingDown, "bg-red-500"],
};
const BY_KIND: Record<Kind, [LucideIcon, string]> = {
  asset: [Building2, "bg-green-600"],
  liability: [HandCoins, "bg-slate-500"],
  equity: [PiggyBank, "bg-purple-600"],
  income: [Receipt, "bg-teal-600"],
  expense: [Tag, "bg-red-500"],
};

export function categoryIcon(name: string, kind: Kind): [LucideIcon, string] {
  return BY_NAME[name.toLowerCase()] ?? BY_KIND[kind] ?? [BookUser, "bg-slate-500"];
}

export function CategoryBadge({ name, kind, size = "md" }: { name: string; kind: Kind; size?: "sm" | "md" }) {
  const [Icon, bg] = categoryIcon(name, kind);
  const box = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const ic = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg text-white ${bg} ${box}`}>
      <Icon className={ic} strokeWidth={2} />
    </span>
  );
}
