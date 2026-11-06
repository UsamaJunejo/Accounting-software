"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWriter } from "@/lib/auth";
import { quickAddToCategory, type Kind, type Role } from "@/lib/books";
import { friendlyCategory } from "@/lib/look";

export type QuickResult =
  | { ok: true; id: number; name: string; group: string; existed: boolean; kind: Kind; role: Role; balance: number; currency: string | null }
  | { ok: false; error: string };

/** Called from the account picker: make the account (in the chosen category) without leaving the entry form. */
export async function quickAccount(name: string, categoryId: number): Promise<QuickResult> {
  const u = await requireWriter();
  try {
    const a = await quickAddToCategory(await db(), u.id, String(name), Number(categoryId));
    revalidatePath("/", "layout");
    return { ok: true, id: a.id, name: a.name, group: friendlyCategory(a.category), existed: a.existed, kind: a.kind, role: a.role, balance: a.balance, currency: a.currency };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
