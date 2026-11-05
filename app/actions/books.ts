"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type Db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import * as B from "@/lib/books";
import { toPaisa } from "@/lib/format";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number(f.get(k));

/** Run an action; on error go back to `path` showing the message. */
async function run(path: string, fn: (uid: number, d: Db) => Promise<unknown>, ok?: string) {
  const u = await requireUser();
  let error: string | null = null;
  try {
    await fn(u.id, await db());
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong";
  }
  revalidatePath("/", "layout");
  const sep = path.includes("?") ? "&" : "?";
  if (error) redirect(`${path}${sep}error=${encodeURIComponent(error)}`);
  redirect(ok ? `${path}${sep}ok=${encodeURIComponent(ok)}` : path);
}

function txnFrom(form: FormData): B.TxnInput {
  const amount = toPaisa(str(form, "amount"));
  if (Number.isNaN(amount)) throw new Error("Please enter a valid amount, e.g. 1500 or 1500.50");
  return {
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
  const back = id ? `/voucher?edit=${id}` : `/voucher?type=${type}`;
  await run(
    back,
    async (uid, d) => {
      const t = txnFrom(form);
      if (id) await B.updateTransaction(d, uid, id, t);
      else await B.addTransaction(d, uid, t);
    },
    id ? "Entry updated" : "Entry saved",
  );
}

export async function deleteTransaction(form: FormData) {
  await run(str(form, "back") || "/transactions", (uid, d) => B.deleteTransaction(d, uid, int(form, "id")), "Entry deleted");
}

export async function restoreTransaction(form: FormData) {
  await run("/reports/deleted", (uid, d) => B.restoreTransaction(d, uid, int(form, "id")), "Entry restored");
}

export async function addCategory(form: FormData) {
  await run("/accounts", async (uid, d) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    await B.addCategory(d, uid, name, str(form, "kind") as B.Kind);
  }, "Category added");
}

export async function addSubcategory(form: FormData) {
  await run("/accounts", async (uid, d) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    await B.addSubcategory(d, uid, int(form, "category"), name);
  }, "Sub-category added");
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
    await B.addAccount(d, uid, int(form, "subcategory"), name, { phone: str(form, "phone"), budgetMonthly: budget(form) });
  }, "Account added");
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
    redirect(`/accounts/${id}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/", "layout");
  redirect("/accounts?ok=Account deleted");
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
  await run("/accounts", (uid, d) => B.deleteCategory(d, uid, int(form, "id")), "Category deleted");
}

export async function deleteSubcategory(form: FormData) {
  await run("/accounts", (uid, d) => B.deleteSubcategory(d, uid, int(form, "id")), "Sub-category deleted");
}
