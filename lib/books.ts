import type { Db } from "./db.ts";

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

const MIN_DATE = "0001-01-01";
const MAX_DATE = "9999-12-31";

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

type IdRow = { id: number };

export async function seedDefaults(d: Db, userId: number) {
  for (const [i, c] of DEFAULTS.entries()) {
    const [cat] = await d.q<IdRow>(
      "INSERT INTO categories (user_id, name, kind, sort) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, c.name, c.kind, i],
    );
    for (const [sub, accs] of c.subs) {
      const [s] = await d.q<IdRow>(
        "INSERT INTO subcategories (user_id, category_id, name) VALUES ($1, $2, $3) RETURNING id",
        [userId, cat.id, sub],
      );
      for (const a of accs) {
        await d.q("INSERT INTO accounts (user_id, subcategory_id, name) VALUES ($1, $2, $3)", [userId, s.id, a]);
      }
    }
  }
}

export async function createUser(
  d: Db,
  u: { name: string; email: string; phone?: string; businessName?: string; passwordHash: string },
): Promise<number> {
  return d.tx(async (t) => {
    const [row] = await t.q<IdRow>(
      // The very first person to sign up becomes the site admin.
      `INSERT INTO users (name, email, phone, business_name, password_hash, is_admin)
       VALUES ($1, $2, $3, $4, $5, NOT EXISTS (SELECT 1 FROM users)) RETURNING id`,
      [u.name, u.email.toLowerCase(), u.phone || null, u.businessName || null, u.passwordHash],
    );
    await seedDefaults(t, row.id);
    return row.id;
  });
}

// ---------- Reading the chart of accounts ----------

export type AccountRow = {
  id: number;
  name: string;
  phone: string | null;
  budget_monthly: number | null;
  archived: boolean;
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
export async function accountsWithBalances(
  d: Db,
  userId: number,
  opts: { from?: string; to?: string } = {},
): Promise<AccountRow[]> {
  const rows = await d.q<Omit<AccountRow, "balance">>(
    `WITH t AS (
       SELECT from_account_id, to_account_id, amount FROM transactions
       WHERE user_id = $1 AND deleted_at IS NULL AND date BETWEEN $2::date AND $3::date
     ),
     ins AS (SELECT to_account_id AS id, SUM(amount) AS s FROM t GROUP BY to_account_id),
     outs AS (SELECT from_account_id AS id, SUM(amount) AS s FROM t GROUP BY from_account_id)
     SELECT a.id, a.name, a.phone, a.budget_monthly::float8 AS budget_monthly, a.archived,
            s.id AS subcategory_id, s.name AS subcategory,
            c.id AS category_id, c.name AS category, c.kind,
            COALESCE(ins.s, 0)::float8 AS money_in,
            COALESCE(outs.s, 0)::float8 AS money_out
     FROM accounts a
     JOIN subcategories s ON s.id = a.subcategory_id
     JOIN categories c ON c.id = s.category_id
     LEFT JOIN ins ON ins.id = a.id
     LEFT JOIN outs ON outs.id = a.id
     WHERE a.user_id = $1
     ORDER BY c.sort, c.name, s.name, a.name`,
    [userId, opts.from ?? MIN_DATE, opts.to ?? MAX_DATE],
  );
  return rows.map((r) => ({ ...r, balance: signedBalance(r.kind, r.money_in, r.money_out) }));
}

export type Category = { id: number; name: string; kind: Kind; sort: number; color: string | null; icon: string | null };
export type Subcategory = { id: number; name: string; category_id: number; color: string | null; icon: string | null };

export function categories(d: Db, userId: number): Promise<Category[]> {
  return d.q<Category>("SELECT id, name, kind, sort, color, icon FROM categories WHERE user_id = $1 ORDER BY sort, name", [userId]);
}

export function subcategories(d: Db, userId: number): Promise<Subcategory[]> {
  return d.q<Subcategory>("SELECT id, name, category_id, color, icon FROM subcategories WHERE user_id = $1 ORDER BY name", [userId]);
}

export async function categoryTotals(d: Db, userId: number, opts: { from?: string; to?: string } = {}) {
  const [accs, cats] = await Promise.all([accountsWithBalances(d, userId, opts), categories(d, userId)]);
  return cats.map((c) => ({
    ...c,
    balance: accs.filter((a) => a.category_id === c.id).reduce((s, a) => s + a.balance, 0),
    accounts: accs.filter((a) => a.category_id === c.id).length,
  }));
}

// ---------- Chart of accounts editing ----------

async function own(d: Db, table: "categories" | "subcategories" | "accounts" | "projects", id: number, userId: number) {
  if (!Number.isInteger(id)) throw new Error("Not found");
  const r = await d.q(`SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!r.length) throw new Error("Not found");
}

/** Only #rrggbb colours and short icon keys are stored. */
function look(l?: { color?: string | null; icon?: string | null }) {
  const color = l?.color && /^#[0-9a-f]{6}$/i.test(l.color) ? l.color.toLowerCase() : null;
  const icon = l?.icon && /^[a-z-]{2,30}$/.test(l.icon) ? l.icon : null;
  return [color, icon] as const;
}

export async function addCategory(d: Db, userId: number, name: string, kind: Kind, l?: { color?: string | null; icon?: string | null }) {
  if (!(kind in KIND_LABEL)) throw new Error("Choose a type");
  const [row] = await d.q<IdRow>(
    `INSERT INTO categories (user_id, name, kind, sort, color, icon)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort), 0) + 1 FROM categories WHERE user_id = $1), $4, $5) RETURNING id`,
    [userId, name, kind, ...look(l)],
  );
  return row.id;
}

export async function addSubcategory(d: Db, userId: number, categoryId: number, name: string, l?: { color?: string | null; icon?: string | null }) {
  await own(d, "categories", categoryId, userId);
  const [row] = await d.q<IdRow>(
    "INSERT INTO subcategories (user_id, category_id, name, color, icon) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [userId, categoryId, name, ...look(l)],
  );
  return row.id;
}

export async function updateCategory(d: Db, userId: number, id: number, name: string, l?: { color?: string | null; icon?: string | null }) {
  if (!name) throw new Error("Name is required");
  await own(d, "categories", id, userId);
  await d.q("UPDATE categories SET name = $1, color = $2, icon = $3 WHERE id = $4", [name, ...look(l), id]);
}

export async function updateSubcategory(
  d: Db,
  userId: number,
  id: number,
  name: string,
  categoryId: number,
  l?: { color?: string | null; icon?: string | null },
) {
  if (!name) throw new Error("Name is required");
  await own(d, "subcategories", id, userId);
  await own(d, "categories", categoryId, userId);
  await d.q("UPDATE subcategories SET name = $1, category_id = $2, color = $3, icon = $4 WHERE id = $5", [name, categoryId, ...look(l), id]);
}

export async function addAccount(
  d: Db,
  userId: number,
  subcategoryId: number,
  name: string,
  extra: { phone?: string | null; budgetMonthly?: number | null } = {},
) {
  await own(d, "subcategories", subcategoryId, userId);
  const [row] = await d.q<IdRow>(
    "INSERT INTO accounts (user_id, subcategory_id, name, phone, budget_monthly) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [userId, subcategoryId, name, extra.phone || null, extra.budgetMonthly || null],
  );
  return row.id;
}

/** For the simpler views: the sub-category an account goes into when only a category was chosen. */
export async function defaultSubcategory(d: Db, userId: number, categoryId: number) {
  await own(d, "categories", categoryId, userId);
  const [s] = await d.q<IdRow>("SELECT id FROM subcategories WHERE category_id = $1 ORDER BY id LIMIT 1", [categoryId]);
  return s ? s.id : addSubcategory(d, userId, categoryId, "General");
}

export async function updateAccount(
  d: Db,
  userId: number,
  id: number,
  f: { name: string; subcategoryId: number; phone?: string | null; budgetMonthly?: number | null; archived?: boolean },
) {
  await own(d, "accounts", id, userId);
  await own(d, "subcategories", f.subcategoryId, userId);
  await d.q(
    "UPDATE accounts SET name = $1, subcategory_id = $2, phone = $3, budget_monthly = $4, archived = $5 WHERE id = $6 AND user_id = $7",
    [f.name, f.subcategoryId, f.phone || null, f.budgetMonthly || null, !!f.archived, id, userId],
  );
}

export async function renameCategory(d: Db, userId: number, id: number, name: string) {
  if (!name) throw new Error("Name is required");
  await d.q("UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3", [name, id, userId]);
}

export async function renameSubcategory(d: Db, userId: number, id: number, name: string, categoryId: number) {
  if (!name) throw new Error("Name is required");
  await own(d, "categories", categoryId, userId);
  await d.q("UPDATE subcategories SET name = $1, category_id = $2 WHERE id = $3 AND user_id = $4", [
    name,
    categoryId,
    id,
    userId,
  ]);
}

/** Only accounts that were never used can be deleted; otherwise archive them. */
export async function deleteAccount(d: Db, userId: number, id: number) {
  await own(d, "accounts", id, userId);
  const [used] = await d.q<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM transactions WHERE from_account_id = $1 OR to_account_id = $1",
    [id],
  );
  if (used.n > 0) throw new Error("This account has entries. Archive it instead of deleting.");
  await d.q("DELETE FROM accounts WHERE id = $1", [id]);
}

export async function deleteSubcategory(d: Db, userId: number, id: number) {
  await own(d, "subcategories", id, userId);
  const [n] = await d.q<{ n: number }>("SELECT COUNT(*)::int AS n FROM accounts WHERE subcategory_id = $1", [id]);
  if (n.n > 0) throw new Error("Move or delete its accounts first.");
  await d.q("DELETE FROM subcategories WHERE id = $1", [id]);
}

export async function deleteCategory(d: Db, userId: number, id: number) {
  await own(d, "categories", id, userId);
  const [n] = await d.q<{ n: number }>("SELECT COUNT(*)::int AS n FROM subcategories WHERE category_id = $1", [id]);
  if (n.n > 0) throw new Error("Delete its sub-categories first.");
  await d.q("DELETE FROM categories WHERE id = $1", [id]);
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
  /** Set when the entry was in another currency (e.g. "USD"). amount is still in the main currency. */
  currency?: string | null;
  foreignAmount?: number | null; // in cents of that currency
  rate?: number | null; // main currency per 1 unit of that currency
  /** The user's main currency (default PKR). */
  primary?: string;
  projectId?: number | null;
};

async function validate(d: Db, userId: number, t: TxnInput) {
  if (!["payment", "receipt", "transfer"].includes(t.type)) throw new Error("Invalid entry type");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || Number.isNaN(Date.parse(t.date))) throw new Error("Invalid date");
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0) throw new Error("Amount must be more than zero");
  if (!t.fromAccountId || !t.toAccountId) throw new Error("Choose both accounts: where the money came from and where it went");
  if (t.fromAccountId === t.toAccountId) throw new Error("'From' and 'To' must be different accounts");
  await own(d, "accounts", t.fromAccountId, userId);
  await own(d, "accounts", t.toAccountId, userId);
  if (t.projectId) await own(d, "projects", t.projectId, userId);
  if (t.currency && t.currency !== (t.primary ?? "PKR")) {
    if (!/^[A-Z]{3}$/.test(t.currency)) throw new Error("Invalid currency");
    if (!t.foreignAmount || t.foreignAmount <= 0 || !Number.isSafeInteger(t.foreignAmount)) throw new Error("Enter the amount in " + t.currency);
    if (!t.rate || !(t.rate > 0)) throw new Error("Enter the exchange rate");
  }
}

/** The extra columns, cleaned: blank unless a foreign currency was really used. */
function extras(t: TxnInput) {
  const foreign = t.currency && t.currency !== (t.primary ?? "PKR");
  return [foreign ? t.currency : null, foreign ? t.foreignAmount : null, foreign ? t.rate : null, t.projectId || null];
}

function audit(d: Db, userId: number, action: string, txnId: number | null, details: unknown) {
  return d.q("INSERT INTO audit_log (user_id, action, transaction_id, details) VALUES ($1, $2, $3, $4)", [
    userId,
    action,
    txnId,
    JSON.stringify(details),
  ]);
}

export async function addTransaction(d: Db, userId: number, t: TxnInput): Promise<number> {
  await validate(d, userId, t);
  return d.tx(async (x) => {
    const [row] = await x.q<IdRow>(
      `INSERT INTO transactions (user_id, type, date, amount, from_account_id, to_account_id, note, highlight,
                                 currency, foreign_amount, rate, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [userId, t.type, t.date, t.amount, t.fromAccountId, t.toAccountId, t.note || null, t.highlight || null, ...extras(t)],
    );
    await audit(x, userId, "create", row.id, t);
    return row.id;
  });
}

export async function updateTransaction(d: Db, userId: number, id: number, t: TxnInput) {
  await validate(d, userId, t);
  const before = await getTransaction(d, userId, id);
  if (!before || before.deleted_at) throw new Error("Entry not found");
  await d.tx(async (x) => {
    await x.q(
      `UPDATE transactions SET type = $1, date = $2, amount = $3, from_account_id = $4, to_account_id = $5,
              note = $6, highlight = $7, currency = $8, foreign_amount = $9, rate = $10, project_id = $11,
              updated_at = now() WHERE id = $12 AND user_id = $13`,
      [t.type, t.date, t.amount, t.fromAccountId, t.toAccountId, t.note || null, t.highlight || null, ...extras(t), id, userId],
    );
    await audit(x, userId, "update", id, { before, after: t });
  });
}

export async function deleteTransaction(d: Db, userId: number, id: number) {
  const before = await getTransaction(d, userId, id);
  if (!before || before.deleted_at) throw new Error("Entry not found");
  await d.tx(async (x) => {
    await x.q("UPDATE transactions SET deleted_at = now() WHERE id = $1 AND user_id = $2", [id, userId]);
    await audit(x, userId, "delete", id, before);
  });
}

export async function restoreTransaction(d: Db, userId: number, id: number) {
  await d.tx(async (x) => {
    const r = await x.q("UPDATE transactions SET deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
    if (!r.length) throw new Error("Entry not found");
    await audit(x, userId, "restore", id, null);
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
  currency: string | null;
  foreign_amount: number | null;
  rate: number | null;
  project_id: number | null;
  project: string | null;
  attachments: number;
};

const TXN_SELECT = `SELECT t.id, t.type, to_char(t.date, 'YYYY-MM-DD') AS date, t.amount::float8 AS amount,
  t.from_account_id, t.to_account_id, fa.name AS from_name, ta.name AS to_name, t.note, t.highlight,
  to_char(t.created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS created_at,
  to_char(t.deleted_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS deleted_at,
  t.currency, t.foreign_amount::float8 AS foreign_amount, t.rate::float8 AS rate, t.project_id, pr.name AS project,
  (SELECT COUNT(*)::int FROM attachments at WHERE at.transaction_id = t.id) AS attachments
  FROM transactions t
  JOIN accounts fa ON fa.id = t.from_account_id
  JOIN accounts ta ON ta.id = t.to_account_id
  LEFT JOIN projects pr ON pr.id = t.project_id`;

export async function getTransaction(d: Db, userId: number, id: number): Promise<TxnRow | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const [row] = await d.q<TxnRow>(`${TXN_SELECT} WHERE t.id = $1 AND t.user_id = $2`, [id, userId]);
  return row;
}

export function listTransactions(
  d: Db,
  userId: number,
  f: {
    type?: TxnType;
    from?: string;
    to?: string;
    search?: string;
    deleted?: boolean;
    limit?: number;
    projectId?: number;
    currency?: string;
  } = {},
): Promise<TxnRow[]> {
  const args: unknown[] = [userId];
  const p = (v: unknown) => (args.push(v), `$${args.length}`);
  const where = ["t.user_id = $1", f.deleted ? "t.deleted_at IS NOT NULL" : "t.deleted_at IS NULL"];
  if (f.type) where.push(`t.type = ${p(f.type)}`);
  if (f.from) where.push(`t.date >= ${p(f.from)}::date`);
  if (f.to) where.push(`t.date <= ${p(f.to)}::date`);
  if (f.projectId) where.push(`t.project_id = ${p(f.projectId)}`);
  if (f.currency) where.push(`t.currency = ${p(f.currency)}`);
  if (f.search) {
    const q = p(`%${f.search}%`);
    where.push(`(t.note ILIKE ${q} OR fa.name ILIKE ${q} OR ta.name ILIKE ${q})`);
  }
  const order = f.deleted ? "t.deleted_at DESC" : "t.date DESC, t.id DESC";
  return d.q<TxnRow>(`${TXN_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ${p(f.limit ?? 500)}`, args);
}

/** One account's statement with opening balance and running balance. */
export async function accountStatement(d: Db, userId: number, accountId: number, from: string, to: string) {
  const acc = (await accountsWithBalances(d, userId)).find((a) => a.id === accountId);
  if (!acc) throw new Error("Account not found");
  const [prev] = await d.q<{ i: number; o: number }>(
    `SELECT COALESCE(SUM(CASE WHEN to_account_id = $1 THEN amount ELSE 0 END), 0)::float8 AS i,
            COALESCE(SUM(CASE WHEN from_account_id = $1 THEN amount ELSE 0 END), 0)::float8 AS o
     FROM transactions WHERE user_id = $2 AND deleted_at IS NULL AND date < $3::date
       AND (to_account_id = $1 OR from_account_id = $1)`,
    [accountId, userId, from],
  );
  const opening = signedBalance(acc.kind, prev.i, prev.o);
  const rows = await d.q<TxnRow>(
    `${TXN_SELECT} WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2::date AND $3::date
     AND (t.to_account_id = $4 OR t.from_account_id = $4) ORDER BY t.date, t.id`,
    [userId, from, to, accountId],
  );
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

export function summarizeIncome(accs: AccountRow[]) {
  const income = accs.filter((a) => a.kind === "income" && a.balance !== 0);
  const expense = accs.filter((a) => a.kind === "expense" && a.balance !== 0);
  const totalIncome = income.reduce((s, a) => s + a.balance, 0);
  const totalExpense = expense.reduce((s, a) => s + a.balance, 0);
  return { income, expense, totalIncome, totalExpense, profit: totalIncome - totalExpense };
}

export async function incomeStatement(d: Db, userId: number, from: string, to: string) {
  return summarizeIncome(await accountsWithBalances(d, userId, { from, to }));
}

/** Income and expense per month for the given month ranges, in one query. */
export async function monthlyTotals(d: Db, userId: number, from: string, to: string) {
  const rows = await d.q<{ month: string; income: number; expense: number }>(
    `SELECT to_char(t.date, 'YYYY-MM') AS month,
            COALESCE(SUM(CASE WHEN fc.kind = 'income' THEN t.amount END), 0)::float8
              - COALESCE(SUM(CASE WHEN tc.kind = 'income' THEN t.amount END), 0)::float8 AS income,
            COALESCE(SUM(CASE WHEN tc.kind = 'expense' THEN t.amount END), 0)::float8
              - COALESCE(SUM(CASE WHEN fc.kind = 'expense' THEN t.amount END), 0)::float8 AS expense
     FROM transactions t
     JOIN accounts fa ON fa.id = t.from_account_id JOIN subcategories fs ON fs.id = fa.subcategory_id JOIN categories fc ON fc.id = fs.category_id
     JOIN accounts ta ON ta.id = t.to_account_id JOIN subcategories ts ON ts.id = ta.subcategory_id JOIN categories tc ON tc.id = ts.category_id
     WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2::date AND $3::date
     GROUP BY 1`,
    [userId, from, to],
  );
  return new Map(rows.map((r) => [r.month, r]));
}

export async function balanceSheet(d: Db, userId: number, asOf: string) {
  const accs = await accountsWithBalances(d, userId, { to: asOf });
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
export async function budgets(d: Db, userId: number, monthStart: string, monthEnd: string) {
  return (await accountsWithBalances(d, userId, { from: monthStart, to: monthEnd }))
    .filter((a) => a.budget_monthly)
    .map((a) => ({ ...a, budget: a.budget_monthly as number, spent: a.balance }));
}

/** Customers / suppliers khata: everyone in Receivables & Payables. */
export async function khata(d: Db, userId: number) {
  return (await accountsWithBalances(d, userId)).filter(
    (a) => !a.archived && (a.category === "Receivables" || a.category === "Payables"),
  );
}

export function auditLog(d: Db, userId: number, limit = 200) {
  return d.q<{ id: number; action: string; transaction_id: number | null; details: string; created_at: string }>(
    `SELECT id, action, transaction_id, details,
            to_char(created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS created_at
     FROM audit_log WHERE user_id = $1 ORDER BY id DESC LIMIT $2`,
    [userId, limit],
  );
}

// ---------- Projects ----------

export type Project = { id: number; name: string; archived: boolean };

export function projects(d: Db, userId: number): Promise<Project[]> {
  return d.q<Project>("SELECT id, name, archived FROM projects WHERE user_id = $1 ORDER BY archived, name", [userId]);
}

export async function addProject(d: Db, userId: number, name: string) {
  if (!name) throw new Error("Name is required");
  const [r] = await d.q<IdRow>("INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id", [userId, name]);
  return r.id;
}

export async function updateProject(d: Db, userId: number, id: number, name: string, archived: boolean) {
  if (!name) throw new Error("Name is required");
  await own(d, "projects", id, userId);
  await d.q("UPDATE projects SET name = $1, archived = $2 WHERE id = $3", [name, archived, id]);
}

/** Income, expense and profit of each project in a period. */
export async function projectSummary(d: Db, userId: number, from: string, to: string) {
  return d.q<{ id: number; name: string; archived: boolean; income: number; expense: number; entries: number }>(
    `SELECT p.id, p.name, p.archived,
       COALESCE(SUM(CASE WHEN fc.kind = 'income' THEN t.amount END), 0)::float8
         - COALESCE(SUM(CASE WHEN tc.kind = 'income' THEN t.amount END), 0)::float8 AS income,
       COALESCE(SUM(CASE WHEN tc.kind = 'expense' THEN t.amount END), 0)::float8
         - COALESCE(SUM(CASE WHEN fc.kind = 'expense' THEN t.amount END), 0)::float8 AS expense,
       COUNT(t.id)::int AS entries
     FROM projects p
     LEFT JOIN transactions t ON t.project_id = p.id AND t.deleted_at IS NULL AND t.date BETWEEN $2::date AND $3::date
     LEFT JOIN accounts fa ON fa.id = t.from_account_id LEFT JOIN subcategories fs ON fs.id = fa.subcategory_id
     LEFT JOIN categories fc ON fc.id = fs.category_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id LEFT JOIN subcategories ts ON ts.id = ta.subcategory_id
     LEFT JOIN categories tc ON tc.id = ts.category_id
     WHERE p.user_id = $1
     GROUP BY p.id ORDER BY p.archived, p.name`,
    [userId, from, to],
  );
}

// ---------- Attachments (receipt photos & PDFs) ----------

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_STORAGE_BYTES = 100 * 1024 * 1024; // per user

/** Work out the real file type from its first bytes (never trust the file name). */
export function sniffMime(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}

export async function addAttachment(d: Db, userId: number, txnId: number, file: { name: string; data: Uint8Array }) {
  const t = await getTransaction(d, userId, txnId);
  if (!t || t.deleted_at) throw new Error("Entry not found");
  const mime = sniffMime(file.data);
  if (!mime) throw new Error(`"${file.name}" is not a photo or PDF`);
  if (file.data.length > MAX_ATTACHMENT_BYTES) throw new Error(`"${file.name}" is too big (max 3 MB)`);
  const [{ n, total }] = await d.q<{ n: number; total: number }>(
    `SELECT (SELECT COUNT(*) FROM attachments WHERE transaction_id = $1)::int AS n,
            (SELECT COALESCE(SUM(size), 0) FROM attachments WHERE user_id = $2)::float8 AS total`,
    [txnId, userId],
  );
  if (n >= MAX_ATTACHMENTS) throw new Error(`Only ${MAX_ATTACHMENTS} attachments allowed per entry`);
  if (total + file.data.length > MAX_STORAGE_BYTES) throw new Error("Your attachment storage (100 MB) is full");
  const name = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 100) || "file";
  await d.q("INSERT INTO attachments (user_id, transaction_id, filename, mime, size, data) VALUES ($1, $2, $3, $4, $5, $6)", [
    userId,
    txnId,
    name,
    mime,
    file.data.length,
    file.data,
  ]);
}

export type AttachmentInfo = { id: number; filename: string; mime: string; size: number; created_at: string };

export function listAttachments(d: Db, userId: number, txnId: number) {
  return d.q<AttachmentInfo>(
    `SELECT id, filename, mime, size, to_char(created_at, 'YYYY-MM-DD') AS created_at
     FROM attachments WHERE user_id = $1 AND transaction_id = $2 ORDER BY id`,
    [userId, txnId],
  );
}

export async function getAttachment(d: Db, userId: number, id: number) {
  if (!Number.isInteger(id)) return undefined;
  const [a] = await d.q<{ filename: string; mime: string; data: Uint8Array }>(
    "SELECT filename, mime, data FROM attachments WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return a;
}

export async function deleteAttachment(d: Db, userId: number, id: number) {
  await d.q("DELETE FROM attachments WHERE id = $1 AND user_id = $2", [id, userId]);
}

/** Attachments per account, for the Attachments report. */
export function attachmentReport(d: Db, userId: number) {
  return d.q<{ id: number; transaction_id: number; filename: string; mime: string; size: number; date: string; from_name: string; to_name: string; amount: number; note: string | null }>(
    `SELECT a.id, a.transaction_id, a.filename, a.mime, a.size, to_char(t.date, 'YYYY-MM-DD') AS date,
            fa.name AS from_name, ta.name AS to_name, t.amount::float8 AS amount, t.note
     FROM attachments a JOIN transactions t ON t.id = a.transaction_id
     JOIN accounts fa ON fa.id = t.from_account_id JOIN accounts ta ON ta.id = t.to_account_id
     WHERE a.user_id = $1 AND t.deleted_at IS NULL ORDER BY t.date DESC, a.id DESC LIMIT 500`,
    [userId],
  );
}

// ---------- Main currency ----------

/**
 * Change the user's main currency. With a rate, every stored amount is converted
 * (amount × rate), e.g. PKR → USD with rate 0.0036. Without a rate only the label changes.
 */
export async function changeMainCurrency(d: Db, userId: number, next: string, rate: number | null) {
  if (!/^[A-Z]{3}$/.test(next)) throw new Error("Choose a currency");
  if (rate !== null && !(rate > 0 && rate < 1e9)) throw new Error("Enter a valid conversion rate");
  const [u] = await d.q<{ currency: string }>("SELECT currency FROM users WHERE id = $1", [userId]);
  if (!u) throw new Error("User not found");
  if (u.currency === next) return;
  await d.tx(async (x) => {
    if (rate !== null) {
      // One statement, so every row is read before it is changed. Entries originally
      // made in the new currency get their exact original amount back.
      await x.q(
        `UPDATE transactions SET
           amount = CASE WHEN currency = $3 THEN foreign_amount ELSE GREATEST(1, ROUND(amount * $2::numeric)) END,
           rate = CASE WHEN currency = $3 THEN NULL ELSE rate * $2::numeric END,
           foreign_amount = CASE WHEN currency = $3 THEN NULL ELSE foreign_amount END,
           currency = CASE WHEN currency = $3 THEN NULL ELSE currency END
         WHERE user_id = $1`,
        [userId, rate, next],
      );
      await x.q("UPDATE accounts SET budget_monthly = ROUND(budget_monthly * $2::numeric) WHERE user_id = $1 AND budget_monthly IS NOT NULL", [userId, rate]);
      await x.q(
        `UPDATE shared_entries e SET amount = GREATEST(1, ROUND(e.amount * $2::numeric))
         FROM shares s WHERE s.id = e.share_id AND s.owner_id = $1 AND e.status = 'pending'`,
        [userId, rate],
      );
      const invs = await x.q<{ id: number; items: string }>("SELECT id, items FROM invoices WHERE user_id = $1", [userId]);
      for (const inv of invs) {
        const items = (JSON.parse(inv.items) as { name: string; qty: number; price: number }[]).map((i) => ({
          ...i,
          price: Math.round(i.price * rate),
        }));
        await x.q(
          `UPDATE invoices SET items = $2, subtotal = ROUND(subtotal * $3::numeric), tax = ROUND(tax * $3::numeric),
             total = ROUND(total * $3::numeric), discount = ROUND(discount * $3::numeric) WHERE id = $1`,
          [inv.id, JSON.stringify(items), rate],
        );
      }
    }
    await x.q("UPDATE users SET currency = $2 WHERE id = $1", [userId, next]);
    await audit(x, userId, "currency", null, { from: u.currency, to: next, rate });
  });
}

// ---------- Chart data ----------

/** Cash & bank (money you hold) for every day in the window, starting from the opening balance. */
export async function cashBankDaily(d: Db, userId: number, from: string, to: string) {
  const ids = (await accountsWithBalances(d, userId))
    .filter((a) => a.category === "Cash" || a.category === "Bank")
    .map((a) => a.id);
  if (!ids.length) return { opening: 0, days: [] as { date: string; inflow: number; outflow: number; balance: number }[] };
  const [o] = await d.q<{ i: number; o: number }>(
    `SELECT COALESCE(SUM(CASE WHEN to_account_id = ANY($2::int[]) THEN amount END), 0)::float8 AS i,
            COALESCE(SUM(CASE WHEN from_account_id = ANY($2::int[]) THEN amount END), 0)::float8 AS o
     FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND date < $3::date
       AND NOT (to_account_id = ANY($2::int[]) AND from_account_id = ANY($2::int[]))`,
    [userId, ids, from],
  );
  const rows = await d.q<{ date: string; i: number; o: number }>(
    `SELECT to_char(date, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(CASE WHEN to_account_id = ANY($2::int[]) THEN amount END), 0)::float8 AS i,
            COALESCE(SUM(CASE WHEN from_account_id = ANY($2::int[]) THEN amount END), 0)::float8 AS o
     FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND date BETWEEN $3::date AND $4::date
       AND NOT (to_account_id = ANY($2::int[]) AND from_account_id = ANY($2::int[]))
     GROUP BY 1 ORDER BY 1`,
    [userId, ids, from, to],
  );
  const byDay = new Map(rows.map((r) => [r.date, r]));
  const opening = o.i - o.o;
  let balance = opening;
  const days: { date: string; inflow: number; outflow: number; balance: number }[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const r = byDay.get(date);
    balance += (r?.i ?? 0) - (r?.o ?? 0);
    days.push({ date, inflow: r?.i ?? 0, outflow: r?.o ?? 0, balance });
  }
  return { opening, days };
}

// ---------- Helpers for the entry form ----------

/** How often each account was used recently, so the picker can show favourites first. */
export async function accountUsage(d: Db, userId: number) {
  const rows = await d.q<{ id: number; n: number }>(
    `SELECT id, COUNT(*)::int AS n FROM (
       SELECT from_account_id AS id FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND created_at > now() - interval '180 days'
       UNION ALL
       SELECT to_account_id FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND created_at > now() - interval '180 days'
     ) x GROUP BY id`,
    [userId],
  );
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** The accounts used in the user's last entry of this type, to pre-fill the next one. */
export async function lastAccounts(d: Db, userId: number, type: TxnType) {
  const [r] = await d.q<{ from_account_id: number; to_account_id: number }>(
    "SELECT from_account_id, to_account_id FROM transactions WHERE user_id = $1 AND type = $2 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
    [userId, type],
  );
  return r;
}

// ---------- Shareable statement links (for customers / suppliers) ----------

export async function statementLink(d: Db, userId: number, accountId: number, on: boolean) {
  await own(d, "accounts", accountId, userId);
  if (!on) {
    await d.q("UPDATE accounts SET share_token = NULL WHERE id = $1", [accountId]);
    return null;
  }
  const { randomBytes } = await import("node:crypto");
  const [r] = await d.q<{ share_token: string }>(
    "UPDATE accounts SET share_token = COALESCE(share_token, $2) WHERE id = $1 RETURNING share_token",
    [accountId, randomBytes(18).toString("base64url")],
  );
  return r.share_token;
}

export async function accountByToken(d: Db, token: string) {
  if (!/^[\w-]{20,40}$/.test(token)) return undefined;
  const [r] = await d.q<{ id: number; user_id: number; business: string; phone: string | null; currency: string; num_format: "intl" | "lakh" }>(
    `SELECT a.id, a.user_id, COALESCE(u.business_name, u.name) AS business, u.phone, u.currency, u.num_format
     FROM accounts a JOIN users u ON u.id = a.user_id WHERE a.share_token = $1`,
    [token],
  );
  return r;
}

export async function shareTokenOf(d: Db, userId: number, accountId: number) {
  const [r] = await d.q<{ share_token: string | null }>("SELECT share_token FROM accounts WHERE id = $1 AND user_id = $2", [accountId, userId]);
  return r?.share_token ?? null;
}
