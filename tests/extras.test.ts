import { test } from "node:test";
import assert from "node:assert/strict";
import { openPglite } from "../lib/db.ts";
import {
  accountsWithBalances, addAttachment, addProject, addTransaction, createUser, getAttachment, getTransaction,
  listAttachments, listTransactions, projectSummary, sniffMime, updateTransaction,
} from "../lib/books.ts";

async function setup() {
  const d = await openPglite();
  const uid = await createUser(d, { name: "Ali", email: "ali@x.pk", passwordHash: "x" });
  const ids = new Map((await accountsWithBalances(d, uid)).map((a) => [a.name, a.id]));
  return { d, uid, acc: (n: string) => ids.get(n)! };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.4 test");

test("foreign currency entries keep the original amount and rate", async () => {
  const { d, uid, acc } = await setup();
  const id = await addTransaction(d, uid, {
    type: "receipt", date: "2026-04-01", amount: 2_800_000, fromAccountId: acc("Sales"), toAccountId: acc("Bank Account"),
    currency: "USD", foreignAmount: 10_000, rate: 280,
  });
  const t = (await getTransaction(d, uid, id))!;
  assert.deepEqual([t.currency, t.foreign_amount, t.rate, t.amount], ["USD", 10_000, 280, 2_800_000]);
  assert.equal((await listTransactions(d, uid, { currency: "USD" })).length, 1);
  // switching back to PKR clears the foreign fields
  await updateTransaction(d, uid, id, { type: "receipt", date: "2026-04-01", amount: 100, fromAccountId: acc("Sales"), toAccountId: acc("Cash"), currency: "PKR", foreignAmount: 5, rate: 2 });
  const t2 = (await getTransaction(d, uid, id))!;
  assert.deepEqual([t2.currency, t2.foreign_amount, t2.rate], [null, null, null]);
  await assert.rejects(() => addTransaction(d, uid, { type: "receipt", date: "2026-04-01", amount: 1, fromAccountId: acc("Sales"), toAccountId: acc("Cash"), currency: "USD" }));
});

test("project profit report", async () => {
  const { d, uid, acc } = await setup();
  const p = await addProject(d, uid, "Shop 2");
  const other = await createUser(d, { name: "B", email: "b@x.pk", passwordHash: "x" });
  await addTransaction(d, uid, { type: "receipt", date: "2026-04-02", amount: 5000, fromAccountId: acc("Sales"), toAccountId: acc("Cash"), projectId: p });
  await addTransaction(d, uid, { type: "payment", date: "2026-04-03", amount: 1500, fromAccountId: acc("Cash"), toAccountId: acc("Rent"), projectId: p });
  await addTransaction(d, uid, { type: "payment", date: "2026-04-03", amount: 999, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  const [s] = await projectSummary(d, uid, "2026-04-01", "2026-04-30");
  assert.deepEqual([s.name, s.income, s.expense, s.entries], ["Shop 2", 5000, 1500, 2]);
  assert.equal((await listTransactions(d, uid, { projectId: p })).length, 2);
  // can't use someone else's project
  await assert.rejects(() => addTransaction(d, other, { type: "payment", date: "2026-04-03", amount: 1, fromAccountId: acc("Cash"), toAccountId: acc("Rent"), projectId: p }));
});

test("attachments: real type check, limits, and privacy", async () => {
  const { d, uid, acc } = await setup();
  const other = await createUser(d, { name: "B", email: "b@x.pk", passwordHash: "x" });
  const id = await addTransaction(d, uid, { type: "payment", date: "2026-04-01", amount: 100, fromAccountId: acc("Cash"), toAccountId: acc("Rent") });
  assert.equal(sniffMime(JPEG), "image/jpeg");
  assert.equal(sniffMime(new TextEncoder().encode("<html>")), null);
  await addAttachment(d, uid, id, { name: "bill.jpg", data: JPEG });
  await addAttachment(d, uid, id, { name: "receipt.pdf", data: PDF });
  await assert.rejects(() => addAttachment(d, uid, id, { name: "evil.jpg", data: new TextEncoder().encode("<script>") }), /not a photo/);
  await assert.rejects(() => addAttachment(d, other, id, { name: "x.jpg", data: JPEG }), /not found/);
  for (let i = 0; i < 3; i++) await addAttachment(d, uid, id, { name: `p${i}.jpg`, data: JPEG });
  await assert.rejects(() => addAttachment(d, uid, id, { name: "6.jpg", data: JPEG }), /Only 5/);
  const list = await listAttachments(d, uid, id);
  assert.equal(list.length, 5);
  assert.equal((await getTransaction(d, uid, id))!.attachments, 5);
  const a = await getAttachment(d, uid, list[0].id);
  assert.deepEqual(Array.from(a!.data), Array.from(JPEG));
  assert.equal(await getAttachment(d, other, list[0].id), undefined);
});
