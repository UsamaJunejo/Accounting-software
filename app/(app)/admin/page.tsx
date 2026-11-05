import { DatabaseBackup, Download, Search, ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminSetAdmin } from "@/app/actions/auth";
import { listBackups } from "@/lib/backup";
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
            NULLIF(CONCAT_WS(' · ', u.nok_name, u.nok_relation, u.nok_phone, u.nok_email), '') AS nok
     FROM users u
     WHERE $1::text IS NULL OR u.name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2 OR u.business_name ILIKE $2
     ORDER BY u.id DESC LIMIT 200`,
    [q || null, `%${q ?? ""}%`],
  );
  const [{ total }] = await d.q<{ total: number }>("SELECT COUNT(*)::int AS total FROM users");
  const backups = await listBackups(d);

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
              <tr><th>User</th><th>Mobile</th><th>Joined</th><th className="num">Entries</th><th>Last entry</th><th>Recovery code</th><th></th></tr>
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
