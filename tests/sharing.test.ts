import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import { accountsWithBalances, addAccount, addTransaction, createUser, subcategories } from "../lib/books.ts";
import {
  approveSharedEntry, pendingForOwner, rejectSharedEntry, respondToShare, shareAccount, sharedStatement,
  sharedWithMe, sharingBadge, submitSharedEntry,
} from "../lib/sharing.ts";

async function setup() {
  const d = await openPglite();
  const shop = await createUser(d, { name: "Shop", email: "shop@x.pk", passwordHash: "x" });
  const cust = await createUser(d, { name: "Ahmed", email: "ahmed@x.pk", passwordHash: "x" });
  const sub = (await subcategories(d, shop)).find((s) => s.name.startsWith("Customers"))!;
  const khata = await addAccount(d, shop, sub.id, "Ahmed Traders");
  const accs = await accountsWithBalances(d, shop);
  const id = (n: string) => accs.find((a) => a.name === n)!.id;
  // Ahmed bought on credit for 10,000
  await addTransaction(d, shop, { type: "transfer", date: "2026-03-01", amount: 1_000_000, fromAccountId: id("Sales"), toAccountId: khata, note: "10 bags" });
  return { d, shop, cust, khata, cash: id("Cash"), sales: id("Sales") };
}

test("share, accept, view without seeing the owner's other accounts", async () => {
  const { d, shop, cust, khata } = await setup();
  await shareAccount(d, shop, khata, "AHMED@x.pk", true);
  assert.equal(await sharingBadge(d, cust), 1);
  await assert.rejects(() => sharedStatement(d, cust, 1, "2026-01-01", "2026-12-31")); // not accepted yet
  const [inv] = await sharedWithMe(d, cust);
  await respondToShare(d, cust, inv.id, true);
  const [mine] = await sharedWithMe(d, cust);
  assert.equal(mine.balance, 1_000_000);
  const st = await sharedStatement(d, cust, inv.id, "2026-01-01", "2026-12-31");
  assert.equal(st.closing, 1_000_000);
  assert.equal(JSON.stringify(st.lines).includes("Sales"), false);
});

test("customer suggests a payment, owner approves into Cash", async () => {
  const { d, shop, cust, khata, cash } = await setup();
  await shareAccount(d, shop, khata, "ahmed@x.pk", true);
  const [s] = await sharedWithMe(d, cust);
  await respondToShare(d, cust, s.id, true);
  await submitSharedEntry(d, cust, s.id, { direction: "decrease", amount: 400_000, date: "2026-03-05", note: "Paid by JazzCash" });
  assert.equal(await sharingBadge(d, shop), 1);
  const [p] = await pendingForOwner(d, shop);
  await assert.rejects(() => approveSharedEntry(d, cust, p.id, cash)); // only the owner may approve
  await approveSharedEntry(d, shop, p.id, cash);
  const bal = Object.fromEntries((await accountsWithBalances(d, shop)).map((a) => [a.name, a.balance]));
  assert.equal(bal["Ahmed Traders"], 600_000);
  assert.equal(bal["Cash"], 400_000);
  assert.equal(await sharingBadge(d, shop), 0);
  await assert.rejects(() => approveSharedEntry(d, shop, p.id, cash)); // can't approve twice
});

test("rejected entries change nothing; view-only shares can't add", async () => {
  const { d, shop, cust, khata } = await setup();
  await shareAccount(d, shop, khata, "ahmed@x.pk", true);
  const [s] = await sharedWithMe(d, cust);
  await respondToShare(d, cust, s.id, true);
  await submitSharedEntry(d, cust, s.id, { direction: "decrease", amount: 999, date: "2026-03-05" });
  const [p] = await pendingForOwner(d, shop);
  await rejectSharedEntry(d, shop, p.id, "Not received");
  const st = await sharedStatement(d, cust, s.id, "2026-01-01", "2026-12-31");
  assert.equal(st.closing, 1_000_000);
  assert.equal(st.submissions[0].status, "rejected");
  await shareAccount(d, shop, khata, "ahmed@x.pk", false);
  await assert.rejects(() => submitSharedEntry(d, cust, s.id, { direction: "decrease", amount: 1, date: "2026-03-05" }), /only view/);
});

test("can't share with unknown people, yourself, or someone else's account", async () => {
  const { d, shop, cust, khata } = await setup();
  await assert.rejects(() => shareAccount(d, shop, khata, "nobody@x.pk", false), /No FinanceChachu user/);
  await assert.rejects(() => shareAccount(d, shop, khata, "shop@x.pk", false), /yourself/);
  await assert.rejects(() => shareAccount(d, cust, khata, "shop@x.pk", false), /not found/);
});
