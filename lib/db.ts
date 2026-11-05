// Database access. In production we talk to Postgres (Supabase) through DATABASE_URL.
// Without DATABASE_URL (local development and tests) an embedded Postgres (PGlite)
// is used, so the app runs with zero setup.
//
// All money is stored as whole paisa (1 rupee = 100 paisa) in BIGINT columns so sums
// never suffer from rounding errors. Queries cast money to float8 when reading, which
// is exact for any amount below 90 trillion rupees.

export type Row = Record<string, unknown>;

export interface Db {
  /** Run a query with $1, $2… placeholders and get the rows back. */
  q<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run several queries as one all-or-nothing unit. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  business_name TEXT,
  password_hash TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Level 1: Category (Cash, Bank, Expense...). "kind" drives accounting rules.
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('asset','liability','equity','income','expense')),
  sort INTEGER NOT NULL DEFAULT 0
);

-- Level 2: Sub-category (e.g. Expense > Utilities)
CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- Level 3: Account (e.g. Utilities > Electricity Bill)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
  name TEXT NOT NULL,
  phone TEXT,
  budget_monthly BIGINT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every entry moves money FROM one account TO another (double entry).
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment','receipt','transfer')),
  date DATE NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  from_account_id INTEGER NOT NULL REFERENCES accounts(id),
  to_account_id INTEGER NOT NULL REFERENCES accounts(id),
  note TEXT,
  highlight TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_txn_from ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_txn_to ON transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_acc_user ON accounts(user_id);

-- History of every create / edit / delete, so nothing disappears silently.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  transaction_id INTEGER,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase publishes the "public" schema through its web API. Turning on row level
-- security with no policies blocks that API completely; this app connects directly
-- as the database owner, which is not affected.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
`;

// ---------- Embedded Postgres (dev & tests) ----------

type PGliteLike = {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
  transaction<T>(fn: (tx: { query<R>(t: string, p?: unknown[]): Promise<{ rows: R[] }> }) => Promise<T>): Promise<T>;
};

function wrapPglite(pg: PGliteLike): Db {
  const make = (runner: { query<R>(t: string, p?: unknown[]): Promise<{ rows: R[] }> }, inTx: boolean): Db => ({
    q: async <T>(text: string, params: unknown[] = []) => (await runner.query<T>(text, params)).rows,
    tx: (fn) => (inTx ? fn(make(runner, true)) : pg.transaction((t) => fn(make(t, true)))),
  });
  return make(pg, false);
}

export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir) as unknown as PGliteLike;
  await pg.exec(SCHEMA);
  return wrapPglite(pg);
}

// ---------- Real Postgres (Supabase) ----------

async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    // Supabase's connection pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    onnotice: () => {},
  });
  type Runner = { unsafe: (t: string, p?: unknown[]) => Promise<unknown> };
  const make = (runner: Runner, inTx: boolean): Db => ({
    q: async <T>(text: string, params: unknown[] = []) =>
      (await runner.unsafe(text, params as never[])) as unknown as T[],
    tx: async <T>(fn: (db: Db) => Promise<T>) =>
      inTx ? fn(make(runner, true)) : ((await sql.begin((t) => fn(make(t as unknown as Runner, true)))) as T),
  });
  // Create tables only the first time (avoids clashes when many servers start at once).
  const [{ ready }] = (await sql.unsafe("SELECT to_regclass('public.audit_log') IS NOT NULL AS ready")) as unknown as {
    ready: boolean;
  }[];
  if (!ready) await sql.unsafe(SCHEMA);
  return make(sql as unknown as Runner, false);
}

// ---------- Shared instance ----------

const g = globalThis as unknown as { __db?: Promise<Db> };

export function db(): Promise<Db> {
  if (!g.__db) {
    const url = process.env.DATABASE_URL;
    if (!url && process.env.VERCEL) throw new Error("DATABASE_URL is not set");
    g.__db = (url ? openPostgres(url) : openPglite(process.env.PGLITE_DIR || "./data/pglite")).catch((e) => {
      g.__db = undefined; // allow a retry on the next request
      throw e;
    });
  }
  return g.__db;
}
