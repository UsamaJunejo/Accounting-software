import Link from "next/link";
import { Check, ChevronRight, Inbox, Mail, Share2, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances } from "@/lib/books";
import { pendingForOwner, sharedWithMe } from "@/lib/sharing";
import { approveEntry, rejectEntry, respondToShare } from "@/app/actions/sharing";
import { money, prettyDate } from "@/lib/format";
import { AccountSelect, Empty, Flash, Money, PageHeader } from "@/components/ui";

export const metadata = { title: "Shared" };

export default async function Shared({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const [mine, pending, accounts] = await Promise.all([
    sharedWithMe(d, user.id),
    pendingForOwner(d, user.id),
    accountsWithBalances(d, user.id),
  ]);
  const invites = mine.filter((s) => s.status === "pending");
  const accepted = mine.filter((s) => s.status === "accepted");
  const cash = accounts.find((a) => a.category === "Cash")?.id;

  return (
    <>
      <PageHeader
        title="Shared"
        subtitle="Accounts others shared with you, and entries waiting for your approval. To share one of your accounts, open it from Accounts or Khata."
      />
      <Flash sp={sp} />

      {invites.length > 0 && (
        <section className="card mb-5 overflow-hidden">
          <h2 className="flex items-center gap-2 bg-ink-soft px-4 py-3 font-semibold text-ink"><Mail className="h-5 w-5 text-brand" />Invitations</h2>
          <ul>
            {invites.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-3 text-sm">
                <div>
                  <b>{s.owner_business || s.owner_name}</b> wants to share the account <b>{s.account}</b> with you
                  {s.can_add ? " (you can view and suggest entries)." : " (view only)."}
                </div>
                <div className="flex gap-2">
                  <form action={respondToShare}>
                    <input type="hidden" name="id" value={s.id} /><input type="hidden" name="accept" value="1" />
                    <button className="btn-primary"><Check className="h-4 w-4" />Accept</button>
                  </form>
                  <form action={respondToShare}>
                    <input type="hidden" name="id" value={s.id} /><input type="hidden" name="accept" value="0" />
                    <button className="btn-ghost"><X className="h-4 w-4" />Decline</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mb-5 overflow-hidden">
        <h2 className="flex items-center gap-2 px-4 py-3 font-semibold text-ink"><Inbox className="h-5 w-5 text-brand" />Waiting for your approval</h2>
        {pending.length === 0 ? (
          <Empty>Nothing to approve.</Empty>
        ) : (
          <ul>
            {pending.map((e) => (
              <li key={e.id} className="space-y-3 border-t border-rule px-4 py-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <b>{e.user_name}</b> added to <Link href={`/accounts/${e.account_id}`} className="font-semibold text-brand">{e.account}</Link>
                    <div className="text-muted">{prettyDate(e.date)}{e.note ? ` · ${e.note}` : ""}</div>
                  </div>
                  <div className={`text-lg font-bold ${e.direction === "increase" ? "text-inflow" : "text-khata"}`}>
                    {e.direction === "increase" ? "+" : "−"} {money(e.amount)}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <form action={approveEntry} className="flex flex-1 flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={e.id} />
                    <div className="min-w-56 flex-1">
                      <label className="label">Other side of this entry</label>
                      <AccountSelect name="other" accounts={accounts.filter((a) => a.id !== e.account_id)} value={cash} />
                    </div>
                    <button className="btn bg-ledger text-white hover:bg-ledger-dark"><Check className="h-4 w-4" />Approve</button>
                  </form>
                  <form action={rejectEntry} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={e.id} />
                    <input name="remarks" placeholder="Reason (optional)" className="input max-w-48" />
                    <button className="btn-danger"><X className="h-4 w-4" />Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="flex items-center gap-2 px-4 py-3 font-semibold text-ink"><Share2 className="h-5 w-5 text-brand" />Shared with me</h2>
        {accepted.length === 0 ? (
          <Empty>No one has shared an account with you yet.</Empty>
        ) : (
          <ul>
            {accepted.map((s) => (
              <li key={s.id} className="border-t border-rule">
                <Link href={`/shared/${s.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-ink-soft/50">
                  <div>
                    <div className="font-semibold text-ink">{s.account}</div>
                    <div className="text-xs text-muted">from {s.owner_business || s.owner_name}{s.can_add ? " · you can add entries" : " · view only"}</div>
                  </div>
                  <div className="flex items-center gap-2 font-bold"><Money value={s.balance} /><ChevronRight className="h-4 w-4 text-muted/80" /></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
