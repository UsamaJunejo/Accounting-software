"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Big, easy-to-copy display of a one-time secret (recovery code or temporary password). */
export function CodeBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-brand bg-orange-50 p-4">
      <code className="select-all text-2xl font-bold tracking-wider text-ink">{value}</code>
      <button
        type="button"
        className="btn-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {}
        }}
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
