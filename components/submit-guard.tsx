"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Stops double saves on slow connections: when any form is sent, its button shows
 * a small spinner and ignores further taps until the next page appears (or 8 seconds pass).
 */
export function SubmitGuard() {
  const path = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    const busy = new Set<HTMLButtonElement>();
    const release = (b: HTMLButtonElement) => {
      if (!b.dataset.busy) return;
      delete b.dataset.busy;
      b.disabled = false;
      b.removeAttribute("aria-busy");
      busy.delete(b);
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (form.method?.toLowerCase() === "get" && !form.getAttribute("action")?.startsWith("javascript")) {
        // plain filters (GET) don't need a lock
        if (!form.querySelector('input[type="file"]')) return;
      }
      const b = (e.submitter as HTMLButtonElement | null) ?? form.querySelector<HTMLButtonElement>("button:not([type=button])");
      if (!b) return;
      if (b.dataset.busy) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      b.dataset.busy = "1";
      busy.add(b);
      // Wait a tick so the browser has already read the button's name/value into the form data.
      setTimeout(() => {
        // Another check on the page stopped this form (e.g. a missing amount): don't lock the button.
        if (e.defaultPrevented) {
          delete b.dataset.busy;
          busy.delete(b);
          return;
        }
        // Only attributes change here: the button's text belongs to React and is left alone.
        b.disabled = true;
        b.setAttribute("aria-busy", "true");
      }, 0);
      setTimeout(() => release(b), 8000);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      busy.forEach(release);
    };
  }, [path, sp]);

  return null;
}
