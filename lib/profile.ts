import type { Db } from "./db.ts";
import { sniffMime } from "./books.ts";

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Save a profile photo. Only real JPEG, PNG or WebP pictures are accepted (checked from the file itself). */
export async function setPhoto(d: Db, userId: number, data: Uint8Array) {
  if (!data.length) throw new Error("Choose a photo first");
  if (data.length > MAX_PHOTO_BYTES) throw new Error("That photo is too big. Please choose one under 2 MB.");
  const mime = sniffMime(data);
  if (!mime || mime === "application/pdf") throw new Error("That file isn't a photo. Please choose a JPG, PNG or WebP picture.");
  await d.q("UPDATE users SET photo = $1, photo_mime = $2, photo_at = now() WHERE id = $3", [data, mime, userId]);
}

export async function removePhoto(d: Db, userId: number) {
  await d.q("UPDATE users SET photo = NULL, photo_mime = NULL, photo_at = now() WHERE id = $1", [userId]);
}

export async function getPhoto(d: Db, userId: number) {
  const [r] = await d.q<{ photo: Uint8Array | null; photo_mime: string | null }>("SELECT photo, photo_mime FROM users WHERE id = $1", [userId]);
  return r?.photo && r.photo_mime ? { data: r.photo, mime: r.photo_mime } : null;
}
