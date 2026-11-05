import type { Db } from "./db.ts";

export type AgingRow = {
  id: number;
  name: string;
  phone: string | null;
  balance: number;
  b0: number; // 0-30 days
  b30: number; // 31-60
  b60: number; // 61-90
  b90: number; // over 90
  oldest: string | null; // date of the oldest unpaid charge
  lastPayment: string | null;
};

const days = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * Who owes you, and for how long. Payments are matched to the oldest unpaid charges first
 * (the way shopkeepers settle khata), and what is left is grouped by age.
 */
export async function receivableAging(d: Db, userId: number, today: string): Promise<AgingRow[]> {
  const accts = await d.q<{ id: number; name: string; phone: string | null }>(
    `SELECT a.id, a.name, a.phone FROM accounts a JOIN subcategories s ON s.id = a.subcategory_id
     JOIN categories c ON c.id = s.category_id
     WHERE a.user_id = $1 AND c.name = 'Receivables' AND NOT a.archived`,
    [userId],
  );
  if (!accts.length) return [];
  const moves = await d.q<{ account: number; date: string; charge: number; pay: number }>(
    `SELECT CASE WHEN to_account_id = ANY($2::int[]) THEN to_account_id ELSE from_account_id END AS account,
            to_char(date, 'YYYY-MM-DD') AS date,
            CASE WHEN to_account_id = ANY($2::int[]) THEN amount ELSE 0 END::float8 AS charge,
            CASE WHEN from_account_id = ANY($2::int[]) THEN amount ELSE 0 END::float8 AS pay
     FROM transactions
     WHERE user_id = $1 AND deleted_at IS NULL AND date <= $3::date
       AND (to_account_id = ANY($2::int[]) OR from_account_id = ANY($2::int[]))
     ORDER BY date, id`,
    [userId, accts.map((a) => a.id), today],
  );
  const rows: AgingRow[] = [];
  for (const a of accts) {
    const queue: { date: string; left: number }[] = [];
    let credit = 0;
    let lastPayment: string | null = null;
    for (const m of moves.filter((x) => x.account === a.id)) {
      if (m.charge) {
        let left = m.charge;
        const use = Math.min(credit, left); // advance paid earlier
        credit -= use;
        left -= use;
        if (left > 0) queue.push({ date: m.date, left });
      }
      if (m.pay) {
        lastPayment = m.date;
        let pay = m.pay;
        while (pay > 0 && queue.length) {
          const use = Math.min(pay, queue[0].left);
          queue[0].left -= use;
          pay -= use;
          if (queue[0].left === 0) queue.shift();
        }
        credit += pay;
      }
    }
    const r: AgingRow = { id: a.id, name: a.name, phone: a.phone, balance: 0, b0: 0, b30: 0, b60: 0, b90: 0, oldest: queue[0]?.date ?? null, lastPayment };
    for (const q of queue) {
      const age = days(q.date, today);
      if (age > 90) r.b90 += q.left;
      else if (age > 60) r.b60 += q.left;
      else if (age > 30) r.b30 += q.left;
      else r.b0 += q.left;
      r.balance += q.left;
    }
    if (r.balance > 0) rows.push(r);
  }
  // Most worrying first: the oldest money, then the biggest.
  return rows.sort((x, y) => y.b90 - x.b90 || y.b60 - x.b60 || y.balance - x.balance);
}
