import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import { accountsWithBalances, createUser } from "../lib/books.ts";
import { cancelInvoice, createInvoice, getInvoice, getInvoiceByToken, invoiceTotals, listInvoices } from "../lib/invoices.ts";

test("invoice totals with discount and GST", () => {
  const t = invoiceTotals([{ name: "Cement", qty: 10, price: 150000 }, { name: "Delivery", qty: 1, price: 50000 }], 18, 50000);
  assert.deepEqual(t, { subtotal: 1550000, taxable: 1500000, tax: 270000, total: 1770000 });
});

test("recorded invoice puts the customer in khata, sales and tax in the right places", async () => {
  const d = await openPglite();
  const uid = await createUser(d, { name: "Shop", email: "s@x.pk", passwordHash: "x" });
  const id = await createInvoice(d, uid, {
    customerName: "Ahmed Traders", customerPhone: "03001234567", date: "2026-05-01",
    items: [{ name: "Cement", qty: 10, price: 150000 }], taxPercent: 18, record: true,
  });
  const bal = () => accountsWithBalances(d, uid).then((a) => Object.fromEntries(a.map((x) => [x.name, x.balance])));
  let b = await bal();
  assert.equal(b["Ahmed Traders"], 1770000);
  assert.equal(b["Sales"], 1500000);
  assert.equal(b["Sales Tax Payable"], 270000);
  const inv = (await getInvoice(d, uid, id))!;
  assert.equal(inv.number, 1);
  assert.equal(inv.items[0].name, "Cement");
  assert.equal((await getInvoiceByToken(d, inv.share_token))!.id, id);
  assert.equal(await getInvoiceByToken(d, "nope"), undefined);
  // second invoice to the same customer reuses the khata account and gets number 2
  await createInvoice(d, uid, { customerName: "ahmed traders", date: "2026-05-02", items: [{ name: "Sand", qty: 1, price: 1000 }], record: true });
  assert.equal((await listInvoices(d, uid))[0].number, 2);
  assert.equal((await accountsWithBalances(d, uid)).filter((a) => a.name.toLowerCase() === "ahmed traders").length, 1);
  await cancelInvoice(d, uid, id);
  b = await bal();
  assert.equal(b["Ahmed Traders"], 1000);
  assert.equal(b["Sales Tax Payable"], 0);
});

test("invoice validation and privacy", async () => {
  const d = await openPglite();
  const uid = await createUser(d, { name: "Shop", email: "s@x.pk", passwordHash: "x" });
  const other = await createUser(d, { name: "B", email: "b@x.pk", passwordHash: "x" });
  await assert.rejects(() => createInvoice(d, uid, { customerName: "A", date: "2026-05-01", items: [], record: false }), /at least one/);
  await assert.rejects(() => createInvoice(d, uid, { customerName: "", date: "2026-05-01", items: [{ name: "x", qty: 1, price: 1 }], record: false }), /name/);
  const id = await createInvoice(d, uid, { customerName: "Walk-in", date: "2026-05-01", items: [{ name: "x", qty: 2, price: 500 }], record: false });
  assert.equal(await getInvoice(d, other, id), undefined);
  // not recorded = books unchanged
  assert.equal((await accountsWithBalances(d, uid)).every((a) => a.balance === 0), true);
});

test("paying through khata marks invoices paid, oldest first; a payment on an invoice stays with it", async () => {
  const { addTransaction, invoiceStatus } = { ...(await import("../lib/books.ts")), ...(await import("../lib/invoices.ts")) };
  const { recordInvoicePayment } = await import("../lib/invoices.ts");
  const d = await openPglite();
  const uid = await createUser(d, { name: "Shop", email: "k@x.pk", passwordHash: "x" });
  const i1 = await createInvoice(d, uid, { customerName: "Bilal", date: "2026-05-01", items: [{ name: "A", qty: 1, price: 100000 }], record: true });
  const cust = (await getInvoice(d, uid, i1))!.customer_account_id!;
  const i2 = await createInvoice(d, uid, { customerAccountId: cust, date: "2026-05-02", items: [{ name: "B", qty: 1, price: 50000 }], record: true });
  const i3 = await createInvoice(d, uid, { customerAccountId: cust, date: "2026-05-03", items: [{ name: "C", qty: 1, price: 30000 }], record: true });
  const cash = (await accountsWithBalances(d, uid)).find((a) => a.role === "cash")!.id;
  // Rs 300 recorded on invoice #3; Rs 1,200 paid in khata (not on any invoice)
  await recordInvoicePayment(d, uid, i3, { amount: 30000, date: "2026-05-04", intoAccountId: cash });
  await addTransaction(d, uid, { type: "receipt", date: "2026-05-05", amount: 120000, fromAccountId: cust, toAccountId: cash });
  const get = async (id: number) => (await getInvoice(d, uid, id))!;
  assert.equal((await get(i1)).paid, 100000); // oldest paid first
  assert.equal((await get(i2)).paid, 20000); // the rest of the 1,200
  assert.equal((await get(i3)).paid, 30000); // its own payment
  assert.equal(invoiceStatus(await get(i1), "2026-05-06"), "paid");
  assert.equal(invoiceStatus(await get(i2), "2026-05-06"), "part");
  assert.equal((await get(i2)).paidKhata, 20000);
  assert.equal((await listInvoices(d, uid)).find((x) => x.id === i1)!.paid, 100000);
  // cancelling the oldest moves the khata money to the next one
  await cancelInvoice(d, uid, i1);
  assert.equal((await get(i2)).paid, 50000);
});
