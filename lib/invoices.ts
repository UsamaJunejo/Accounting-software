import { randomBytes } from "node:crypto";
import type { Db } from "./db.ts";
import { addAccount, addSubcategory, addTransaction, accountsWithBalances, categories, checkDate, deleteTransaction, subcategories, type Kind, type Role } from "./books.ts";

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

/** Find an account by name in a category, creating the sub-category/account if needed. */
/** Find (or make) an account. The category is found by its role, then by name, then by kind,
 *  so it still works after the user renames their categories. */
async function ensureAccount(d: Db, userId: number, want: { role?: Role; name: string; kind: Kind }, subName: string, accountName: string) {
  const cats = await categories(d, userId);
  const cat =
    (want.role ? cats.find((c) => c.role === want.role) : undefined) ??
    cats.find((c) => c.name === want.name && c.kind === want.kind) ??
    cats.find((c) => c.kind === want.kind && !c.role);
  if (!cat) throw new Error(`Category "${want.name}" is missing`);
  const accs = await accountsWithBalances(d, userId);
  const found = accs.find((a) => a.name.toLowerCase() === accountName.toLowerCase() && a.category_id === cat.id && !a.archived);
  if (found) return found.id;
  const sub =
    (await subcategories(d, userId)).find((s) => s.category_id === cat.id && s.name === subName) ??
    (await subcategories(d, userId)).find((s) => s.category_id === cat.id);
  const subId = sub ? sub.id : await addSubcategory(d, userId, cat.id, subName);
  return addAccount(d, userId, subId, accountName);
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

  return d.tx(async (x) => {
    let txnId: number | null = null;
    let taxTxnId: number | null = null;
    const [{ n }] = await x.q<{ n: number }>("SELECT COALESCE(MAX(number), 0) + 1 AS n FROM invoices WHERE user_id = $1", [userId]);
    if (i.record) {
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
        });
      }
    }
    const [row] = await x.q<{ id: number }>(
      `INSERT INTO invoices (user_id, number, customer_account_id, customer_name, customer_phone, date, due_date, items,
         tax_percent, discount, subtotal, tax, total, notes, transaction_id, tax_transaction_id, share_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [
        userId, n, customerId, customerName, phone, i.date, i.dueDate || null, JSON.stringify(items), i.taxPercent ?? 0,
        i.discount ?? 0, t.subtotal, t.tax, t.total, i.notes || null, txnId, taxTxnId, randomBytes(18).toString("base64url"),
      ],
    );
    // Lines picked from Items take that many out of stock.
    for (const it of items.filter((x) => x.itemId)) {
      const [own] = await x.q("SELECT 1 FROM items WHERE id = $1 AND user_id = $2", [it.itemId, userId]);
      if (!own) throw new Error(`Item "${it.name}" not found`);
      await x.q(
        "INSERT INTO stock_moves (user_id, item_id, date, qty, unit_cost, reason, invoice_id) VALUES ($1, $2, $3, $4, NULL, 'sale', $5)",
        [userId, it.itemId, i.date, -it.qty, row.id],
      );
    }
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
  share_token: string;
  cancelled: boolean;
  business: string;
  business_phone: string | null;
  business_address: string | null;
  business_ntn: string | null;
  currency: string;
  paid: number;
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
  i.tax::float8 AS tax, i.total::float8 AS total, i.notes, i.transaction_id, i.share_token, i.cancelled,
  COALESCE(u.business_name, u.name) AS business, u.phone AS business_phone, u.address AS business_address, u.ntn AS business_ntn, u.currency,
  COALESCE((SELECT SUM(p.amount) FROM invoice_payments p LEFT JOIN transactions t ON t.id = p.transaction_id
            WHERE p.invoice_id = i.id AND (p.transaction_id IS NULL OR t.deleted_at IS NULL)), 0)::float8 AS paid
  FROM invoices i JOIN users u ON u.id = i.user_id`;

const parse = (r: Invoice & { items: unknown }): Invoice => ({ ...r, items: typeof r.items === "string" ? JSON.parse(r.items) : r.items } as Invoice);

export async function listInvoices(d: Db, userId: number) {
  return (await d.q<Invoice>(`${SELECT} WHERE i.user_id = $1 ORDER BY i.number DESC LIMIT 500`, [userId])).map(parse);
}

export async function getInvoice(d: Db, userId: number, id: number) {
  if (!Number.isInteger(id)) return undefined;
  const [r] = await d.q<Invoice>(`${SELECT} WHERE i.user_id = $1 AND i.id = $2`, [userId, id]);
  return r && parse(r);
}

/** For the public link sent to the customer. */
export async function getInvoiceByToken(d: Db, token: string) {
  if (!/^[\w-]{20,40}$/.test(token)) return undefined;
  const [r] = await d.q<Invoice>(`${SELECT} WHERE i.share_token = $1`, [token]);
  return r && parse(r);
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
    const pays = await x.q<{ t: number | null }>("SELECT transaction_id AS t FROM invoice_payments WHERE invoice_id = $1", [id]);
    for (const t of [r.t1, r.t2, ...pays.map((p) => p.t)]) {
      if (t) {
        const [live] = await x.q("SELECT 1 FROM transactions WHERE id = $1 AND deleted_at IS NULL", [t]);
        if (live) await deleteTransaction(x, userId, t);
      }
    }
    await x.q("UPDATE invoices SET cancelled = true WHERE id = $1", [id]);
    // What it took out of stock goes back.
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
