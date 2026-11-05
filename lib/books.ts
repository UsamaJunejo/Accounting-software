import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";

export type Kind = "asset" | "liability" | "equity" | "income" | "expense";
export type TxnType = "payment" | "receipt" | "transfer";

export const KIND_LABEL: Record<Kind, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

/**
 * Assets & expenses grow when money goes INTO them.
 * Liabilities, equity & income grow when money comes OUT of them.
 */
export function signedBalance(kind: Kind, moneyIn: number, moneyOut: number): number {
  return kind === "asset" || kind === "expense" ? moneyIn - moneyOut : moneyOut - moneyIn;
}

// Ready-made chart of accounts for a Pakistani small business.
const DEFAULTS: { name: string; kind: Kind; subs: [string, string[]][] }[] = [
  { name: "Cash", kind: "asset", subs: [["Cash in Hand", ["Cash"]]] },
  { name: "Bank", kind: "asset", subs: [["Bank Accounts", ["Bank Account"]], ["Mobile Wallets", ["JazzCash", "Easypaisa"]]] },
  { name: "Receivables", kind: "asset", subs: [["Customers (Khata)", []]] },
  { name: "Assets", kind: "asset", subs: [["Stock / Inventory", ["Stock"]], ["Fixed Assets", ["Furniture & Equipment"]]] },
  { name: "Payables", kind: "liability", subs: [["Suppliers", []]] },
  { name: "Liabilities", kind: "liability", subs: [["Loans", []], ["Taxes Payable", ["Sales Tax Payable"]]] },
  { name: "Equity", kind: "equity", subs: [["Owner", ["Owner Capital", "Owner Drawings"]]] },
  { name: "Income", kind: "income", subs: [["Sales", ["Sales"]], ["Other Income", ["Other Income"]]] },
  {
    name: "Expense",
    kind: "expense",
    subs: [
      ["Purchases", ["Purchases"]],
      ["Shop Expenses", ["Rent", "Salaries & Wages", "Repairs"]],
      ["Utilities", ["Electricity", "Gas", "Internet & Phone"]],
      ["Transport", ["Fuel", "Delivery"]],
      ["Other Expenses", ["Bank Charges", "Miscellaneous"]],
    ],
  },
];

export function seedDefaults(d: DatabaseSync, userId: number) {
  const insCat = d.prepare("INSERT INTO categories (user_id, name, kind, sort) VALUES (?, ?, ?, ?)");
  const insSub = d.prepare("INSERT INTO subcategories (user_id, category_id, name) VALUES (?, ?, ?)");
  const insAcc = d.prepare("INSERT INTO accounts (user_id, subcategory_id, name) VALUES (?, ?, ?)");
  DEFAULTS.forEach((c, i) => {
    const catId = Number(insCat.run(userId, c.name, c.kind, i).lastInsertRowid);
    for (const [sub, accs] of c.subs) {
      const subId = Number(insSub.run(userId, catId, sub).lastInsertRowid);
      for (const a of accs) insAcc.run(userId, subId, a);
    }
  });
}

export function createUser(
  d: DatabaseSync,
  u: { name: string; email: string; phone?: string; businessName?: string; passwordHash: string },
): number {
  return tx(d, () => {
    const id = Number(
      d
        .prepare("INSERT INTO users (name, email, phone, business_name, password_hash) VALUES (?, ?, ?, ?, ?)")
        .run(u.name, u.email.toLowerCase(), u.phone || null, u.businessName || null, u.passwordHash).lastInsertRowid,
    );
    seedDefaults(d, id);
    return id;
  });
}

// ---------- Reading the chart of accounts ----------

export type AccountRow = {
  id: number;
  name: string;
  phone: string | null;
  budget_monthly: number | null;
  archived: number;
  subcategory_id: number;
  subcategory: string;
  category_id: number;
  category: string;
  kind: Kind;
  money_in: number;
  money_out: number;
  balance: number;
};

/** Every account with its totals. Optional date window (inclusive, YYYY-MM-DD). */
export function accountsWithBalances(
  d: DatabaseSync,
  userId: number,
  opts: { from?: string; to?: string } = {},
): AccountRow[] {
  const from = opts.from ?? "0000-01-01";
  const to = opts.to ?? "9999-12-31";
  const rows = d
    .prepare(
      `SELECT a.id, a.name, a.phone, a.budget_monthly, a.archived,
              s.id AS subcategory_id, s.name AS subcategory,
              c.id AS category_id, c.name AS category, c.kind,
              COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.to_account_id = a.id
                        AND t.deleted_at IS NULL AND t.date BETWEEN ? AND ?), 0) AS money_in,
              COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.from_account_id = a.id
                        AND t.deleted_at IS NULL AND t.date BETWEEN ? AND ?), 0) AS money_out
       FROM accounts a
       JOIN subcategories s ON s.id = a.subcategory_id
       JOIN categories c ON c.id = s.category_id
       WHERE a.user_id = ?
       ORDER BY c.sort, c.name, s.name, a.name`,
    )
    .all(from, to, from, to, userId) as Omit<AccountRow, "balance">[];
  return rows.map((r) => ({ ...r, balance: signedBalance(r.kind, r.money_in, r.money_out) }));
}

export type Category = { id: number; name: string; kind: Kind; sort: number };
export type Subcategory = { id: number; name: string; category_id: number };

export function categories(d: DatabaseSync, userId: number): Category[] {
  return d.prepare("SELECT id, name, kind, sort FROM categories WHERE user_id = ? ORDER BY sort, name").all(userId) as Category[];
}

export function subcategories(d: DatabaseSync, userId: number): Subcategory[] {
  return d
    .prepare("SELECT id, name, category_id FROM subcategories WHERE user_id = ? ORDER BY name")
    .all(userId) as Subcategory[];
}

export function categoryTotals(d: DatabaseSync, userId: number, opts: { from?: string; to?: string } = {}) {
  const accs = accountsWithBalances(d, userId, opts);
  return categories(d, userId).map((c) => ({
    ...c,
    balance: accs.filter((a) => a.category_id === c.id).reduce((s, a) => s + a.balance, 0),
    accounts: accs.filter((a) => a.category_id === c.id).length,
  }));
}

// ---------- Chart of accounts editing ----------

function own(d: DatabaseSync, table: "categories" | "subcategories" | "accounts", id: number, userId: number) {
  const r = d.prepare(`SELECT id FROM ${table} WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!r) throw new Error("Not found");
}

export function addCategory(d: DatabaseSync, userId: number, name: string, kind: Kind) {
  const max = d.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM categories WHERE user_id = ?").get(userId) as { m: number };
  return Number(
    d.prepare("INSERT INTO categories (user_id, name, kind, sort) VALUES (?, ?, ?, ?)").run(userId, name, kind, max.m + 1)
      .lastInsertRowid,
  );
}

export function addSubcategory(d: DatabaseSync, userId: number, categoryId: number, name: string) {
  own(d, "categories", categoryId, userId);
  return Number(
    d.prepare("INSERT INTO subcategories (user_id, category_id, name) VALUES (?, ?, ?)").run(userId, categoryId, name)
      .lastInsertRowid,
  );
}

export function addAccount(
  d: DatabaseSync,
  userId: number,
  subcategoryId: number,
  name: string,
  extra: { phone?: string | null; budgetMonthly?: number | null } = {},
) {
  own(d, "subcategories", subcategoryId, userId);
  return Number(
    d
      .prepare("INSERT INTO accounts (user_id, subcategory_id, name, phone, budget_monthly) VALUES (?, ?, ?, ?, ?)")
      .run(userId, subcategoryId, name, extra.phone || null, extra.budgetMonthly || null).lastInsertRowid,
  );
}

export function updateAccount(
  d: DatabaseSync,
  userId: number,
  id: number,
  f: { name: string; subcategoryId: number; phone?: string | null; budgetMonthly?: number | null; archived?: boolean },
) {
  own(d, "accounts", id, userId);
  own(d, "subcategories", f.subcategoryId, userId);
  d.prepare(
    "UPDATE accounts SET name = ?, subcategory_id = ?, phone = ?, budget_monthly = ?, archived = ? WHERE id = ? AND user_id = ?",
  ).run(f.name, f.subcategoryId, f.phone || null, f.budgetMonthly || null, f.archived ? 1 : 0, id, userId);
}

export function renameCategory(d: DatabaseSync, userId: number, id: number, name: string) {
  d.prepare("UPDATE categories SET name = ? WHERE id = ? AND user_id = ?").run(name, id, userId);
}

export function renameSubcategory(d: DatabaseSync, userId: number, id: number, name: string, categoryId: number) {
  own(d, "categories", categoryId, userId);
  d.prepare("UPDATE subcategories SET name = ?, category_id = ? WHERE id = ? AND user_id = ?").run(name, categoryId, id, userId);
}

/** Only accounts that were never used can be deleted; otherwise archive them. */
export function deleteAccount(d: DatabaseSync, userId: number, id: number) {
  own(d, "accounts", id, userId);
  const used = d
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE from_account_id = ? OR to_account_id = ?")
    .get(id, id) as { n: number };
  if (used.n > 0) throw new Error("This account has entries. Archive it instead of deleting.");
  d.prepare("DELETE FROM accounts WHERE id = ?").run(id);
}

export function deleteSubcategory(d: DatabaseSync, userId: number, id: number) {
  own(d, "subcategories", id, userId);
  const n = d.prepare("SELECT COUNT(*) AS n FROM accounts WHERE subcategory_id = ?").get(id) as { n: number };
  if (n.n > 0) throw new Error("Move or delete its accounts first.");
  d.prepare("DELETE FROM subcategories WHERE id = ?").run(id);
}

export function deleteCategory(d: DatabaseSync, userId: number, id: number) {
  own(d, "categories", id, userId);
  const n = d.prepare("SELECT COUNT(*) AS n FROM subcategories WHERE category_id = ?").get(id) as { n: number };
  if (n.n > 0) throw new Error("Delete its sub-categories first.");
  d.prepare("DELETE FROM categories WHERE id = ?").run(id);
}

// ---------- Transactions ----------

export type TxnInput = {
  type: TxnType;
  date: string;
  amount: number; // paisa
  fromAccountId: number;
  toAccountId: number;
  note?: string | null;
  highlight?: string | null;
};

function validate(d: DatabaseSync, userId: number, t: TxnInput) {
  if (!["payment", "receipt", "transfer"].includes(t.type)) throw new Error("Invalid entry type");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) throw new Error("Invalid date");
  if (!Number.isInteger(t.amount) || t.amount <= 0) throw new Error("Amount must be more than zero");
  if (t.fromAccountId === t.toAccountId) throw new Error("'From' and 'To' must be different accounts");
  own(d, "accounts", t.fromAccountId, userId);
  own(d, "accounts", t.toAccountId, userId);
}

function audit(d: DatabaseSync, userId: number, action: string, txnId: number | null, details: unknown) {
  d.prepare("INSERT INTO audit_log (user_id, action, transaction_id, details) VALUES (?, ?, ?, ?)").run(
    userId,
    action,
    txnId,
    JSON.stringify(details),
  );
}

export function addTransaction(d: DatabaseSync, userId: number, t: TxnInput): number {
  validate(d, userId, t);
  return tx(d, () => {
    const id = Number(
      d
        .prepare(
          `INSERT INTO transactions (user_id, type, date, amount, from_account_id, to_account_id, note, highlight)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(userId, t.type, t.date, t.amount, t.fromAccountId, t.toAccountId, t.note || null, t.highlight || null)
        .lastInsertRowid,
    );
    audit(d, userId, "create", id, t);
    return id;
  });
}

export function updateTransaction(d: DatabaseSync, userId: number, id: number, t: TxnInput) {
  validate(d, userId, t);
  const before = getTransaction(d, userId, id);
  if (!before || before.deleted_at) throw new Error("Entry not found");
  tx(d, () => {
    d.prepare(
      `UPDATE transactions SET type = ?, date = ?, amount = ?, from_account_id = ?, to_account_id = ?,
              note = ?, highlight = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
    ).run(t.type, t.date, t.amount, t.fromAccountId, t.toAccountId, t.note || null, t.highlight || null, id, userId);
    audit(d, userId, "update", id, { before, after: t });
  });
}

export function deleteTransaction(d: DatabaseSync, userId: number, id: number) {
  const before = getTransaction(d, userId, id);
  if (!before || before.deleted_at) throw new Error("Entry not found");
  tx(d, () => {
    d.prepare("UPDATE transactions SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?").run(id, userId);
    audit(d, userId, "delete", id, before);
  });
}

export function restoreTransaction(d: DatabaseSync, userId: number, id: number) {
  tx(d, () => {
    d.prepare("UPDATE transactions SET deleted_at = NULL WHERE id = ? AND user_id = ?").run(id, userId);
    audit(d, userId, "restore", id, null);
  });
}

export type TxnRow = {
  id: number;
  type: TxnType;
  date: string;
  amount: number;
  from_account_id: number;
  to_account_id: number;
  from_name: string;
  to_name: string;
  note: string | null;
  highlight: string | null;
  created_at: string;
  deleted_at: string | null;
};

const TXN_SELECT = `SELECT t.id, t.type, t.date, t.amount, t.from_account_id, t.to_account_id,
  fa.name AS from_name, ta.name AS to_name, t.note, t.highlight, t.created_at, t.deleted_at
  FROM transactions t
  JOIN accounts fa ON fa.id = t.from_account_id
  JOIN accounts ta ON ta.id = t.to_account_id`;

export function getTransaction(d: DatabaseSync, userId: number, id: number): TxnRow | undefined {
  return d.prepare(`${TXN_SELECT} WHERE t.id = ? AND t.user_id = ?`).get(id, userId) as TxnRow | undefined;
}

export function listTransactions(
  d: DatabaseSync,
  userId: number,
  f: { type?: TxnType; from?: string; to?: string; search?: string; deleted?: boolean; limit?: number } = {},
): TxnRow[] {
  const where = ["t.user_id = ?", f.deleted ? "t.deleted_at IS NOT NULL" : "t.deleted_at IS NULL"];
  const args: (string | number)[] = [userId];
  if (f.type) (where.push("t.type = ?"), args.push(f.type));
  if (f.from) (where.push("t.date >= ?"), args.push(f.from));
  if (f.to) (where.push("t.date <= ?"), args.push(f.to));
  if (f.search) {
    where.push("(t.note LIKE ? OR fa.name LIKE ? OR ta.name LIKE ?)");
    const q = `%${f.search}%`;
    args.push(q, q, q);
  }
  args.push(f.limit ?? 500);
  return d
    .prepare(`${TXN_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.date DESC, t.id DESC LIMIT ?`)
    .all(...args) as TxnRow[];
}

/** One account's statement with opening balance and running balance. */
export function accountStatement(d: DatabaseSync, userId: number, accountId: number, from: string, to: string) {
  const acc = accountsWithBalances(d, userId).find((a) => a.id === accountId);
  if (!acc) throw new Error("Account not found");
  const prev = d
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN to_account_id = ? THEN amount ELSE 0 END), 0) AS i,
              COALESCE(SUM(CASE WHEN from_account_id = ? THEN amount ELSE 0 END), 0) AS o
       FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND date < ?
         AND (to_account_id = ? OR from_account_id = ?)`,
    )
    .get(accountId, accountId, userId, from, accountId, accountId) as { i: number; o: number };
  const opening = signedBalance(acc.kind, prev.i, prev.o);
  const rows = d
    .prepare(
      `${TXN_SELECT} WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.date BETWEEN ? AND ?
       AND (t.to_account_id = ? OR t.from_account_id = ?) ORDER BY t.date, t.id`,
    )
    .all(userId, from, to, accountId, accountId) as TxnRow[];
  let running = opening;
  const lines = rows.map((r) => {
    const moneyIn = r.to_account_id === accountId ? r.amount : 0;
    const moneyOut = r.from_account_id === accountId ? r.amount : 0;
    running += signedBalance(acc.kind, moneyIn, moneyOut);
    return { ...r, other: moneyIn ? r.from_name : r.to_name, moneyIn, moneyOut, balance: running };
  });
  return { account: acc, opening, closing: running, lines };
}

// ---------- Reports ----------

export function incomeStatement(d: DatabaseSync, userId: number, from: string, to: string) {
  const accs = accountsWithBalances(d, userId, { from, to });
  const income = accs.filter((a) => a.kind === "income" && a.balance !== 0);
  const expense = accs.filter((a) => a.kind === "expense" && a.balance !== 0);
  const totalIncome = income.reduce((s, a) => s + a.balance, 0);
  const totalExpense = expense.reduce((s, a) => s + a.balance, 0);
  return { income, expense, totalIncome, totalExpense, profit: totalIncome - totalExpense };
}

export function balanceSheet(d: DatabaseSync, userId: number, asOf: string) {
  const accs = accountsWithBalances(d, userId, { to: asOf });
  const pick = (k: Kind) => accs.filter((a) => a.kind === k && a.balance !== 0);
  const sum = (xs: AccountRow[]) => xs.reduce((s, a) => s + a.balance, 0);
  const assets = pick("asset");
  const liabilities = pick("liability");
  const equity = pick("equity");
  const profit = sum(pick("income")) - sum(pick("expense"));
  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity) + profit;
  return {
    assets,
    liabilities,
    equity,
    profit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netWorth: totalAssets - totalLiabilities,
    balanced: totalAssets === totalLiabilities + totalEquity,
  };
}

/** Accounts with a monthly budget and how much was spent this month. */
export function budgets(d: DatabaseSync, userId: number, monthStart: string, monthEnd: string) {
  return accountsWithBalances(d, userId, { from: monthStart, to: monthEnd })
    .filter((a) => a.budget_monthly)
    .map((a) => ({ ...a, budget: a.budget_monthly as number, spent: a.balance }));
}

/** Customers / suppliers khata: everyone in Receivables & Payables. */
export function khata(d: DatabaseSync, userId: number) {
  return accountsWithBalances(d, userId).filter(
    (a) => !a.archived && (a.category === "Receivables" || a.category === "Payables"),
  );
}

export function auditLog(d: DatabaseSync, userId: number, limit = 200) {
  return d
    .prepare("SELECT id, action, transaction_id, details, created_at FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, limit) as { id: number; action: string; transaction_id: number | null; details: string; created_at: string }[];
}
