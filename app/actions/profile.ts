"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { removePhoto, setPhoto } from "@/lib/profile";

export async function uploadPhoto(form: FormData): Promise<{ error?: string }> {
  const u = await requireUser();
  const f = form.get("photo");
  if (!(f instanceof File) || !f.size) return { error: "Choose a photo first" };
  try {
    await setPhoto(await db(), u.id, new Uint8Array(await f.arrayBuffer()));
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function deletePhoto(): Promise<{ error?: string }> {
  const u = await requireUser();
  await removePhoto(await db(), u.id);
  revalidatePath("/", "layout");
  return {};
}
