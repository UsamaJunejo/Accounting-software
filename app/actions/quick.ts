"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWriter } from "@/lib/auth";
import { addOpeningBalance, quickAddAccount, type AccountChoice, type Kind, type Role } from "@/lib/books";
import { friendlyCategory } from "@/lib/look";
import { toPaisa, today } from "@/lib/format";

export type QuickResult =
  | { ok: true; id: number; name: string; group: string; existed: boolean; kind: Kind; role: Role; balance: number; currency: string | null }
  | { ok: false; error: string };

/** Called from the account picker: make the account without leaving the entry form. */
export async function quickAccount(name: string, choice: AccountChoice): Promise<QuickResult> {
  const u = await requireWriter();
  try {
    const a = await quickAddAccount(await db(), u.id, String(name), choice);
    revalidatePath("/", "layout");
    return { ok: true, id: a.id, name: a.name, group: friendlyCategory(a.category), existed: a.existed, kind: a.kind, role: a.role, balance: a.balance, currency: a.currency };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The "Add account" box on the Accounts page: name, what it is, and an optional starting balance. */
export async function addAccountPlain(form: FormData) {
  const u = await requireWriter();
  const d = await db();
  const raw = String(form.get("opening") ?? "").trim();
  const opening = raw ? toPaisa(raw) : 0;
  let target = "";
  let error = "";
  try {
    if (Number.isNaN(opening)) throw new Error("Please enter the balance as a number, e.g. 5000");
    await d.tx(async (x) => {
      const cur = String(form.get("currency") ?? "") || null;
      const a = await quickAddAccount(x, u.id, String(form.get("name") ?? ""), String(form.get("choice")) as AccountChoice, cur);
      if (a.existed) throw new Error(`You already have an account called "${a.name}".`);
      if (opening > 0) {
        if (a.currency) {
          // Typed in the account's own currency: needs today's rate to show it in the main currency too.
          const rate = Number(String(form.get("rate") ?? "").replace(/,/g, ""));
          if (!(rate > 0)) throw new Error(`Enter the rate for ${a.currency}, so the balance can also be shown in your main currency.`);
          await addOpeningBalance(x, u.id, a.id, Math.round(opening * rate), today(), { foreignAmount: opening, rate });
        } else await addOpeningBalance(x, u.id, a.id, opening, today());
      }
      target = `/accounts/${a.id}`;
    });
  } catch (e) {
    error = (e as Error).message;
  }
  revalidatePath("/", "layout");
  if (error) redirect(`/accounts?n=${Date.now()}&error=${encodeURIComponent(error)}`);
  redirect(`${target}?n=${Date.now()}&ok=${encodeURIComponent("Account added")}`);
}
