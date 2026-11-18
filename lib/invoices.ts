import { randomBytes } from "node:crypto";
import type { Db } from "./db.ts";
import { addTransaction, accountsWithBalances, checkDate, deleteTransaction, ensureAccount } from "./books.ts";
import { bookStock, removeEntries } from "./items.ts";

/** One line. itemId is set when it was picked from your Items: then stock goes down by qty. */
export type InvoiceItem = { name: string; qty: number; price: number; itemId?: number | null }; // price in paisa

export type InvoiceInput = {
  customerAccountId?: number | null;
  customerName?: string;
  customerPhone?: string | null;
  date: string;
  dueDate?: string | null;
  items: InvoiceItem[];
  taxPercent?: number;
  discount?: number; // paisa
  notes?: string | null;
  /** Add it to the books as a credit (udhaar) sale to the customer's khata. */
  record: boolean;
  /** The project this sale was for (optional). */
  projectId?: number | null;
};

/** Subtotal, tax and total, all in whole paisa. */
export function invoiceTotals(items: InvoiceItem[], taxPercent = 0, discount = 0) {
  const subtotal = items.reduce((s, i) => s + Math.round(i.qty * i.price), 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round((taxable * taxPercent) / 100);
  return { subtotal, taxable, tax, total: taxable + tax };
}

function validate(i: InvoiceInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) throw new Error("Invalid date");
  if (i.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(i.dueDate)) throw new Error("Invalid due date");
  checkDate(i.date);
  if (i.dueDate && i.dueDate < i.date) throw new Error("The due date can't be before the invoice date");
  const items = i.items.filter((x) => x.name.trim() || x.price);
  if (!items.length) throw new Error("Add at least one item");
  for (const x of items) {
    if (!x.name.trim()) throw new Error("Every item needs a name");
    if (!(x.qty > 0) || x.qty > 1_000_000) throw new Error(`Check the quantity of "${x.name}"`);
    if (!Number.isSafeInteger(x.price) || x.price < 0) throw new Error(`Check the price of "${x.name}"`);
  }
  const tax = i.taxPercent ?? 0;
  if (!(tax >= 0 && tax <= 100)) throw new Error("Tax must be between 0 and 100%");
  if (!Number.isSafeInteger(i.discount ?? 0) || (i.discount ?? 0) < 0) throw new Error("Invalid discount");
  return items;
}

export async function createInvoice(d: Db, userId: number, i: InvoiceInput) {
  const items = validate(i);
  const t = invoiceTotals(items, i.taxPercent ?? 0, i.discount ?? 0);
  if (t.total <= 0) throw new Error("The invoice total must be more than zero");
  let customerName = (i.customerName ?? "").trim();
  let customerId = i.customerAccountId || null;
  let phone = i.customerPhone || null;
  if (customerId) {
    const acc = (await accountsWithBalances(d, userId)).find((a) => a.id === customerId);
    if (!acc) throw new Error("Customer not found");
    customerName = acc.name;
    phone = phone || acc.phone;
  }
  if (!customerName) throw new Error("Enter the customer's name");
  const projectId = i.projectId || null;
  if (projectId) {
    const [pr] = await d.q("SELECT 1 FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]);
    if (!pr) throw new Error("Project not found");
  }

  return d.tx(async (x) => {
    let txnId: number | null = null;
    let taxTxnId: number | null = null;
    const [{ n }] = await x.q<{ n: number }>("SELECT COALESCE(MAX(number), 0) + 1 AS n FROM invoices WHERE user_id = $1", [userId]);
    // An invoice that takes items out of stock is always put in the books, so the sale and its cost go in together.
    if (i.record || items.some((x) => x.itemId)) {
      if (!customerId) customerId = await ensureAccount(x, userId, { role: "receivable", name: "Receivables", kind: "asset" }, "Customers (Khata)", customerName);
      const sales = await ensureAccount(x, userId, { name: "Income", kind: "income" }, "Sales", "Sales");
      // Customer now owes the total: the sale goes to Sales, the tax to Sales Tax Payable.
      txnId = await addTransaction(x, userId, {
        type: "transfer",
        date: i.date,
        amount: t.taxable,
        fromAccountId: sales,
        toAccountId: customerId,
        note: `Invoice #${n}`,
        projectId,
      });
      if (t.tax > 0) {
        const taxAcc = await ensureAccount(x, userId, { name: "Liabilities", kind: "liability" }, "Taxes Payable", "Sales Tax Payable");
        taxTxnId = await addTransaction(x, userId, {
          type: "transfer",
          date: i.date,
          amount: t.tax,
          fromAccountId: taxAcc,
          toAccountId: customerId,
          note: `Sales tax on invoice #${n}`,
          projectId,
        });
      }
    }
    const [row] = await x.q<{ id: number }>(
      `INSERT INTO invoices (user_id, number, customer_account_id, customer_name, customer_phone, date, due_date, items,
         tax_percent, discount, subtotal, tax, total, notes, transaction_id, tax_transaction_id, share_token, project_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [
        userId, n, customerId, customerName, phone, i.date, i.dueDate || null, JSON.stringify(items), i.taxPercent ?? 0,
        i.discount ?? 0, t.subtotal, t.tax, t.total, i.notes || null, txnId, taxTxnId, randomBytes(18).toString("base64url"), projectId,
      ],
    );
    // Lines picked from Items take that many out of stock.
    for (const it of items.filter((x) => x.itemId)) {
      const [own] = await x.q("SELECT 1 FROM items WHERE id = $1 AND user_id = $2", [it.itemId, userId]);
      if (!own) throw new Error(`Item "${it.name}" not found`);
      await x.q(
        "INSERT INTO stock_moves (user_id, item_id, date, qty, reason, invoice_id, sale_amount, project_id) VALUES ($1, $2, $3, $4, 'sale', $5, $6, $7)",
        [userId, it.itemId, i.date, -it.qty, row.id, Math.round(it.qty * it.price), projectId],
      );
    }
    // What those goods cost leaves the Stock account.
    await bookStock(x, userId);
    return row.id;
  });
}

export type Invoice = {
  id: number;
  number: number;
  customer_account_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  date: string;
  due_date: string | null;
  items: InvoiceItem[];
  tax_percent: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  transaction_id: number | null;
  project_id: number | null;
  project: string | null;
  share_token: string;
  cancelled: boolean;
  business: string;
  business_phone: string | null;
  business_address: string | null;
  business_ntn: string | null;
  currency: string;
  paid: number;
  /** Of `paid`, what the customer paid through khata (not recorded on this invoice). */
  paidKhata?: number;
  tax_transaction_id: number | null;
  user_id: number;
};

export type InvoiceStatus = "paid" | "part" | "unpaid" | "overdue" | "cancelled";

export function invoiceStatus(inv: Pick<Invoice, "cancelled" | "paid" | "total" | "due_date">, today: string): InvoiceStatus {
  if (inv.cancelled) return "cancelled";
  if (inv.paid >= inv.total) return "paid";
  if (inv.due_date && inv.due_date < today) return "overdue";
  return inv.paid > 0 ? "part" : "unpaid";
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Paid",
  part: "Part paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const SELECT = `SELECT i.id, i.number, i.customer_account_id, i.customer_name, i.customer_phone,
  to_char(i.date, 'YYYY-MM-DD') AS date, to_char(i.due_date, 'YYYY-MM-DD') AS due_date, i.items,
  i.tax_percent::float8 AS tax_percent, i.discount::float8 AS discount, i.subtotal::float8 AS subtotal,
  i.tax::float8 AS tax, i.total::float8 AS total, i.notes, i.transaction_id, i.tax_transaction_id, i.project_id,
  (SELECT name FROM projects WHERE id = i.project_id) AS project, i.user_id, i.share_token, i.cancelled,
  COALESCE(u.business_name, u.name) AS business, u.phone AS business_phone, u.address AS business_address, u.ntn AS business_ntn, u.currency,
  COALESCE((SELECT SUM(p.amount) FROM invoice_payments p LEFT JOIN transactions t ON t.id = p.transaction_id
            WHERE p.invoice_id = i.id AND (p.transaction_id IS NULL OR t.deleted_at IS NULL)), 0)::float8 AS paid
  FROM invoices i JOIN users u ON u.id = i.user_id`;

const parse = (r: Invoice & { items: unknown }): Invoice => ({ ...r, items: typeof r.items === "string" ? JSON.parse(r.items) : r.items } as Invoice);

/**
 * An invoice put in a customer's khata is paid by ANY money the customer pays, not only by payments
 * recorded on the invoice: a payment recorded on an invoice goes to that invoice first; every other
 * payment from the customer pays off the oldest amounts first (the way khata is settled).
 * Sets `paid` (and `paidKhata`, the part that came through khata) on those invoices.
 */
async function withKhataPayments(d: Db, rows: Invoice[]) {
  const inKhata = rows.filter((r) => r.customer_account_id && r.transaction_id && !r.cancelled);
  if (!inKhata.length) return rows;
  const userId = inKhata[0].user_id;
  const custIds = [...new Set(inKhata.map((r) => r.customer_account_id!))];
  const txns = await d.q<{ id: number; date: string; amount: number; from_account_id: number; to_account_id: number }>(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, amount::float8 AS amount, from_account_id, to_account_id FROM transactions
     WHERE user_id = $1 AND deleted_at IS NULL AND (to_account_id = ANY($2::int[]) OR from_account_id = ANY($2::int[])) ORDER BY date, id`,
    [userId, custIds],
  );
  const all = await d.q<{ id: number; customer_account_id: number; transaction_id: number | null; tax_transaction_id: number | null }>(
    "SELECT id, customer_account_id, transaction_id, tax_transaction_id FROM invoices WHERE user_id = $1 AND customer_account_id = ANY($2::int[]) AND NOT cancelled",
    [userId, custIds],
  );
  const linked = await d.q<{ invoice_id: number; transaction_id: number; amount: number }>(
    `SELECT p.invoice_id, p.transaction_id, p.amount::float8 AS amount FROM invoice_payments p JOIN transactions t ON t.id = p.transaction_id
     JOIN invoices i ON i.id = p.invoice_id WHERE i.user_id = $1 AND t.deleted_at IS NULL AND NOT i.cancelled AND i.customer_account_id = ANY($2::int[])`,
    [userId, custIds],
  );
  const owe = new Map<number, number>(); // charge transaction id -> still unpaid
  const chargeOf = new Map<number, number[]>(); // invoice id -> its charge transaction ids
  for (const inv of all) chargeOf.set(inv.id, [inv.transaction_id, inv.tax_transaction_id].filter((x): x is number => !!x));
  const unpaidOf = new Map<number, number>(); // invoice id -> unpaid
  for (const cust of custIds) {
    const mine = txns.filter((t) => t.to_account_id === cust || t.from_account_id === cust);
    for (const t of mine) if (t.to_account_id === cust) owe.set(t.id, t.amount);
    const usedCredit = new Set<number>();
    // 1. payments recorded on an invoice go to that invoice
    for (const p of linked) {
      const charges = chargeOf.get(p.invoice_id);
      if (!charges || all.find((x) => x.id === p.invoice_id)?.customer_account_id !== cust) continue;
      usedCredit.add(p.transaction_id);
      let left = p.amount;
      for (const c of charges) {
        const take = Math.min(left, owe.get(c) ?? 0);
        owe.set(c, (owe.get(c) ?? 0) - take);
        left -= take;
      }
    }
    // 2. every other payment from the customer pays the oldest amounts first
    let credit = mine.filter((t) => t.from_account_id === cust && !usedCredit.has(t.id)).reduce((s, t) => s + t.amount, 0);
    for (const t of mine) {
      if (t.to_account_id !== cust || credit <= 0) continue;
      const take = Math.min(credit, owe.get(t.id) ?? 0);
      owe.set(t.id, (owe.get(t.id) ?? 0) - take);
      credit -= take;
    }
  }
  for (const inv of all) unpaidOf.set(inv.id, (chargeOf.get(inv.id) ?? []).reduce((s, c) => s + (owe.get(c) ?? 0), 0));
  return rows.map((r) => {
    if (!unpaidOf.has(r.id)) return r;
    const paid = Math.max(0, r.total - unpaidOf.get(r.id)!);
    return { ...r, paidKhata: Math.max(0, paid - r.paid), paid };
  });
}

export async function listInvoices(d: Db, userId: number) {
  return withKhataPayments(d, (await d.q<Invoice>(`${SELECT} WHERE i.user_id = $1 ORDER BY i.number DESC LIMIT 500`, [userId])).map(parse));
}

export async function getInvoice(d: Db, userId: number, id: number) {
  if (!Number.isInteger(id)) return undefined;
  const [r] = await d.q<Invoice>(`${SELECT} WHERE i.user_id = $1 AND i.id = $2`, [userId, id]);
  return r && (await withKhataPayments(d, [parse(r)]))[0];
}

/** For the public link sent to the customer. */
export async function getInvoiceByToken(d: Db, token: string) {
  if (!/^[\w-]{20,40}$/.test(token)) return undefined;
  const [r] = await d.q<Invoice>(`${SELECT} WHERE i.share_token = $1`, [token]);
  return r && (await withKhataPayments(d, [parse(r)]))[0];
}

/** Cancel: the entries it added to the books are deleted (they stay in the deleted log). */
export async function cancelInvoice(d: Db, userId: number, id: number) {
  const inv = await getInvoice(d, userId, id);
  if (!inv) throw new Error("Invoice not found");
  if (inv.cancelled) return;
  await d.tx(async (x) => {
    const [r] = await x.q<{ t1: number | null; t2: number | null }>(
      "SELECT transaction_id AS t1, tax_transaction_id AS t2 FROM invoices WHERE id = $1",
      [id],
    );
    // Money the customer already paid stays theirs: in khata it becomes credit (an advance) for their next purchase.
    // Without a khata the payment came straight from Sales, so it is taken back out with the sale.
    const keepPaid = !!(inv.customer_account_id && r.t1);
    const pays = keepPaid ? [] : await x.q<{ t: number | null }>("SELECT transaction_id AS t FROM invoice_payments WHERE invoice_id = $1", [id]);
    for (const t of [r.t1, r.t2, ...pays.map((p) => p.t)]) {
      if (t) {
        const [live] = await x.q("SELECT 1 FROM transactions WHERE id = $1 AND deleted_at IS NULL", [t]);
        if (live) await deleteTransaction(x, userId, t, { internal: true });
      }
    }
    await x.q("UPDATE invoices SET cancelled = true WHERE id = $1", [id]);
    // What it took out of stock goes back (and its cost back into Stock).
    for (const m of await x.q<{ id: number }>("SELECT id FROM stock_moves WHERE invoice_id = $1 AND user_id = $2", [id, userId])) await removeEntries(x, userId, m.id);
    await x.q("DELETE FROM stock_moves WHERE invoice_id = $1 AND user_id = $2", [id, userId]);
  });
}

// ---------- Payments against an invoice ----------

export async function recordInvoicePayment(
  d: Db,
  userId: number,
  invoiceId: number,
  p: { amount: number; date: string; intoAccountId: number },
) {
  const inv = await getInvoice(d, userId, invoiceId);
  if (!inv) throw new Error("Invoice not found");
  if (inv.cancelled) throw new Error("This invoice was cancelled");
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw new Error("Amount must be more than zero");
  const due = inv.total - inv.paid;
  if (p.amount > due) throw new Error("That's more than the balance due");
  checkDate(p.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new Error("Invalid date");
  // Money comes from the customer's khata (or straight from Sales if the invoice wasn't put in the books).
  const from = inv.customer_account_id ?? (await ensureAccount(d, userId, { name: "Income", kind: "income" }, "Sales", "Sales"));
  await d.tx(async (x) => {
    const txnId = await addTransaction(x, userId, {
      type: "receipt",
      date: p.date,
      amount: p.amount,
      fromAccountId: from,
      toAccountId: p.intoAccountId,
      note: `Payment for invoice #${inv.number}`,
      projectId: inv.project_id,
    });
    await x.q("INSERT INTO invoice_payments (invoice_id, transaction_id, amount, date) VALUES ($1, $2, $3, $4)", [invoiceId, txnId, p.amount, p.date]);
  });
}

export async function invoicePayments(d: Db, userId: number, invoiceId: number) {
  return d.q<{ id: number; amount: number; date: string; deleted: boolean }>(
    `SELECT p.id, p.amount::float8 AS amount, to_char(p.date, 'YYYY-MM-DD') AS date, (t.deleted_at IS NOT NULL) AS deleted
     FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN transactions t ON t.id = p.transaction_id
     WHERE p.invoice_id = $1 AND i.user_id = $2 ORDER BY p.date, p.id`,
    [invoiceId, userId],
  );
}
