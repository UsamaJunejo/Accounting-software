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
  /* 4: receipt attachments, foreign currency, projects */ `
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp','application/pdf')),
    size INTEGER NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_txn ON attachments(transaction_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id);

  -- When an entry was in another currency: amount stays in PKR, these keep the original.
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS foreign_amount BIGINT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rate NUMERIC(18,6);

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_txn_project ON transactions(project_id);

  ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  `,
  /* 5: next of kin, display level, invoices */ `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS nok_name TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS nok_relation TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS nok_phone TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS nok_email TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 3 CHECK (level IN (1, 2, 3));
  ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS ntn TEXT;

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    customer_account_id INTEGER REFERENCES accounts(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    date DATE NOT NULL,
    due_date DATE,
    items TEXT NOT NULL,               -- JSON: [{ "name", "qty", "price" }] (price in paisa)
    tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    discount BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL,
    tax BIGINT NOT NULL,
    total BIGINT NOT NULL,
    notes TEXT,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    tax_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    share_token TEXT NOT NULL UNIQUE,
    cancelled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, number)
  );
  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  `,
  /* 6: colour and icon chosen for categories and sub-categories */ `
  ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT;
  ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;
  ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS color TEXT;
  ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS icon TEXT;
  `,
  /* 7: scheduled (repeating) entries and invoice payments */ `
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('payment','receipt','transfer')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    from_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    note TEXT,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','yearly')),
    next_date DATE NOT NULL,
    end_date DATE,
    auto BOOLEAN NOT NULL DEFAULT true,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_account_id <> to_account_id)
  );
  CREATE INDEX IF NOT EXISTS idx_schedules_due ON schedules(user_id, active, next_date);
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL;

  CREATE TABLE IF NOT EXISTS invoice_payments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_invoice_payments ON invoice_payments(invoice_id);

  ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
  ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
  `,
  /* 8: daily snapshots of the whole database, kept inside it (last 7) */ `
  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    size INTEGER NOT NULL,
    rows INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
  `,
  /* 9: subscriptions (free trial, then paid months) */ `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_until DATE;
  -- People who signed up before paid plans existed get a fresh 15-day trial.
  UPDATE users SET trial_ends_at = now() + interval '15 days' WHERE trial_ends_at IS NULL;
  ALTER TABLE users ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '15 days');

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscription_payments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    months INTEGER NOT NULL CHECK (months BETWEEN 1 AND 24),
    amount BIGINT NOT NULL CHECK (amount >= 0),
    method TEXT NOT NULL,
    reference TEXT NOT NULL,
    proof BYTEA,
    proof_mime TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sub_payments ON subscription_payments(status, created_at);
  ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
  `,
  /* 10: number style (lakh) and shareable statement links */ `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS num_format TEXT NOT NULL DEFAULT 'intl' CHECK (num_format IN ('intl','lakh'));
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
  `,
  /* 11: what a category is for (so renaming "Bank" doesn't break anything), and entry types
         worked out from the accounts (money in / money out / transfer always match the accounts) */ `
  ALTER TABLE categories ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('cash','bank','receivable','payable','opening'));
  UPDATE categories SET role = CASE name WHEN 'Cash' THEN 'cash' WHEN 'Bank' THEN 'bank'
    WHEN 'Receivables' THEN 'receivable' WHEN 'Payables' THEN 'payable' END
  WHERE role IS NULL AND name IN ('Cash','Bank','Receivables','Payables');
  UPDATE transactions t SET type = CASE
      WHEN fc.role IN ('cash','bank') AND tc.role IN ('cash','bank') THEN 'transfer'
      WHEN fc.role IN ('cash','bank') THEN 'payment'
      WHEN tc.role IN ('cash','bank') THEN 'receipt'
      ELSE 'transfer' END
  FROM accounts fa JOIN subcategories fs ON fs.id = fa.subcategory_id JOIN categories fc ON fc.id = fs.category_id,
       accounts ta JOIN subcategories ts ON ts.id = ta.subcategory_id JOIN categories tc ON tc.id = ts.category_id
  WHERE fa.id = t.from_account_id AND ta.id = t.to_account_id;
  `,
  /* 12: plain words for the account that holds starting balances */ `
  UPDATE accounts a SET name = 'Starting balance'
  FROM subcategories s JOIN categories c ON c.id = s.category_id
  WHERE s.id = a.subcategory_id AND c.kind = 'equity' AND a.name = 'Opening Balances'
    AND NOT EXISTS (SELECT 1 FROM accounts x WHERE x.user_id = a.user_id AND x.name = 'Starting balance');
  UPDATE transactions SET note = 'Starting balance' WHERE note = 'Opening balance';
  `,
  /* 13: an account can be kept in its own currency (e.g. a dollar account, USDT wallet) */ `
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency ~ '^[A-Z]{3,4}$');
  `,
  /* 14: profile photo (small, already shrunk in the browser) */ `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS photo BYTEA;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_mime TEXT CHECK (photo_mime IN ('image/jpeg','image/png','image/webp'));
  ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_at TIMESTAMPTZ;
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
