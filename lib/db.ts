import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// All money is stored as whole paisa (1 rupee = 100 paisa) so sums never
// suffer from floating point rounding errors.

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  business_name TEXT,
  password_hash TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Level 1: Category (Cash, Bank, Expense...). "kind" drives accounting rules.
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('asset','liability','equity','income','expense')),
  sort INTEGER NOT NULL DEFAULT 0
);

-- Level 2: Sub-category (e.g. Expense > Utilities)
CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- Level 3: Account (e.g. Utilities > Electricity Bill)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
  name TEXT NOT NULL,
  phone TEXT,
  budget_monthly INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every entry moves money FROM one account TO another (double entry).
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment','receipt','transfer')),
  date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  from_account_id INTEGER NOT NULL REFERENCES accounts(id),
  to_account_id INTEGER NOT NULL REFERENCES accounts(id),
  note TEXT,
  highlight TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT,
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_txn_from ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_txn_to ON transactions(to_account_id);

-- History of every create / edit / delete, so nothing disappears silently.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  transaction_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(file: string): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

const g = globalThis as unknown as { __db?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__db) {
    g.__db = openDb(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db"));
  }
  return g.__db;
}

/** Run several statements as one all-or-nothing unit. */
export function tx<T>(d: DatabaseSync, fn: () => T): T {
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
