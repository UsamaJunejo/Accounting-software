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
  assert.equal(money(-150000), "−1,500.00");
  assert.equal(money(-150000, { brackets: true }), "(1,500.00)");
  assert.equal(money(12345678, { style: "lakh" }), "1,23,456.78");
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

import { newRecoveryCode, normalizeRecoveryCode, isLimited, recordFailure } from "../lib/security.ts";

test("recovery codes are readable and forgiving to type", () => {
  const c = newRecoveryCode();
  assert.match(c, /^FC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, " ")), c);
  assert.equal(normalizeRecoveryCode("FC-123"), "");
});

test("too many failed logins are blocked", async () => {
  const { d } = await setup();
  for (let i = 0; i < 7; i++) await recordFailure(d, "login:a@b.pk");
  assert.equal(await isLimited(d, "login:a@b.pk"), false);
  await recordFailure(d, "login:a@b.pk");
  assert.equal(await isLimited(d, "login:a@b.pk"), true);
  assert.equal(await isLimited(d, "login:other@b.pk"), false);
});

test("only the first user becomes admin", async () => {
  const { d, uid } = await setup();
  const other = await createUser(d, { name: "B", email: "b2@example.com", passwordHash: "x" });
  const rows = await d.q<{ id: number; is_admin: boolean }>("SELECT id, is_admin FROM users ORDER BY id");
  assert.deepEqual(rows, [{ id: uid, is_admin: true }, { id: other, is_admin: false }]);
});

import { friendlyDate } from "../lib/format.ts";
test("friendly dates", () => {
  assert.equal(friendlyDate("2026-05-10", "2026-05-10"), "Today");
  assert.equal(friendlyDate("2026-05-09", "2026-05-10"), "Yesterday");
  assert.equal(friendlyDate("2026-03-02", "2026-05-10"), "2 Mar");
  assert.equal(friendlyDate("2025-12-31", "2026-05-10"), "31 Dec 2025");
});

import { addOpeningBalance, cashBankDaily, categories, khata, renameCategory, statementColumns } from "../lib/books.ts";

test("entry type always follows the accounts, whatever tab was used", async () => {
  const { d, uid, acc } = await setup();
  // Picked "Money In" but chose Cash -> Rent: it is really money going out.
  const id = await addTransaction(d, uid, { type: "receipt", date: "2026-01-02", amount: 500, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  const rows = await listTransactions(d, uid, {});
  assert.equal(rows.find((r) => r.id === id)!.type, "payment");
  await addTransaction(d, uid, { type: "payment", date: "2026-01-02", amount: 500, fromAccountId: acc("Sales"), toAccountId: acc("Bank Account") });
  await addTransaction(d, uid, { type: "payment", date: "2026-01-02", amount: 500, fromAccountId: acc("Cash"), toAccountId: acc("JazzCash") });
  const types = (await listTransactions(d, uid, {})).map((r) => r.type).sort();
  assert.deepEqual(types, ["payment", "receipt", "transfer"]);
});

test("renaming categories does not break cash, bank or khata", async () => {
  const { d, uid, acc } = await setup();
  const cats = await categories(d, uid);
  for (const c of cats) await renameCategory(d, uid, c.id, c.name + " (mine)");
  await addTransaction(d, uid, { type: "receipt", date: "2026-01-01", amount: 7000, fromAccountId: acc("Owner Capital"), toAccountId: acc("Cash") });
  const flow = await cashBankDaily(d, uid, "2026-01-01", "2026-01-01");
  assert.equal(flow.days[0].balance, 7000);
  const sub = (await subcategories(d, uid)).find((s) => s.name === "Customers (Khata)")!;
  await addAccount(d, uid, sub.id, "Bilal");
  assert.deepEqual((await khata(d, uid)).map((k) => k.name), ["Bilal"]);
});

test("opening balances: customer owes, supplier is owed, books still balance", async () => {
  const { d, uid, acc } = await setup();
  const cust = await addAccount(d, uid, (await subcategories(d, uid)).find((s) => s.name === "Customers (Khata)")!.id, "Ahmed");
  const sup = await addAccount(d, uid, (await subcategories(d, uid)).find((s) => s.name === "Suppliers")!.id, "Cement Co");
  await addOpeningBalance(d, uid, cust, 500000, "2026-01-01");
  await addOpeningBalance(d, uid, sup, 200000, "2026-01-01");
  await addOpeningBalance(d, uid, acc("Cash"), 100000, "2026-01-01");
  const bal = Object.fromEntries((await accountsWithBalances(d, uid)).map((a) => [a.name, a.balance]));
  assert.equal(bal["Ahmed"], 500000);
  assert.equal(bal["Cement Co"], 200000);
  assert.equal(bal["Cash"], 100000);
  assert.equal(bal["Starting balance"], 400000);
  const bs = await balanceSheet(d, uid, "2026-12-31");
  assert.ok(bs.balanced);
  assert.equal(bs.netWorth, 400000);
});

test("statement columns add up for income and supplier accounts", async () => {
  const { d, uid, acc } = await setup();
  await addTransaction(d, uid, { type: "receipt", date: "2026-01-01", amount: 3000, fromAccountId: acc("Sales"), toAccountId: acc("Cash") });
  await addTransaction(d, uid, { type: "payment", date: "2026-01-02", amount: 1000, fromAccountId: acc("Cash"), toAccountId: acc("Sales") });
  const s = await accountStatement(d, uid, acc("Sales"), "2026-01-01", "2026-01-31");
  assert.deepEqual(statementColumns(s.account), ["Earned", "Returned"]);
  assert.deepEqual(s.lines.map((l) => [l.up, l.down, l.balance]), [[3000, 0, 3000], [0, 1000, 2000]]);
});

import { MIGRATIONS } from "../lib/db.ts";

test("upgrade fixes old entries saved with the wrong type", async () => {
  const { d, uid, acc } = await setup();
  const id = await addTransaction(d, uid, { type: "payment", date: "2026-01-02", amount: 500, fromAccountId: acc("Owner Capital"), toAccountId: acc("Cash") });
  await d.q("UPDATE transactions SET type = 'payment' WHERE id = $1", [id]); // how an old mix-up looked
  await d.q("UPDATE categories SET role = NULL WHERE user_id = $1", [uid]); // as before the upgrade
  await d.exec(MIGRATIONS[9]); // version 11
  assert.equal((await listTransactions(d, uid, {})).find((r) => r.id === id)!.type, "receipt");
  assert.equal((await categories(d, uid)).find((c) => c.name === "Cash")!.role, "cash");
});

import { checkBooks, deleteUser, fixEntryTypes, resetBooks } from "../lib/maintenance.ts";

test("books check finds cash below zero, double saves and wrong labels", async () => {
  const { d, uid, acc } = await setup();
  const pay = { type: "payment" as const, date: "2026-01-02", amount: 5000, fromAccountId: acc("Cash"), toAccountId: acc("Rent") };
  await addTransaction(d, uid, pay);
  await addTransaction(d, uid, pay);
  const id = await addTransaction(d, uid, { ...pay, toAccountId: acc("Fuel") });
  await d.q("UPDATE transactions SET type = 'receipt' WHERE id = $1", [id]);
  const text = (await checkBooks(d, uid, "2026-06-01")).map((i) => i.text).join("\n");
  assert.match(text, /Cash is below zero/);
  assert.match(text, /1 entries look saved twice/);
  assert.match(text, /1 entries are labelled/);
  assert.doesNotMatch(text, /does not balance/);
  assert.equal(await fixEntryTypes(d), 1);
  assert.doesNotMatch((await checkBooks(d, uid, "2026-06-01")).map((i) => i.text).join("\n"), /labelled/);
});

test("reset keeps or replaces accounts; delete removes the person", async () => {
  const { d, uid, acc } = await setup();
  const other = await createUser(d, { name: "B", email: "b3@example.com", passwordHash: "x" });
  await addTransaction(d, uid, { type: "payment", date: "2026-01-02", amount: 100, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  await addAccount(d, uid, (await subcategories(d, uid))[0].id, "My extra account");
  await resetBooks(d, uid, "entries");
  assert.equal((await listTransactions(d, uid, {})).length, 0);
  assert.ok((await accountsWithBalances(d, uid)).some((a) => a.name === "My extra account"));
  await resetBooks(d, uid, "everything");
  const names = (await accountsWithBalances(d, uid)).map((a) => a.name);
  assert.ok(!names.includes("My extra account") && names.includes("Cash"));
  await assert.rejects(() => deleteUser(d, uid), /only admin/); // first user is the admin
  await deleteUser(d, other);
  assert.equal((await d.q("SELECT 1 FROM users WHERE id = $1", [other])).length, 0);
});

import { toPaisa as parse } from "../lib/format.ts";
import { startingBalanceOf, renameCategory as rename2, deleteCategory, updateAccount } from "../lib/books.ts";

test("careless input: amounts written in many ways", () => {
  assert.equal(parse("Rs 500"), 50000);
  assert.equal(parse("rs.1,00,000"), 10000000);
  assert.equal(parse("500/-"), 50000);
  assert.equal(parse("۵۰۰"), 50000);
  assert.equal(parse("٥٠٠"), 50000);
  assert.ok(Number.isNaN(parse("five hundred")));
  assert.ok(Number.isNaN(parse("-500")));
  assert.ok(Number.isNaN(parse("10.555")));
});

test("careless input: silly amounts, dates and notes are refused", async () => {
  const { d, uid, acc } = await setup();
  const base = { type: "payment" as const, date: "2026-01-01", amount: 100, fromAccountId: acc("Cash"), toAccountId: acc("Rent") };
  await assert.rejects(() => addTransaction(d, uid, { ...base, amount: 100_00_00_000_00 + 1 }), /extra zero/);
  await assert.rejects(() => addTransaction(d, uid, { ...base, date: "1926-01-01" }), /before the year 2000/);
  await assert.rejects(() => addTransaction(d, uid, { ...base, date: "2206-01-01" }), /more than a year/);
  await assert.rejects(() => addTransaction(d, uid, { ...base, date: "2026-02-31" }), /valid date|year/);
  await assert.rejects(() => addTransaction(d, uid, { ...base, note: "x".repeat(1001) }), /too long/);
});

test("careless input: duplicate names, hiding money, deleting key categories", async () => {
  const { d, uid, acc } = await setup();
  const sub = (await subcategories(d, uid))[0].id;
  await assert.rejects(() => addAccount(d, uid, sub, " cash "), /already have an account called "Cash"/);
  await assert.rejects(() => addAccount(d, uid, sub, "   "), /type a name/);
  await addTransaction(d, uid, { type: "receipt", date: "2026-01-01", amount: 500, fromAccountId: acc("Sales"), toAccountId: acc("Cash") });
  await assert.rejects(() => updateAccount(d, uid, acc("Cash"), { name: "Cash", subcategoryId: sub, archived: true }), /still has a balance/);
  const cashCat = (await categories(d, uid)).find((c) => c.role === "cash")!;
  await assert.rejects(() => deleteCategory(d, uid, cashCat.id), /can't be deleted/);
  await assert.rejects(() => rename2(d, uid, cashCat.id, "  "), /required/);
});

test("careless input: setting the starting balance twice replaces it", async () => {
  const { d, uid, acc } = await setup();
  await addOpeningBalance(d, uid, acc("Cash"), 30000000, "2026-01-01");
  await addOpeningBalance(d, uid, acc("Cash"), 30000000, "2026-01-01");
  assert.equal((await accountsWithBalances(d, uid)).find((a) => a.name === "Cash")!.balance, 30000000);
  await addOpeningBalance(d, uid, acc("Cash"), 25000000, "2026-01-02");
  assert.equal((await accountsWithBalances(d, uid)).find((a) => a.name === "Cash")!.balance, 25000000);
  assert.equal((await startingBalanceOf(d, uid, acc("Cash")))!.amount, 25000000);
});

test("accounts in their own currency: USD bank and USDT wallet", async () => {
  const { d, uid, acc } = await setup();
  const bankSub = (await subcategories(d, uid)).find((s) => s.name === "Bank Accounts")!.id;
  const usd = await addAccount(d, uid, bankSub, "Meezan Dollar", { currency: "USD" });
  const usdt = await addAccount(d, uid, bankSub, "Binance", { currency: "USDT" });
  // starting balance $1,000 at 280
  await addOpeningBalance(d, uid, usd, 280000_00, "2026-01-01", { foreignAmount: 1000_00, rate: 280 });
  // sell $200 for rupees into cash at 281
  await addTransaction(d, uid, { type: "transfer", date: "2026-01-02", amount: 56200_00, fromAccountId: usd, toAccountId: acc("Cash"), currency: "USD", foreignAmount: 200_00, rate: 281 });
  // a PKR amount into the dollar account is refused with a clear message
  await assert.rejects(() => addTransaction(d, uid, { type: "receipt", date: "2026-01-03", amount: 100, fromAccountId: acc("Sales"), toAccountId: usd }), /kept in USD/);
  // USD account to USDT account directly is refused (two different currencies)
  await assert.rejects(() => addTransaction(d, uid, { type: "transfer", date: "2026-01-03", amount: 100, fromAccountId: usd, toAccountId: usdt, currency: "USD", foreignAmount: 1, rate: 1 }), /two steps/);
  // buy 100 USDT with cash
  await addTransaction(d, uid, { type: "transfer", date: "2026-01-04", amount: 28500_00, fromAccountId: acc("Cash"), toAccountId: usdt, currency: "USDT", foreignAmount: 100_00, rate: 285 });
  const accs = await accountsWithBalances(d, uid);
  const u = accs.find((a) => a.id === usd)!, t = accs.find((a) => a.id === usdt)!;
  assert.equal(u.native, 800_00);
  assert.equal(u.balance, 280000_00 - 56200_00);
  assert.equal(t.native, 100_00);
  assert.equal(t.balance, 28500_00);
  assert.ok((await balanceSheet(d, uid, "2026-12-31")).balanced);
  // currency can't change once there are entries
  await assert.rejects(() => updateAccount(d, uid, usd, { name: "Meezan Dollar", subcategoryId: bankSub, currency: "AED" }), /can't be changed/);
});
