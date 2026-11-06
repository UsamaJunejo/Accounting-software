import type { Db } from "./db.ts";
import { accountsWithBalances, balanceSheet, categories, seedDefaults } from "./books.ts";
import { isMoney, typeFor } from "./kinds.ts";

export type Issue = { level: "problem" | "check"; text: string; fix?: string };

const rs = (paisa: number) => new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paisa / 100);

/**
 * Reconcile one person's books: do the totals agree, and is anything likely entered by mistake?
 * Read-only. Each issue says what to do about it.
 */
export async function checkBooks(d: Db, userId: number, today: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const [accs, cats, bs] = await Promise.all([accountsWithBalances(d, userId), categories(d, userId), balanceSheet(d, userId, "9999-12-31")]);

  // 1. Double entry: what you own must equal what you owe plus the owner's share.
  if (!bs.balanced)
    issues.push({ level: "problem", text: `Balance sheet does not balance: assets ${rs(bs.totalAssets)}, liabilities + equity ${rs(bs.totalLiabilities + bs.totalEquity)}.` });

  // 2. Each account's total must match its entries, worked out a second, independent way.
  const [raw] = await d.q<{ i: number; o: number }>(
    `SELECT COALESCE(SUM(amount), 0)::float8 AS i, COALESCE(SUM(amount), 0)::float8 AS o
     FROM transactions WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const ins = accs.reduce((s, a) => s + a.money_in, 0);
  const outs = accs.reduce((s, a) => s + a.money_out, 0);
  if (ins !== raw.i || outs !== raw.o)
    issues.push({ level: "problem", text: `Account totals (${rs(ins)} in, ${rs(outs)} out) don't match the entries (${rs(raw.i)}).` });

  // 3. The app needs to know which categories hold money and people.
  for (const [role, what] of [["cash", "Cash"], ["receivable", "Customers"], ["payable", "Suppliers"]] as const)
    if (!cats.some((c) => c.role === role)) issues.push({ level: "problem", text: `No category is marked as ${what}, so totals and khata may be missing it.` });

  // 4. Money can't be below zero.
  for (const a of accs.filter((a) => isMoney(a) && a.balance < 0))
    issues.push({ level: "check", text: `${a.name} is below zero (${rs(a.balance)}).`, fix: "Add its starting balance, or check for a payment entered twice." });

  // 5. Entry types that disagree with their accounts.
  const roleOf = new Map(accs.map((a) => [a.id, a]));
  const rows = await d.q<{ id: number; type: string; from_account_id: number; to_account_id: number; amount: number; date: string; created_at: string }>(
    `SELECT id, type, from_account_id, to_account_id, amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
     FROM transactions WHERE user_id = $1 AND deleted_at IS NULL ORDER BY id`,
    [userId],
  );
  const wrongType = rows.filter((r) => {
    const f = roleOf.get(r.from_account_id), t = roleOf.get(r.to_account_id);
    return f && t && typeFor(f, t) !== r.type;
  });
  if (wrongType.length) issues.push({ level: "problem", text: `${wrongType.length} entries are labelled In/Out the wrong way.`, fix: "Use \"Fix entry labels\" on the Admin page." });

  // 6. Dates that look like typing mistakes.
  const future = rows.filter((r) => r.date > today);
  if (future.length) issues.push({ level: "check", text: `${future.length} entries are dated in the future (e.g. ${future[0].date}).`, fix: "Open them from Entries and correct the date." });
  const ancient = rows.filter((r) => r.date < "2000-01-01");
  if (ancient.length) issues.push({ level: "check", text: `${ancient.length} entries are dated before 2000 (e.g. ${ancient[0].date}).`, fix: "Probably a wrong year." });

  // 7. Possible double saves: same accounts, amount and date, saved within 2 minutes.
  let dupes = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.from_account_id === b.from_account_id && a.to_account_id === b.to_account_id && a.amount === b.amount && a.date === b.date
        && Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) < 120_000) dupes++;
  }
  if (dupes) issues.push({ level: "check", text: `${dupes} entries look saved twice (same accounts, amount and date, a moment apart).`, fix: "Check Entries and delete the extra one." });

  // 8. Very large single amounts (an extra zero is a common slip).
  const big = rows.filter((r) => r.amount >= 100_000_000_00);
  if (big.length) issues.push({ level: "check", text: `${big.length} entries are 10 crore or more.`, fix: "Check for an extra zero." });

  return issues;
}

/** Correct In / Out / Transfer labels so they match the accounts (same rule as when saving). */
export async function fixEntryTypes(d: Db) {
  const r = await d.q<{ id: number }>(
    `UPDATE transactions t SET type = CASE
        WHEN fc.role IN ('cash','bank') AND tc.role IN ('cash','bank') THEN 'transfer'
        WHEN fc.role IN ('cash','bank') THEN 'payment'
        WHEN tc.role IN ('cash','bank') THEN 'receipt'
        ELSE 'transfer' END
     FROM accounts fa JOIN subcategories fs ON fs.id = fa.subcategory_id JOIN categories fc ON fc.id = fs.category_id,
          accounts ta JOIN subcategories ts ON ts.id = ta.subcategory_id JOIN categories tc ON tc.id = ts.category_id
     WHERE fa.id = t.from_account_id AND ta.id = t.to_account_id
       AND t.type <> CASE
        WHEN fc.role IN ('cash','bank') AND tc.role IN ('cash','bank') THEN 'transfer'
        WHEN fc.role IN ('cash','bank') THEN 'payment'
        WHEN tc.role IN ('cash','bank') THEN 'receipt'
        ELSE 'transfer' END
     RETURNING t.id`,
  );
  return r.length;
}

/**
 * Start again. "entries": wipe every entry, invoice and repeating entry but keep the accounts.
 * "everything": also remove all accounts and categories and put back the ready-made ones.
 * Login, plan and settings are kept either way.
 */
export async function resetBooks(d: Db, userId: number, mode: "entries" | "everything") {
  await d.tx(async (t) => {
    await t.q("DELETE FROM invoices WHERE user_id = $1", [userId]); // payments go with them
    await t.q("DELETE FROM stock_moves WHERE user_id = $1", [userId]); // stock starts again from zero
    await t.q("DELETE FROM schedules WHERE user_id = $1", [userId]);
    await t.q("DELETE FROM shares WHERE owner_id = $1", [userId]); // and their suggested entries
    await t.q("DELETE FROM transactions WHERE user_id = $1", [userId]); // attachments go with them
    await t.q("DELETE FROM audit_log WHERE user_id = $1", [userId]);
    if (mode === "everything") {
      await t.q("DELETE FROM projects WHERE user_id = $1", [userId]);
      await t.q("DELETE FROM items WHERE user_id = $1", [userId]);
      await t.q("DELETE FROM accounts WHERE user_id = $1", [userId]);
      await t.q("DELETE FROM subcategories WHERE user_id = $1", [userId]);
      await t.q("DELETE FROM categories WHERE user_id = $1", [userId]);
      await seedDefaults(t, userId);
    }
    await t.q("INSERT INTO audit_log (user_id, action, details) VALUES ($1, 'reset', $2)", [userId, JSON.stringify({ mode })]);
  });
}

/** Remove a person and all their data for good. The last admin can't be removed. */
export async function deleteUser(d: Db, userId: number) {
  await d.tx(async (t) => {
    const [u] = await t.q<{ is_admin: boolean }>("SELECT is_admin FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!u) throw new Error("User not found");
    if (u.is_admin) {
      const [{ n }] = await t.q<{ n: number }>("SELECT COUNT(*)::int AS n FROM users WHERE is_admin");
      if (n <= 1) throw new Error("This is the only admin account. Make someone else admin first.");
    }
    await t.q("DELETE FROM users WHERE id = $1", [userId]);
  });
}
