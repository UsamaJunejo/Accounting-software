"use client";

import { useState } from "react";
import { Boxes, Tag } from "lucide-react";
import * as A from "@/app/actions/items";

const UNITS = ["pcs", "bag", "kg", "g", "ton", "litre", "box", "carton", "dozen", "metre", "foot", "sq ft", "pair", "packet", "roll"];

/** The same box for adding and editing an item. First choice: one price per piece, or a lot bought for one total. */
export function ItemForm({ groups, item }: {
  groups: string[];
  item?: { id: number; name: string; unit: string; group_name: string | null; sale_price: number; cost_price: number; low_stock: number | null; archived: boolean; pricing: "each" | "lot" };
}) {
  const editing = !!item;
  const [pricing, setPricing] = useState<"each" | "lot">(item?.pricing ?? "each");
  const lot = pricing === "lot";
  const rs = (p?: number) => (p ? (p / 100).toFixed(2) : "");
  const choice = (id: "each" | "lot", title: string, Icon: typeof Tag) => (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${pricing === id ? "border-peacock bg-peacock-soft" : "border-rule bg-white"}`}>
      <input type="radio" name="pricing" value={id} checked={pricing === id} onChange={() => setPricing(id)} className="sr-only" />
      <Icon className={`h-6 w-6 shrink-0 ${pricing === id ? "text-peacock" : "text-muted"}`} />
      <span className="font-bold text-ink">{title}</span>
    </label>
  );
  return (
    <form action={editing ? A.updateItemAction : A.addItemAction} className="space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="label">How do you price it?</legend>
        {choice("each", "Same price for each piece", Tag)}
        {choice("lot", "Bought as a lot (one total)", Boxes)}
      </fieldset>
      <div>
        <label className="label" htmlFor="it-name">Name</label>
        <input id="it-name" name="name" required defaultValue={item?.name} placeholder={lot ? "e.g. Laptop Dell 5420 (lot of 50)" : "e.g. Cement bag (Maple Leaf)"} className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="it-group">Group (optional)</label>
          <input id="it-group" name="group" list="item-groups" defaultValue={item?.group_name ?? ""} placeholder="e.g. Cement" className="input" />
          <datalist id="item-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor="it-unit">Unit</label>
          <input id="it-unit" name="unit" list="item-units" defaultValue={item?.unit ?? "pcs"} className="input" />
          <datalist id="item-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
      </div>
      {lot ? (
        !editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="it-opening">How many pieces</label>
              <input id="it-opening" name="opening" inputMode="decimal" required placeholder="e.g. 50" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="it-total">Total you paid for all</label>
              <input id="it-total" name="opening_total" inputMode="decimal" required placeholder="e.g. 50,00,000" className="input" />
            </div>
          </div>
        )
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="it-sale">Selling price (each)</label>
              <input id="it-sale" name="sale_price" inputMode="decimal" defaultValue={rs(item?.sale_price)} placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="it-cost">Buying price (each)</label>
              <input id="it-cost" name="cost_price" inputMode="decimal" defaultValue={rs(item?.cost_price)} placeholder="0.00" className="input" />
            </div>
          </div>
          {!editing && (
            <div>
              <label className="label" htmlFor="it-opening">How many you have now</label>
              <input id="it-opening" name="opening" inputMode="decimal" placeholder="0" className="input" />
            </div>
          )}
        </>
      )}
      <div>
        <label className="label" htmlFor="it-low">Warn me when it falls to (optional)</label>
        <input id="it-low" name="low_stock" inputMode="decimal" defaultValue={item?.low_stock ?? ""} placeholder="e.g. 10" className="input" />
      </div>
      {editing && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" defaultChecked={item.archived} /> Archived (hide it, keep its history)
        </label>
      )}
      <button className="btn-primary w-full">{editing ? "Save changes" : "Add item"}</button>
    </form>
  );
}
