import { FolderPlus, Layers, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { categories, subcategories } from "@/lib/books";
import type { User } from "@/lib/auth";
import { Dialog } from "@/components/dialog";
import { AccountForm, GroupForm } from "@/components/organize-forms";

/**
 * The same "Add account / Add sub-category / Add category" buttons on every accounts page.
 * Opened inside a category or sub-category, the forms start there.
 */
export async function OrganizeButtons({ user, back, categoryId, subId, only }: {
  user: User;
  back: string;
  categoryId?: number;
  subId?: number;
  /** Show only some buttons (e.g. inside a sub-category there's nothing to add but accounts). */
  only?: ("account" | "sub" | "category")[];
}) {
  const d = await db();
  const [cats, subs] = await Promise.all([categories(d, user.id), subcategories(d, user.id)]);
  const show = (x: "account" | "sub" | "category") => !only || only.includes(x);
  return (
    <>
      {show("account") && (
        <Dialog title="Add account" triggerClass="btn-primary" trigger={<><Plus className="h-4 w-4" />Add account</>}>
          <AccountForm mode="add" categories={cats} subs={subs} level={user.level} primary={user.currency} back={back} categoryId={categoryId} subId={subId} />
        </Dialog>
      )}
      {(user.level === 3 && show("sub")) || (user.level >= 2 && show("category")) ? (
        // Making groups is rarer than adding an account, so those two wait behind one button.
        <details className="relative">
          <summary className="btn-ghost cursor-pointer list-none [&::-webkit-details-marker]:hidden"><FolderPlus className="h-4 w-4" />Add a group ▾</summary>
          <div data-popover className="absolute start-0 z-30 mt-1 flex w-64 flex-col gap-1 rounded-lg border border-rule bg-white p-2 shadow-xl">
            {user.level === 3 && show("sub") && (
              <Dialog title="Add sub-category" triggerClass="btn w-full justify-start text-ink hover:bg-paper" trigger={<><Layers className="h-4 w-4" />Sub-category <span className="font-normal text-muted">(small group)</span></>}>
                <GroupForm what="sub" mode="add" categories={cats} parentId={categoryId} primary={user.currency} back={back} />
              </Dialog>
            )}
            {user.level >= 2 && show("category") && (
              <Dialog title="Add category" triggerClass="btn w-full justify-start text-ink hover:bg-paper" trigger={<><FolderPlus className="h-4 w-4" />Category <span className="font-normal text-muted">(big group)</span></>}>
                <GroupForm what="category" mode="add" primary={user.currency} back={back} />
              </Dialog>
            )}
          </div>
        </details>
      ) : null}
    </>
  );
}

/** A small reminder of how accounts are organised, matching the view chosen in Settings. */
export function HowOrganised({ level }: { level: 1 | 2 | 3 }) {
  const steps =
    level === 3
      ? [["Category", "a big group", "Bank"], ["Sub-category", "a smaller group (optional)", "Mobile wallets"], ["Account", "one real thing", "JazzCash"]]
      : level === 2
        ? [["Category", "a big group", "Bank"], ["Account", "one real thing", "JazzCash"]]
        : [["Account", "one real thing", "JazzCash, Ahmed Traders, Rent"]];
  return (
    <details className="card mb-5 p-4 text-[15px]">
      <summary className="cursor-pointer font-semibold text-ink">How your accounts are organised</summary>
      <ol className="mt-3 flex flex-wrap items-stretch gap-2">
        {steps.map(([t, what, eg], i) => (
          <li key={t} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="text-muted">→</span>}
            <span className="rounded-lg border border-rule bg-white/70 px-3 py-2">
              <b className="text-ink">{t}</b> <span className="text-muted">{what}</span>
              <span className="block text-sm text-body">e.g. {eg}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">
        Entries always use <b>accounts</b>. Categories{level === 3 ? " and sub-categories" : ""} only group them for totals and charts.
        Want {level === 1 ? "groups" : "fewer levels"}? Change &ldquo;How detailed should your accounts be?&rdquo; in Settings.
      </p>
    </details>
  );
}
