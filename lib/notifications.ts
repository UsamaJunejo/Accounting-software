import type { Db } from "./db.ts";
import { budgets } from "./books.ts";
import { dueReminders } from "./schedules.ts";
import { invoiceStatus, listInvoices } from "./invoices.ts";
import { pendingForOwner, sharedWithMe } from "./sharing.ts";
import { monthRange } from "./format.ts";

export type Notice = {
  key: string;
  kind: "approval" | "invite" | "reminder" | "overdue" | "budget" | "auto";
  urgent: boolean;
  title: string;
  detail?: string;
  href: string;
  reminderId?: number;
  date?: string;
};

/** Everything that needs the user's attention, worked out fresh each time (nothing to clear by hand). */
export async function getNotifications(d: Db, userId: number, today: string): Promise<Notice[]> {
  const [mStart, mEnd] = monthRange(today);
  const [pending, shares, reminders, invoices, budgetRows, auto] = await Promise.all([
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
  for (const a of auto)
    out.push({ key: `au${a.id}`, kind: "auto", urgent: false, title: `Added automatically: ${a.note || `${a.from_name} → ${a.to_name}`}`, detail: "From a scheduled entry", href: `/voucher?edit=${a.id}`, date: a.date });
  return out;
}
