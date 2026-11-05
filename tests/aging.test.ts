import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import { accountsWithBalances, addAccount, addTransaction, createUser, subcategories } from "../lib/books.ts";
import { receivableAging } from "../lib/aging.ts";
import { createInvoice, getInvoice, invoiceStatus, recordInvoicePayment, cancelInvoice } from "../lib/invoices.ts";

async function setup() {
  const d = await openPglite();
  const uid = await createUser(d, { name: "A", email: "a@x.pk", passwordHash: "x" });
  const sub = (await subcategories(d, uid)).find((s) => s.name.startsWith("Customers"))!;
  const ahmed = await addAccount(d, uid, sub.id, "Ahmed");
  const ids = new Map((await accountsWithBalances(d, uid)).map((a) => [a.name, a.id]));
  return { d, uid, ahmed, acc: (n: string) => ids.get(n)! };
}

test("aging matches payments to the oldest charges first", async () => {
  const { d, uid, ahmed, acc } = await setup();
  const sale = (date: string, amount: number) => addTransaction(d, uid, { type: "transfer", date, amount, fromAccountId: acc("Sales"), toAccountId: ahmed });
  await sale("2026-01-01", 10000); // 120+ days old by May
  await sale("2026-03-20", 5000); // ~45 days
  await sale("2026-04-25", 2000); // ~10 days
  await addTransaction(d, uid, { type: "receipt", date: "2026-04-01", amount: 7000, fromAccountId: ahmed, toAccountId: acc("Cash") });
  const [r] = await receivableAging(d, uid, "2026-05-05");
  assert.deepEqual([r.balance, r.b90, r.b30, r.b0], [10000, 3000, 5000, 2000]);
  assert.equal(r.oldest, "2026-01-01");
  assert.equal(r.lastPayment, "2026-04-01");
});

test("invoice payments update status, khata and cash; can't overpay", async () => {
  const { d, uid, acc } = await setup();
  const id = await createInvoice(d, uid, { customerName: "Bilal", date: "2026-05-01", dueDate: "2026-05-10", items: [{ name: "Cement", qty: 10, price: 1000 }], record: true });
  let inv = (await getInvoice(d, uid, id))!;
  assert.equal(invoiceStatus(inv, "2026-05-05"), "unpaid");
  assert.equal(invoiceStatus(inv, "2026-05-11"), "overdue");
  await recordInvoicePayment(d, uid, id, { amount: 4000, date: "2026-05-06", intoAccountId: acc("Cash") });
  inv = (await getInvoice(d, uid, id))!;
  assert.equal(inv.paid, 4000);
  assert.equal(invoiceStatus(inv, "2026-05-07"), "part");
  await assert.rejects(() => recordInvoicePayment(d, uid, id, { amount: 6001, date: "2026-05-07", intoAccountId: acc("Cash") }), /more than/);
  await recordInvoicePayment(d, uid, id, { amount: 6000, date: "2026-05-07", intoAccountId: acc("Bank Account") });
  inv = (await getInvoice(d, uid, id))!;
  assert.equal(invoiceStatus(inv, "2026-06-01"), "paid");
  const bal = Object.fromEntries((await accountsWithBalances(d, uid)).map((a) => [a.name, a.balance]));
  assert.deepEqual([bal["Bilal"], bal["Cash"], bal["Bank Account"]], [0, 4000, 6000]);
  await cancelInvoice(d, uid, id);
  const after = Object.fromEntries((await accountsWithBalances(d, uid)).map((a) => [a.name, a.balance]));
  assert.deepEqual([after["Bilal"], after["Cash"], after["Sales"]], [0, 0, 0]);
});
