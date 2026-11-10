"use server";

import { go as redirect } from "@/lib/go";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWriter } from "@/lib/auth";
import { toPaisa, today } from "@/lib/format";
import { addItem, addStock, countStock, deleteItem, updateItem, type ItemInput } from "@/lib/items";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k).replace(/,/g, ""));
const back = (path: string, key: "ok" | "error", msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}n=${Date.now()}&${key}=${encodeURIComponent(msg)}`);

function price(f: FormData, k: string) {
  const raw = str(f, k);
  if (!raw) return 0;
  const p = toPaisa(raw);
  if (Number.isNaN(p)) throw new Error("Please check the prices: use numbers like 1500 or 1,500.50");
  return p;
}

function itemFrom(f: FormData): ItemInput {
  return {
    name: str(f, "name"),
    unit: str(f, "unit"),
    group: str(f, "group") || null,
    salePrice: price(f, "sale_price"),
    costPrice: price(f, "cost_price"),
    lowStock: str(f, "low_stock") ? num(f, "low_stock") : null,
  };
}

async function run(path: string, ok: string, fn: (uid: number) => Promise<unknown>, okPath?: () => string) {
  const u = await requireWriter();
  try {
    await fn(u.id);
  } catch (e) {
    back(path, "error", (e as Error).message);
  }
  revalidatePath("/", "layout");
  back(okPath?.() ?? path, "ok", ok);
}

export async function addItemAction(form: FormData) {
  let id = 0;
  await run("/items", "Item added", async (uid) => {
    id = await addItem(await db(), uid, { ...itemFrom(form), openingQty: str(form, "opening") ? num(form, "opening") : 0 }, today());
  }, () => `/items/${id}`);
}

export async function updateItemAction(form: FormData) {
  const id = Number(form.get("id"));
  await run(`/items/${id}`, "Item saved", async (uid) => updateItem(await db(), uid, id, { ...itemFrom(form), archived: form.get("archived") === "on" }));
}

export async function deleteItemAction(form: FormData) {
  const id = Number(form.get("id"));
  await run(`/items/${id}`, "Item deleted", async (uid) => deleteItem(await db(), uid, id), () => "/items");
}

export async function addStockAction(form: FormData) {
  const id = Number(form.get("id"));
  await run(`/items/${id}`, "Stock added", async (uid) =>
    addStock(await db(), uid, id, {
      qty: num(form, "qty"),
      unitCost: price(form, "unit_cost"),
      date: str(form, "date") || today(),
      fromAccountId: Number(form.get("from")) || null,
      note: str(form, "note"),
    }),
  );
}

export async function countStockAction(form: FormData) {
  const id = Number(form.get("id"));
  await run(`/items/${id}`, "Stock corrected", async (uid) => {
    if (!str(form, "counted")) throw new Error("Please type how many you counted");
    await countStock(await db(), uid, id, num(form, "counted"), str(form, "date") || today(), str(form, "note"));
  });
}
