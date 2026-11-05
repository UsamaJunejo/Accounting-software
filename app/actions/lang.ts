"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isScheme } from "@/lib/schemes";

export async function setScheme(form: FormData) {
  const v = String(form.get("scheme") ?? "");
  if (isScheme(v)) (await cookies()).set("scheme", v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/settings?n=${Date.now()}&ok=Colour theme saved`);
}

export async function setLanguage(form: FormData) {
  const lang = form.get("lang") === "ur" ? "ur" : "en";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  // Go back to the same page (only within this site).
  const ref = (await headers()).get("referer") ?? "/";
  let path = "/";
  try {
    const u = new URL(ref);
    path = u.pathname + u.search;
  } catch {}
  redirect(path.startsWith("/") && !path.startsWith("//") ? path : "/");
}

export async function remindRecoveryLater() {
  (await cookies()).set("recovery-later", "1", { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect(`/dashboard?n=${Date.now()}`);
}

export async function hideChecklist() {
  (await cookies()).set("hide-start", "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect(`/dashboard?n=${Date.now()}`);
}
