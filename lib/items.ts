import type { Db } from "./db.ts";
import { accountsWithBalances, addTransaction, checkDate, isMoney, MAX_AMOUNT } from "./books.ts";

/**
 * Items you sell and their stock. Stock is never stored as one number: every change is a "move"
 * (+ bought, − sold, ± counted) and the stock is their sum, so the history always explains it.
 * Money: buying stock is recorded like any purchase (an expense), so profit stays simple.
 */

export type Item = {
  id: number;
  name: string;
  unit: string;
  group_name: string | null;
  sale_price: number;
  cost_price: number;
  low_stock: number | null;
  archived: boolean;
  stock: number;
};

const ITEM_SELECT = `SELECT i.id, i.name, i.unit, i.group_name, i.sale_price::float8 AS sale_price, i.cost_price::float8 AS cost_price,
         i.low_stock::float8 AS low_stock, i.archived, COALESCE(SUM(m.qty), 0)::float8 AS stock
  FROM items i LEFT JOIN stock_moves m ON m.item_id = i.id`;

export function listItems(d: Db, userId: number, opts: { archived?: boolean } = {}) {
  return d.q<Item>(
    `${ITEM_SELECT} WHERE i.user_id = $1 ${opts.archived ? "" : "AND NOT i.archived"} GROUP BY i.id ORDER BY COALESCE(i.group_name, ''), i.name`,
    [userId],
  );
}

export async function getItem(d: Db, userId: number, id: number) {
  const [it] = await d.q<Item>(`${ITEM_SELECT} WHERE i.user_id = $1 AND i.id = $2 GROUP BY i.id`, [userId, id]);
  return it;
}

/** Items at or below their "running low" level. */
export async function lowStock(d: Db, userId: number) {
  return (await listItems(d, userId)).filter((i) => i.low_stock !== null && i.stock <= i.low_stock);
}

export type ItemInput = { name: string; unit?: string; group?: string | null; salePrice?: number; costPrice?: number; lowStock?: number | null };

const qtyOk = (q: number) => Number.isFinite(q) && Math.abs(q) < 1e9 && Math.round(q * 1000) === q * 1000;

async function checkItem(d: Db, userId: number, i: ItemInput, exceptId = 0) {
  const name = i.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Please type the item's name");
  if (name.length > 80) throw new Error("That name is too long");
  const [dup] = await d.q<{ name: string }>("SELECT name FROM items WHERE user_id = $1 AND lower(name) = lower($2) AND id <> $3", [userId, name, exceptId]);
  if (dup) throw new Error(`You already have an item called "${dup.name}"`);
  for (const p of [i.salePrice ?? 0, i.costPrice ?? 0]) if (!Number.isSafeInteger(p) || p < 0 || p > MAX_AMOUNT) throw new Error("Please check the prices");
  if (i.lowStock !== null && i.lowStock !== undefined && !(qtyOk(i.lowStock) && i.lowStock >= 0)) throw new Error("Please check the 'running low' number");
  const unit = (i.unit ?? "pcs").trim().slice(0, 20) || "pcs";
  const group = (i.group ?? "").trim().slice(0, 40) || null;
  return { name, unit, group };
}

/** New item, optionally with the stock you already have (at its cost price). */
export async function addItem(d: Db, userId: number, i: ItemInput & { openingQty?: number }, date: string) {
  const { name, unit, group } = await checkItem(d, userId, i);
  if (i.openingQty && !(qtyOk(i.openingQty) && i.openingQty > 0)) throw new Error("Please check how many you have now");
  return d.tx(async (x) => {
    const [row] = await x.q<{ id: number }>(
      `INSERT INTO items (user_id, name, unit, group_name, sale_price, cost_price, low_stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, name, unit, group, i.salePrice ?? 0, i.costPrice ?? 0, i.lowStock ?? null],
    );
    if (i.openingQty) {
      checkDate(date);
      await x.q("INSERT INTO stock_moves (user_id, item_id, date, qty, unit_cost, reason) VALUES ($1, $2, $3, $4, $5, 'opening')", [userId, row.id, date, i.openingQty, i.costPrice ?? 0]);
    }
    return row.id;
  });
}

export async function updateItem(d: Db, userId: number, id: number, i: ItemInput & { archived?: boolean }) {
  if (!(await getItem(d, userId, id))) throw new Error("Item not found");
  const { name, unit, group } = await checkItem(d, userId, i, id);
  await d.q(
    `UPDATE items SET name = $1, unit = $2, group_name = $3, sale_price = $4, cost_price = $5, low_stock = $6, archived = $7 WHERE id = $8 AND user_id = $9`,
    [name, unit, group, i.salePrice ?? 0, i.costPrice ?? 0, i.lowStock ?? null, !!i.archived, id, userId],
  );
}

/** Only items never used on an invoice or moved can be deleted; otherwise archive them. */
export async function deleteItem(d: Db, userId: number, id: number) {
  const it = await getItem(d, userId, id);
  if (!it) throw new Error("Item not found");
  const [{ n }] = await d.q<{ n: number }>("SELECT COUNT(*)::int AS n FROM stock_moves WHERE item_id = $1 AND reason <> 'opening'", [id]);
  if (n > 0) throw new Error("This item has been bought or sold. Archive it instead, so its history stays.");
  await d.q("DELETE FROM items WHERE id = $1 AND user_id = $2", [id, userId]);
}

/**
 * Stock bought. The quantity goes up, and (unless "already recorded") the purchase is recorded in the
 * books: paid from a cash/bank account, or on credit from a supplier, into the Purchases expense.
 */
export async function addStock(
  d: Db,
  userId: number,
  itemId: number,
  p: { qty: number; unitCost: number; date: string; fromAccountId?: number | null; note?: string | null },
) {
  const it = await getItem(d, userId, itemId);
  if (!it) throw new Error("Item not found");
  if (!(qtyOk(p.qty) && p.qty > 0)) throw new Error("How many did you buy? Use a number more than zero.");
  if (!Number.isSafeInteger(p.unitCost) || p.unitCost < 0) throw new Error("Please check the price you paid");
  checkDate(p.date);
  const total = Math.round(p.qty * p.unitCost);
  return d.tx(async (x) => {
    let txnId: number | null = null;
    if (p.fromAccountId && total > 0) {
      const accs = await accountsWithBalances(x, userId);
      const from = accs.find((a) => a.id === p.fromAccountId);
      if (!from || !(isMoney(from) || from.role === "payable")) throw new Error("Paid from must be cash, bank or a supplier");
      const purchases = accs.find((a) => a.kind === "expense" && a.name === "Purchases" && !a.archived) ?? accs.find((a) => a.kind === "expense" && !a.archived);
      if (!purchases) throw new Error("Add an expense account called Purchases first");
      txnId = await addTransaction(x, userId, {
        type: "payment",
        date: p.date,
        amount: total,
        fromAccountId: from.id,
        toAccountId: purchases.id,
        note: `${it.name}: ${p.qty} ${it.unit}${p.note ? ` · ${p.note}` : ""}`,
      });
    }
    await x.q(
      "INSERT INTO stock_moves (user_id, item_id, date, qty, unit_cost, reason, transaction_id, note) VALUES ($1, $2, $3, $4, $5, 'purchase', $6, $7)",
      [userId, itemId, p.date, p.qty, p.unitCost, txnId, p.note || null],
    );
    // Remember the latest cost, so the next purchase and the stock value start from it.
    if (p.unitCost > 0) await x.q("UPDATE items SET cost_price = $1 WHERE id = $2", [p.unitCost, itemId]);
  });
}

/** After counting the shelf: set the stock to what is really there (the difference is recorded). */
export async function countStock(d: Db, userId: number, itemId: number, counted: number, date: string, note?: string | null) {
  const it = await getItem(d, userId, itemId);
  if (!it) throw new Error("Item not found");
  if (!(qtyOk(counted) && counted >= 0)) throw new Error("Please type how many you counted");
  checkDate(date);
  const diff = Math.round((counted - it.stock) * 1000) / 1000;
  if (diff === 0) return 0;
  await d.q("INSERT INTO stock_moves (user_id, item_id, date, qty, reason, note) VALUES ($1, $2, $3, $4, 'count', $5)", [userId, itemId, date, diff, note || "Counted"]);
  return diff;
}

export type StockMove = { id: number; date: string; qty: number; unit_cost: number | null; reason: string; note: string | null; invoice_id: number | null; invoice_number: number | null; balance: number };

/** An item's history, oldest first, with the running stock after each move. */
export async function itemMoves(d: Db, userId: number, itemId: number) {
  const rows = await d.q<Omit<StockMove, "balance">>(
    `SELECT m.id, to_char(m.date, 'YYYY-MM-DD') AS date, m.qty::float8 AS qty, m.unit_cost::float8 AS unit_cost, m.reason, m.note,
            m.invoice_id, i.number AS invoice_number
     FROM stock_moves m LEFT JOIN invoices i ON i.id = m.invoice_id
     WHERE m.user_id = $1 AND m.item_id = $2 ORDER BY m.date, m.id`,
    [userId, itemId],
  );
  let bal = 0;
  return rows.map((r) => ({ ...r, balance: (bal = Math.round((bal + r.qty) * 1000) / 1000) }));
}

/** Total stock value at cost price (for the Items page). */
export function stockValue(items: Item[]) {
  return items.reduce((s, i) => s + Math.max(0, i.stock) * i.cost_price, 0);
}
