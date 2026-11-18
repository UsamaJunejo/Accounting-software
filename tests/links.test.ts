// Linked things stay connected: invoices, stock and khata can't drift apart through ordinary edits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import * as B from "../lib/books.ts";
import * as I from "../lib/items.ts";
import * as V from "../lib/invoices.ts";

async function fresh() {
  const d = await openPglite();
  const uid = await B.createUser(d, { name: "Shop", email: `a${Math.random()}@x.pk`, passwordHash: "x" });
  const accs = await B.accountsWithBalances(d, uid);
  const acc = (n: string) => accs.find((a) => a.name === n)!.id;
  const bal = async () => Object.fromEntries((await B.accountsWithBalances(d, uid)).map((a) => [a.name, a.balance]));
  const stockMatches = async () => {
    const b = Object.values(await B.accountsWithBalances(d, uid)).find((a) => a.system === "stock")!.balance;
    const items = (await I.listItems(d, uid, { archived: true })).reduce((s, i) => s + i.value, 0);
    assert.equal(b, items, "Stock account = value of items");
  };
  return { d, uid, acc, bal, stockMatches };
}
const invoice = (d: Awaited<ReturnType<typeof fresh>>["d"], uid: number, extra: Partial<V.InvoiceInput> = {}) =>
  V.createInvoice(d, uid, { customerName: "Ahmed", date: "2026-05-01", items: [{ name: "Cement", qty: 1, price: 5000_00 }], record: true, ...extra });

test("an invoice's entries can only be changed from the invoice", async () => {
  const { d, uid } = await fresh();
  const inv = (await V.getInvoice(d, uid, await invoice(d, uid)))!;
  const t = (await B.getTransaction(d, uid, inv.transaction_id!))!;
  assert.equal(t.source_kind, "invoice");
  assert.equal(t.source_id, inv.id);
  await assert.rejects(() => B.deleteTransaction(d, uid, t.id), /invoice #1/);
  await assert.rejects(
    () => B.updateTransaction(d, uid, t.id, { type: t.type, date: t.date, amount: 3000_00, fromAccountId: t.from_account_id, toAccountId: t.to_account_id }),
    /invoice #1/,
  );
  // Cancelling the invoice removes them, and they can't be brought back on their own.
  await V.cancelInvoice(d, uid, inv.id);
  await assert.rejects(() => B.restoreTransaction(d, uid, t.id), /invoice #1/);
});

test("a payment on an invoice can be deleted (not edited); the invoice follows", async () => {
  const { d, uid, acc } = await fresh();
  const id = await invoice(d, uid);
  await V.recordInvoicePayment(d, uid, id, { amount: 2000_00, date: "2026-05-02", intoAccountId: acc("Cash") });
  const [{ t }] = await d.q<{ t: number }>("SELECT transaction_id AS t FROM invoice_payments WHERE invoice_id = $1", [id]);
  const p = (await B.getTransaction(d, uid, t))!;
  await assert.rejects(
    () => B.updateTransaction(d, uid, t, { type: p.type, date: p.date, amount: 1_00, fromAccountId: p.from_account_id, toAccountId: p.to_account_id }),
    /payment on invoice/,
  );
  await B.deleteTransaction(d, uid, t);
  assert.equal((await V.getInvoice(d, uid, id))!.paid, 0);
});

test("stock entries can only be changed from the Stock page", async () => {
  const { d, uid, acc, stockMatches } = await fresh();
  const lap = await I.addItem(d, uid, { name: "Laptop", costPrice: 100_000_00, openingQty: 5 }, "2026-05-01");
  await I.sellStock(d, uid, lap, { qty: 1, total: 120_000_00, date: "2026-05-02", intoAccountId: acc("Cash") });
  await I.addStock(d, uid, lap, { qty: 2, total: 190_000_00, date: "2026-05-03", fromAccountId: acc("Cash") });
  const moves = await d.q<{ t1: number | null; t2: number | null }>("SELECT transaction_id AS t1, cost_transaction_id AS t2 FROM stock_moves WHERE item_id = $1", [lap]);
  const ids = moves.flatMap((m) => [m.t1, m.t2]).filter((x): x is number => !!x);
  assert.ok(ids.length >= 4);
  for (const id of ids) {
    const t = (await B.getTransaction(d, uid, id))!;
    assert.equal(t.source_kind, "item");
    await assert.rejects(() => B.deleteTransaction(d, uid, id), /Stock page for Laptop/);
    await assert.rejects(
      () => B.updateTransaction(d, uid, id, { type: t.type, date: t.date, amount: 1_00, fromAccountId: t.from_account_id, toAccountId: t.to_account_id }),
      /Stock page/,
    );
  }
  await stockMatches();
});

test("the Stock account only changes through stock, and survives a rename", async () => {
  const { d, uid, acc, stockMatches } = await fresh();
  const stock = acc("Stock");
  await assert.rejects(
    () => B.addTransaction(d, uid, { type: "payment", date: "2026-05-01", amount: 7_000_00, fromAccountId: acc("Cash"), toAccountId: stock }),
    /Stock page/,
  );
  await assert.rejects(() => B.addOpeningBalance(d, uid, stock, 50_000_00, "2026-01-01"), /Stock page/);
  await assert.rejects(() => B.deleteAccount(d, uid, stock), /can't be deleted/);
  await assert.rejects(() => B.deleteAccountWithEntries(d, uid, stock), /can't be deleted/);
  const sub = (await B.subcategories(d, uid)).find((s) => s.name === "Stock / Inventory")!;
  await assert.rejects(() => B.updateAccount(d, uid, stock, { name: "Stock", subcategoryId: sub.id, archived: true }), /can't be archived/);
  // Renamed: stock still goes into it, no second "Stock" account appears.
  await B.updateAccount(d, uid, stock, { name: "Goods in shop", subcategoryId: sub.id });
  const rice = await I.addItem(d, uid, { name: "Rice" }, "2026-05-01");
  await I.addStock(d, uid, rice, { qty: 10, total: 10_000_00, date: "2026-05-02", fromAccountId: acc("Cash") });
  const b = await (async () => Object.fromEntries((await B.accountsWithBalances(d, uid)).map((a) => [a.name, a.balance])))();
  assert.equal(b["Goods in shop"], 10_000_00);
  assert.ok(!("Stock" in b));
  await stockMatches();
});

test("an invoice with stock items is always put in the books", async () => {
  const { d, uid, bal, stockMatches } = await fresh();
  const lap = await I.addItem(d, uid, { name: "Laptop", costPrice: 100_000_00, openingQty: 5 }, "2026-05-01");
  await V.createInvoice(d, uid, { customerName: "Walk-in", date: "2026-05-02", items: [{ name: "Laptop", qty: 1, price: 120_000_00, itemId: lap }], record: false });
  const b = await bal();
  assert.equal(Math.abs(b["Sales"]), 120_000_00); // the sale is in, next to its cost
  assert.equal(b["Cost of goods sold"], 100_000_00);
  await stockMatches();
});

test("cancelling a paid khata invoice keeps the money as the customer's credit", async () => {
  const { d, uid, acc, bal } = await fresh();
  const id = await invoice(d, uid);
  await V.recordInvoicePayment(d, uid, id, { amount: 5000_00, date: "2026-05-02", intoAccountId: acc("Cash") });
  await V.cancelInvoice(d, uid, id);
  const b = await bal();
  assert.equal(b["Cash"], 5000_00);
  assert.equal(b["Ahmed"], -5000_00); // an advance: it pays their next invoice
  const next = await invoice(d, uid, { date: "2026-05-05" });
  assert.equal(V.invoiceStatus((await V.getInvoice(d, uid, next))!, "2026-05-06"), "paid");
});

test("selling on udhaar goes through an invoice; customers with invoices can't be deleted", async () => {
  const { d, uid } = await fresh();
  const cust = await B.addAccount(d, uid, (await B.subcategories(d, uid)).find((s) => s.name === "Customers (Khata)")!.id, "Bilal");
  const lap = await I.addItem(d, uid, { name: "Laptop", costPrice: 100_000_00, openingQty: 5 }, "2026-05-01");
  await assert.rejects(() => I.sellStock(d, uid, lap, { qty: 1, total: 120_000_00, date: "2026-05-02", intoAccountId: cust }), /Make an invoice/);
  const id = await invoice(d, uid);
  const inv = (await V.getInvoice(d, uid, id))!;
  await assert.rejects(() => B.deleteAccountWithEntries(d, uid, inv.customer_account_id!), /Cancel it first/);
  await V.cancelInvoice(d, uid, id);
  await B.deleteAccountWithEntries(d, uid, inv.customer_account_id!);
});

test("books still balance with stock and invoices", async () => {
  const { d, uid, acc, stockMatches } = await fresh();
  const lap = await I.addItem(d, uid, { name: "Laptop", costPrice: 100_000_00, openingQty: 5 }, "2026-05-01");
  await I.sellStock(d, uid, lap, { qty: 1, total: 120_000_00, date: "2026-05-02", intoAccountId: acc("Cash") });
  await invoice(d, uid, { items: [{ name: "Laptop", qty: 2, price: 125_000_00, itemId: lap }] });
  await stockMatches();
  assert.ok((await B.balanceSheet(d, uid, "2026-12-31")).balanced);
});
