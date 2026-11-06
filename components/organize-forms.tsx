"use client";

/**
 * The SAME forms for accounts, categories and sub-categories, wherever they are opened (Accounts page,
 * a category, a sub-category, an account's edit page). Same fields, same order, same words.
 *
 *   Category      a big group:          Bank, Customers, Expenses
 *   Sub-category  a smaller group in it: Mobile wallets (inside Bank)   (only in the detailed view)
 *   Account       one real thing:        JazzCash, Ahmed Traders, Rent
 */
import { useState } from "react";
import { friendlyCategory } from "@/lib/look";
import { categoryHint, type Kind, type Role } from "@/lib/kinds";
import * as A from "@/app/actions/books";
import { CurrencyPick } from "@/components/currency-pick";
import { LookPicker } from "@/components/look-picker";
import { ConfirmButton } from "@/components/confirm-button";

export type CatOpt = { id: number; name: string; kind: Kind; role: Role; currency: string | null };
export type SubOpt = { id: number; name: string; category_id: number; currency: string | null };

const KIND_GROUP: Record<Kind, string> = {
  asset: "Money and things you own",
  liability: "What you owe",
  equity: "Owner's money",
  income: "Money you earn",
  expense: "Money you spend",
};

/** Explains, at the top of every box, what this thing is. */
export function Explain({ children }: { children: React.ReactNode }) {
  return <p className="-mt-1 rounded-md bg-paper px-3 py-2 text-sm text-body">{children}</p>;
}

/** Category dropdown grouped by what the money is, each with a short hint. */
function CategorySelect({ categories, value, onChange, id = "f-category" }: { categories: CatOpt[]; value: number | ""; onChange: (v: number) => void; id?: string }) {
  return (
    <select id={id} name="category" required value={value} onChange={(e) => onChange(Number(e.target.value))} className="input">
      <option value="" disabled>Choose a category</option>
      {(Object.keys(KIND_GROUP) as Kind[]).map((k) =>
        categories.some((c) => c.kind === k) ? (
          <optgroup key={k} label={KIND_GROUP[k]}>
            {categories.filter((c) => c.kind === k).map((c) => (
              <option key={c.id} value={c.id}>{friendlyCategory(c.name)} – {categoryHint(c)}</option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  );
}

export type AccountFormProps = {
  mode: "add" | "edit";
  categories: CatOpt[];
  subs: SubOpt[];
  /** 1 = only accounts, 2 = categories and accounts, 3 = categories, sub-categories and accounts. */
  level: 1 | 2 | 3;
  primary: string;
  back: string;
  /** When opened from inside a category or sub-category, it starts there. */
  categoryId?: number;
  subId?: number;
  account?: { id: number; name: string; subcategory_id: number; category_id: number; phone: string | null; budget: number | null; currency: string | null; archived: boolean };
};

export function AccountForm({ mode, categories, subs, level, primary, back, categoryId, subId, account }: AccountFormProps) {
  const startCat = account?.category_id ?? categoryId ?? (subId ? subs.find((s) => s.id === subId)?.category_id : undefined);
  const [cat, setCat] = useState<number | "">(startCat ?? "");
  const firstSub = (catId: number | "" | undefined) => subs.find((x) => x.category_id === catId)?.id ?? "";
  const [sub, setSub] = useState<number | "">(account?.subcategory_id ?? subId ?? firstSub(startCat));
  const c = categories.find((x) => x.id === cat);
  const mySubs = subs.filter((s) => s.category_id === cat);
  const s = subs.find((x) => x.id === sub && x.category_id === cat);
  const canCurrency = !!c && (c.kind === "asset" || c.kind === "liability");
  const isParty = c?.role === "receivable" || c?.role === "payable";
  // The currency a new account starts with: its sub-category's, then its category's.
  const defaultCur = account ? account.currency ?? "" : s?.currency ?? c?.currency ?? "";
  const editing = mode === "edit";

  return (
    <form action={editing ? A.updateAccount : A.addAccount} className="space-y-4">
      <Explain>An <b>account</b> is one real thing you keep track of: one bank account, one customer, one kind of expense.</Explain>
      {account && <input type="hidden" name="id" value={account.id} />}
      <input type="hidden" name="back" value={back} />
      <div>
        <label className="label" htmlFor="f-name">Name</label>
        <input id="f-name" name="name" required defaultValue={account?.name} placeholder="e.g. Meezan Bank, Ahmed Traders, Tea" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="f-category">{level === 1 ? "What is it?" : "Category"}</label>
        <CategorySelect categories={categories} value={cat} onChange={(v) => { setCat(v); setSub(firstSub(v)); }} />
      </div>
      {level === 3 && cat !== "" && (
        <div>
          <label className="label" htmlFor="f-sub">Sub-category</label>
          <select id="f-sub" name="subcategory" value={sub} onChange={(e) => setSub(e.target.value ? Number(e.target.value) : "")} className="input">
            {!mySubs.length && <option value="">General (made for you)</option>}
            {mySubs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
      )}
      {canCurrency && (
        <div key={`${cat}-${sub}`}>
          <CurrencyPick primary={primary} value={defaultCur} needRate label="Currency" />
          {editing && <p className="mt-1 text-sm text-muted">Changing it converts this account&apos;s entries at today&apos;s rate. Totals in {primary} stay the same.</p>}
        </div>
      )}
      {isParty && (
        <div>
          <label className="label" htmlFor="f-phone">Mobile (optional)</label>
          <input id="f-phone" name="phone" defaultValue={account?.phone ?? ""} placeholder="For WhatsApp reminders" className="input" />
        </div>
      )}
      {c?.kind === "expense" && (
        <div>
          <label className="label" htmlFor="f-budget">Monthly budget (optional)</label>
          <input id="f-budget" name="budget" inputMode="decimal" defaultValue={account?.budget ? (account.budget / 100).toFixed(2) : ""} className="input" />
        </div>
      )}
      {!editing && canCurrency && (
        <div>
          <label className="label" htmlFor="f-opening">Balance it already has (optional)</label>
          <input id="f-opening" name="opening" inputMode="decimal" placeholder="0.00" className="input" />
          <p className="mt-1 text-sm text-muted">Cash already in hand, what a customer already owes, what you already owe a supplier, as of today.</p>
        </div>
      )}
      {editing && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" defaultChecked={!!account?.archived} /> Archived (hide from lists, keep history)
        </label>
      )}
      <button className="btn-primary w-full">{editing ? "Save changes" : "Add account"}</button>
    </form>
  );
}

export type GroupFormProps = {
  what: "category" | "sub";
  mode: "add" | "edit";
  primary: string;
  back: string;
  deleteBack?: string;
  /** For a sub-category: the categories it can be inside. */
  categories?: CatOpt[];
  /** For a new sub-category: the category it goes in. */
  parentId?: number;
  item?: { id: number; name: string; color: string | null; icon: string | null; currency: string | null; kind?: Kind; category_id?: number };
};

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

export function GroupForm({ what, mode, primary, back, deleteBack, categories = [], parentId, item }: GroupFormProps) {
  const editing = mode === "edit";
  const [type, setType] = useState("asset:bank");
  const [parent, setParent] = useState<number | "">(item?.category_id ?? parentId ?? "");
  const kind: Kind | undefined = what === "category" ? (editing ? item?.kind : (type.split(":")[0] as Kind)) : categories.find((c) => c.id === parent)?.kind;
  const canCurrency = kind === "asset" || kind === "liability";
  const action = what === "category" ? (editing ? A.updateCategory : A.addCategory) : editing ? A.updateSubcategory : A.addSubcategory;

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        {what === "category" ? (
          <Explain>A <b>category</b> is a big group of accounts, like <i>Bank</i>, <i>Customers</i> or <i>Expenses</i>.</Explain>
        ) : (
          <Explain>A <b>sub-category</b> is a smaller group inside a category, like <i>Mobile wallets</i> inside <i>Bank</i>. It just keeps a long list tidy.</Explain>
        )}
        {item && <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="back" value={back} />
        <div>
          <label className="label" htmlFor={`g-name-${what}`}>Name</label>
          <input id={`g-name-${what}`} name="name" required defaultValue={item?.name} placeholder={what === "category" ? "e.g. Online Business" : "e.g. Mobile wallets"} className="input" />
        </div>
        {what === "category" && !editing && (
          <div>
            <label className="label" htmlFor="cat-kind">What will it hold?</label>
            <select id="cat-kind" name="kind" required value={type} onChange={(e) => setType(e.target.value)} className="input">
              {CATEGORY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <p className="mt-1 text-sm text-muted">This decides how its balance is worked out, so pick the closest one. It can&apos;t be changed later.</p>
          </div>
        )}
        {what === "sub" && (
          <div>
            <label className="label" htmlFor="g-parent">Inside category</label>
            <CategorySelect id="g-parent" categories={categories} value={parent} onChange={setParent} />
          </div>
        )}
        {canCurrency && (
          <div>
            <CurrencyPick primary={primary} value={item?.currency ?? ""} label="Currency for new accounts in it (optional)" />
            {editing && <p className="mt-1 text-sm text-muted">Accounts already in it keep their own currency.</p>}
          </div>
        )}
        <LookPicker color={item?.color} icon={item?.icon} />
        <button className="btn-primary w-full">{editing ? "Save changes" : what === "category" ? "Add category" : "Add sub-category"}</button>
      </form>
      {editing && item && (
        <form action={what === "category" ? A.deleteCategory : A.deleteSubcategory} className="border-t border-rule pt-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="back" value={deleteBack ?? back} />
          <ConfirmButton className="btn-danger w-full" message={`Delete "${item.name}"? This cannot be undone.`} confirmLabel="Delete">
            Delete {what === "category" ? "category" : "sub-category"}
          </ConfirmButton>
          <p className="mt-1 text-sm text-muted">Only when it&apos;s empty: move or delete what&apos;s inside first.</p>
        </form>
      )}
    </div>
  );
}
