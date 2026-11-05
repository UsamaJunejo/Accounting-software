"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import * as B from "@/lib/books";
import { toPaisa } from "@/lib/format";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number(f.get(k));

/** Run an action; on error go back to `path` showing the message. */
async function run(path: string, fn: (uid: number) => void, ok?: string) {
  const u = await requireUser();
  let error: string | null = null;
  try {
    fn(u.id);
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
    (uid) => {
      const t = txnFrom(form);
      if (id) B.updateTransaction(db(), uid, id, t);
      else B.addTransaction(db(), uid, t);
    },
    id ? "Entry updated" : "Entry saved",
  );
}

export async function deleteTransaction(form: FormData) {
  await run(str(form, "back") || "/transactions", (uid) => B.deleteTransaction(db(), uid, int(form, "id")), "Entry deleted");
}

export async function restoreTransaction(form: FormData) {
  await run("/reports/deleted", (uid) => B.restoreTransaction(db(), uid, int(form, "id")), "Entry restored");
}

export async function addCategory(form: FormData) {
  await run("/accounts", (uid) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    B.addCategory(db(), uid, name, str(form, "kind") as B.Kind);
  }, "Category added");
}

export async function addSubcategory(form: FormData) {
  await run("/accounts", (uid) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    B.addSubcategory(db(), uid, int(form, "category"), name);
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
  await run(back, (uid) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    B.addAccount(db(), uid, int(form, "subcategory"), name, { phone: str(form, "phone"), budgetMonthly: budget(form) });
  }, "Account added");
}

export async function updateAccount(form: FormData) {
  const id = int(form, "id");
  await run(`/accounts/${id}/edit`, (uid) => {
    const name = str(form, "name");
    if (!name) throw new Error("Name is required");
    B.updateAccount(db(), uid, id, {
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
    B.deleteAccount(db(), u.id, id);
  } catch (e) {
    redirect(`/accounts/${id}/edit?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/", "layout");
  redirect("/accounts?ok=Account deleted");
}

export async function renameCategory(form: FormData) {
  await run("/accounts", (uid) => B.renameCategory(db(), uid, int(form, "id"), str(form, "name")), "Saved");
}

export async function renameSubcategory(form: FormData) {
  await run(
    "/accounts",
    (uid) => B.renameSubcategory(db(), uid, int(form, "id"), str(form, "name"), int(form, "category")),
    "Saved",
  );
}

export async function deleteCategory(form: FormData) {
  await run("/accounts", (uid) => B.deleteCategory(db(), uid, int(form, "id")), "Category deleted");
}

export async function deleteSubcategory(form: FormData) {
  await run("/accounts", (uid) => B.deleteSubcategory(db(), uid, int(form, "id")), "Sub-category deleted");
}
