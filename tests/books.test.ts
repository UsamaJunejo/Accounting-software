import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.ts";
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

function setup() {
  const d = openDb(":memory:");
  const uid = createUser(d, { name: "Ali", email: "ali@example.com", passwordHash: "x" });
  const acc = (name: string) => accountsWithBalances(d, uid).find((a) => a.name === name)!.id;
  return { d, uid, acc };
}

test("new user gets default chart of accounts", () => {
  const { d, uid } = setup();
  const names = accountsWithBalances(d, uid).map((a) => a.name);
  for (const n of ["Cash", "Sales", "Rent", "Owner Capital", "JazzCash"]) assert.ok(names.includes(n), n);
});

test("balances, income statement and balance sheet add up", () => {
  const { d, uid, acc } = setup();
  const add = (type: "payment" | "receipt" | "transfer", date: string, rs: number, from: string, to: string) =>
    addTransaction(d, uid, { type, date, amount: rs * 100, fromAccountId: acc(from), toAccountId: acc(to) });

  add("receipt", "2026-01-01", 100000, "Owner Capital", "Cash"); // owner puts in 1 lakh
  add("receipt", "2026-01-05", 30000, "Sales", "Cash"); // cash sale
  add("payment", "2026-01-10", 20000, "Cash", "Rent"); // pay rent
  add("transfer", "2026-01-11", 50000, "Cash", "Bank Account"); // deposit

  const bal = Object.fromEntries(accountsWithBalances(d, uid).map((a) => [a.name, a.balance / 100]));
  assert.equal(bal["Cash"], 60000);
  assert.equal(bal["Bank Account"], 50000);
  assert.equal(bal["Sales"], 30000);
  assert.equal(bal["Rent"], 20000);
  assert.equal(bal["Owner Capital"], 100000);

  const is = incomeStatement(d, uid, "2026-01-01", "2026-01-31");
  assert.equal(is.profit, 10000 * 100);

  const bs = balanceSheet(d, uid, "2026-12-31");
  assert.equal(bs.totalAssets, 110000 * 100);
  assert.ok(bs.balanced);
  assert.equal(bs.netWorth, 110000 * 100);
});

test("account statement has opening and running balance", () => {
  const { d, uid, acc } = setup();
  addTransaction(d, uid, { type: "receipt", date: "2026-01-01", amount: 1000, fromAccountId: acc("Sales"), toAccountId: acc("Cash") });
  addTransaction(d, uid, { type: "receipt", date: "2026-02-01", amount: 500, fromAccountId: acc("Sales"), toAccountId: acc("Cash") });
  addTransaction(d, uid, { type: "payment", date: "2026-02-02", amount: 200, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  const s = accountStatement(d, uid, acc("Cash"), "2026-02-01", "2026-02-28");
  assert.equal(s.opening, 1000);
  assert.deepEqual(s.lines.map((l) => l.balance), [1500, 1300]);
  assert.equal(s.closing, 1300);
});

test("deleted entries leave balances and go to the deleted log", () => {
  const { d, uid, acc } = setup();
  const id = addTransaction(d, uid, { type: "payment", date: "2026-01-01", amount: 999, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  deleteTransaction(d, uid, id);
  assert.equal(accountsWithBalances(d, uid).find((a) => a.name === "Rent")!.balance, 0);
  assert.equal(listTransactions(d, uid, { deleted: true }).length, 1);
});

test("rejects bad entries and protects other users' data", () => {
  const { d, uid, acc } = setup();
  const other = createUser(d, { name: "B", email: "b@example.com", passwordHash: "x" });
  const base = { type: "payment" as const, date: "2026-01-01", amount: 100, fromAccountId: acc("Cash"), toAccountId: acc("Rent") };
  assert.throws(() => addTransaction(d, uid, { ...base, amount: 0 }));
  assert.throws(() => addTransaction(d, uid, { ...base, toAccountId: base.fromAccountId }));
  assert.throws(() => addTransaction(d, other, base), /Not found/);
  assert.throws(() => deleteAccount(d, other, acc("Cash")), /Not found/);
});

test("used accounts cannot be deleted, new ones can", () => {
  const { d, uid, acc } = setup();
  addTransaction(d, uid, { type: "payment", date: "2026-01-01", amount: 100, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  assert.throws(() => deleteAccount(d, uid, acc("Rent")));
  const sub = subcategories(d, uid).find((s) => s.name === "Customers (Khata)")!;
  const id = addAccount(d, uid, sub.id, "Ahmed Traders", { phone: "03001234567" });
  deleteAccount(d, uid, id);
});

import { money, toPaisa, monthRange } from "../lib/format.ts";

test("money formatting and parsing", () => {
  assert.equal(money(12345678), "123,456.78");
  assert.equal(money(-150000), "(1,500.00)");
  assert.equal(toPaisa("1,500.5"), 150050);
  assert.ok(Number.isNaN(toPaisa("abc")));
  assert.ok(Number.isNaN(toPaisa("-5")));
  assert.deepEqual(monthRange("2024-02-10"), ["2024-02-01", "2024-02-29"]);
});
