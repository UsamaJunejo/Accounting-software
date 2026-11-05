import { Check, CreditCard, DatabaseBackup, Download, Search, Settings2, ShieldCheck, Users, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminSetAdmin } from "@/app/actions/auth";
import { listBackups } from "@/lib/backup";
import { allPayments, getBillingSettings, planOf } from "@/lib/billing";
import { approvePayment, grantMonths, rejectPayment, saveBillingSettings } from "@/app/actions/billing";
import { money, today } from "@/lib/format";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { AdminReset } from "@/components/admin-reset";

export const metadata = { title: "Admin" };

type Row = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  joined: string;
  entries: number;
  last_entry: string | null;
  is_admin: boolean;
  has_recovery: boolean;
  nok: string | null;
  trial_end: string | null;
  paid_until: string | null;
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; ok?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const d = await db();
  const q = sp.q?.trim();
  const users = await d.q<Row>(
    `SELECT u.id, u.name, u.email, u.phone, u.business_name, to_char(u.created_at, 'YYYY-MM-DD') AS joined,
            (SELECT COUNT(*)::int FROM transactions t WHERE t.user_id = u.id AND t.deleted_at IS NULL) AS entries,
            (SELECT to_char(MAX(t.created_at), 'YYYY-MM-DD') FROM transactions t WHERE t.user_id = u.id) AS last_entry,
            u.is_admin, u.recovery_hash IS NOT NULL AS has_recovery,
            NULLIF(CONCAT_WS(' · ', u.nok_name, u.nok_relation, u.nok_phone, u.nok_email), '') AS nok,
            to_char(u.trial_ends_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD') AS trial_end, to_char(u.paid_until, 'YYYY-MM-DD') AS paid_until
     FROM users u
     WHERE $1::text IS NULL OR u.name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2 OR u.business_name ILIKE $2
     ORDER BY u.id DESC LIMIT 200`,
    [q || null, `%${q ?? ""}%`],
  );
  const [{ total }] = await d.q<{ total: number }>("SELECT COUNT(*)::int AS total FROM users");
  const [backups, payments, billing] = await Promise.all([listBackups(d), allPayments(d), getBillingSettings(d)]);
  const now = today();
  const pending = payments.filter((p) => p.status === "pending");

  return (
    <>
      <PageHeader title="Admin" subtitle={`${total} registered ${total === 1 ? "user" : "users"}. Only admins can see this page.`} />
      <Flash sp={sp} />
      <form className="card mb-5 flex gap-2 p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted/80" />
          <input name="q" defaultValue={q} placeholder="Search name, email, mobile or business" className="input ps-9" />
        </div>
        <button className="btn-dark">Search</button>
      </form>
      <div className="card overflow-x-auto">
        {users.length === 0 ? (
          <Empty>No users found.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>User</th><th>Mobile</th><th>Joined</th><th>Plan</th><th className="num">Entries</th><th>Last entry</th><th>Recovery code</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-1 font-semibold text-ink">
                      {u.is_admin ? <ShieldCheck className="h-4 w-4 text-brand" /> : <Users className="h-4 w-4 text-muted/80" />}
                      {u.name}
                    </div>
                    <div className="text-xs text-muted">{u.email}</div>
                    {u.business_name && <div className="text-xs text-muted">{u.business_name}</div>}
                    {u.nok && <div className="text-xs text-muted/80">Next of kin: {u.nok}</div>}
                  </td>
                  <td>{u.phone}</td>
                  <td className="whitespace-nowrap">{u.joined}</td>
                  <td className="whitespace-nowrap text-sm">
                    {(() => {
                      const pl = planOf(u, now);
                      return pl.state === "free" ? "Admin" : pl.state === "trial" ? `Trial, ${pl.daysLeft}d left` : pl.state === "active" ? `Paid to ${pl.until}` : <span className="font-semibold text-khata">Expired</span>;
                    })()}
                    {!u.is_admin && (
                      <form action={grantMonths} className="mt-1 flex items-center gap-1">
                        <input type="hidden" name="user" value={u.id} />
                        <select name="months" className="rounded border border-rule bg-white/80 px-1 py-0.5 text-xs" defaultValue="1">
                          {[1, 3, 6, 12].map((m) => <option key={m} value={m}>+{m} mo</option>)}
                        </select>
                        <button className="text-xs font-semibold text-peacock underline">Give free</button>
                      </form>
                    )}
                  </td>
                  <td className="num">{u.entries}</td>
                  <td className="whitespace-nowrap">{u.last_entry ?? "—"}</td>
                  <td>{u.has_recovery ? "Saved" : <span className="text-marigold">Not yet</span>}</td>
                  <td className="space-y-2">
                    {u.id !== me.id && <AdminReset id={u.id} name={u.name} phone={u.phone} />}
                    {u.id !== me.id && (
                      <form action={adminSetAdmin}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="make" value={u.is_admin ? "0" : "1"} />
                        <button className="text-xs font-semibold text-muted hover:text-ink">
                          {u.is_admin ? "Remove admin" : "Make admin"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <section className="card mt-6 overflow-x-auto p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><CreditCard className="h-5 w-5 text-brand" />Payments{pending.length ? ` (${pending.length} waiting)` : ""}</h2>
        <p className="mb-3 text-sm text-muted">Check each transaction ID in your JazzCash, Easypaisa or bank app before approving. Approving adds the months to that person&apos;s plan.</p>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">No payments yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Sent</th><th>User</th><th className="num">Amount</th><th>Method / TID</th><th>Proof</th><th>Status</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{p.created_at}</td>
                  <td><div className="font-semibold text-ink">{p.user_name}</div><div className="text-xs text-muted">{p.user_email}</div></td>
                  <td className="num">{money(p.amount)}<div className="text-xs text-muted">{p.months} mo</div></td>
                  <td>{p.method}<div className="text-sm font-semibold">{p.reference}</div></td>
                  <td>{p.has_proof ? <a href={`/api/payment-proof/${p.id}`} target="_blank" rel="noreferrer" className="font-semibold text-peacock underline">View</a> : <span className="text-muted">–</span>}</td>
                  <td className="whitespace-nowrap">
                    {p.status === "pending" ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <form action={approvePayment}><input type="hidden" name="id" value={p.id} /><button className="btn bg-ledger px-2.5 py-1 text-sm text-white hover:bg-ledger-dark"><Check className="h-4 w-4" />Approve</button></form>
                        <form action={rejectPayment} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={p.id} />
                          <input name="note" placeholder="Reason" className="w-28 rounded border border-rule bg-white/80 px-2 py-1 text-sm" />
                          <button className="btn-danger px-2.5 py-1 text-sm"><X className="h-4 w-4" />Reject</button>
                        </form>
                      </div>
                    ) : (
                      <span className={`text-sm font-semibold capitalize ${p.status === "approved" ? "text-ledger" : "text-khata"}`}>{p.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form action={saveBillingSettings} className="card mt-6 grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="flex items-center gap-2 text-lg font-bold sm:col-span-2"><Settings2 className="h-5 w-5 text-brand" />Price and where people pay you</h2>
        <div><label className="label" htmlFor="b-price">Price per month (Rs)</label><input id="b-price" name="price" inputMode="decimal" defaultValue={(billing.price / 100).toFixed(0)} className="input" /></div>
        <div><label className="label" htmlFor="b-trial">Free trial (days)</label><input id="b-trial" name="trialDays" type="number" min={0} max={365} defaultValue={billing.trialDays} className="input" /></div>
        <div><label className="label" htmlFor="b-title">Account title (your name as it appears)</label><input id="b-title" name="accountTitle" defaultValue={billing.accountTitle} className="input" /></div>
        <div><label className="label" htmlFor="b-jc">JazzCash number</label><input id="b-jc" name="jazzcash" defaultValue={billing.jazzcash} placeholder="03XX-XXXXXXX" className="input" /></div>
        <div><label className="label" htmlFor="b-ep">Easypaisa number</label><input id="b-ep" name="easypaisa" defaultValue={billing.easypaisa} placeholder="03XX-XXXXXXX" className="input" /></div>
        <div><label className="label" htmlFor="b-bank">Bank name</label><input id="b-bank" name="bankName" defaultValue={billing.bankName} placeholder="e.g. Meezan Bank" className="input" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="b-iban">Bank account / IBAN</label><input id="b-iban" name="iban" defaultValue={billing.iban} placeholder="PK00 XXXX 0000 0000 0000 0000" className="input" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="b-ins">Extra instructions (optional)</label><textarea id="b-ins" name="instructions" rows={2} defaultValue={billing.instructions} className="input" /></div>
        <p className="text-sm text-muted sm:col-span-2">Leave any method empty to hide it. A new trial length applies to people who sign up from now on.</p>
        <div className="sm:col-span-2"><button className="btn-primary">Save billing settings</button></div>
      </form>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold"><DatabaseBackup className="h-5 w-5 text-brand" />Backups</h2>
          <a href="/backup?full=1" className="btn-ghost"><Download className="h-4 w-4" />Download a backup now</a>
        </div>
        <p className="mb-3 text-sm text-muted">A full copy of the database is saved automatically once a day; the last 7 are kept. Bill photos aren&apos;t included. Keep a downloaded copy somewhere safe now and then.</p>
        {backups.length === 0 ? (
          <p className="text-sm text-muted">The first daily backup will appear after the next daily check.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Saved</th><th className="num">Rows</th><th className="num">Size</th><th></th></tr></thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{b.created_at}</td>
                  <td className="num">{b.rows.toLocaleString()}</td>
                  <td className="num">{(b.size / 1024).toFixed(0)} KB</td>
                  <td className="text-right"><a href={`/backup?id=${b.id}`} className="font-semibold text-peacock underline">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
