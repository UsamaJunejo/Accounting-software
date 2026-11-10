"use server";

import bcrypt from "bcryptjs";
import { go as redirect } from "@/lib/go";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { endSession, requireAdmin, requireUser } from "@/lib/auth";
import { deleteUser, fixEntryTypes, resetBooks } from "@/lib/maintenance";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (path: string, key: "ok" | "error", msg: string): never => {
  // The message must go before any "#section", or the page never sees it.
  const [base, hash] = path.split("#");
  return redirect(`${base}${base.includes("?") ? "&" : "?"}n=${Date.now()}&${key}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
};

/** Big, can't-undo steps need the password and a typed word, so they never happen by accident. */
async function confirm(form: FormData, userId: number, word: string) {
  const [row] = await (await db()).q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
  if (!row || !(await bcrypt.compare(str(form, "password"), row.password_hash))) return "Password is wrong.";
  if (str(form, "confirm").toUpperCase() !== word) return `Type ${word} in the box to confirm.`;
  return "";
}

export async function resetMyBooks(form: FormData) {
  const u = await requireUser();
  const problem = await confirm(form, u.id, "RESET");
  if (problem) back("/settings#start-again", "error", problem);
  const mode = form.get("mode") === "everything" ? "everything" : "entries";
  await resetBooks(await db(), u.id, mode);
  revalidatePath("/", "layout");
  back("/dashboard", "ok", mode === "everything" ? "Your books were reset with fresh accounts." : "All entries were removed. Your accounts are kept.");
}

export async function deleteMyAccount(form: FormData) {
  const u = await requireUser();
  const problem = await confirm(form, u.id, "DELETE");
  if (problem) back("/settings#start-again", "error", problem);
  try {
    await deleteUser(await db(), u.id);
  } catch (e) {
    back("/settings#start-again", "error", (e as Error).message);
  }
  await endSession();
  redirect("/?deleted=1");
}

export async function adminDeleteUser(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (id === admin.id) back("/admin", "error", "Use Settings to delete your own account.");
  try {
    await deleteUser(await db(), id);
  } catch (e) {
    back("/admin", "error", (e as Error).message);
  }
  revalidatePath("/admin");
  back("/admin", "ok", "User and all their data deleted.");
}

export async function adminResetUser(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  await resetBooks(await db(), id, "everything");
  back("/admin/check", "ok", "That user's books were reset.");
}

export async function adminFixEntryTypes() {
  await requireAdmin();
  const n = await fixEntryTypes(await db());
  back("/admin/check", "ok", n ? `Fixed ${n} entry labels.` : "All entry labels were already right.");
}
