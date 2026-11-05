import {
  Banknote, BookUser, Briefcase, Building2, Car, CreditCard, Factory, Fuel, Gift, GraduationCap, HandCoins, HeartPulse,
  Home, Landmark, Package, PiggyBank, Plane, Receipt, Scale, Shirt, ShoppingBag, Smartphone, Store, Tag, TrendingDown,
  TrendingUp, Truck, Users, Utensils, Wallet, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS, OTHER_COLOR } from "./palette.ts";

/** Icons people can pick for a category or sub-category. */
export const ICONS: Record<string, [LucideIcon, string]> = {
  banknote: [Banknote, "Cash"],
  landmark: [Landmark, "Bank"],
  wallet: [Wallet, "Wallet"],
  "credit-card": [CreditCard, "Card"],
  smartphone: [Smartphone, "Mobile wallet"],
  users: [Users, "People"],
  "book-user": [BookUser, "Khata"],
  truck: [Truck, "Supplier"],
  package: [Package, "Stock"],
  store: [Store, "Shop"],
  factory: [Factory, "Factory"],
  building: [Building2, "Building"],
  home: [Home, "Home"],
  car: [Car, "Vehicle"],
  fuel: [Fuel, "Fuel"],
  zap: [Zap, "Bills"],
  utensils: [Utensils, "Food"],
  "shopping-bag": [ShoppingBag, "Shopping"],
  shirt: [Shirt, "Clothes"],
  "heart-pulse": [HeartPulse, "Health"],
  "graduation-cap": [GraduationCap, "Education"],
  plane: [Plane, "Travel"],
  wrench: [Wrench, "Repairs"],
  briefcase: [Briefcase, "Business"],
  gift: [Gift, "Gifts"],
  receipt: [Receipt, "Receipts"],
  scale: [Scale, "Loans"],
  "hand-coins": [HandCoins, "Owed"],
  "piggy-bank": [PiggyBank, "Savings"],
  "trending-up": [TrendingUp, "Income"],
  "trending-down": [TrendingDown, "Expense"],
  tag: [Tag, "Other"],
};

const BY_NAME: Record<string, string> = {
  cash: "banknote", bank: "landmark", receivables: "users", assets: "package", payables: "truck",
  liabilities: "scale", equity: "piggy-bank", income: "trending-up", expense: "trending-down",
};
const BY_KIND: Record<string, string> = { asset: "building", liability: "hand-coins", equity: "piggy-bank", income: "receipt", expense: "tag" };

export const PICK_COLORS = [...CATEGORY_COLORS, "#1f2937", OTHER_COLOR];

export function iconFor(icon: string | null | undefined, name = "", kind = ""): LucideIcon {
  return (ICONS[icon ?? ""] ?? ICONS[BY_NAME[name.toLowerCase()] ?? ""] ?? ICONS[BY_KIND[kind] ?? ""] ?? ICONS.tag)[0];
}

export function defaultIconKey(name = "", kind = "") {
  return BY_NAME[name.toLowerCase()] ?? BY_KIND[kind] ?? "tag";
}

/** A colour for the n-th item in a list, used when nothing was chosen. */
export function colorAt(index: number) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? OTHER_COLOR;
}
