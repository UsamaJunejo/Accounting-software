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
