import Link from "next/link";
import { Database, Download, KeyRound, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { changePassword, updateProfile } from "@/app/actions/auth";
import { Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
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
          <form action={changePassword} className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><KeyRound className="h-5 w-5 text-brand" />Change password</h2>
            <div><label className="label">Current password</label><input type="password" name="current" required className="input" autoComplete="current-password" /></div>
            <div><label className="label">New password</label><input type="password" name="next" required minLength={8} className="input" autoComplete="new-password" /></div>
            <button className="btn-dark">Change password</button>
          </form>
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Database className="h-5 w-5 text-brand" />Your data</h2>
            <p className="text-sm text-slate-600">Download all your entries as a CSV file that opens in Excel or Google Sheets.</p>
            <Link href="/export" className="btn-ghost"><Download className="h-4 w-4" />Download all entries</Link>
            <p className="text-sm text-slate-600">Budgets are set per account: open <Link href="/accounts" className="font-semibold text-brand">Accounts</Link> → Edit.</p>
          </div>
        </div>
      </div>
    </>
  );
}
