import * as A from "@/app/actions/items";
import { Explain } from "@/components/organize-forms";

const UNITS = ["pcs", "bag", "kg", "g", "ton", "litre", "box", "carton", "dozen", "metre", "foot", "sq ft", "pair", "packet", "roll"];

/** The same box for adding and editing an item. */
export function ItemForm({ groups, item }: {
  groups: string[];
  item?: { id: number; name: string; unit: string; group_name: string | null; sale_price: number; cost_price: number; low_stock: number | null; archived: boolean };
}) {
  const editing = !!item;
  const rs = (p?: number) => (p ? (p / 100).toFixed(2) : "");
  return (
    <form action={editing ? A.updateItemAction : A.addItemAction} className="space-y-4">
      <Explain>An <b>item</b> is something you sell and keep in stock, like <i>Cement bag</i> or <i>Steel rod</i>. Pick it on an invoice and the stock goes down by itself.</Explain>
      {item && <input type="hidden" name="id" value={item.id} />}
      <div>
        <label className="label" htmlFor="it-name">Name</label>
        <input id="it-name" name="name" required defaultValue={item?.name} placeholder="e.g. Cement bag (Maple Leaf)" className="input" />
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
      <div className="grid gap-3 sm:grid-cols-2">
        {!editing && (
          <div>
            <label className="label" htmlFor="it-opening">How many you have now</label>
            <input id="it-opening" name="opening" inputMode="decimal" placeholder="0" className="input" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="it-low">Warn me when it falls to (optional)</label>
          <input id="it-low" name="low_stock" inputMode="decimal" defaultValue={item?.low_stock ?? ""} placeholder="e.g. 10" className="input" />
        </div>
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
