"use client";

import { useState } from "react";

const n = (s: string) => Number(s.replace(/,/g, ""));
const fmt = (v: number) => (Number.isFinite(v) && v > 0 ? String(Math.round(v * 100) / 100) : "");

/**
 * How many + price, where you can type the price for one OR the total for all of them;
 * the other box fills itself (50 laptops for 50,00,000 → 1,00,000 each).
 * The total is what gets saved, so a bulk price is never rounded.
 */
export function PriceBox({ unit, each = "", qtyLabel, eachLabel, totalLabel, idPrefix, defaultQty = "", totalOnly = false }: {
  unit: string; each?: string; qtyLabel: string; eachLabel: string; totalLabel: string; idPrefix: string; defaultQty?: string;
  /** A lot: only how many and the total, no price per piece. */
  totalOnly?: boolean;
}) {
  const [qty, setQty] = useState(defaultQty);
  const [eachV, setEach] = useState(each);
  const [total, setTotal] = useState(defaultQty && each ? fmt(n(defaultQty) * n(each)) : "");
  const [last, setLast] = useState<"each" | "total">("each");
  return (
    <div className={`grid gap-3 ${totalOnly ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      <div>
        <label className="label" htmlFor={`${idPrefix}-qty`}>{qtyLabel} ({unit})</label>
        <input id={`${idPrefix}-qty`} name="qty" inputMode="decimal" required value={qty} className="input"
          onChange={(e) => {
            const q = e.target.value;
            setQty(q);
            if (last === "each") setTotal(fmt(n(q) * n(eachV)));
            else setEach(fmt(n(total) / n(q)));
          }} />
      </div>
      <div className={totalOnly ? "hidden" : ""}>
        <label className="label" htmlFor={`${idPrefix}-each`}>{eachLabel}</label>
        <input id={`${idPrefix}-each`} inputMode="decimal" value={eachV} className="input" placeholder="0"
          onChange={(e) => { setEach(e.target.value); setLast("each"); setTotal(fmt(n(qty) * n(e.target.value))); }} />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-total`}>{totalLabel}</label>
        <input id={`${idPrefix}-total`} name="total" inputMode="decimal" value={total} className="input font-semibold" placeholder="0"
          onChange={(e) => { setTotal(e.target.value); setLast("total"); setEach(fmt(n(e.target.value) / n(qty))); }} />
      </div>
    </div>
  );
}
