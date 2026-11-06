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
