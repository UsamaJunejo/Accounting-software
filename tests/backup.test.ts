import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import { accountsWithBalances, addTransaction, createUser } from "../lib/books.ts";
import { dailySnapshot, fullSnapshot, getBackup, listBackups, userSnapshot } from "../lib/backup.ts";

test("snapshots: full copy once a day, user copy has only their data and no secrets", async () => {
  const d = await openPglite();
  const a = await createUser(d, { name: "A", email: "a@x.pk", passwordHash: "secret-hash" });
  const b = await createUser(d, { name: "B", email: "b@x.pk", passwordHash: "x" });
  const acc = new Map((await accountsWithBalances(d, a)).map((x) => [x.name, x.id]));
  await addTransaction(d, a, { type: "payment", date: "2026-01-01", amount: 500, fromAccountId: acc.get("Cash")!, toAccountId: acc.get("Rent")! });
  const full = await fullSnapshot(d);
  assert.equal((full.tables.users as unknown[]).length, 2);
  assert.equal((full.tables.transactions as unknown[]).length, 1);
  const mine = await userSnapshot(d, b);
  assert.equal((mine.tables.transactions as unknown[]).length, 0);
  assert.equal(JSON.stringify(mine).includes("password_hash"), false);
  assert.equal(await dailySnapshot(d), true);
  assert.equal(await dailySnapshot(d), false); // not twice in a day
  const [row] = await listBackups(d);
  const back = JSON.parse((await getBackup(d, row.id))!.data);
  assert.equal(back.rows, full.rows);
});
