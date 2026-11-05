"use client";

import { useRef } from "react";

/**
 * A submit button that first asks "Are you sure?" in an in-app box (not the browser's grey pop-up).
 * Put it inside the form it belongs to.
 */
export function ConfirmButton({
  message,
  confirmLabel = "Yes, continue",
  danger = true,
  className,
  children,
  name,
  value,
}: {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
  name?: string;
  value?: string;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const real = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => dlg.current?.showModal()}>
        {children}
      </button>
      <button ref={real} type="submit" name={name} value={value} hidden tabIndex={-1} aria-hidden="true" />
      <dialog
        ref={dlg}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-white/70 bg-white p-0 text-body shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
      >
        <div className="p-5">
          <p className="text-[15px] text-ink">{message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => dlg.current?.close()} autoFocus>Cancel</button>
            <button
              type="button"
              className={danger ? "btn bg-khata text-white hover:bg-khata-dark" : "btn-primary"}
              onClick={() => {
                dlg.current?.close();
                real.current?.form?.requestSubmit(real.current);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
