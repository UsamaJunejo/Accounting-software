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
