"use server";

import { go as redirect } from "@/lib/go";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWriter as requireUser } from "@/lib/auth";
import * as S from "@/lib/sharing";
import { toPaisa } from "@/lib/format";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number(f.get(k));

async function run(path: string, fn: (uid: number) => Promise<unknown>, ok: string) {
  const u = await requireUser();
  let error = "";
  try {
    await fn(u.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong";
  }
  revalidatePath("/", "layout");
  // The message goes before any "#section" part of the address, or the page would never see it.
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  const msg = error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(ok)}`;
  redirect(`${base}${sep}n=${Date.now()}&${msg}${hash ? `#${hash}` : ""}`);
}

export async function shareAccount(form: FormData) {
  const id = int(form, "account");
  await run(`/accounts/${id}#sharing`, async (uid) =>
    S.shareAccount(await db(), uid, id, str(form, "email"), form.get("can_add") === "on"), "Shared. They'll see an invitation.");
}

export async function removeShare(form: FormData) {
  await run(`/accounts/${int(form, "account")}#sharing`, async (uid) => S.removeShare(await db(), uid, int(form, "id")), "Sharing stopped");
}

export async function respondToShare(form: FormData) {
  const accept = form.get("accept") === "1";
  await run("/shared", async (uid) => S.respondToShare(await db(), uid, int(form, "id"), accept), accept ? "Invitation accepted" : "Invitation declined");
}

export async function approveEntry(form: FormData) {
  await run("/shared", async (uid) => S.approveSharedEntry(await db(), uid, int(form, "id"), int(form, "other")), "Approved and added to your books");
}

export async function rejectEntry(form: FormData) {
  await run("/shared", async (uid) => S.rejectSharedEntry(await db(), uid, int(form, "id"), str(form, "remarks")), "Rejected");
}

export async function submitEntry(form: FormData) {
  const id = int(form, "share");
  await run(`/shared/${id}`, async (uid) => {
    const amount = toPaisa(str(form, "amount"));
    if (Number.isNaN(amount)) throw new Error("Please enter a valid amount");
    await S.submitSharedEntry(await db(), uid, id, {
      direction: str(form, "direction") as "increase" | "decrease",
      amount,
      date: str(form, "date"),
      note: str(form, "note"),
    });
  }, "Sent for approval");
}
