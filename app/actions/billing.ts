"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import * as Bl from "@/lib/billing";
import { toPaisa } from "@/lib/format";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function run(path: string, fn: () => Promise<unknown>, ok: string) {
  let error = "";
  try {
    await fn();
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong";
  }
  revalidatePath("/", "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}${error ? `n=${Date.now()}&error=${encodeURIComponent(error)}` : `n=${Date.now()}&ok=${encodeURIComponent(ok)}`}`);
}

// Paying is allowed even when the plan has run out (that's the point), so this uses requireUser.
export async function submitPayment(form: FormData) {
  const u = await requireUser();
  const file = form.get("proof");
  const proof = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
  await run(
    "/billing",
    async () =>
      Bl.submitPayment(await db(), u.id, {
        months: Number(form.get("months")),
        method: str(form, "method"),
        reference: str(form, "reference"),
        proof,
      }),
    "Thank you! Your payment was sent for checking. Your plan is extended as soon as it's approved.",
  );
}

export async function approvePayment(form: FormData) {
  const a = await requireAdmin();
  await run("/admin", async () => Bl.approvePayment(await db(), a.id, Number(form.get("id"))), "Payment approved");
}

export async function rejectPayment(form: FormData) {
  const a = await requireAdmin();
  await run("/admin", async () => Bl.rejectPayment(await db(), a.id, Number(form.get("id")), str(form, "note")), "Payment rejected");
}

export async function grantMonths(form: FormData) {
  const a = await requireAdmin();
  await run("/admin", async () => Bl.grantMonths(await db(), a.id, Number(form.get("user")), Number(form.get("months"))), "Months added");
}

export async function saveBillingSettings(form: FormData) {
  await requireAdmin();
  await run("/admin", async () => {
    const price = toPaisa(str(form, "price"));
    if (Number.isNaN(price)) throw new Error("Enter a valid price");
    await Bl.saveBillingSettings(await db(), {
      price,
      trialDays: Number(str(form, "trialDays")),
      accountTitle: str(form, "accountTitle"),
      jazzcash: str(form, "jazzcash"),
      easypaisa: str(form, "easypaisa"),
      bankName: str(form, "bankName"),
      iban: str(form, "iban"),
      instructions: str(form, "instructions"),
    });
  }, "Billing settings saved");
}
