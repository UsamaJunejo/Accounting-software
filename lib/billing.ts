import type { Db } from "./db.ts";
import { sniffMime } from "./books.ts";

// ---------- Settings the admin controls (price, trial, where to send money) ----------

export type BillingSettings = {
  price: number; // per month, in paisa
  trialDays: number;
  accountTitle: string;
  jazzcash: string;
  easypaisa: string;
  bankName: string;
  iban: string;
  instructions: string;
};

const DEFAULTS: BillingSettings = {
  price: 50_000,
  trialDays: 15,
  accountTitle: "",
  jazzcash: "",
  easypaisa: "",
  bankName: "",
  iban: "",
  instructions: "",
};

export async function getBillingSettings(d: Db): Promise<BillingSettings> {
  const rows = await d.q<{ key: string; value: string }>("SELECT key, value FROM app_settings WHERE key LIKE 'billing.%'");
  const m = Object.fromEntries(rows.map((r) => [r.key.slice(8), r.value]));
  return {
    price: m.price ? Number(m.price) : DEFAULTS.price,
    trialDays: m.trialDays ? Number(m.trialDays) : DEFAULTS.trialDays,
    accountTitle: m.accountTitle ?? "",
    jazzcash: m.jazzcash ?? "",
    easypaisa: m.easypaisa ?? "",
    bankName: m.bankName ?? "",
    iban: m.iban ?? "",
    instructions: m.instructions ?? "",
  };
}

export async function saveBillingSettings(d: Db, s: BillingSettings) {
  if (!Number.isSafeInteger(s.price) || s.price < 0) throw new Error("Enter a valid price");
  if (!Number.isInteger(s.trialDays) || s.trialDays < 0 || s.trialDays > 365) throw new Error("Trial must be 0 to 365 days");
  await d.tx(async (x) => {
    for (const [k, v] of Object.entries(s)) {
      await x.q(
        "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [`billing.${k}`, String(v).trim().slice(0, 500)],
      );
    }
  });
}

// ---------- A user's plan ----------

export type Plan = {
  state: "free" | "trial" | "active" | "expired";
  until: string | null; // last day they can add entries
  daysLeft: number;
};

const day = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");

export function planOf(u: { is_admin: boolean; trial_end: string | null; paid_until: string | null }, today: string): Plan {
  if (u.is_admin) return { state: "free", until: null, daysLeft: Infinity };
  const trial = u.trial_end;
  const paid = u.paid_until;
  const left = (end: string) => Math.round((day(end) - day(today)) / 86_400_000);
  if (paid && paid >= today && (!trial || paid >= trial)) return { state: "active", until: paid, daysLeft: left(paid) };
  if (trial && trial >= today) return { state: "trial", until: trial, daysLeft: left(trial) };
  if (paid && paid >= today) return { state: "active", until: paid, daysLeft: left(paid) };
  const last = [trial, paid].filter(Boolean).sort().pop() ?? null;
  return { state: "expired", until: last, daysLeft: 0 };
}

export async function setTrialForNewUser(d: Db, userId: number) {
  const { trialDays } = await getBillingSettings(d);
  await d.q("UPDATE users SET trial_ends_at = now() + ($1::int * interval '1 day') WHERE id = $2", [trialDays, userId]);
}

// ---------- Payments ----------

export const METHODS = ["JazzCash", "Easypaisa", "Bank transfer", "Other"] as const;

export async function submitPayment(
  d: Db,
  userId: number,
  p: { months: number; method: string; reference: string; proof?: Uint8Array | null },
) {
  if (!Number.isInteger(p.months) || p.months < 1 || p.months > 24) throw new Error("Choose how many months");
  if (!METHODS.includes(p.method as (typeof METHODS)[number])) throw new Error("Choose how you paid");
  const ref = p.reference.trim().replace(/\s+/g, " ");
  if (ref.length < 4 || ref.length > 60) throw new Error("Enter the transaction ID (TID) from your payment message");
  const [dup] = await d.q("SELECT 1 FROM subscription_payments WHERE lower(reference) = lower($1) AND status <> 'rejected'", [ref]);
  if (dup) throw new Error("This transaction ID was already submitted");
  const [{ n }] = await d.q<{ n: number }>("SELECT COUNT(*)::int AS n FROM subscription_payments WHERE user_id = $1 AND status = 'pending'", [userId]);
  if (n >= 3) throw new Error("You already have payments waiting for approval. Please wait for them to be checked.");
  let proof: Uint8Array | null = null;
  let mime: string | null = null;
  if (p.proof && p.proof.length) {
    mime = sniffMime(p.proof);
    if (!mime) throw new Error("The screenshot must be a photo or PDF");
    if (p.proof.length > 3 * 1024 * 1024) throw new Error("The screenshot is too big (max 3 MB)");
    proof = p.proof;
  }
  const { price } = await getBillingSettings(d);
  const [r] = await d.q<{ id: number }>(
    `INSERT INTO subscription_payments (user_id, months, amount, method, reference, proof, proof_mime)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [userId, p.months, price * p.months, p.method, ref, proof, mime],
  );
  return r.id;
}

export type PaymentRow = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  business: string | null;
  months: number;
  amount: number;
  method: string;
  reference: string;
  has_proof: boolean;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  created_at: string;
  decided_at: string | null;
};

const PAY_SELECT = `SELECT p.id, p.user_id, u.name AS user_name, u.email AS user_email, u.business_name AS business, p.months,
  p.amount::float8 AS amount, p.method, p.reference, (p.proof IS NOT NULL) AS has_proof, p.status, p.note,
  to_char(p.created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS created_at,
  to_char(p.decided_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS decided_at
  FROM subscription_payments p JOIN users u ON u.id = p.user_id`;

export function myPayments(d: Db, userId: number) {
  return d.q<PaymentRow>(`${PAY_SELECT} WHERE p.user_id = $1 ORDER BY p.id DESC LIMIT 50`, [userId]);
}

export function allPayments(d: Db, status?: "pending") {
  return d.q<PaymentRow>(`${PAY_SELECT} ${status ? "WHERE p.status = 'pending'" : ""} ORDER BY p.status = 'pending' DESC, p.id DESC LIMIT 100`);
}

async function requireAdmin(d: Db, adminId: number) {
  const [a] = await d.q<{ is_admin: boolean }>("SELECT is_admin FROM users WHERE id = $1", [adminId]);
  if (!a?.is_admin) throw new Error("Only an admin can do this");
}

/** Approve: add the paid months after whichever is later: today, the trial end, or what's already paid. */
export async function approvePayment(d: Db, adminId: number, id: number) {
  await requireAdmin(d, adminId);
  await d.tx(async (x) => {
    const [p] = await x.q<{ user_id: number; months: number }>(
      "UPDATE subscription_payments SET status = 'approved', decided_at = now(), decided_by = $2 WHERE id = $1 AND status = 'pending' RETURNING user_id, months",
      [id, adminId],
    );
    if (!p) throw new Error("Payment not found or already checked");
    await x.q(
      `UPDATE users SET paid_until = (GREATEST(COALESCE(paid_until, current_date), current_date, COALESCE((trial_ends_at AT TIME ZONE 'Asia/Karachi')::date, current_date))
                                       + ($2::int * interval '1 month'))::date
       WHERE id = $1`,
      [p.user_id, p.months],
    );
  });
}

export async function rejectPayment(d: Db, adminId: number, id: number, note: string) {
  await requireAdmin(d, adminId);
  const r = await d.q(
    "UPDATE subscription_payments SET status = 'rejected', note = $3, decided_at = now(), decided_by = $2 WHERE id = $1 AND status = 'pending' RETURNING id",
    [id, adminId, note || null],
  );
  if (!r.length) throw new Error("Payment not found or already checked");
}

/** Admin can also give months for free (e.g. a friend, or cash paid in person). */
export async function grantMonths(d: Db, adminId: number, userId: number, months: number) {
  await requireAdmin(d, adminId);
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error("Choose 1 to 24 months");
  await d.q(
    `INSERT INTO subscription_payments (user_id, months, amount, method, reference, status, note, decided_at, decided_by)
     VALUES ($1, $2, 0, 'Other', $3, 'approved', 'Given by admin', now(), $4)`,
    [userId, months, `ADMIN-${Date.now()}`, adminId],
  );
  await d.q(
    `UPDATE users SET paid_until = (GREATEST(COALESCE(paid_until, current_date), current_date, COALESCE((trial_ends_at AT TIME ZONE 'Asia/Karachi')::date, current_date))
                                     + ($2::int * interval '1 month'))::date WHERE id = $1`,
    [userId, months],
  );
}

export async function getProof(d: Db, userId: number, isAdmin: boolean, id: number) {
  const [p] = await d.q<{ proof: Uint8Array | null; proof_mime: string | null }>(
    `SELECT proof, proof_mime FROM subscription_payments WHERE id = $1 AND ($2::bool OR user_id = $3)`,
    [id, isAdmin, userId],
  );
  return p?.proof ? p : undefined;
}
