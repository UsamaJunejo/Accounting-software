import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import { accountsWithBalances, createUser, listTransactions } from "../lib/books.ts";
import { addSchedule, advance, dueReminders, listSchedules, postReminder, runDueSchedules, skipReminder } from "../lib/schedules.ts";

async function setup() {
  const d = await openPglite();
  const uid = await createUser(d, { name: "A", email: "a@x.pk", passwordHash: "x" });
  const ids = new Map((await accountsWithBalances(d, uid)).map((a) => [a.name, a.id]));
  return { d, uid, acc: (n: string) => ids.get(n)! };
}

test("next dates: weekly, monthly keeps the 31st, yearly", () => {
  assert.equal(advance("2026-01-28", "weekly"), "2026-02-04");
  assert.equal(advance("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(advance("2026-02-28", "monthly", 31), "2026-03-31");
  assert.equal(advance("2026-12-15", "monthly"), "2027-01-15");
  assert.equal(advance("2028-02-29", "yearly"), "2029-02-28");
});

test("automatic schedule catches up on every missed month, and stops at the end date", async () => {
  const { d, uid, acc } = await setup();
  await addSchedule(d, uid, { type: "payment", amount: 3500000, fromAccountId: acc("Cash"), toAccountId: acc("Rent"), note: "Shop rent", frequency: "monthly", startDate: "2026-01-01", endDate: "2026-04-30", auto: true });
  assert.equal(await runDueSchedules(d, uid, "2026-03-15"), 3); // Jan, Feb, Mar
  assert.equal(await runDueSchedules(d, uid, "2026-03-15"), 0); // nothing twice
  assert.equal(await runDueSchedules(d, uid, "2026-12-31"), 1); // Apr, then ends
  const rent = (await accountsWithBalances(d, uid)).find((a) => a.name === "Rent")!;
  assert.equal(rent.balance, 4 * 3500000);
  assert.equal((await listSchedules(d, uid))[0].active, false);
  assert.deepEqual((await listTransactions(d, uid)).map((t) => t.date).sort(), ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
});

test("reminders don't add by themselves; Add now and Skip work", async () => {
  const { d, uid, acc } = await setup();
  const id = await addSchedule(d, uid, { type: "payment", amount: 1000, fromAccountId: acc("Cash"), toAccountId: acc("Electricity"), frequency: "monthly", startDate: "2026-05-10", auto: false });
  assert.equal(await runDueSchedules(d, uid, "2026-06-30"), 0);
  assert.equal((await dueReminders(d, uid, "2026-05-08")).length, 1); // due within 3 days
  await postReminder(d, uid, id);
  assert.equal((await listTransactions(d, uid)).length, 1);
  await skipReminder(d, uid, id);
  assert.equal((await listSchedules(d, uid))[0].next_date, "2026-07-10");
  const other = await createUser(d, { name: "B", email: "b@x.pk", passwordHash: "x" });
  await assert.rejects(() => postReminder(d, other, id));
  await assert.rejects(() => addSchedule(d, other, { type: "payment", amount: 1, fromAccountId: acc("Cash"), toAccountId: acc("Rent"), frequency: "monthly", startDate: "2026-05-10", auto: true }));
});

import { getNotifications, urgentCount } from "../lib/notifications.ts";
test("bell count matches the urgent notifications", async () => {
  const { d, uid, acc } = await setup();
  await addSchedule(d, uid, { type: "payment", amount: 500, fromAccountId: acc("Cash"), toAccountId: acc("Electricity"), frequency: "monthly", startDate: "2026-05-01", auto: false });
  const list = await getNotifications(d, uid, "2026-05-02");
  assert.equal(await urgentCount(d, uid, "2026-05-02", false), list.filter((n) => n.urgent).length);
  assert.equal(await urgentCount(d, uid, "2026-05-02", false), 1);
});
