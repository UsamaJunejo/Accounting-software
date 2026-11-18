import type { Db } from "./db.ts";
import { accountsWithBalances, addTransaction, checkDate, deleteTransaction, ensureAccount, isMoney, MAX_AMOUNT } from "./books.ts";

/**
 * Items you sell and their stock. Stock is never stored as one number: every change is a "move"
 * (+ bought, − sold, ± counted) and the stock is their sum, so the history always explains it.
 *
 * Money: stock is something you own, so it sits in the "Stock" account (an asset) and shows on the
 * dashboard and balance sheet. Buying adds to it at the price paid. Selling takes it out at the
 * average cost of what you have (so 50 laptops bought for 50 lakh cost 1 lakh each, whatever each
 * one sells for); that cost goes to "Cost of goods sold", so profit = sale price − cost.
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
  /** "each": same price for every piece. "lot": bought for one total, each piece sold at its own price. */
  pricing: "each" | "lot";
  stock: number;
  /** What the stock you have cost (paisa). */
  value: number;
};

/** Average cost of one unit of what is on the shelf (or the buying price when nothing is). */
export const avgCost = (i: Pick<Item, "stock" | "value" | "cost_price">) => (i.stock > 0 ? i.value / i.stock : i.cost_price);

const ITEM_SELECT = `SELECT i.id, i.name, i.unit, i.group_name, i.sale_price::float8 AS sale_price, i.cost_price::float8 AS cost_price,
         i.low_stock::float8 AS low_stock, i.archived, i.pricing, COALESCE(SUM(m.qty), 0)::float8 AS stock, COALESCE(SUM(m.value), 0)::float8 AS value
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

export type ItemInput = { name: string; unit?: string; group?: string | null; salePrice?: number; costPrice?: number; lowStock?: number | null; pricing?: "each" | "lot" };

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

/** New item, optionally with the stock you already have: at its cost price, or for a lot, at the total paid. */
export async function addItem(d: Db, userId: number, i: ItemInput & { openingQty?: number; openingTotal?: number }, date: string) {
  const { name, unit, group } = await checkItem(d, userId, i);
  if (i.openingQty && !(qtyOk(i.openingQty) && i.openingQty > 0)) throw new Error("Please check how many you have now");
  const lot = i.pricing === "lot";
  if (lot) {
    if (!i.openingQty) throw new Error("How many pieces are in the lot?");
    if (!Number.isSafeInteger(i.openingTotal ?? -1) || (i.openingTotal ?? 0) <= 0 || (i.openingTotal ?? 0) > MAX_AMOUNT) throw new Error("Type the total you paid for the lot");
    // No price per piece is kept for a lot; the average is only used inside, for profit.
    i = { ...i, salePrice: 0, costPrice: Math.round(i.openingTotal! / i.openingQty) };
  }
  return d.tx(async (x) => {
    const [row] = await x.q<{ id: number }>(
      `INSERT INTO items (user_id, name, unit, group_name, sale_price, cost_price, low_stock, pricing) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [userId, name, unit, group, i.salePrice ?? 0, i.costPrice ?? 0, i.lowStock ?? null, lot ? "lot" : "each"],
    );
    if (i.openingQty) {
      checkDate(date);
      await x.q(
        "INSERT INTO stock_moves (user_id, item_id, date, qty, unit_cost, value, reason) VALUES ($1, $2, $3, $4, $5, $6, 'opening')",
        [userId, row.id, date, i.openingQty, lot ? i.openingTotal! / i.openingQty : i.costPrice ?? 0, lot ? i.openingTotal! : Math.round(i.openingQty * (i.costPrice ?? 0))],
      );
      await bookStock(x, userId);
    }
    return row.id;
  });
}

export async function updateItem(d: Db, userId: number, id: number, i: ItemInput & { archived?: boolean }) {
  if (!(await getItem(d, userId, id))) throw new Error("Item not found");
  const { name, unit, group } = await checkItem(d, userId, i, id);
  const old = (await getItem(d, userId, id))!;
  const lot = (i.pricing ?? old.pricing) === "lot";
  await d.q(
    `UPDATE items SET name = $1, unit = $2, group_name = $3, sale_price = $4, cost_price = $5, low_stock = $6, archived = $7, pricing = $8 WHERE id = $9 AND user_id = $10`,
    [name, unit, group, lot ? 0 : i.salePrice ?? 0, lot ? old.cost_price : i.costPrice ?? 0, i.lowStock ?? null, !!i.archived, lot ? "lot" : "each", id, userId],
  );
}

/** Only items never used on an invoice or moved can be deleted; otherwise archive them. */
export async function deleteItem(d: Db, userId: number, id: number) {
  const it = await getItem(d, userId, id);
  if (!it) throw new Error("Item not found");
  const [{ n }] = await d.q<{ n: number }>("SELECT COUNT(*)::int AS n FROM stock_moves WHERE item_id = $1 AND reason <> 'opening'", [id]);
  if (n > 0) throw new Error("This item has been bought or sold. Archive it instead, so its history stays.");
  await d.tx(async (x) => {
    // Its starting stock leaves the Stock account too.
    const moves = await x.q<{ id: number }>("SELECT id FROM stock_moves WHERE item_id = $1 AND user_id = $2", [id, userId]);
    for (const m of moves) await removeEntries(x, userId, m.id);
    await x.q("DELETE FROM items WHERE id = $1 AND user_id = $2", [id, userId]);
  });
}

/** The price box: a total wins (exact, e.g. 50 laptops for 50 lakh); otherwise quantity × price each. */
function totalOf(qty: number, p: { total?: number | null; each?: number | null }) {
  const total = p.total ?? (p.each != null ? Math.round(qty * p.each) : 0);
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_AMOUNT) throw new Error("Please check the price");
  return total;
}

/**
 * Stock bought. The quantity goes up and so does the Stock account: paid from cash/bank, or owed to a
 * supplier. "Already entered" means the payment went to Purchases earlier; it is moved into Stock.
 */
export async function addStock(
  d: Db,
  userId: number,
  itemId: number,
  p: { qty: number; total?: number | null; unitCost?: number | null; date: string; fromAccountId?: number | null; note?: string | null; projectId?: number | null },
) {
  const it = await getItem(d, userId, itemId);
  if (!it) throw new Error("Item not found");
  if (!(qtyOk(p.qty) && p.qty > 0)) throw new Error("How many did you buy? Use a number more than zero.");
  const total = totalOf(p.qty, { total: p.total, each: p.unitCost });
  checkDate(p.date);
  return d.tx(async (x) => {
    let txnId: number | null = null;
    if (p.fromAccountId && total > 0) {
      const from = (await accountsWithBalances(x, userId)).find((a) => a.id === p.fromAccountId);
      if (!from || !(isMoney(from) || from.role === "payable")) throw new Error("Paid from must be cash, bank or a supplier");
      txnId = await addTransaction(x, userId, {
        type: "payment",
        date: p.date,
        amount: total,
        fromAccountId: from.id,
        toAccountId: await stockAccount(x, userId),
        internal: true,
        projectId: p.projectId || null,
        note: `${it.name}: bought ${fmtQty(p.qty)} ${it.unit}${p.note ? ` · ${p.note}` : ""}`,
      });
    }
    await x.q(
      `INSERT INTO stock_moves (user_id, item_id, date, qty, unit_cost, value, reason, transaction_id, note, booked, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'purchase', $7, $8, $9, $10)`,
      [userId, itemId, p.date, p.qty, total / p.qty, total, txnId, p.note || null, !!txnId || total === 0, p.projectId || null],
    );
    await bookStock(x, userId);
    // Remember the latest cost, so the next purchase starts from it.
    if (total > 0) await x.q("UPDATE items SET cost_price = $1 WHERE id = $2", [Math.round(total / p.qty), itemId]);
  });
}

/**
 * Sold from the item page, at whatever price this sale got. The money goes into cash/bank (or the
 * customer's khata if they will pay later) from Sales; the stock leaves at its average cost.
 */
export async function sellStock(
  d: Db,
  userId: number,
  itemId: number,
  p: { qty: number; total?: number | null; each?: number | null; date: string; intoAccountId?: number | null; note?: string | null; projectId?: number | null },
) {
  const it = await getItem(d, userId, itemId);
  if (!it) throw new Error("Item not found");
  if (!(qtyOk(p.qty) && p.qty > 0)) throw new Error("How many did you sell? Use a number more than zero.");
  if (p.qty > it.stock) throw new Error(it.stock > 0 ? `You only have ${fmtQty(it.stock)} ${it.unit} in stock` : `${it.name} is out of stock. Add the stock you bought first.`);
  const total = totalOf(p.qty, p);
  if (total <= 0) throw new Error("Type the price you sold it for");
  checkDate(p.date);
  return d.tx(async (x) => {
    const into = (await accountsWithBalances(x, userId)).find((a) => a.id === p.intoAccountId);
    if (into?.role === "receivable") throw new Error("Selling on udhaar? Make an invoice for it, so it shows in the customer's invoices.");
    if (!into || !isMoney(into)) throw new Error("Choose where the money went: cash or bank");
    const txnId = await addTransaction(x, userId, {
      type: "receipt",
      date: p.date,
      amount: total,
      fromAccountId: await ensureAccount(x, userId, { name: "Income", kind: "income" }, "Sales", "Sales"),
      toAccountId: into.id,
      projectId: p.projectId || null,
      note: `${it.name}: sold ${fmtQty(p.qty)} ${it.unit}${p.note ? ` · ${p.note}` : ""}`,
    });
    const [m] = await x.q<{ id: number }>(
      `INSERT INTO stock_moves (user_id, item_id, date, qty, reason, transaction_id, sale_amount, note, project_id)
       VALUES ($1, $2, $3, $4, 'sale', $5, $6, $7, $8) RETURNING id`,
      [userId, itemId, p.date, -p.qty, txnId, total, p.note || null, p.projectId || null],
    );
    await bookStock(x, userId);
    return m.id;
  });
}

/**
 * Taken off the shelf to be used in a project (e.g. 20 cement bags to a site). Nothing is sold:
 * stock goes down and what those items cost becomes that project's expense ("Materials used").
 */
export async function useStock(
  d: Db,
  userId: number,
  itemId: number,
  p: { qty: number; date: string; projectId: number; note?: string | null },
) {
  const it = await getItem(d, userId, itemId);
  if (!it) throw new Error("Item not found");
  if (!(qtyOk(p.qty) && p.qty > 0)) throw new Error("How many did you use? Use a number more than zero.");
  if (p.qty > it.stock) throw new Error(it.stock > 0 ? `You only have ${fmtQty(it.stock)} ${it.unit} in stock` : `${it.name} is out of stock.`);
  if (!p.projectId) throw new Error("Choose the project");
  const [pr] = await d.q("SELECT 1 FROM projects WHERE id = $1 AND user_id = $2", [p.projectId, userId]);
  if (!pr) throw new Error("Project not found");
  checkDate(p.date);
  return d.tx(async (x) => {
    const [m] = await x.q<{ id: number }>(
      "INSERT INTO stock_moves (user_id, item_id, date, qty, reason, note, project_id) VALUES ($1, $2, $3, $4, 'use', $5, $6) RETURNING id",
      [userId, itemId, p.date, -p.qty, p.note || null, p.projectId],
    );
    await bookStock(x, userId);
    return m.id;
  });
}

/**
 * A Money Out (or bought-on-credit) entry into Purchases that was really stock: the items go on the
 * shelf and the entry is pointed at the Stock account, so the money and the stock agree.
 */
export async function stockFromPurchase(d: Db, userId: number, itemId: number, qty: number, txnId: number) {
  const it = await getItem(d, userId, itemId);
  if (!it) throw new Error("Item not found");
  if (!(qtyOk(qty) && qty > 0)) throw new Error("How many did you buy? Use a number more than zero.");
  const [t] = await d.q<{ amount: number; date: string }>(
    "SELECT amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date FROM transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [txnId, userId],
  );
  if (!t) throw new Error("Entry not found");
  await d.tx(async (x) => {
    await x.q(
      `INSERT INTO stock_moves (user_id, item_id, date, qty, unit_cost, value, reason, transaction_id) VALUES ($1, $2, $3, $4, $5, $6, 'purchase', $7)`,
      [userId, itemId, t.date, qty, t.amount / qty, t.amount, txnId],
    );
    await bookStock(x, userId); // moves the entry from Purchases into Stock
    if (it.pricing === "each") await x.q("UPDATE items SET cost_price = $1 WHERE id = $2", [Math.round(t.amount / qty), itemId]);
  });
}

/** Undo one line of an item's history (with its entries). Invoice lines go by cancelling the invoice. */
export async function removeMove(d: Db, userId: number, moveId: number) {
  const [m] = await d.q<{ invoice_id: number | null }>("SELECT invoice_id FROM stock_moves WHERE id = $1 AND user_id = $2", [moveId, userId]);
  if (!m) throw new Error("Not found");
  if (m.invoice_id) throw new Error("This came from an invoice. Cancel the invoice instead.");
  await d.tx(async (x) => {
    await removeEntries(x, userId, moveId);
    await x.q("DELETE FROM stock_moves WHERE id = $1 AND user_id = $2", [moveId, userId]);
  });
}

/** Deletes (to the deleted log) the book entries a stock move made. */
export async function removeEntries(d: Db, userId: number, moveId: number) {
  const [m] = await d.q<{ t1: number | null; t2: number | null; reason: string }>(
    "SELECT transaction_id AS t1, cost_transaction_id AS t2, reason FROM stock_moves WHERE id = $1 AND user_id = $2",
    [moveId, userId],
  );
  for (const t of [m?.t1, m?.t2]) {
    if (!t) continue;
    const [live] = await d.q("SELECT 1 FROM transactions WHERE id = $1 AND deleted_at IS NULL", [t]);
    if (live) await deleteTransaction(d, userId, t, { internal: true });
  }
}

/** After counting the shelf: set the stock to what is really there (the difference is recorded). */
export async function countStock(d: Db, userId: number, itemId: number, counted: number, date: string, note?: string | null) {
  const it = await getItem(d, userId, itemId);
  if (!it) throw new Error("Item not found");
  if (!(qtyOk(counted) && counted >= 0)) throw new Error("Please type how many you counted");
  checkDate(date);
  const diff = Math.round((counted - it.stock) * 1000) / 1000;
  if (diff === 0) return 0;
  await d.tx(async (x) => {
    await x.q("INSERT INTO stock_moves (user_id, item_id, date, qty, reason, note) VALUES ($1, $2, $3, $4, 'count', $5)", [userId, itemId, date, diff, note || "Counted"]);
    await bookStock(x, userId);
  });
  return diff;
}

export type StockMove = {
  id: number; date: string; qty: number; unit_cost: number | null; reason: string; note: string | null;
  invoice_id: number | null; invoice_number: number | null; value: number | null; sale_amount: number | null; balance: number;
  project_id: number | null; project: string | null;
};

/** An item's history, oldest first, with the running stock after each move. */
export async function itemMoves(d: Db, userId: number, itemId: number) {
  const rows = await d.q<Omit<StockMove, "balance">>(
    `SELECT m.id, to_char(m.date, 'YYYY-MM-DD') AS date, m.qty::float8 AS qty, m.unit_cost::float8 AS unit_cost, m.reason, m.note,
            m.invoice_id, i.number AS invoice_number, m.value::float8 AS value, m.sale_amount::float8 AS sale_amount,
            m.project_id, pr.name AS project
     FROM stock_moves m LEFT JOIN invoices i ON i.id = m.invoice_id LEFT JOIN projects pr ON pr.id = m.project_id
     WHERE m.user_id = $1 AND m.item_id = $2 ORDER BY m.date, m.id`,
    [userId, itemId],
  );
  let bal = 0;
  return rows.map((r) => ({ ...r, balance: (bal = Math.round((bal + r.qty) * 1000) / 1000) }));
}

/** Total stock value at what it cost (for the Items page). */
export function stockValue(items: Item[]) {
  return items.reduce((s, i) => s + (i.stock > 0 ? i.value : 0), 0);
}

const fmtQty = (n: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 }).format(n);

/** An account the app keeps itself, found by its mark (so renaming it is safe), else by name, else made. */
async function systemAccount(d: Db, userId: number, system: "stock" | "cogs", find: () => Promise<number | undefined>, make: () => Promise<number>) {
  const [a] = await d.q<{ id: number; archived: boolean }>("SELECT id, archived FROM accounts WHERE user_id = $1 AND system = $2", [userId, system]);
  if (a) {
    if (a.archived) await d.q("UPDATE accounts SET archived = false WHERE id = $1", [a.id]);
    return a.id;
  }
  const id = (await find()) ?? (await make());
  await d.q("UPDATE accounts SET system = $1 WHERE id = $2 AND user_id = $3", [system, id, userId]);
  return id;
}

/** The asset account stock sits in ("Stock", made in Assets if it is missing). */
export async function stockAccount(d: Db, userId: number) {
  return systemAccount(d, userId, "stock", async () => {
    const [a] = await d.q<{ id: number }>(
      `SELECT a.id FROM accounts a JOIN subcategories s ON s.id = a.subcategory_id JOIN categories c ON c.id = s.category_id
       WHERE a.user_id = $1 AND NOT a.archived AND a.currency IS NULL AND c.kind = 'asset' AND c.role IS NULL AND lower(a.name) IN ('stock', 'inventory')
       ORDER BY a.id LIMIT 1`,
      [userId],
    );
    return a?.id;
  }, () => ensureAccount(d, userId, { name: "Assets", kind: "asset" }, "Stock / Inventory", "Stock"));
}

async function namedAccount(d: Db, userId: number, kind: string, names: string[]) {
  const [a] = await d.q<{ id: number }>(
    `SELECT a.id FROM accounts a JOIN subcategories s ON s.id = a.subcategory_id JOIN categories c ON c.id = s.category_id
     WHERE a.user_id = $1 AND NOT a.archived AND a.currency IS NULL AND c.kind = $2 AND lower(a.name) = ANY($3::text[]) ORDER BY a.id LIMIT 1`,
    [userId, kind, names.map((n) => n.toLowerCase())],
  );
  return a?.id;
}

const costAccount = (d: Db, userId: number) =>
  systemAccount(d, userId, "cogs", () => namedAccount(d, userId, "expense", ["Cost of goods sold"]),
    () => ensureAccount(d, userId, { name: "Expense", kind: "expense" }, "Purchases", "Cost of goods sold"));

/**
 * Puts every stock move that isn't in the books yet into the books, oldest first:
 * starting stock (from "Starting balance"), purchases entered before stock had a value (moved out of
 * Purchases), and sales or count corrections (at the average cost at that moment).
 * Safe to call any time; it does nothing when everything is booked.
 */
export async function bookStock(d: Db, userId: number) {
  const [any] = await d.q("SELECT 1 FROM stock_moves WHERE user_id = $1 AND NOT booked LIMIT 1", [userId]);
  if (!any) return;
  await d.tx(async (x) => {
    const moves = await x.q<{ id: number; item_id: number; date: string; qty: number; value: number | null; reason: string; booked: boolean; transaction_id: number | null; name: string; unit: string; cost_price: number; project_id: number | null; project: string | null }>(
      `SELECT m.id, m.item_id, to_char(m.date, 'YYYY-MM-DD') AS date, m.qty::float8 AS qty, m.value::float8 AS value, m.reason, m.booked,
              m.project_id, (SELECT name FROM projects WHERE id = m.project_id) AS project,
              m.transaction_id, i.name, i.unit, i.cost_price::float8 AS cost_price
       FROM stock_moves m JOIN items i ON i.id = m.item_id
       WHERE m.user_id = $1 AND m.item_id IN (SELECT item_id FROM stock_moves WHERE user_id = $1 AND NOT booked)
       ORDER BY m.item_id, m.date, m.id FOR UPDATE OF m`,
      [userId],
    );
    const stock = await stockAccount(x, userId);
    let item = 0, qty = 0, val = 0;
    for (const m of moves) {
      if (m.item_id !== item) [item, qty, val] = [m.item_id, 0, 0];
      if (m.booked) {
        qty += m.qty;
        val += m.value ?? 0;
        continue;
      }
      const entry = (amount: number, from: number, to: number, note: string) =>
        addTransaction(x, userId, { type: "transfer", date: m.date, amount, fromAccountId: from, toAccountId: to, note, internal: true, projectId: m.project_id });
      let v: number;
      let t1 = m.transaction_id, t2: number | null = null;
      if ((m.reason === "opening" || m.reason === "purchase") && m.qty > 0 && m.value !== null) {
        v = m.value;
        if (v > 0 && m.reason === "opening") {
          const start = (await namedAccount(x, userId, "equity", ["Starting balance", "Opening Balances"])) ??
            (await ensureAccount(x, userId, { name: "Equity", kind: "equity" }, "Owner", "Starting balance"));
          t1 = await entry(v, start, stock, `Starting stock: ${m.name} (${fmtQty(m.qty)} ${m.unit})`);
        } else if (v > 0) {
          // Entered before stock had a value: the payment went to an expense such as Purchases. Point it at Stock.
          const [old] = m.transaction_id
            ? await x.q<{ id: number }>(
              `SELECT t.id FROM transactions t JOIN accounts a ON a.id = t.to_account_id JOIN subcategories s ON s.id = a.subcategory_id
               JOIN categories c ON c.id = s.category_id WHERE t.id = $1 AND t.deleted_at IS NULL AND c.kind = 'expense'`,
              [m.transaction_id],
            )
            : [];
          if (old) await x.q("UPDATE transactions SET to_account_id = $1 WHERE id = $2", [stock, old.id]);
          else {
            const purchases = (await namedAccount(x, userId, "expense", ["Purchases"])) ??
              (await ensureAccount(x, userId, { name: "Expense", kind: "expense" }, "Purchases", "Purchases"));
            t2 = await entry(v, purchases, stock, `${m.name}: ${fmtQty(m.qty)} ${m.unit} moved from Purchases into stock`);
          }
        }
      } else {
        // Out (or found on a count): at the average cost of what is on the shelf.
        const avg = qty > 0 ? val / qty : m.cost_price;
        v = m.qty < 0 && -m.qty >= qty && qty > 0 ? -val : Math.round(m.qty * avg);
        if (v !== 0) {
          // Used in a project: its cost is that project's expense. Sold or miscounted: cost of goods sold.
          const cost = m.reason === "use"
            ? (await namedAccount(x, userId, "expense", ["Materials used"])) ?? (await ensureAccount(x, userId, { name: "Expense", kind: "expense" }, "Purchases", "Materials used"))
            : await costAccount(x, userId);
          const what = m.reason === "sale" ? `cost of ${fmtQty(-m.qty)} ${m.unit} sold`
            : m.reason === "use" ? `${fmtQty(-m.qty)} ${m.unit} used${m.project ? ` for ${m.project}` : ""}`
            : `count correction (${m.qty > 0 ? "+" : ""}${fmtQty(m.qty)} ${m.unit})`;
          t2 = v < 0 ? await entry(-v, stock, cost, `${m.name}: ${what}`) : await entry(v, cost, stock, `${m.name}: ${what}`);
        }
      }
      await x.q("UPDATE stock_moves SET value = $1, booked = true, transaction_id = $2, cost_transaction_id = COALESCE($3, cost_transaction_id) WHERE id = $4", [v, t1, t2, m.id]);
      qty += m.qty;
      val += v;
    }
  });
}
