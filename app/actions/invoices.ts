"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWriter as requireUser } from "@/lib/auth";
import { cancelInvoice as cancel, createInvoice as create, recordInvoicePayment, type InvoiceItem } from "@/lib/invoices";
import { toPaisa } from "@/lib/format";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export type InvoiceFormState = { error?: string };

export async function createInvoice(_prev: InvoiceFormState, form: FormData): Promise<InvoiceFormState> {
  const u = await requireUser();
  let id = 0;
  try {
    const raw = JSON.parse(str(form, "items") || "[]") as { name: string; qty: string; price: string }[];
    const items: InvoiceItem[] = raw
      .filter((r) => r.name.trim() || r.price)
      .map((r) => {
        const price = toPaisa(r.price || "0");
        const qty = Number(String(r.qty).replace(/,/g, ""));
        if (Number.isNaN(price)) throw new Error(`Check the price of "${r.name}"`);
        return { name: r.name.trim(), qty, price };
      });
    const discount = str(form, "discount") ? toPaisa(str(form, "discount")) : 0;
    if (Number.isNaN(discount)) throw new Error("Check the discount");
    id = await create(await db(), u.id, {
      customerAccountId: Number(form.get("customer")) || null,
      customerName: str(form, "customer_name"),
      customerPhone: str(form, "customer_phone") || null,
      date: str(form, "date"),
      dueDate: str(form, "due_date") || null,
      items,
      taxPercent: Number(str(form, "tax") || 0),
      discount,
      notes: str(form, "notes") || null,
      record: form.get("record") === "on",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the invoice" };
  }
  revalidatePath("/", "layout");
  redirect(`/invoices/${id}?ok=Invoice created`);
}

export async function cancelInvoice(form: FormData) {
  const u = await requireUser();
  const id = Number(form.get("id"));
  let error = "";
  try {
    await cancel(await db(), u.id, id);
  } catch (e) {
    error = (e as Error).message;
  }
  revalidatePath("/", "layout");
  redirect(`/invoices/${id}?${error ? `error=${encodeURIComponent(error)}` : "ok=Invoice cancelled"}`);
}

export async function payInvoice(form: FormData) {
  const u = await requireUser();
  const id = Number(form.get("id"));
  let error = "";
  try {
    const amount = toPaisa(str(form, "amount"));
    if (Number.isNaN(amount)) throw new Error("Please enter a valid amount");
    await recordInvoicePayment(await db(), u.id, id, { amount, date: str(form, "date"), intoAccountId: Number(form.get("into")) });
  } catch (e) {
    error = (e as Error).message;
  }
  revalidatePath("/", "layout");
  redirect(`/invoices/${id}?${error ? `error=${encodeURIComponent(error)}` : "ok=Payment recorded"}`);
}
