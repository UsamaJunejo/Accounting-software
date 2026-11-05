"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

const MAX_SIDE = 1600;

/** Shrink big phone photos before upload (a 5 MB photo becomes ~300 KB) so saving is quick. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.78));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function AttachmentPicker({ max }: { max: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function sync(list: File[]) {
    const dt = new DataTransfer();
    list.forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    setFiles(list);
  }

  if (max <= 0) return <p className="text-xs text-slate-500">This entry already has the most attachments allowed.</p>;
  return (
    <div>
      <label className="btn-ghost cursor-pointer">
        <Paperclip className="h-4 w-4" />
        {busy ? "Preparing…" : "Attach bill / receipt"}
        <input
          ref={input}
          type="file"
          name="files"
          multiple
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={async (e) => {
            setError("");
            const picked = Array.from(e.target.files ?? []);
            setBusy(true);
            const ready = await Promise.all(picked.map(shrink));
            setBusy(false);
            const all = [...files, ...ready];
            if (all.length > max) setError(`Only ${max} more allowed. Extra files were left out.`);
            const tooBig = all.filter((f) => f.size > 3 * 1024 * 1024);
            if (tooBig.length) setError("Files over 3 MB were left out.");
            sync(all.filter((f) => f.size <= 3 * 1024 * 1024).slice(0, max));
          }}
        />
      </label>
      <span className="ml-2 text-xs text-slate-500">Photos or PDFs, up to {max}</span>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <Paperclip className="h-3 w-3" />
              {f.name} ({Math.ceil(f.size / 1024)} KB)
              <button type="button" onClick={() => sync(files.filter((_, j) => j !== i))} aria-label="Remove" className="text-red-600">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
