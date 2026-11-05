"use client";

import { useRef } from "react";
import { X } from "lucide-react";

/** A button that opens a small form in a pop-up window (native <dialog>: keyboard and Esc work). */
export function Dialog({ trigger, title, children, triggerClass = "" }: { trigger: React.ReactNode; title: string; children: React.ReactNode; triggerClass?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={triggerClass}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-white/70 bg-white/95 p-0 text-body shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-paper">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </dialog>
    </>
  );
}
