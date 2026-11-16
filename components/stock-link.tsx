"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";

/**
 * Shown when money goes to Purchases: "is this stock you will sell?" Picking an item and how many
 * puts them on the shelf with this entry, so there is one way to record buying stock.
 */
export function StockLink({ items, purchaseIds }: { items: { id: number; name: string; unit: string }[]; purchaseIds: number[] }) {
  const [to, setTo] = useState<number | null>(null);
  const [item, setItem] = useState("");
  useEffect(() => {
    const onPick = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; id: number | null }>).detail;
      if (d.name === "to") setTo(d.id ? Number(d.id) : null);
    };
    window.addEventListener("fc-pick", onPick);
    window.dispatchEvent(new Event("fc-ask"));
    return () => window.removeEventListener("fc-pick", onPick);
  }, []);
  if (!to || !purchaseIds.includes(to)) return null;
  const unit = items.find((i) => String(i.id) === item)?.unit ?? "pcs";
  return (
    <fieldset className="rounded-xl border-2 border-mustard/60 bg-mustard-soft/60 p-4 sm:col-span-2">
      <legend className="flex items-center gap-2 px-1 font-bold text-ink"><Package className="h-5 w-5" />Is this stock you will sell?</legend>
      {items.length === 0 ? (
        <p className="text-sm">Add the item in <Link href="/items" className="font-semibold text-peacock underline">Stock</Link> first, then buy it from there.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div>
            <label className="label" htmlFor="stock-item">Item</label>
            <select id="stock-item" name="stock_item" value={item} onChange={(e) => setItem(e.target.value)} className="input">
              <option value="">No, not stock</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          {item && (
            <div>
              <label className="label" htmlFor="stock-qty">How many ({unit})</label>
              <input id="stock-qty" name="stock_qty" inputMode="decimal" required className="input" />
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
