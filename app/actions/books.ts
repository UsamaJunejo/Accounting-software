"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type Db } from "@/lib/db";
import { requireWriter as requireUser } from "@/lib/auth";
import * as B from "@/lib/books";
import { toPaisa, today } from "@/lib/format";
import { CURRENCY_CODES } from "@/lib/currencies";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number(f.get(k));

/** Run an action; on error go back to `path` showing the message. */
async function run(path: string, fn: (uid: number, d: Db) => Promise<unknown>, ok?: string, extra?: () => string) {
  const u = await requireUser();
  let error: string | null = null;
  try {
    await fn(u.id, await db());
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong";
  }
  revalidatePath("/", "layout");
  const sep = path.includes("?") ? "&" : "?";
  if (error) redirect(`${path}${sep}n=${Date.now()}&error=${encodeURIComponent(error)}`);
  redirect(ok ? `${path}${sep}n=${Date.now()}&ok=${encodeURIComponent(ok + (extra?.() ?? ""))}` : path);
}

function txnFrom(form: FormData, primary: string): B.TxnInput {
  const currency = str(form, "currency") || primary;
  let amount: number;
  let foreignAmount: number | null = null;
  let rate: number | null = null;
  if (currency !== primary) {
    if (!CURRENCY_CODES.has(currency)) throw new Error("Unknown currency");
    foreignAmount = toPaisa(str(form, "foreign_amount"));
    rate = Number(str(form, "rate").replace(/,/g, ""));
    if (Number.isNaN(foreignAmount)) throw new Error(`Please enter a valid amount in ${currency}`);
    if (!(rate > 0) || rate > 1_000_000) throw new Error("Please enter a valid exchange rate");
    amount = Math.round(foreignAmount * rate);
  } else {
    amount = toPaisa(str(form, "amount"));
  }
  if (Number.isNaN(amount)) throw new Error("Please enter a valid amount, e.g. 1500 or 1500.50");
  return {
    primary,
    currency,
    foreignAmount,
    rate,
    projectId: int(form, "project") || null,
    type: str(form, "type") as B.TxnType,
    date: str(form, "date"),
    amount,
    fromAccountId: int(form, "from"),
    toAccountId: int(form, "to"),
    note: str(form, "note"),
    highlight: str(form, "highlight") || null,
  };
}

export async function saveTransaction(form: FormData) {
  const id = int(form, "id");
  const type = str(form, "type") || "payment";
  const back = id ? `/voucher?edit=${id}` : form.get("next") === "close" ? "/transactions" : `/voucher?type=${type}`;
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  let note = "";
  await run(
    back,
    async (uid, d) => {
      const [{ currency: primary }] = await d.q<{ currency: string }>("SELECT currency FROM users WHERE id = $1", [uid]);
      const t = txnFrom(form, primary);
      const txnId = id || (await B.addTransaction(d, uid, t));
      if (id) await B.updateTransaction(d, uid, id, t);
      // Attachments are saved after the entry; a bad file doesn't lose the entry.
      const problems: string[] = [];
      for (const f of files) {
        try {
          await B.addAttachment(d, uid, txnId, { name: f.name, data: new Uint8Array(await f.arrayBuffer()) });
        } catch (e) {
          problems.push((e as Error).message);
        }
      }
      if (problems.length) note = ` (but: ${problems.join("; ")})`;
    },
    id ? "Entry updated" : "Entry saved",
    () => note,
  );
}

export async function deleteAttachment(form: FormData) {
  const id = int(form, "id");
  await run(`/voucher?edit=${id}`, (uid, d) => B.deleteAttachment(d, uid, int(form, "attachment")), "Attachment removed");
}

export async function addProject(form: FormData) {
  await run("/projects", (uid, d) => B.addProject(d, uid, str(form, "name")), "Project added");
}

export async function updateProject(form: FormData) {
  await run(
    "/projects",
    (uid, d) => B.updateProject(d, uid, int(form, "id"), str(form, "name"), form.get("archived") === "on"),
    "Project saved",
  );
}

export async function deleteTransaction(form: FormData) {
  const id = int(form, "id");
  const back = str(form, "back") || "/transactions";
  await run(`${back}${back.includes("?") ? "&" : "?"}undo=${id}`, (uid, d) => B.deleteTransaction(d, uid, id), "Entry deleted");
}

export async function restoreTransaction(form: FormData) {
  const back = str(form, "back");
  await run(back && back.startsWith("/") ? back : "/reports/deleted", (uid, d) => B.restoreTransaction(d, uid, int(form, "id")), "Entry restored");
}

const look = (form: FormData) => ({ color: str(form, "color") || null, icon: str(form, "icon") || null });

export async function addCategory(form: FormData) {
  await run(str(form, "back") || "/accounts", async (uid, d) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    const [kind, role] = str(form, "kind").split(":");
    await B.addCategory(d, uid, name, kind as B.Kind, look(form), (role || null) as B.Role);
  }, "Category added");
}

export async function addSubcategory(form: FormData) {
  await run(str(form, "back") || "/accounts", async (uid, d) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    await B.addSubcategory(d, uid, int(form, "category"), name, look(form));
  }, "Sub-category added");
}

export async function updateCategory(form: FormData) {
  await run(str(form, "back") || "/accounts", (uid, d) => B.updateCategory(d, uid, int(form, "id"), str(form, "name"), look(form)), "Saved");
}

export async function updateSubcategory(form: FormData) {
  await run(
    str(form, "back") || "/accounts",
    (uid, d) => B.updateSubcategory(d, uid, int(form, "id"), str(form, "name"), int(form, "category"), look(form)),
    "Saved",
  );
}

function budget(form: FormData) {
  const b = str(form, "budget");
  if (!b) return null;
  const p = toPaisa(b);
  if (Number.isNaN(p)) throw new Error("Invalid budget amount");
  return p;
}

export async function addAccount(form: FormData) {
  const back = str(form, "back") || "/accounts";
  await run(back, async (uid, d) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    const sub = int(form, "subcategory") || (await B.defaultSubcategory(d, uid, int(form, "category")));
    const raw = str(form, "opening");
    const opening = raw ? toPaisa(raw) : 0;
    if (Number.isNaN(opening)) throw new Error("Please enter the balance as a number, e.g. 5000");
    // Account and its opening balance are saved together, or not at all.
    await d.tx(async (x) => {
      const id = await B.addAccount(x, uid, sub, name, { phone: str(form, "phone"), budgetMonthly: budget(form) });
      if (opening > 0) await B.addOpeningBalance(x, uid, id, opening, today());
    });
  }, "Account added");
}

/** Money or a balance the account already had before using the app. */
export async function addStartingBalance(form: FormData) {
  const id = int(form, "id");
  await run(`/accounts/${id}`, async (uid, d) => {
    const amount = toPaisa(str(form, "opening"));
    if (Number.isNaN(amount) || amount <= 0) throw new Error("Please enter the balance as a number, e.g. 300000");
    const date = str(form, "date") || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
    await B.addOpeningBalance(d, uid, id, amount, date);
  }, "Starting balance added");
}

export async function updateAccount(form: FormData) {
  const id = int(form, "id");
  await run(`/accounts/${id}/edit`, async (uid, d) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    await B.updateAccount(d, uid, id, {
      name,
      subcategoryId: int(form, "subcategory"),
      phone: str(form, "phone"),
      budgetMonthly: budget(form),
      archived: form.get("archived") === "on",
    });
  }, "Account saved");
}

export async function deleteAccount(form: FormData) {
  const id = int(form, "id");
  const u = await requireUser();
  try {
    await B.deleteAccount(await db(), u.id, id);
  } catch (e) {
    redirect(`/accounts/${id}/edit?n=${Date.now()}&error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/", "layout");
  redirect(`/accounts?n=${Date.now()}&ok=Account deleted`);
}

export async function renameCategory(form: FormData) {
  await run("/accounts", (uid, d) => B.renameCategory(d, uid, int(form, "id"), str(form, "name")), "Saved");
}

export async function renameSubcategory(form: FormData) {
  await run(
    "/accounts",
    (uid, d) => B.renameSubcategory(d, uid, int(form, "id"), str(form, "name"), int(form, "category")),
    "Saved",
  );
}

export async function deleteCategory(form: FormData) {
  await run(str(form, "back") || "/accounts", (uid, d) => B.deleteCategory(d, uid, int(form, "id")), "Category deleted");
}

export async function deleteSubcategory(form: FormData) {
  await run(str(form, "back") || "/accounts", (uid, d) => B.deleteSubcategory(d, uid, int(form, "id")), "Sub-category deleted");
}

export async function setStatementLink(form: FormData) {
  const id = int(form, "id");
  await run(`/accounts/${id}`, (uid, d) => B.statementLink(d, uid, id, form.get("on") === "1"), form.get("on") === "1" ? "Statement link ready" : "Statement link turned off");
}
