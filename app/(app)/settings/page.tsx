import Link from "next/link";
import { Database, Download, KeyRound, LifeBuoy, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { changePassword, updateProfile } from "@/app/actions/auth";
import { Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; must?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Settings" />
      <Flash sp={sp} />
      <div className="grid gap-5 lg:grid-cols-2">
        <form action={updateProfile} className="card space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><UserRound className="h-5 w-5 text-brand" />Profile</h2>
          <div><label className="label">Your name</label><input name="name" defaultValue={user.name} required className="input" /></div>
          <div><label className="label">Business name</label><input name="business" defaultValue={user.business_name ?? ""} className="input" /></div>
          <div><label className="label">Mobile</label><input name="phone" defaultValue={user.phone ?? ""} className="input" /></div>
          <div><label className="label">Email</label><input value={user.email} disabled className="input bg-slate-50" /></div>
          <div><label className="label">Currency</label><input value="PKR (Pakistani Rupee)" disabled className="input bg-slate-50" /></div>
          <button className="btn-primary">Save profile</button>
        </form>
        <div className="space-y-5">
          <form action={changePassword} className={`card space-y-4 p-5 ${sp.must ? "border-2 border-red-400" : ""}`}>
            {sp.must && <p className="text-sm font-semibold text-red-600">Enter the temporary password you were given, then choose your own.</p>}
            <h2 className="flex items-center gap-2 font-semibold text-ink"><KeyRound className="h-5 w-5 text-brand" />Change password</h2>
            <div><label className="label">Current password</label><input type="password" name="current" required className="input" autoComplete="current-password" /></div>
            <div><label className="label">New password</label><input type="password" name="next" required minLength={8} className="input" autoComplete="new-password" /></div>
            <button className="btn-dark">Change password</button>
          </form>
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><LifeBuoy className="h-5 w-5 text-brand" />Recovery code</h2>
            <p className="text-sm text-slate-600">
              {user.has_recovery
                ? "You have a recovery code saved. Lost it? Make a new one (the old one will stop working)."
                : "You don't have a recovery code yet. Without it, you can't reset a forgotten password yourself."}
            </p>
            <Link href="/recovery-code" className="btn-ghost"><KeyRound className="h-4 w-4" />{user.has_recovery ? "Make a new code" : "Create recovery code"}</Link>
          </div>
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Database className="h-5 w-5 text-brand" />Your data</h2>
            <p className="text-sm text-slate-600">Download your data as files that open in Excel or Google Sheets. Keep a copy as a backup.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/export" className="btn-ghost"><Download className="h-4 w-4" />All entries</Link>
              <Link href="/export?what=accounts" className="btn-ghost"><Download className="h-4 w-4" />Accounts &amp; balances</Link>
            </div>
            <p className="text-sm text-slate-600">Budgets are set per account: open <Link href="/accounts" className="font-semibold text-brand">Accounts</Link> → Edit.</p>
          </div>
        </div>
      </div>
    </>
  );
}
