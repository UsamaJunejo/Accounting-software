import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import { createUser } from "../lib/books.ts";
import { approvePayment, getBillingSettings, grantMonths, planOf, rejectPayment, saveBillingSettings, submitPayment } from "../lib/billing.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const row = (d: Awaited<ReturnType<typeof openPglite>>, id: number) =>
  d.q<{ is_admin: boolean; trial_end: string; paid_until: string | null }>(
    "SELECT is_admin, to_char(trial_ends_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD') AS trial_end, to_char(paid_until, 'YYYY-MM-DD') AS paid_until FROM users WHERE id = $1",
    [id],
  ).then((r) => r[0]);

test("plan states: admin free, trial, active, expired", () => {
  assert.equal(planOf({ is_admin: true, trial_end: "2020-01-01", paid_until: null }, "2026-05-01").state, "free");
  assert.deepEqual(planOf({ is_admin: false, trial_end: "2026-05-10", paid_until: null }, "2026-05-01"), { state: "trial", until: "2026-05-10", daysLeft: 9 });
  assert.equal(planOf({ is_admin: false, trial_end: "2026-04-10", paid_until: "2026-06-10" }, "2026-05-01").state, "active");
  assert.equal(planOf({ is_admin: false, trial_end: "2026-04-10", paid_until: "2026-04-20" }, "2026-05-01").state, "expired");
});

test("pay, approve, extend after the trial; reject; admin-only; no duplicate TIDs", async () => {
  const d = await openPglite();
  const admin = await createUser(d, { name: "Owner", email: "o@x.pk", passwordHash: "x" });
  const u = await createUser(d, { name: "Shop", email: "s@x.pk", passwordHash: "x" });
  const before = await row(d, u);
  assert.ok(before.trial_end); // has a trial
  assert.equal((await getBillingSettings(d)).price, 50000);
  await saveBillingSettings(d, { ...(await getBillingSettings(d)), price: 60000, jazzcash: "0300-1234567" });
  const id = await submitPayment(d, u, { months: 2, method: "JazzCash", reference: "TID 123456789", proof: JPEG });
  await assert.rejects(() => submitPayment(d, u, { months: 1, method: "JazzCash", reference: "tid 123456789" }), /already submitted/);
  await assert.rejects(() => approvePayment(d, u, id), /Only an admin/);
  await approvePayment(d, admin, id);
  await assert.rejects(() => approvePayment(d, admin, id), /already checked/);
  const after = await row(d, u);
  // 2 months counted from the end of the trial
  const expected = new Date(Date.parse(before.trial_end + "T00:00:00Z"));
  expected.setUTCMonth(expected.getUTCMonth() + 2);
  assert.equal(after.paid_until, expected.toISOString().slice(0, 10));
  const [{ amount }] = await d.q<{ amount: number }>("SELECT amount::float8 AS amount FROM subscription_payments WHERE id = $1", [id]);
  assert.equal(amount, 120000);
  const id2 = await submitPayment(d, u, { months: 1, method: "Easypaisa", reference: "EP-998877" });
  await rejectPayment(d, admin, id2, "Not received");
  await grantMonths(d, admin, u, 1);
  assert.ok((await row(d, u)).paid_until! > after.paid_until!);
});
