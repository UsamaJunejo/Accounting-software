import type { Db } from "./db.ts";
import { budgets } from "./books.ts";
import { dueReminders } from "./schedules.ts";
import { invoiceStatus, listInvoices } from "./invoices.ts";
import { pendingForOwner, sharedWithMe } from "./sharing.ts";
import { monthRange } from "./format.ts";
import { lowStock } from "./items.ts";

export type Notice = {
  key: string;
  kind: "approval" | "invite" | "reminder" | "overdue" | "budget" | "auto" | "billing" | "stock";
  urgent: boolean;
  title: string;
  detail?: string;
  href: string;
  reminderId?: number;
  date?: string;
};

/** Everything that needs the user's attention, worked out fresh each time (nothing to clear by hand). */
export async function getNotifications(d: Db, userId: number, today: string, isAdmin = false): Promise<Notice[]> {
  const [mStart, mEnd] = monthRange(today);
  const [pending, shares, reminders, invoices, budgetRows, auto, low] = await Promise.all([
    pendingForOwner(d, userId),
    sharedWithMe(d, userId),
    dueReminders(d, userId, today),
    listInvoices(d, userId),
    budgets(d, userId, mStart, mEnd),
    d.q<{ id: number; note: string | null; to_name: string; from_name: string; amount: number; date: string }>(
      `SELECT t.id, t.note, ta.name AS to_name, fa.name AS from_name, t.amount::float8 AS amount, to_char(t.date, 'YYYY-MM-DD') AS date
       FROM transactions t JOIN accounts fa ON fa.id = t.from_account_id JOIN accounts ta ON ta.id = t.to_account_id
       WHERE t.user_id = $1 AND t.schedule_id IS NOT NULL AND t.deleted_at IS NULL AND t.created_at > now() - interval '3 days'
       ORDER BY t.created_at DESC LIMIT 10`,
      [userId],
    ),
    lowStock(d, userId),
  ]);
  const out: Notice[] = [];
  for (const p of pending)
    out.push({ key: `ap${p.id}`, kind: "approval", urgent: true, title: `${p.user_name} added an entry to ${p.account}`, detail: "Waiting for your approval", href: "/shared", date: p.date });
  for (const s of shares.filter((x) => x.status === "pending"))
    out.push({ key: `in${s.id}`, kind: "invite", urgent: true, title: `${s.owner_business || s.owner_name} shared "${s.account}" with you`, detail: "Accept or decline the invitation", href: "/shared" });
  for (const r of reminders)
    out.push({ key: `re${r.id}`, kind: "reminder", urgent: r.next_date <= today, title: `${r.note || `${r.from_name} → ${r.to_name}`} is due`, detail: r.next_date <= today ? "Due now" : "Due soon", href: "/scheduled", reminderId: r.id, date: r.next_date });
  for (const inv of invoices.filter((i) => invoiceStatus(i, today) === "overdue"))
    out.push({ key: `iv${inv.id}`, kind: "overdue", urgent: true, title: `Invoice #${inv.number} for ${inv.customer_name} is overdue`, detail: "Payment was due", href: `/invoices/${inv.id}`, date: inv.due_date ?? undefined });
  for (const b of budgetRows.filter((x) => x.spent >= x.budget * 0.9))
    out.push({ key: `bu${b.id}`, kind: "budget", urgent: b.spent > b.budget, title: b.spent > b.budget ? `${b.name} is over budget` : `${b.name} is close to its budget`, detail: "This month", href: `/accounts/${b.id}` });
  for (const i of low)
    out.push({ key: `st${i.id}`, kind: "stock", urgent: i.stock <= 0, title: i.stock <= 0 ? `${i.name} is out of stock` : `${i.name} is running low`, detail: `${i.stock} ${i.unit} left`, href: `/items/${i.id}` });
  for (const a of auto)
    out.push({ key: `au${a.id}`, kind: "auto", urgent: false, title: `Added automatically: ${a.note || `${a.from_name} → ${a.to_name}`}`, detail: "From a scheduled entry", href: `/voucher?edit=${a.id}`, date: a.date });
  // Payments: admins see what's waiting; everyone sees recent decisions on their own payments.
  const [waiting, decided] = await Promise.all([
    isAdmin ? d.q<{ n: number }>("SELECT COUNT(*)::int AS n FROM subscription_payments WHERE status = 'pending'") : Promise.resolve([{ n: 0 }]),
    d.q<{ id: number; status: string; months: number; note: string | null }>(
      "SELECT id, status, months, note FROM subscription_payments WHERE user_id = $1 AND status <> 'pending' AND decided_at > now() - interval '7 days' AND amount > 0",
      [userId],
    ),
  ]);
  if (waiting[0].n)
    out.unshift({ key: "pay-waiting", kind: "billing", urgent: true, title: `${waiting[0].n} ${waiting[0].n === 1 ? "payment is" : "payments are"} waiting for your approval`, detail: "Check the transaction IDs, then approve", href: "/admin" });
  for (const p of decided)
    out.push({ key: `pd${p.id}`, kind: "billing", urgent: false, title: p.status === "approved" ? `Payment approved: ${p.months} ${p.months === 1 ? "month" : "months"} added` : "Payment not approved", detail: p.status === "approved" ? "Thank you!" : p.note || "Please contact support", href: "/billing" });
  return out;
}

/** Just the number on the bell, in one quick query (the full list is built on the Notifications page). */
export async function urgentCount(d: Db, userId: number, today: string, isAdmin: boolean) {
  const [mStart, mEnd] = monthRange(today);
  const [r] = await d.q<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM shared_entries e JOIN shares s ON s.id = e.share_id WHERE s.owner_id = $1 AND e.status = 'pending')
     + (SELECT COUNT(*) FROM shares WHERE user_id = $1 AND status = 'pending')
     + (SELECT COUNT(*) FROM schedules WHERE user_id = $1 AND active AND NOT auto AND next_date <= $2::date)
     + (SELECT COUNT(*) FROM invoices i WHERE i.user_id = $1 AND NOT i.cancelled AND i.due_date < $2::date
          AND i.total > COALESCE((SELECT SUM(p.amount) FROM invoice_payments p LEFT JOIN transactions t ON t.id = p.transaction_id
                                  WHERE p.invoice_id = i.id AND (p.transaction_id IS NULL OR t.deleted_at IS NULL)), 0))
     + (SELECT COUNT(*) FROM accounts a WHERE a.user_id = $1 AND a.budget_monthly IS NOT NULL AND a.budget_monthly <
          COALESCE((SELECT SUM(amount) FROM transactions WHERE to_account_id = a.id AND deleted_at IS NULL AND date BETWEEN $3::date AND $4::date), 0)
          - COALESCE((SELECT SUM(amount) FROM transactions WHERE from_account_id = a.id AND deleted_at IS NULL AND date BETWEEN $3::date AND $4::date), 0))
     + (SELECT COUNT(*) FROM items i WHERE i.user_id = $1 AND NOT i.archived AND i.low_stock IS NOT NULL
          AND COALESCE((SELECT SUM(qty) FROM stock_moves WHERE item_id = i.id), 0) <= 0)
     + (CASE WHEN $5::bool THEN (SELECT COUNT(*) FROM subscription_payments WHERE status = 'pending') ELSE 0 END)
     AS n`,
    [userId, today, mStart, mEnd, isAdmin],
  );
  return Number(r.n);
}
