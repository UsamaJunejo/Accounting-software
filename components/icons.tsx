import {
  Banknote, BookUser, Building2, HandCoins, Landmark, Package, PiggyBank, Receipt, Scale, Tag,
  TrendingDown, TrendingUp, Truck, Users, type LucideIcon,
} from "lucide-react";
import type { Kind } from "@/lib/books";

// One quiet icon per category. Colour is kept for meaning (money in / out), not decoration.
const BY_NAME: Record<string, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  receivables: Users,
  assets: Package,
  payables: Truck,
  liabilities: Scale,
  equity: PiggyBank,
  income: TrendingUp,
  expense: TrendingDown,
};
const BY_KIND: Record<Kind, LucideIcon> = {
  asset: Building2,
  liability: HandCoins,
  equity: PiggyBank,
  income: Receipt,
  expense: Tag,
};

export function categoryIcon(name: string, kind: Kind): LucideIcon {
  return BY_NAME[name.toLowerCase()] ?? BY_KIND[kind] ?? BookUser;
}

export function CategoryBadge({ name, kind, size = "md" }: { name: string; kind: Kind; size?: "sm" | "md" }) {
  const Icon = categoryIcon(name, kind);
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const ic = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded bg-ink-soft text-ink ${box}`}>
      <Icon className={ic} strokeWidth={1.8} />
    </span>
  );
}
