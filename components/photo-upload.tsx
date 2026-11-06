"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { deletePhoto, uploadPhoto } from "@/app/actions/profile";

/** Make the picture small and square in the browser, so it uploads fast even on slow mobile data. */
async function shrink(file: File, side = 320): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("That file isn't a photo. Please choose a JPG, PNG or WebP picture."));
      i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = side;
    // Centre crop to a square.
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, side, side);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Could not read that photo"))), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoUpload({ name, v }: { name: string; v: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const router = useRouter();

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setMsg({});
    try {
      if (!file.type.startsWith("image/")) throw new Error("That file isn't a photo. Please choose a JPG, PNG or WebP picture.");
      const fd = new FormData();
      fd.append("photo", await shrink(file), "photo.jpg");
      const r = await uploadPhoto(fd);
      if (r.error) throw new Error(r.error);
      setMsg({ ok: "Photo saved" });
      router.refresh();
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} v={v} size={72} className="ring-4" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-dark">
            <Camera className="h-4 w-4" />{busy ? "Saving…" : v ? "Change photo" : "Add photo"}
          </button>
          {v && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await deletePhoto();
                setBusy(false);
                setMsg({ ok: "Photo removed" });
                router.refresh();
              }}
              className="btn-danger"
            >
              <Trash2 className="h-4 w-4" />Remove
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Choose a profile photo" onChange={(e) => pick(e.target.files?.[0])} />
        {msg.error && <p role="alert" className="text-sm font-semibold text-khata">{msg.error}</p>}
        {msg.ok && <p role="status" className="text-sm text-ledger">{msg.ok}</p>}
        {!msg.error && !msg.ok && <p className="text-sm text-muted">A photo from your phone or computer. It&apos;s only shown to you.</p>}
      </div>
    </div>
  );
}
