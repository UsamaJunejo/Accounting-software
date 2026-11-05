import Link from "next/link";
import { Coins, Database, Palette, Download, Gift, HeartHandshake, KeyRound, Layers, LifeBuoy, MessageCircle, UserRound } from "lucide-react";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { CurrencySettings } from "@/components/currency-settings";
import { setScheme } from "@/app/actions/lang";
import { SCHEMES } from "@/lib/schemes";
import { getScheme } from "@/lib/lang";
import { db } from "@/lib/db";
import { changePassword, updateLevel, updateNextOfKin, updateProfile } from "@/app/actions/auth";
import { Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; must?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [{ n }] = await (await db()).q<{ n: number }>("SELECT COUNT(*)::int AS n FROM transactions WHERE user_id = $1", [user.id]);
  const hasEntries = n > 0;
  const scheme = await getScheme();
  const h = await headers();
  const site = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
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
          <div><label className="label">Business address (shown on invoices)</label><textarea name="address" rows={2} defaultValue={user.address ?? ""} className="input" /></div>
          <div><label className="label">NTN / STRN (optional, shown on invoices)</label><input name="ntn" defaultValue={user.ntn ?? ""} className="input" /></div>
          <div><label className="label">Email</label><input value={user.email} disabled className="input bg-paper" /></div>
          <button className="btn-primary">Save profile</button>
        </form>
        <form action={setScheme} className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Palette className="h-5 w-5 text-brand" />Colour theme</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCHEMES.map((sc) => (
              <label key={sc.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-rule p-3 has-[:checked]:border-peacock has-[:checked]:bg-peacock-soft">
                <input type="radio" name="scheme" value={sc.id} defaultChecked={scheme === sc.id} className="sr-only" />
                <span className="flex overflow-hidden rounded border border-rule" aria-hidden="true">
                  {sc.swatch.map((c) => <span key={c} className="h-8 w-4" style={{ background: c }} />)}
                </span>
                <span><b className="block text-ink">{sc.name}</b><span className="text-sm text-muted">{sc.desc}</span></span>
              </label>
            ))}
          </div>
          <button className="btn-dark">Use this theme</button>
        </form>
        <div className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Coins className="h-5 w-5 text-brand" />Currency</h2>
          <CurrencySettings current={user.currency} hasEntries={hasEntries} />
        </div>
        <form action={updateLevel} className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Layers className="h-5 w-5 text-brand" />How detailed should your accounts be?</h2>
          {[
            [1, "Simple (1 level)", "Just a list of accounts. Best for home use or a very small shop."],
            [2, "Grouped (2 levels)", "Accounts grouped under categories like Cash, Bank, Expense."],
            [3, "Detailed (3 levels)", "Category › Sub-category › Account. Best for a growing business."],
          ].map(([v, t, d]) => (
            <label key={v} className="flex items-start gap-2 rounded-lg border border-rule p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-ink-soft">
              <input type="radio" name="level" value={v} defaultChecked={user.level === v} className="mt-1" />
              <span><b>{t}</b><br /><span className="text-muted">{d}</span></span>
            </label>
          ))}
          <p className="text-xs text-muted">This only changes how things are shown. Your data stays the same, so you can switch any time.</p>
          <button className="btn-dark">Save view</button>
        </form>
        <form action={updateNextOfKin} className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><HeartHandshake className="h-5 w-5 text-brand" />Next of kin</h2>
          <p className="text-sm text-muted">Someone we can contact about your account if something happens to you. Only FinanceChachu admins can see this.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Name</label><input name="nok_name" defaultValue={user.nok_name ?? ""} className="input" /></div>
            <div><label className="label">Relation</label><input name="nok_relation" defaultValue={user.nok_relation ?? ""} placeholder="e.g. Brother" className="input" /></div>
            <div><label className="label">Mobile</label><input name="nok_phone" defaultValue={user.nok_phone ?? ""} className="input" /></div>
            <div><label className="label">Email</label><input name="nok_email" type="email" defaultValue={user.nok_email ?? ""} className="input" /></div>
          </div>
          <button className="btn-dark">Save next of kin</button>
        </form>
        <div className="space-y-5">
          <form action={changePassword} className={`card space-y-4 p-5 ${sp.must ? "border-2 border-khata" : ""}`}>
            {sp.must && <p className="text-sm font-semibold text-khata">Enter the temporary password you were given, then choose your own.</p>}
            <h2 className="flex items-center gap-2 font-semibold text-ink"><KeyRound className="h-5 w-5 text-brand" />Change password</h2>
            <div><label className="label">Current password</label><input type="password" name="current" required className="input" autoComplete="current-password" /></div>
            <div><label className="label">New password</label><input type="password" name="next" required minLength={8} className="input" autoComplete="new-password" /></div>
            <button className="btn-dark">Change password</button>
          </form>
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Gift className="h-5 w-5 text-brand" />Invite a friend</h2>
            <p className="text-sm text-muted">Know a shopkeeper who still keeps a paper register? Send them FinanceChachu.</p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Assalam-o-Alaikum! I use FinanceChachu to keep my shop's hisaab: sales, expenses and khata, free. Try it: ${site}`)}`}
              target="_blank"
              rel="noreferrer"
              className="btn bg-ledger text-white hover:bg-ledger-dark"
            >
              <MessageCircle className="h-4 w-4" />Invite on WhatsApp
            </a>
          </div>
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><LifeBuoy className="h-5 w-5 text-brand" />Recovery code</h2>
            <p className="text-sm text-muted">
              {user.has_recovery
                ? "You have a recovery code saved. Lost it? Make a new one (the old one will stop working)."
                : "You don't have a recovery code yet. Without it, you can't reset a forgotten password yourself."}
            </p>
            <Link href="/recovery-code" className="btn-ghost"><KeyRound className="h-4 w-4" />{user.has_recovery ? "Make a new code" : "Create recovery code"}</Link>
          </div>
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Database className="h-5 w-5 text-brand" />Your data</h2>
            <p className="text-sm text-muted">Download your data as files that open in Excel or Google Sheets. Keep a copy as a backup.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/export" className="btn-ghost"><Download className="h-4 w-4" />All entries</Link>
              <Link href="/export?what=accounts" className="btn-ghost"><Download className="h-4 w-4" />Accounts &amp; balances</Link>
              <a href="/backup" className="btn-ghost"><Download className="h-4 w-4" />Everything (backup file)</a>
            </div>
            <p className="text-sm text-muted">Budgets are set per account: open <Link href="/accounts" className="font-semibold text-brand">Accounts</Link> → Edit.</p>
          </div>
        </div>
      </div>
    </>
  );
}
