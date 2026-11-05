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
  /** Run a script of several SQL statements (no parameters). */
  exec(sql: string): Promise<void>;
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
ALTER TABLE IF EXISTS schema_migrations ENABLE ROW LEVEL SECURITY;
`;

// ---------- Database updates ("migrations") ----------
// Each entry changes the database structure once. Never edit an old entry; add a new one.
// Version 1 is SCHEMA above.

export const MIGRATIONS: string[] = [
  /* 2: password recovery, admins, sign-out-everywhere, login limits */ `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_hash TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
  -- The first person who signed up runs the site.
  UPDATE users SET is_admin = true WHERE id = (SELECT MIN(id) FROM users);
  CREATE TABLE IF NOT EXISTS auth_attempts (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_auth_attempts ON auth_attempts(key, created_at);
  ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
  `,
  /* 3: sharing ledgers */ `
  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_add BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, user_id),
    CHECK (owner_id <> user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
  CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id);
  -- Entries suggested by the person an account is shared with, waiting for the owner.
  CREATE TABLE IF NOT EXISTS shared_entries (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    share_id INTEGER NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('increase','decrease')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    remarks TEXT,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_shared_entries_share ON shared_entries(share_id, status);
  ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
  ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;
  `,
];

export const LATEST_VERSION = MIGRATIONS.length + 1;

/** Bring the database up to date. Safe to run on every start. */
export async function migrate(d: Db) {
  await d.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const [{ v }] = await d.q<{ v: number | null }>("SELECT MAX(version) AS v FROM schema_migrations");
  if ((v ?? 0) >= LATEST_VERSION) return;
  await d.tx(async (t) => {
    // Only one server at a time may update the database.
    await t.q("SELECT pg_advisory_xact_lock(727274)");
    const [{ v: now }] = await t.q<{ v: number | null }>("SELECT MAX(version) AS v FROM schema_migrations");
    let version = now ?? 0;
    if (version === 0) {
      const [{ exists }] = await t.q<{ exists: boolean }>("SELECT to_regclass('public.audit_log') IS NOT NULL AS exists");
      if (!exists) await t.exec(SCHEMA); // brand-new database
      await t.q("INSERT INTO schema_migrations (version) VALUES (1)");
      version = 1;
    }
    for (let next = version + 1; next <= LATEST_VERSION; next++) {
      await t.exec(MIGRATIONS[next - 2]);
      await t.q("INSERT INTO schema_migrations (version) VALUES ($1)", [next]);
    }
  });
}

// ---------- Embedded Postgres (dev & tests) ----------

type PgRunner = {
  query<R>(t: string, p?: unknown[]): Promise<{ rows: R[] }>;
  exec(t: string): Promise<unknown>;
};
type PGliteLike = PgRunner & { transaction<T>(fn: (tx: PgRunner) => Promise<T>): Promise<T> };

function wrapPglite(pg: PGliteLike): Db {
  const make = (runner: PgRunner, inTx: boolean): Db => ({
    q: async <T>(text: string, params: unknown[] = []) => (await runner.query<T>(text, params)).rows,
    tx: (fn) => (inTx ? fn(make(runner, true)) : pg.transaction((t) => fn(make(t, true)))),
    exec: async (sql) => void (await runner.exec(sql)),
  });
  return make(pg, false);
}

export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const d = wrapPglite(new PGlite(dataDir) as unknown as PGliteLike);
  await migrate(d);
  return d;
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
    exec: async (script) => void (await runner.unsafe(script)),
  });
  const d = make(sql as unknown as Runner, false);
  await migrate(d);
  return d;
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
