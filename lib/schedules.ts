import type { Db } from "./db.ts";
import { addTransaction, type TxnType } from "./books.ts";

export type Frequency = "weekly" | "monthly" | "yearly";
export const FREQ_LABEL: Record<Frequency, string> = { weekly: "Every week", monthly: "Every month", yearly: "Every year" };

/** The next date after `iso`. Monthly keeps the day of the month (31st → last day in short months). */
export function advance(iso: string, f: Frequency, anchorDay?: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (f === "weekly") return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  const day = anchorDay ?? d;
  const ny = f === "yearly" ? y + 1 : m === 12 ? y + 1 : y;
  const nm = f === "yearly" ? m : m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export type ScheduleInput = {
  type: TxnType;
  amount: number;
  fromAccountId: number;
  toAccountId: number;
  note?: string | null;
  projectId?: number | null;
  frequency: Frequency;
  startDate: string;
  endDate?: string | null;
  auto: boolean;
};

export type ScheduleRow = {
  id: number;
  type: TxnType;
  amount: number;
  from_account_id: number;
  to_account_id: number;
  from_name: string;
  to_name: string;
  note: string | null;
  frequency: Frequency;
  next_date: string;
  end_date: string | null;
  auto: boolean;
  active: boolean;
};

const SELECT = `SELECT s.id, s.type, s.amount::float8 AS amount, s.from_account_id, s.to_account_id,
  fa.name AS from_name, ta.name AS to_name, s.note, s.frequency, to_char(s.next_date, 'YYYY-MM-DD') AS next_date,
  to_char(s.end_date, 'YYYY-MM-DD') AS end_date, s.auto, s.active
  FROM schedules s JOIN accounts fa ON fa.id = s.from_account_id JOIN accounts ta ON ta.id = s.to_account_id`;

function check(i: ScheduleInput) {
  if (!["payment", "receipt", "transfer"].includes(i.type)) throw new Error("Invalid entry type");
  if (!Number.isSafeInteger(i.amount) || i.amount <= 0) throw new Error("Amount must be more than zero");
  if (i.fromAccountId === i.toAccountId) throw new Error("'From' and 'To' must be different accounts");
  if (!["weekly", "monthly", "yearly"].includes(i.frequency)) throw new Error("Choose how often");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.startDate)) throw new Error("Invalid start date");
  if (i.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(i.endDate) || i.endDate < i.startDate)) throw new Error("End date must be after the start date");
}

async function ownAccounts(d: Db, userId: number, ids: number[]) {
  const r = await d.q("SELECT id FROM accounts WHERE user_id = $1 AND id = ANY($2::int[])", [userId, ids]);
  if (r.length !== new Set(ids).size) throw new Error("Account not found");
}

export async function addSchedule(d: Db, userId: number, i: ScheduleInput) {
  check(i);
  await ownAccounts(d, userId, [i.fromAccountId, i.toAccountId]);
  const [r] = await d.q<{ id: number }>(
    `INSERT INTO schedules (user_id, type, amount, from_account_id, to_account_id, note, project_id, frequency, next_date, end_date, auto)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [userId, i.type, i.amount, i.fromAccountId, i.toAccountId, i.note || null, i.projectId || null, i.frequency, i.startDate, i.endDate || null, i.auto],
  );
  return r.id;
}

export function listSchedules(d: Db, userId: number) {
  return d.q<ScheduleRow>(`${SELECT} WHERE s.user_id = $1 ORDER BY s.active DESC, s.next_date`, [userId]);
}

export async function setScheduleActive(d: Db, userId: number, id: number, active: boolean) {
  await d.q("UPDATE schedules SET active = $1 WHERE id = $2 AND user_id = $3", [active, id, userId]);
}

export async function deleteSchedule(d: Db, userId: number, id: number) {
  await d.q("DELETE FROM schedules WHERE id = $1 AND user_id = $2", [id, userId]);
}

/** Post one occurrence of a schedule and move it to the next date (or finish it). */
async function postOnce(d: Db, userId: number, s: ScheduleRow, anchorDay: number) {
  await d.tx(async (x) => {
    const id = await addTransaction(x, userId, {
      type: s.type,
      date: s.next_date,
      amount: s.amount,
      fromAccountId: s.from_account_id,
      toAccountId: s.to_account_id,
      note: s.note,
    });
    await x.q("UPDATE transactions SET schedule_id = $1 WHERE id = $2", [s.id, id]);
    const next = advance(s.next_date, s.frequency, anchorDay);
    const done = s.end_date !== null && next > s.end_date;
    await x.q("UPDATE schedules SET next_date = $1, active = $2 WHERE id = $3", [next, !done, s.id]);
  });
}

async function anchor(d: Db, id: number) {
  const [{ day }] = await d.q<{ day: number }>(
    "SELECT EXTRACT(DAY FROM COALESCE((SELECT MIN(date) FROM transactions WHERE schedule_id = $1), (SELECT next_date FROM schedules WHERE id = $1)))::int AS day",
    [id],
  );
  return day;
}

/**
 * Add every automatic entry that has come due (up to today). Runs when the user opens the app,
 * so nothing is missed even after days away. Capped so a mistake can't flood the books.
 */
export async function runDueSchedules(d: Db, userId: number, today: string) {
  let added = 0;
  for (let guard = 0; guard < 120; guard++) {
    const [s] = await d.q<ScheduleRow>(
      `${SELECT} WHERE s.user_id = $1 AND s.active AND s.auto AND s.next_date <= $2::date ORDER BY s.next_date LIMIT 1`,
      [userId, today],
    );
    if (!s) break;
    await postOnce(d, userId, s, await anchor(d, s.id));
    added++;
  }
  return added;
}

/** Reminder-type schedules that are due within `days`: shown as notifications with an "Add now" button. */
export function dueReminders(d: Db, userId: number, today: string, days = 3) {
  return d.q<ScheduleRow>(
    `${SELECT} WHERE s.user_id = $1 AND s.active AND NOT s.auto AND s.next_date <= ($2::date + $3::int) ORDER BY s.next_date`,
    [userId, today, days],
  );
}

/** "Add now" on a reminder: post it for its due date and move to the next one. */
export async function postReminder(d: Db, userId: number, id: number) {
  const [s] = await d.q<ScheduleRow>(`${SELECT} WHERE s.id = $1 AND s.user_id = $2 AND s.active`, [id, userId]);
  if (!s) throw new Error("Reminder not found");
  await postOnce(d, userId, s, await anchor(d, s.id));
}

/** "Skip": move a reminder to its next date without adding an entry. */
export async function skipReminder(d: Db, userId: number, id: number) {
  const [s] = await d.q<ScheduleRow>(`${SELECT} WHERE s.id = $1 AND s.user_id = $2 AND s.active`, [id, userId]);
  if (!s) throw new Error("Reminder not found");
  const next = advance(s.next_date, s.frequency, await anchor(d, s.id));
  await d.q("UPDATE schedules SET next_date = $1, active = $2 WHERE id = $3", [next, !(s.end_date && next > s.end_date), id]);
}
