"use client";

import { useEffect, useState } from "react";
import { currencySymbol } from "@/lib/currencies";

const fmt = (n: number, d = 2) => new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: d }).format(n);

/**
 * Today's exchange rate, shown but not editable: the app fetches it once a day and uses that same
 * rate when saving. Optionally shows what an amount comes to in the main currency.
 */
export function RateNote({ from, to, amount, onRate }: { from: string; to: string; amount?: number; onRate?: (r: number | null) => void }) {
  const [rate, setRate] = useState<number | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    setRate(null);
    setErr("");
    fetch(`/api/rate?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        if (j.rate) setRate(j.rate);
        else setErr(j.error || "Today's rate isn't available right now. Please try again in a minute.");
        onRate?.(j.rate ?? null);
      })
      .catch(() => live && setErr("Today's rate isn't available right now. Please try again in a minute."));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="rounded-md border border-rule bg-paper px-3 py-2.5 text-[15px]" aria-live="polite">
      {err ? (
        <span className="font-semibold text-khata">{err}</span>
      ) : rate === null ? (
        <span className="text-muted">Getting today&apos;s rate…</span>
      ) : (
        <>
          <div>
            <span className="text-muted">Today&apos;s rate: </span>
            <b dir="ltr">1 {from} = {currencySymbol(to)} {fmt(rate, 4)}</b>
            <span className="text-xs text-muted"> · updated daily</span>
          </div>
          {amount !== undefined && amount > 0 && (
            <div>
              <span className="text-muted">Saved in your books as </span>
              <b dir="ltr">{currencySymbol(to)} {fmt(amount * rate)}</b>
            </div>
          )}
        </>
      )}
    </div>
  );
}
