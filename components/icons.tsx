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

export function CategoryBadge({ name, kind, size = "md", color }: { name: string; kind: Kind; size?: "sm" | "md" | "lg"; color?: string }) {
  const Icon = categoryIcon(name, kind);
  const box = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const ic = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${color ? "text-white" : "bg-peacock-soft text-peacock"} ${box}`}
      style={color ? { background: color } : undefined}
    >
      <Icon className={ic} strokeWidth={1.8} />
    </span>
  );
}
