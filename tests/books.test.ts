import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import {
  accountStatement,
  accountsWithBalances,
  addAccount,
  addTransaction,
  balanceSheet,
  createUser,
  deleteAccount,
  deleteTransaction,
  incomeStatement,
  listTransactions,
  subcategories,
} from "../lib/books.ts";

async function setup() {
  const d = await openPglite();
  const uid = await createUser(d, { name: "Ali", email: "ali@example.com", passwordHash: "x" });
  const ids = new Map((await accountsWithBalances(d, uid)).map((a) => [a.name, a.id]));
  const acc = (name: string) => ids.get(name)!;
  return { d, uid, acc };
}

test("new user gets default chart of accounts", async () => {
  const { d, uid } = await setup();
  const names = (await accountsWithBalances(d, uid)).map((a) => a.name);
  for (const n of ["Cash", "Sales", "Rent", "Owner Capital", "JazzCash"]) assert.ok(names.includes(n), n);
});

test("balances, income statement and balance sheet add up", async () => {
  const { d, uid, acc } = await setup();
  const add = async (type: "payment" | "receipt" | "transfer", date: string, rs: number, from: string, to: string) =>
    await addTransaction(d, uid, { type, date, amount: rs * 100, fromAccountId: acc(from), toAccountId: acc(to) });

  await add("receipt", "2026-01-01", 100000, "Owner Capital", "Cash"); // owner puts in 1 lakh
  await add("receipt", "2026-01-05", 30000, "Sales", "Cash"); // cash sale
  await add("payment", "2026-01-10", 20000, "Cash", "Rent"); // pay rent
  await add("transfer", "2026-01-11", 50000, "Cash", "Bank Account"); // deposit

  const bal = Object.fromEntries((await accountsWithBalances(d, uid)).map((a) => [a.name, a.balance / 100]));
  assert.equal(bal["Cash"], 60000);
  assert.equal(bal["Bank Account"], 50000);
  assert.equal(bal["Sales"], 30000);
  assert.equal(bal["Rent"], 20000);
  assert.equal(bal["Owner Capital"], 100000);

  const is = await incomeStatement(d, uid, "2026-01-01", "2026-01-31");
  assert.equal(is.profit, 10000 * 100);

  const bs = await balanceSheet(d, uid, "2026-12-31");
  assert.equal(bs.totalAssets, 110000 * 100);
  assert.ok(bs.balanced);
  assert.equal(bs.netWorth, 110000 * 100);
});

test("account statement has opening and running balance", async () => {
  const { d, uid, acc } = await setup();
  await addTransaction(d, uid, { type: "receipt", date: "2026-01-01", amount: 1000, fromAccountId: acc("Sales"), toAccountId: acc("Cash") });
  await addTransaction(d, uid, { type: "receipt", date: "2026-02-01", amount: 500, fromAccountId: acc("Sales"), toAccountId: acc("Cash") });
  await addTransaction(d, uid, { type: "payment", date: "2026-02-02", amount: 200, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  const s = await accountStatement(d, uid, acc("Cash"), "2026-02-01", "2026-02-28");
  assert.equal(s.opening, 1000);
  assert.deepEqual(s.lines.map((l) => l.balance), [1500, 1300]);
  assert.equal(s.closing, 1300);
});

test("deleted entries leave balances and go to the deleted log", async () => {
  const { d, uid, acc } = await setup();
  const id = await addTransaction(d, uid, { type: "payment", date: "2026-01-01", amount: 999, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  await deleteTransaction(d, uid, id);
  assert.equal((await accountsWithBalances(d, uid)).find((a) => a.name === "Rent")!.balance, 0);
  assert.equal((await listTransactions(d, uid, { deleted: true })).length, 1);
});

test("rejects bad entries and protects other users' data", async () => {
  const { d, uid, acc } = await setup();
  const other = await createUser(d, { name: "B", email: "b@example.com", passwordHash: "x" });
  const base = { type: "payment" as const, date: "2026-01-01", amount: 100, fromAccountId: acc("Cash"), toAccountId: acc("Rent") };
  await assert.rejects(() => addTransaction(d, uid, { ...base, amount: 0 }));
  await assert.rejects(() => addTransaction(d, uid, { ...base, toAccountId: base.fromAccountId }));
  await assert.rejects(() => addTransaction(d, other, base), /Not found/);
  await assert.rejects(() => deleteAccount(d, other, acc("Cash")), /Not found/);
});

test("used accounts cannot be deleted, new ones can", async () => {
  const { d, uid, acc } = await setup();
  await addTransaction(d, uid, { type: "payment", date: "2026-01-01", amount: 100, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  await assert.rejects(() => deleteAccount(d, uid, acc("Rent")));
  const sub = (await subcategories(d, uid)).find((s) => s.name === "Customers (Khata)")!;
  const id = await addAccount(d, uid, sub.id, "Ahmed Traders", { phone: "03001234567" });
  await deleteAccount(d, uid, id);
});

import { money, toPaisa, monthRange } from "../lib/format.ts";

test("money formatting and parsing", async () => {
  assert.equal(money(12345678), "123,456.78");
  assert.equal(money(-150000), "(1,500.00)");
  assert.equal(toPaisa("1,500.5"), 150050);
  assert.ok(Number.isNaN(toPaisa("abc")));
  assert.ok(Number.isNaN(toPaisa("-5")));
  assert.deepEqual(monthRange("2024-02-10"), ["2024-02-01", "2024-02-29"]);
});

import { monthlyTotals } from "../lib/books.ts";

test("monthly totals match the profit & loss report", async () => {
  const { d, uid, acc } = await setup();
  const add = (date: string, amount: number, from: string, to: string) =>
    addTransaction(d, uid, { type: "payment", date, amount, fromAccountId: acc(from), toAccountId: acc(to) });
  await add("2026-01-03", 5000, "Sales", "Cash");
  await add("2026-01-04", 1200, "Cash", "Rent");
  await add("2026-02-10", 700, "Cash", "Fuel");
  await add("2026-02-11", 100, "Fuel", "Cash"); // refund
  const m = await monthlyTotals(d, uid, "2026-01-01", "2026-02-28");
  for (const [month, from, to] of [["2026-01", "2026-01-01", "2026-01-31"], ["2026-02", "2026-02-01", "2026-02-28"]]) {
    const is = await incomeStatement(d, uid, from, to);
    assert.equal(m.get(month)?.income ?? 0, is.totalIncome, month);
    assert.equal(m.get(month)?.expense ?? 0, is.totalExpense, month);
  }
});
