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
