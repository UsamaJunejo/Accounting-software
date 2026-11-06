import type { Db } from "./db.ts";

export * from "./kinds.ts";
import { ratesToday, rateFor } from "./fx.ts";
import { isMoney, isParty, typeFor, type AccountChoice, type Kind, type Role, type TxnType } from "./kinds.ts";

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
/** Rs 100 crore: anything bigger in one entry is almost surely a typing slip. */
export const MAX_AMOUNT = 100_00_00_000_00;

/** Dates must be real and sensible: not before 2000 and not more than a year ahead. */
export function checkDate(date: string) {
  // Round-trip so impossible days like 31 February are caught (JavaScript would quietly roll them over).
  const real = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date;
  if (!real) throw new Error("Please choose a valid date");
  if (date < "2000-01-01") throw new Error("That date is before the year 2000. Please check the year.");
  const limit = new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10);
  if (date > limit) throw new Error("That date is more than a year from now. Please check the year.");
}

/** An account's own currency: blank (or the main currency) means "same as the books". */
async function accountCurrency(d: Db, userId: number, c?: string | null) {
  if (!c) return null;
  if (!/^[A-Z]{3,4}$/.test(c)) throw new Error("Choose a currency from the list");
  const [{ currency: main }] = await d.q<{ currency: string }>("SELECT currency FROM users WHERE id = $1", [userId]);
  return c === main ? null : c;
}

/**
 * Change the currency an account is kept in. Its entries are converted: their value in the main
 * currency stays exactly the same (so every total and report is unchanged), and the amount in the
 * new currency is worked out with `rate` (main currency for 1 unit of the new one).
 */
export async function changeAccountCurrency(d: Db, userId: number, id: number, wanted: string | null, rate: number | null = null) {
  const next = await accountCurrency(d, userId, wanted);
  const acc = (await accountsWithBalances(d, userId)).find((a) => a.id === id);
  if (!acc) throw new Error("Not found");
  if ((acc.currency ?? null) === next) return;
  if (next && !(acc.kind === "asset" || acc.kind === "liability"))
    throw new Error("Only money, customer, supplier, asset and loan accounts can be kept in another currency.");
  if (next) {
    // Always today's rate from the rates service.
    const [{ currency: main }] = await d.q<{ currency: string }>("SELECT currency FROM users WHERE id = $1", [userId]);
    rate = await rateFor(d, main, next);
  }
  const rows = await d.q<{ id: number; amount: number; currency: string | null; other: string; other_currency: string | null }>(
    `SELECT t.id, t.amount::float8 AS amount, t.currency, o.name AS other, o.currency AS other_currency
     FROM transactions t JOIN accounts o ON o.id = CASE WHEN t.from_account_id = $1 THEN t.to_account_id ELSE t.from_account_id END
     WHERE t.user_id = $2 AND (t.from_account_id = $1 OR t.to_account_id = $1)`,
    [id, userId],
  );
  // An entry can only carry one other currency: it can't be both this account's and the other side's.
  const clash = next ? rows.find((r) => r.other_currency && r.other_currency !== next) : undefined;
  if (clash)
    throw new Error(`Some entries go to or from ${clash.other}, which is kept in ${clash.other_currency}. Change one of the two accounts so they share a currency, or move those entries through a main-currency account first.`);
  await d.tx(async (x) => {
    for (const r of rows) {
      if (!next) {
        // Back to the main currency: the amounts already are in it.
        if (!r.other_currency) await x.q("UPDATE transactions SET currency = NULL, foreign_amount = NULL, rate = NULL WHERE id = $1", [r.id]);
      } else if (r.currency !== next) {
        await x.q("UPDATE transactions SET currency = $1, foreign_amount = $2, rate = $3 WHERE id = $4", [next, Math.max(1, Math.round(r.amount / rate!)), rate, r.id]);
      }
    }
    await x.q("UPDATE accounts SET currency = $1 WHERE id = $2 AND user_id = $3", [next, id, userId]);
    await audit(x, userId, "currency", null, { account: acc.name, from: acc.currency, to: next, rate, entries: rows.length });
  });
}

/** Account names must be filled in, not too long, and not the same as another account's. */
async function checkAccountName(d: Db, userId: number, raw: string, exceptId?: number) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Please type a name for the account");
  if (name.length > 80) throw new Error("That name is too long (80 letters at most)");
  const [dup] = await d.q<{ name: string }>(
    "SELECT name FROM accounts WHERE user_id = $1 AND lower(name) = lower($2) AND NOT archived AND id <> $3",
    [userId, name, exceptId ?? 0],
  );
  if (dup) throw new Error(`You already have an account called "${dup.name}". Use that one, or choose a different name.`);
  return name;
}
const MAX_DATE = "9999-12-31";

// Ready-made chart of accounts for a Pakistani small business.
const DEFAULTS: { name: string; kind: Kind; role?: Role; subs: [string, string[]][] }[] = [
  { name: "Cash", kind: "asset", role: "cash", subs: [["Cash in Hand", ["Cash"]]] },
  { name: "Bank", kind: "asset", role: "bank", subs: [["Bank Accounts", ["Bank Account"]], ["Mobile Wallets", ["JazzCash", "Easypaisa"]]] },
  { name: "Receivables", kind: "asset", role: "receivable", subs: [["Customers (Khata)", []]] },
  { name: "Assets", kind: "asset", subs: [["Stock / Inventory", ["Stock"]], ["Fixed Assets", ["Furniture & Equipment"]]] },
  { name: "Payables", kind: "liability", role: "payable", subs: [["Suppliers", []]] },
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
      "INSERT INTO categories (user_id, name, kind, sort, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [userId, c.name, c.kind, i, c.role ?? null],
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
  role: Role;
  money_in: number;
  money_out: number;
  balance: number;
  /** Value at the rates the entries were made at. Differs from `balance` only for other-currency accounts. */
  book: number;
  /** Set when the account is kept in another currency than the main one (e.g. "USD", "USDT"). */
  currency: string | null;
  native_in: number;
  native_out: number;
  native: number | null;
};

/** Every account with its totals. Optional date window (inclusive, YYYY-MM-DD). */
export async function accountsWithBalances(
  d: Db,
  userId: number,
  opts: { from?: string; to?: string } = {},
): Promise<AccountRow[]> {
  const rows = await d.q<Omit<AccountRow, "balance" | "native" | "book">>(
    `WITH t AS (
       SELECT from_account_id, to_account_id, amount, currency, foreign_amount FROM transactions
       WHERE user_id = $1 AND deleted_at IS NULL AND date BETWEEN $2::date AND $3::date
     ),
     ins AS (SELECT to_account_id AS id, SUM(amount) AS s FROM t GROUP BY to_account_id),
     outs AS (SELECT from_account_id AS id, SUM(amount) AS s FROM t GROUP BY from_account_id),
     -- The same totals in each entry's own currency, for accounts kept in another currency.
     fins AS (SELECT to_account_id AS id, currency, SUM(foreign_amount) AS s FROM t WHERE currency IS NOT NULL GROUP BY 1, 2),
     fouts AS (SELECT from_account_id AS id, currency, SUM(foreign_amount) AS s FROM t WHERE currency IS NOT NULL GROUP BY 1, 2)
     SELECT a.id, a.name, a.phone, a.budget_monthly::float8 AS budget_monthly, a.archived, a.currency,
            COALESCE(fins.s, 0)::float8 AS native_in, COALESCE(fouts.s, 0)::float8 AS native_out,
            s.id AS subcategory_id, s.name AS subcategory,
            c.id AS category_id, c.name AS category, c.kind, c.role,
            COALESCE(ins.s, 0)::float8 AS money_in,
            COALESCE(outs.s, 0)::float8 AS money_out
     FROM accounts a
     JOIN subcategories s ON s.id = a.subcategory_id
     JOIN categories c ON c.id = s.category_id
     LEFT JOIN ins ON ins.id = a.id
     LEFT JOIN outs ON outs.id = a.id
     LEFT JOIN fins ON fins.id = a.id AND fins.currency = a.currency
     LEFT JOIN fouts ON fouts.id = a.id AND fouts.currency = a.currency
     WHERE a.user_id = $1
     ORDER BY c.sort, c.name, s.name, a.name`,
    [userId, opts.from ?? MIN_DATE, opts.to ?? MAX_DATE],
  );
  const out = rows.map((r) => {
    const book = signedBalance(r.kind, r.money_in, r.money_out);
    return {
      ...r,
      balance: book,
      book,
      // Balance in the account's own currency (only for accounts kept in another currency).
      native: r.currency ? signedBalance(r.kind, r.native_in, r.native_out) : null,
    };
  });
  // Accounts kept in another currency are worth their own balance at TODAY's rate. (Only for
  // "everything up to a date" views; a period's movements keep the rates they were entered at.)
  if (!opts.from && out.some((a) => a.currency && a.native !== null)) {
    const [{ currency: main }] = await d.q<{ currency: string }>("SELECT currency FROM users WHERE id = $1", [userId]);
    let rates: Map<string, number> | null = null;
    try {
      rates = await ratesToday(d, main);
    } catch {
      rates = null;
    }
    for (const a of out) {
      const rate = a.currency && a.currency !== main ? rates?.get(a.currency) : undefined;
      if (rate && a.native !== null) a.balance = Math.round(a.native * rate);
    }
  }
  return out;
}

export type Category = { id: number; name: string; kind: Kind; sort: number; color: string | null; icon: string | null; role: Role; currency: string | null };
export type Subcategory = { id: number; name: string; category_id: number; color: string | null; icon: string | null; currency: string | null };

export function categories(d: Db, userId: number): Promise<Category[]> {
  return d.q<Category>("SELECT id, name, kind, sort, color, icon, role, currency FROM categories WHERE user_id = $1 ORDER BY sort, name", [userId]);
}

export function subcategories(d: Db, userId: number): Promise<Subcategory[]> {
  return d.q<Subcategory>("SELECT id, name, category_id, color, icon, currency FROM subcategories WHERE user_id = $1 ORDER BY name", [userId]);
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

export async function addCategory(
  d: Db,
  userId: number,
  name: string,
  kind: Kind,
  l?: { color?: string | null; icon?: string | null; currency?: string | null },
  role: Role = null,
) {
  if (!(kind in KIND_LABEL)) throw new Error("Choose a type");
  const allowed: Record<string, Kind> = { cash: "asset", bank: "asset", receivable: "asset", payable: "liability" };
  if (role && allowed[role] !== kind) throw new Error("Choose a type");
  const [row] = await d.q<IdRow>(
    `INSERT INTO categories (user_id, name, kind, sort, color, icon, role, currency)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort), 0) + 1 FROM categories WHERE user_id = $1), $4, $5, $6, $7) RETURNING id`,
    [userId, name, kind, ...look(l), role, await accountCurrency(d, userId, l?.currency)],
  );
  return row.id;
}

export async function addSubcategory(d: Db, userId: number, categoryId: number, name: string, l?: { color?: string | null; icon?: string | null; currency?: string | null }) {
  await own(d, "categories", categoryId, userId);
  const [row] = await d.q<IdRow>(
    "INSERT INTO subcategories (user_id, category_id, name, color, icon, currency) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [userId, categoryId, name, ...look(l), await accountCurrency(d, userId, l?.currency)],
  );
  return row.id;
}

export async function updateCategory(d: Db, userId: number, id: number, name: string, l?: { color?: string | null; icon?: string | null; currency?: string | null }) {
  if (!name) throw new Error("Name is required");
  await own(d, "categories", id, userId);
  await d.q("UPDATE categories SET name = $1, color = $2, icon = $3 WHERE id = $4", [name, ...look(l), id]);
  // Only the default for accounts added later: existing accounts keep their own currency.
  if (l?.currency !== undefined) await d.q("UPDATE categories SET currency = $1 WHERE id = $2", [await accountCurrency(d, userId, l.currency), id]);
}

export async function updateSubcategory(
  d: Db,
  userId: number,
  id: number,
  name: string,
  categoryId: number,
  l?: { color?: string | null; icon?: string | null; currency?: string | null },
) {
  if (!name) throw new Error("Name is required");
  await own(d, "subcategories", id, userId);
  await own(d, "categories", categoryId, userId);
  await d.q("UPDATE subcategories SET name = $1, category_id = $2, color = $3, icon = $4 WHERE id = $5", [name, categoryId, ...look(l), id]);
  if (l?.currency !== undefined) await d.q("UPDATE subcategories SET currency = $1 WHERE id = $2", [await accountCurrency(d, userId, l.currency), id]);
}

export async function addAccount(
  d: Db,
  userId: number,
  subcategoryId: number,
  name: string,
  extra: { phone?: string | null; budgetMonthly?: number | null; currency?: string | null } = {},
) {
  await own(d, "subcategories", subcategoryId, userId);
  name = await checkAccountName(d, userId, name);
  // No currency chosen: use the sub-category's, then the category's default.
  // (undefined = not asked; "" or null = the main currency, chosen on purpose)
  let wanted = extra.currency;
  if (wanted === undefined) {
    const [def] = await d.q<{ c: string | null }>(
      "SELECT COALESCE(s.currency, c.currency) AS c FROM subcategories s JOIN categories c ON c.id = s.category_id WHERE s.id = $1",
      [subcategoryId],
    );
    wanted = def?.c ?? null;
  }
  const [{ kind }] = await d.q<{ kind: Kind }>(
    "SELECT c.kind FROM subcategories s JOIN categories c ON c.id = s.category_id WHERE s.id = $1",
    [subcategoryId],
  );
  // Income, expense and owner's money are always counted in the main currency.
  const currency = kind === "asset" || kind === "liability" ? await accountCurrency(d, userId, wanted) : null;
  const [row] = await d.q<IdRow>(
    "INSERT INTO accounts (user_id, subcategory_id, name, phone, budget_monthly, currency) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [userId, subcategoryId, name, extra.phone || null, extra.budgetMonthly || null, currency],
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
  f: { name: string; subcategoryId: number; phone?: string | null; budgetMonthly?: number | null; archived?: boolean; currency?: string | null; rate?: number | null },
) {
  await own(d, "accounts", id, userId);
  await own(d, "subcategories", f.subcategoryId, userId);
  const name = await checkAccountName(d, userId, f.name, id);
  if (f.archived) {
    // Hiding an account that still holds money makes that money disappear from the lists.
    const acc = (await accountsWithBalances(d, userId)).find((a) => a.id === id);
    if (acc && !acc.archived && acc.balance !== 0)
      throw new Error(`${acc.name} still has a balance of ${(acc.balance / 100).toLocaleString("en-PK")}. Move it with a Transfer first, or use "Delete account" to move everything into another account.`);
  }
  f = { ...f, name };
  if (f.currency !== undefined) await changeAccountCurrency(d, userId, id, f.currency);
  await d.q(
    "UPDATE accounts SET name = $1, subcategory_id = $2, phone = $3, budget_monthly = $4, archived = $5 WHERE id = $6 AND user_id = $7",
    [f.name, f.subcategoryId, f.phone || null, f.budgetMonthly || null, !!f.archived, id, userId],
  );
}

export async function renameCategory(d: Db, userId: number, id: number, name: string) {
  name = name.trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 60) throw new Error("That name is too long");
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
  const [c] = await d.q<{ role: Role; name: string }>("SELECT role, name FROM categories WHERE id = $1", [id]);
  if (c?.role) throw new Error(`"${c.name}" is needed for your totals and khata, so it can't be deleted. You can rename it.`);
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

/** Checks the entry and returns its type, worked out from the two accounts. */
async function validate(d: Db, userId: number, t: TxnInput): Promise<TxnType> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || Number.isNaN(Date.parse(t.date))) throw new Error("Invalid date");
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0) throw new Error("Amount must be more than zero");
  if (t.amount > MAX_AMOUNT) throw new Error("That amount is over 100 crore. Please check for an extra zero.");
  checkDate(t.date);
  if ((t.note ?? "").length > 1000) throw new Error("The note is too long. Please keep it under 1,000 letters.");
  if (!t.fromAccountId || !t.toAccountId) throw new Error("Choose both accounts: where the money came from and where it went");
  if (t.fromAccountId === t.toAccountId)
    throw new Error("From and To are the same account. To record money you already have, open that account and use \"Starting balance\".");
  await own(d, "accounts", t.fromAccountId, userId);
  await own(d, "accounts", t.toAccountId, userId);
  if (t.projectId) await own(d, "projects", t.projectId, userId);
  if (t.currency && t.currency !== (t.primary ?? "PKR")) {
    if (!/^[A-Z]{3,4}$/.test(t.currency)) throw new Error("Invalid currency");
    if (!t.foreignAmount || t.foreignAmount <= 0 || !Number.isSafeInteger(t.foreignAmount)) throw new Error("Enter the amount in " + t.currency);
    if (!t.rate || !(t.rate > 0)) throw new Error("Enter the exchange rate");
  }
  const roles = await d.q<{ id: number; role: Role; name: string; currency: string | null }>(
    `SELECT a.id, c.role, a.name, a.currency FROM accounts a JOIN subcategories s ON s.id = a.subcategory_id JOIN categories c ON c.id = s.category_id
     WHERE a.id = ANY($1::int[])`,
    [[t.fromAccountId, t.toAccountId]],
  );
  // Accounts kept in another currency only take entries in that currency, so their own balance stays right.
  const [{ currency: main }] = await d.q<{ currency: string }>("SELECT currency FROM users WHERE id = $1", [userId]);
  const entryCur = t.currency || main;
  const foreign = roles.filter((r) => r.currency && r.currency !== main);
  const curs = [...new Set(foreign.map((r) => r.currency))];
  if (curs.length > 1)
    throw new Error(`${foreign[0].name} is in ${foreign[0].currency} and ${foreign[1].name} is in ${foreign[1].currency}. Move the money through a ${main} account in two steps.`);
  if (curs.length === 1 && entryCur !== curs[0])
    throw new Error(`${foreign[0].name} is kept in ${curs[0]}, so type this amount in ${curs[0]} (choose ${curs[0]} next to the amount and add the rate).`);
  const role = (id: number) => ({ role: roles.find((r) => r.id === id)?.role ?? null });
  return typeFor(role(t.fromAccountId), role(t.toAccountId));
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

export async function addTransaction(d: Db, userId: number, input: TxnInput): Promise<number> {
  const t = { ...input, type: await validate(d, userId, input) };
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

export async function updateTransaction(d: Db, userId: number, id: number, input: TxnInput) {
  const t = { ...input, type: await validate(d, userId, input) };
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
  // An account kept in another currency is listed in that currency (USDT in, USDT out, USDT balance).
  const nat = acc.currency;
  const val = nat ? `CASE WHEN currency = $4 THEN foreign_amount ELSE 0 END` : "amount";
  const [prev] = await d.q<{ i: number; o: number }>(
    `SELECT COALESCE(SUM(CASE WHEN to_account_id = $1 THEN ${val} ELSE 0 END), 0)::float8 AS i,
            COALESCE(SUM(CASE WHEN from_account_id = $1 THEN ${val} ELSE 0 END), 0)::float8 AS o
     FROM transactions WHERE user_id = $2 AND deleted_at IS NULL AND date < $3::date
       AND (to_account_id = $1 OR from_account_id = $1)`,
    nat ? [accountId, userId, from, nat] : [accountId, userId, from],
  );
  const opening = signedBalance(acc.kind, prev.i, prev.o);
  const rows = await d.q<TxnRow>(
    `${TXN_SELECT} WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2::date AND $3::date
     AND (t.to_account_id = $4 OR t.from_account_id = $4) ORDER BY t.date, t.id`,
    [userId, from, to, accountId],
  );
  let running = opening;
  const lines = rows.map((r) => {
    const v = nat ? (r.currency === nat ? r.foreign_amount ?? 0 : 0) : r.amount;
    const moneyIn = r.to_account_id === accountId ? v : 0;
    const moneyOut = r.from_account_id === accountId ? v : 0;
    const effect = signedBalance(acc.kind, moneyIn, moneyOut);
    running += effect;
    // up / down: how the entry changed this account's balance, so the columns always add up.
    return { ...r, other: moneyIn ? r.from_name : r.to_name, moneyIn, moneyOut, up: Math.max(effect, 0), down: Math.max(-effect, 0), balance: running };
  });
  return { account: acc, opening, closing: running, lines, inCurrency: nat };
}

/**
 * Bring in a balance from before (e.g. from the old MunshiBaba books): a customer who already
 * owes 5,000, cash already in the drawer. Recorded as one entry against "Opening Balances"
 * (owner's money), so the books still balance.
 */
export async function addOpeningBalance(
  d: Db,
  userId: number,
  accountId: number,
  balance: number,
  date: string,
  fx?: { foreignAmount: number; rate: number } | null,
) {
  if (!Number.isSafeInteger(balance) || balance <= 0) throw new Error("Opening balance must be more than zero");
  const accs = await accountsWithBalances(d, userId);
  const acc = accs.find((a) => a.id === accountId);
  if (!acc) throw new Error("Not found");
  const opening = accs.find((a) => a.kind === "equity" && (a.name === "Starting balance" || a.name === "Opening Balances"));
  let openingId = opening?.id;
  if (!openingId) {
    const eq = (await categories(d, userId)).find((c) => c.kind === "equity");
    const catId = eq?.id ?? (await addCategory(d, userId, "Equity", "equity"));
    openingId = await addAccount(d, userId, await defaultSubcategory(d, userId, catId), "Starting balance");
  }
  if (openingId === accountId) throw new Error("Choose another account");
  // Setting it again changes the old starting balance instead of adding a second one.
  checkDate(date);
  const [prev] = await d.q<{ id: number }>(
    `SELECT id FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND note = 'Starting balance'
       AND ((from_account_id = $2 AND to_account_id = $3) OR (from_account_id = $3 AND to_account_id = $2)) ORDER BY id LIMIT 1`,
    [userId, accountId, openingId],
  );
  if (prev) await deleteTransaction(d, userId, prev.id);
  // Assets and expenses grow when money goes into them; the rest grow when it comes out.
  const grows = acc.kind === "asset" || acc.kind === "expense";
  return addTransaction(d, userId, {
    type: "transfer",
    date,
    amount: balance,
    fromAccountId: grows ? openingId : accountId,
    toAccountId: grows ? accountId : openingId,
    note: "Starting balance",
    // For an account kept in another currency, keep the amount in that currency too.
    ...(acc.currency && fx ? { currency: acc.currency, foreignAmount: fx.foreignAmount, rate: fx.rate } : {}),
  });
}

/** Column names for an account's statement, in plain words for that kind of account. */
export function statementColumns(a: { kind: Kind; role: Role }): [string, string] {
  if (isMoney(a)) return ["Money in", "Money out"];
  if (a.role === "receivable") return ["Udhaar given", "Received"];
  if (a.role === "payable") return ["Bought on credit", "Paid"];
  switch (a.kind) {
    case "asset": return ["Added", "Reduced"];
    case "expense": return ["Spent", "Refund"];
    case "income": return ["Earned", "Returned"];
    case "liability": return ["Borrowed / owed", "Paid back"];
    case "equity": return ["Put in", "Taken out"];
  }
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
  // Foreign-currency accounts valued at today's rate: the change since the entries' rates is a gain or loss.
  const diff = (k: Kind) => accs.filter((a) => a.kind === k).reduce((t, a) => t + (a.balance - a.book), 0);
  const fxGain = diff("asset") - diff("liability");
  const totalEquity = sum(equity) + profit + fxGain;
  return {
    assets,
    liabilities,
    equity,
    profit,
    fxGain,
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
    (a) => !a.archived && isParty(a),
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
  if (!/^[A-Z]{3,4}$/.test(next)) throw new Error("Choose a currency");
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
    // An account kept in the new main currency is now just a normal account.
    await x.q("UPDATE accounts SET currency = NULL WHERE user_id = $1 AND currency = $2", [userId, next]);
    await audit(x, userId, "currency", null, { from: u.currency, to: next, rate });
  });
}

// ---------- Chart data ----------

/** Cash & bank (money you hold) for every day in the window, starting from the opening balance. */
export async function cashBankDaily(d: Db, userId: number, from: string, to: string) {
  const ids = (await accountsWithBalances(d, userId))
    .filter(isMoney)
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

// ---------- Adding an account in plain words ----------

/** Add an account into a category (its first sub-category), from just a name. Returns an existing one with that name. */
export async function quickAddToCategory(d: Db, userId: number, rawName: string, categoryId: number) {
  const name = rawName.trim().replace(/\s+/g, " ");
  const accs = await accountsWithBalances(d, userId);
  const same = accs.find((a) => !a.archived && a.name.toLowerCase() === name.toLowerCase());
  if (same) return { id: same.id, name: same.name, category: same.category, kind: same.kind, role: same.role, balance: same.balance, currency: same.currency, existed: true };
  const cat = (await categories(d, userId)).find((c) => c.id === categoryId);
  if (!cat) throw new Error("Choose a category");
  const id = await addAccount(d, userId, await defaultSubcategory(d, userId, cat.id), name);
  const a = (await accountsWithBalances(d, userId)).find((x) => x.id === id)!;
  return { id, name: a.name, category: cat.name, kind: cat.kind, role: cat.role, balance: 0, currency: a.currency, existed: false };
}

/**
 * Add an account from just a name and a plain choice. If one with that name already exists
 * (not archived), it is returned instead of making a duplicate.
 */
export async function quickAddAccount(d: Db, userId: number, rawName: string, choice: AccountChoice, currency?: string | null) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Type a name for the account");
  if (name.length > 80) throw new Error("Name is too long");
  const accs = await accountsWithBalances(d, userId);
  const same = accs.find((a) => !a.archived && a.name.toLowerCase() === name.toLowerCase());
  if (same) return { id: same.id, name: same.name, category: same.category, kind: same.kind, role: same.role, balance: same.balance, currency: same.currency, existed: true };
  const cats = await categories(d, userId);
  const subs = await subcategories(d, userId);
  const pick: Record<AccountChoice, () => Category | undefined> = {
    expense: () => cats.find((c) => c.kind === "expense"),
    income: () => cats.find((c) => c.kind === "income"),
    money: () => cats.find((c) => c.role === "bank") ?? cats.find((c) => c.role === "cash"),
    customer: () => cats.find((c) => c.role === "receivable"),
    supplier: () => cats.find((c) => c.role === "payable"),
    owned: () => cats.find((c) => c.kind === "asset" && !c.role),
    owed: () => cats.find((c) => c.kind === "liability" && !c.role),
  };
  const fallback: Record<AccountChoice, [string, Kind, Role]> = {
    expense: ["Expense", "expense", null], income: ["Income", "income", null], money: ["Bank", "asset", "bank"],
    customer: ["Receivables", "asset", "receivable"], supplier: ["Payables", "liability", "payable"],
    owned: ["Assets", "asset", null], owed: ["Liabilities", "liability", null],
  };
  if (!(choice in pick)) throw new Error("Choose what kind of account it is");
  let cat = pick[choice]();
  if (!cat) {
    const [n, k, r] = fallback[choice];
    const id = await addCategory(d, userId, n, k, undefined, r);
    cat = (await categories(d, userId)).find((c) => c.id === id)!;
  }
  // Prefer an "Other …" sub-category for odd expenses and income, so they don't land under "Purchases".
  const mine = subs.filter((s) => s.category_id === cat.id);
  const sub = (choice === "expense" || choice === "income" ? mine.find((s) => /^other/i.test(s.name)) : undefined) ?? mine[0];
  const subId = sub?.id ?? (await defaultSubcategory(d, userId, cat.id));
  const id = await addAccount(d, userId, subId, name, { currency });
  const cur = (await accountsWithBalances(d, userId)).find((a) => a.id === id)?.currency ?? null;
  return { id, name, category: cat.name, kind: cat.kind, role: cat.role, balance: 0, currency: cur, existed: false };
}

/** The starting balance already set on an account, if any (for showing on its edit page). */
export async function startingBalanceOf(d: Db, userId: number, accountId: number) {
  const [r] = await d.q<{ amount: number; foreign_amount: number | null; date: string }>(
    `SELECT t.amount::float8 AS amount, t.foreign_amount::float8 AS foreign_amount, to_char(t.date, 'YYYY-MM-DD') AS date FROM transactions t
     JOIN accounts o ON o.id = CASE WHEN t.from_account_id = $2 THEN t.to_account_id ELSE t.from_account_id END
     WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.note = 'Starting balance'
       AND (t.from_account_id = $2 OR t.to_account_id = $2) AND o.name IN ('Starting balance', 'Opening Balances')
     ORDER BY t.id LIMIT 1`,
    [userId, accountId],
  );
  return r;
}

// ---------- Deleting an account that is in use ----------

export type AccountImpact = {
  account: AccountRow;
  entries: number;
  first: string | null;
  last: string | null;
  /** Other accounts whose balance changes if this account's entries are deleted, and by how much. */
  others: { id: number; name: string; change: number }[];
  invoices: number;
  schedules: number;
  shares: number;
};

/** What deleting an account would touch, in plain numbers, before anything is done. */
export async function accountImpact(d: Db, userId: number, id: number): Promise<AccountImpact> {
  const accs = await accountsWithBalances(d, userId);
  const account = accs.find((a) => a.id === id);
  if (!account) throw new Error("Not found");
  const [{ n, first, last }] = await d.q<{ n: number; first: string | null; last: string | null }>(
    `SELECT COUNT(*)::int AS n, to_char(MIN(date), 'YYYY-MM-DD') AS first, to_char(MAX(date), 'YYYY-MM-DD') AS last
     FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND (from_account_id = $2 OR to_account_id = $2)`,
    [userId, id],
  );
  const flows = await d.q<{ other: number; i: number; o: number }>(
    `SELECT CASE WHEN from_account_id = $2 THEN to_account_id ELSE from_account_id END AS other,
            COALESCE(SUM(CASE WHEN to_account_id <> $2 THEN amount END), 0)::float8 AS i,
            COALESCE(SUM(CASE WHEN from_account_id <> $2 THEN amount END), 0)::float8 AS o
     FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND (from_account_id = $2 OR to_account_id = $2) GROUP BY 1`,
    [userId, id],
  );
  // Removing an entry takes its effect away from the other account: the change is minus what it added.
  const others = flows
    .map((f) => {
      const o = accs.find((a) => a.id === f.other)!;
      return { id: o.id, name: o.name, change: -signedBalance(o.kind, f.i, f.o) };
    })
    .filter((x) => x.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const [{ inv }] = await d.q<{ inv: number }>("SELECT COUNT(*)::int AS inv FROM invoices WHERE user_id = $1 AND customer_account_id = $2", [userId, id]);
  const [{ sch }] = await d.q<{ sch: number }>("SELECT COUNT(*)::int AS sch FROM schedules WHERE user_id = $1 AND (from_account_id = $2 OR to_account_id = $2)", [userId, id]);
  const [{ sh }] = await d.q<{ sh: number }>("SELECT COUNT(*)::int AS sh FROM shares WHERE owner_id = $1 AND account_id = $2", [userId, id]);
  return { account, entries: n, first, last, others, invoices: inv, schedules: sch, shares: sh };
}

/**
 * Join an account into another one: all its entries, invoices and repeating entries move over,
 * so the balance and history move too, then it is deleted. Entries between the two cancel out and go.
 */
export async function mergeAccount(d: Db, userId: number, id: number, intoId: number) {
  if (id === intoId) throw new Error("Choose a different account to move it into");
  const accs = await accountsWithBalances(d, userId);
  const from = accs.find((a) => a.id === id), into = accs.find((a) => a.id === intoId);
  if (!from || !into) throw new Error("Not found");
  if ((from.currency ?? null) !== (into.currency ?? null))
    throw new Error(`${from.name} is in ${from.currency ?? "your main currency"} but ${into.name} is in ${into.currency ?? "your main currency"}. Choose an account in the same currency, or change one account's currency first.`);
  await d.tx(async (x) => {
    await x.q("DELETE FROM transactions WHERE user_id = $1 AND ((from_account_id = $2 AND to_account_id = $3) OR (from_account_id = $3 AND to_account_id = $2))", [userId, id, intoId]);
    await x.q("UPDATE transactions SET from_account_id = $3 WHERE user_id = $1 AND from_account_id = $2", [userId, id, intoId]);
    await x.q("UPDATE transactions SET to_account_id = $3 WHERE user_id = $1 AND to_account_id = $2", [userId, id, intoId]);
    await x.q("UPDATE invoices SET customer_account_id = $3 WHERE user_id = $1 AND customer_account_id = $2", [userId, id, intoId]);
    await x.q("DELETE FROM schedules WHERE user_id = $1 AND ((from_account_id = $2 AND to_account_id = $3) OR (from_account_id = $3 AND to_account_id = $2))", [userId, id, intoId]);
    await x.q("UPDATE schedules SET from_account_id = $3 WHERE user_id = $1 AND from_account_id = $2", [userId, id, intoId]);
    await x.q("UPDATE schedules SET to_account_id = $3 WHERE user_id = $1 AND to_account_id = $2", [userId, id, intoId]);
    await x.q("DELETE FROM accounts WHERE id = $1 AND user_id = $2", [id, userId]);
    await audit(x, userId, "merge-account", null, { from: from.name, into: into.name, balance: from.balance });
  });
}

/**
 * Delete an account together with all its entries. Other accounts lose what those entries gave them
 * (see accountImpact). Invoices keep the customer's name but are no longer linked.
 */
export async function deleteAccountWithEntries(d: Db, userId: number, id: number) {
  const impact = await accountImpact(d, userId, id);
  await d.tx(async (x) => {
    await x.q("UPDATE invoices SET customer_account_id = NULL WHERE user_id = $1 AND customer_account_id = $2", [userId, id]);
    await x.q("DELETE FROM transactions WHERE user_id = $1 AND (from_account_id = $2 OR to_account_id = $2)", [userId, id]);
    await x.q("DELETE FROM accounts WHERE id = $1 AND user_id = $2", [id, userId]);
    await audit(x, userId, "delete-account", null, {
      account: impact.account.name,
      balance: impact.account.balance,
      entries: impact.entries,
      others: impact.others,
    });
  });
}
