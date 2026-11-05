import type { Db } from "./db.ts";

// Every table, parents before children, so a backup can be loaded back in this order.
const TABLES = [
  "users", "categories", "subcategories", "accounts", "projects", "schedules", "transactions",
  "attachments", "audit_log", "shares", "shared_entries", "invoices", "invoice_payments",
] as const;

/** Photos/PDFs are left out of backups (they're large); everything else is included. */
const COLUMNS: Partial<Record<(typeof TABLES)[number], string>> = {
  attachments: "id, user_id, transaction_id, filename, mime, size, created_at",
};

async function dump(d: Db, table: (typeof TABLES)[number], where = "", params: unknown[] = []) {
  return d.q(`SELECT ${COLUMNS[table] ?? "*"} FROM ${table} ${where} ORDER BY id`, params);
}

/** The whole database as one JSON document (admin only). */
export async function fullSnapshot(d: Db) {
  const tables: Record<string, unknown[]> = {};
  let rows = 0;
  for (const t of TABLES) {
    tables[t] = await dump(d, t);
    rows += tables[t].length;
  }
  const [{ v }] = await d.q<{ v: number }>("SELECT MAX(version) AS v FROM schema_migrations");
  return { app: "FinanceChachu", kind: "full", schema: v, created: new Date().toISOString(), rows, tables };
}

/** One user's own data, for "Download everything" in Settings. Secrets are left out. */
export async function userSnapshot(d: Db, userId: number) {
  const byUser = "WHERE user_id = $1";
  const tables: Record<string, unknown[]> = {
    profile: await d.q(
      `SELECT id, name, email, phone, business_name, currency, address, ntn, nok_name, nok_relation, nok_phone, nok_email, created_at
       FROM users WHERE id = $1`,
      [userId],
    ),
  };
  for (const t of ["categories", "subcategories", "accounts", "projects", "schedules", "transactions", "audit_log", "invoices"] as const) {
    tables[t] = await dump(d, t, byUser, [userId]);
  }
  tables.attachments = await dump(d, "attachments", byUser, [userId]);
  tables.invoice_payments = await d.q(
    "SELECT p.* FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.user_id = $1 ORDER BY p.id",
    [userId],
  );
  tables.shares = await dump(d, "shares", "WHERE owner_id = $1", [userId]);
  return { app: "FinanceChachu", kind: "user", created: new Date().toISOString(), tables };
}

const KEEP = 7;

/**
 * Save a snapshot if the last one is more than 20 hours old, and keep only the newest 7.
 * Called by the daily health check, so it runs once a day without any setup.
 */
export async function dailySnapshot(d: Db) {
  const [{ recent }] = await d.q<{ recent: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM backups WHERE created_at > now() - interval '20 hours') AS recent",
  );
  if (recent) return false;
  const snap = await fullSnapshot(d);
  const text = JSON.stringify(snap);
  await d.q("INSERT INTO backups (size, rows, data) VALUES ($1, $2, $3)", [text.length, snap.rows, text]);
  await d.q(`DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT ${KEEP})`);
  return true;
}

export function listBackups(d: Db) {
  return d.q<{ id: number; created_at: string; size: number; rows: number }>(
    "SELECT id, to_char(created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS created_at, size, rows FROM backups ORDER BY id DESC",
  );
}

export async function getBackup(d: Db, id: number) {
  const [b] = await d.q<{ data: string; created_at: string }>(
    "SELECT data, to_char(created_at, 'YYYY-MM-DD') AS created_at FROM backups WHERE id = $1",
    [id],
  );
  return b;
}
