// Small, pure rules about accounts. Safe to use in the browser too.

export type Kind = "asset" | "liability" | "equity" | "income" | "expense";
export type TxnType = "payment" | "receipt" | "transfer";
/** What a category is for. Logic uses this, never the name, so users can rename freely. */
export type Role = "cash" | "bank" | "receivable" | "payable" | "opening" | null;

/** Cash, bank and mobile wallets: where money actually sits. */
export const isMoney = (a: { role: Role }) => a.role === "cash" || a.role === "bank";
export const isParty = (a: { role: Role }) => a.role === "receivable" || a.role === "payable";

/**
 * The entry's type comes from its accounts, so it can never disagree with them:
 * out of cash/bank = Money Out, into cash/bank = Money In, between them = Transfer.
 * Anything else (e.g. an udhaar sale: Sales → customer) is a transfer between other accounts.
 */
export function typeFor(from: { role: Role }, to: { role: Role }): TxnType {
  if (isMoney(from) && isMoney(to)) return "transfer";
  if (isMoney(from)) return "payment";
  if (isMoney(to)) return "receipt";
  return "transfer";
}

/** What a beginner picks when adding an account; the app works out where it goes. */
export type AccountChoice = "expense" | "income" | "money" | "customer" | "supplier" | "owned" | "owed";
export const ACCOUNT_CHOICES: [AccountChoice, string, string][] = [
  ["expense", "Expense", "something you spend on: tea, rent, bills"],
  ["income", "Income", "money you earn: sales, commission"],
  ["money", "Cash / bank / wallet", "where money is kept"],
  ["customer", "Customer", "someone who buys on credit (khata)"],
  ["supplier", "Supplier", "someone you buy from on credit"],
  ["owned", "Something you own", "stock, equipment, a deposit"],
  ["owed", "Loan / you owe", "a loan or other money you owe"],
];

/** "1,500.50", "Rs 500", "500/-" or "۵۰۰" -> paisa. Returns NaN for bad input. Safe in the browser too. */
export function parseAmount(input: string): number {
  const clean = String(input)
    // Urdu / Arabic digits (۵۰۰, ٥٠٠) count as normal digits.
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    // People write "Rs 500", "PKR 500" or "500/-": the extra bits mean nothing.
    .replace(/^\s*(rs\.?|pkr|₨)\s*/i, "")
    .replace(/\/-\s*$/, "")
    .replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean) * 100);
}

/** What a category is for, in plain words. */
export function categoryHint(c: { kind: Kind; role: Role }) {
  if (c.role === "cash") return "cash in hand";
  if (c.role === "bank") return "bank accounts and wallets";
  if (c.role === "receivable") return "customers who owe you";
  if (c.role === "payable") return "suppliers you owe";
  return { asset: "things you own", liability: "loans and money you owe", equity: "the owner's money", income: "money you earn", expense: "money you spend" }[c.kind];
}
