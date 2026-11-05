"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, RotateCcw, TriangleAlert, X } from "lucide-react";
import { restoreTransaction } from "@/app/actions/books";

/**
 * Shows "Saved ✓"-style messages that pages pass back in the address (?ok=… / ?error=…).
 * Success messages fade after a few seconds; errors stay until closed.
 */
export function Toaster() {
  const sp = useSearchParams();
  const path = usePathname();
  const [msg, setMsg] = useState<{ ok?: string; error?: string; undo?: string } | null>(null);

  const first = useRef(true);
  useEffect(() => {
    const ok = sp.get("ok") ?? undefined;
    const error = sp.get("error") ?? undefined;
    const undo = sp.get("undo") ?? undefined;
    // On a page reload, don't repeat an old message (the address is left as it is,
    // so nothing here ever interferes with moving between pages).
    const reloaded = first.current && (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload";
    first.current = false;
    if ((!ok && !error) || reloaded) return;
    setMsg({ ok, error, undo });
  }, [sp, path]);

  useEffect(() => {
    if (!msg || msg.error) return;
    const t = setTimeout(() => setMsg(null), msg.undo ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  const isErr = Boolean(msg.error);
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 lg:bottom-6">
      <div
        role={isErr ? "alert" : "status"}
        className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl px-4 py-3 text-[15px] shadow-xl ring-1 ${
          isErr ? "bg-khata text-white ring-khata-dark" : "bg-ink text-white ring-black/10"
        }`}
      >
        {isErr ? <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mustard" />}
        <span className="flex-1">{msg.error ?? msg.ok}</span>
        {msg.undo && (
          <form action={restoreTransaction}>
            <input type="hidden" name="id" value={msg.undo} />
            <input type="hidden" name="back" value={path} />
            <button className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25"><RotateCcw className="h-4 w-4" />Undo</button>
          </form>
        )}
        <button onClick={() => setMsg(null)} aria-label="Close" className="rounded p-0.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
