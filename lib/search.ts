import type { Db } from "./db.ts";
import { toPaisa } from "./format.ts";

/** One search across accounts, entries and invoices. A number also matches entry amounts. */
export async function searchAll(d: Db, userId: number, q: string) {
  const term = q.trim();
  if (term.length < 2) return { accounts: [], entries: [], invoices: [] };
  const like = `%${term}%`;
  const amount = toPaisa(term);
  const [accounts, entries, invoices] = await Promise.all([
    d.q<{ id: number; name: string; phone: string | null; category: string; sub: string }>(
      `SELECT a.id, a.name, a.phone, c.name AS category, s.name AS sub FROM accounts a
       JOIN subcategories s ON s.id = a.subcategory_id JOIN categories c ON c.id = s.category_id
       WHERE a.user_id = $1 AND (a.name ILIKE $2 OR a.phone ILIKE $2 OR s.name ILIKE $2 OR c.name ILIKE $2)
       ORDER BY a.archived, a.name LIMIT 20`,
      [userId, like],
    ),
    d.q<{ id: number; date: string; type: string; amount: number; note: string | null; from_name: string; to_name: string }>(
      `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') AS date, t.type, t.amount::float8 AS amount, t.note, fa.name AS from_name, ta.name AS to_name
       FROM transactions t JOIN accounts fa ON fa.id = t.from_account_id JOIN accounts ta ON ta.id = t.to_account_id
       WHERE t.user_id = $1 AND t.deleted_at IS NULL AND (t.note ILIKE $2 OR fa.name ILIKE $2 OR ta.name ILIKE $2 OR t.amount = $3)
       ORDER BY t.date DESC, t.id DESC LIMIT 30`,
      [userId, like, Number.isNaN(amount) ? -1 : amount],
    ),
    d.q<{ id: number; number: number; customer_name: string; total: number; date: string; cancelled: boolean }>(
      `SELECT id, number, customer_name, total::float8 AS total, to_char(date, 'YYYY-MM-DD') AS date, cancelled FROM invoices
       WHERE user_id = $1 AND (customer_name ILIKE $2 OR customer_phone ILIKE $2 OR number::text = $3 OR notes ILIKE $2)
       ORDER BY number DESC LIMIT 15`,
      [userId, like, term.replace(/^#/, "")],
    ),
  ]);
  return { accounts, entries, invoices };
}
