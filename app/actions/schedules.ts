"use server";

import { go as redirect } from "@/lib/go";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWriter as requireUser } from "@/lib/auth";
import * as S from "@/lib/schedules";
import { toPaisa } from "@/lib/format";
import type { TxnType } from "@/lib/books";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function run(path: string, fn: (uid: number) => Promise<unknown>, ok: string) {
  const u = await requireUser();
  let error = "";
  try {
    await fn(u.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong";
  }
  revalidatePath("/", "layout");
  redirect(`${path}?${error ? `n=${Date.now()}&error=${encodeURIComponent(error)}` : `n=${Date.now()}&ok=${encodeURIComponent(ok)}`}`);
}

export async function addSchedule(form: FormData) {
  await run("/scheduled", async (uid) => {
    const amount = toPaisa(str(form, "amount"));
    if (Number.isNaN(amount)) throw new Error("Please enter a valid amount");
    await S.addSchedule(await db(), uid, {
      type: str(form, "type") as TxnType,
      amount,
      fromAccountId: Number(form.get("from")),
      toAccountId: Number(form.get("to")),
      note: str(form, "note"),
      frequency: str(form, "frequency") as S.Frequency,
      startDate: str(form, "start"),
      endDate: str(form, "end") || null,
      auto: form.get("auto") === "1",
    });
  }, "Scheduled entry saved");
}

export async function toggleSchedule(form: FormData) {
  await run("/scheduled", async (uid) => S.setScheduleActive(await db(), uid, Number(form.get("id")), form.get("active") === "1"), "Saved");
}

export async function deleteSchedule(form: FormData) {
  await run("/scheduled", async (uid) => S.deleteSchedule(await db(), uid, Number(form.get("id"))), "Scheduled entry deleted");
}

export async function addReminderNow(form: FormData) {
  await run(str(form, "back") || "/notifications", async (uid) => S.postReminder(await db(), uid, Number(form.get("id"))), "Entry added");
}

export async function skipReminder(form: FormData) {
  await run(str(form, "back") || "/notifications", async (uid) => S.skipReminder(await db(), uid, Number(form.get("id"))), "Skipped to next time");
}
