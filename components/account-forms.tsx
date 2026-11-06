import { KIND_LABEL, type Kind } from "@/lib/books";
import * as A from "@/app/actions/books";
import * as Q from "@/app/actions/quick";
import { ACCOUNT_CHOICES } from "@/lib/kinds";
import { CurrencyPick } from "@/components/currency-pick";
import { LookPicker } from "@/components/look-picker";
import { ConfirmButton } from "@/components/confirm-button";

// Plain-language choices. "kind:role" marks categories the app treats specially
// (money accounts, customers, suppliers).
const CATEGORY_TYPES: [string, string][] = [
  ["asset:bank", "Money: cash, bank or mobile wallet"],
  ["asset:receivable", "Customers who owe me (khata)"],
  ["liability:payable", "Suppliers I owe (khata)"],
  ["asset", "Things I own: stock, equipment, deposits"],
  ["liability", "Loans and other things I owe"],
  ["income", "Income: sales and other earnings"],
  ["expense", "Expenses: rent, bills, salaries"],
  ["equity", "Owner's money (capital, drawings)"],
];

export function AddCategoryForm({ back }: { back: string }) {
  return (
    <form action={A.addCategory} className="space-y-4">
      <input type="hidden" name="back" value={back} />
      <div>
        <label className="label" htmlFor="cat-name">Category name</label>
        <input id="cat-name" name="name" required placeholder="e.g. Online Business" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="cat-kind">What will it hold?</label>
        <select id="cat-kind" name="kind" required className="input" defaultValue="asset">
          {CATEGORY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <p className="mt-1 text-sm text-muted">This decides how its balance is worked out, so pick the closest one.</p>
      </div>
      <LookPicker />
      <button className="btn-primary w-full">Add category</button>
    </form>
  );
}

export function AddSubcategoryForm({ categoryId, back }: { categoryId: number; back: string }) {
  return (
    <form action={A.addSubcategory} className="space-y-4">
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="category" value={categoryId} />
      <div>
        <label className="label" htmlFor="sub-name">Sub-category name</label>
        <input id="sub-name" name="name" required placeholder="e.g. Vehicles" className="input" />
      </div>
      <LookPicker />
      <button className="btn-primary w-full">Add sub-category</button>
    </form>
  );
}

/** Pass a sub-category, or (in the simpler views) a category: the account goes into its first sub-category. */
export function AddAccountForm({
  subcategoryId,
  categories,
  categoryId,
  back,
}: {
  subcategoryId?: number;
  categoryId?: number;
  categories?: { id: number; name: string }[];
  back: string;
}) {
  return (
    <form action={A.addAccount} className="space-y-4">
      <input type="hidden" name="back" value={back} />
      {subcategoryId && <input type="hidden" name="subcategory" value={subcategoryId} />}
      {!subcategoryId && categoryId && <input type="hidden" name="category" value={categoryId} />}
      {!subcategoryId && !categoryId && categories && (
        <div>
          <label className="label" htmlFor="acc-cat">Category</label>
          <select id="acc-cat" name="category" required className="input" defaultValue="">
            <option value="" disabled>Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="acc-name">Account name</label>
        <input id="acc-name" name="name" required placeholder="e.g. Honda CD-70, Ahmed Traders" className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="acc-phone">Mobile (optional)</label>
          <input id="acc-phone" name="phone" placeholder="For khata reminders" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="acc-budget">Monthly budget (optional)</label>
          <input id="acc-budget" name="budget" inputMode="decimal" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="acc-opening">Balance it already has (optional)</label>
        <input id="acc-opening" name="opening" inputMode="decimal" placeholder="0.00" className="input" />
        <p className="mt-1 text-sm text-muted">Moving from MunshiBaba or a paper khata? Type today&apos;s balance: cash in hand, what a customer owes, what you owe a supplier.</p>
      </div>
      <button className="btn-primary w-full">Add account</button>
    </form>
  );
}

export function EditGroupForm({
  kind,
  id,
  name,
  color,
  icon,
  categoryId,
  categories,
  back,
  deleteBack,
}: {
  kind: "category" | "sub";
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  categoryId?: number;
  categories?: { id: number; name: string }[];
  back: string;
  deleteBack: string;
}) {
  return (
    <div className="space-y-5">
      <form action={kind === "category" ? A.updateCategory : A.updateSubcategory} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back" value={back} />
        <div>
          <label className="label" htmlFor={`edit-${kind}-${id}`}>Name</label>
          <input id={`edit-${kind}-${id}`} name="name" defaultValue={name} required className="input" />
        </div>
        {kind === "sub" && categories && (
          <div>
            <label className="label" htmlFor={`move-${id}`}>Belongs to category</label>
            <select id={`move-${id}`} name="category" defaultValue={categoryId} className="input">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <LookPicker color={color} icon={icon} />
        <button className="btn-primary w-full">Save changes</button>
      </form>
      <form action={kind === "category" ? A.deleteCategory : A.deleteSubcategory} className="border-t border-rule pt-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back" value={deleteBack} />
        <ConfirmButton className="btn-danger w-full" message={`Delete "${name}"? This cannot be undone.`} confirmLabel="Delete">Delete {kind === "category" ? "category" : "sub-category"}</ConfirmButton>
        <p className="mt-1 text-sm text-muted">Only possible when it&apos;s empty. Move or delete what&apos;s inside first.</p>
      </form>
    </div>
  );
}

/** "Add account" in plain words: a name, what it is, and what it already has. */
export function AddAccountPlainForm({ primary = "PKR" }: { primary?: string }) {
  return (
    <form action={Q.addAccountPlain} className="space-y-4">
      <div>
        <label className="label" htmlFor="plain-name">Name</label>
        <input id="plain-name" name="name" required placeholder="e.g. Tea, Meezan Bank, Ahmed Traders" className="input" />
      </div>
      <fieldset>
        <legend className="label">What is it?</legend>
        <div className="grid gap-1.5">
          {ACCOUNT_CHOICES.map(([v, l, help], i) => (
            <label key={v} className="flex cursor-pointer items-start gap-2 rounded-md border border-rule bg-white px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-peacock-soft">
              <input type="radio" name="choice" value={v} defaultChecked={i === 0} className="mt-1" />
              <span><span className="font-semibold text-ink">{l}</span> <span className="text-sm text-muted">{help}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <CurrencyPick primary={primary} needRate />
      <div>
        <label className="label" htmlFor="plain-opening">Balance it already has (optional, in the account&apos;s currency)</label>
        <input id="plain-opening" name="opening" inputMode="decimal" placeholder="0.00" className="input" />
        <p className="mt-1 text-sm text-muted">Cash in hand, what a customer owes you, or what you owe a supplier, as of today.</p>
      </div>
      <button className="btn-primary w-full">Add account</button>
    </form>
  );
}
