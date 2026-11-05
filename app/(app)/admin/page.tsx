import { Search, ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminSetAdmin } from "@/app/actions/auth";
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

  return (
    <>
      <PageHeader title="Admin" subtitle={`${total} registered ${total === 1 ? "user" : "users"}. Only admins can see this page.`} />
      <Flash sp={sp} />
      <form className="card mb-5 flex gap-2 p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Search name, email, mobile or business" className="input pl-9" />
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
                      {u.is_admin ? <ShieldCheck className="h-4 w-4 text-brand" /> : <Users className="h-4 w-4 text-slate-400" />}
                      {u.name}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    {u.business_name && <div className="text-xs text-slate-500">{u.business_name}</div>}
                    {u.nok && <div className="text-xs text-slate-400">Next of kin: {u.nok}</div>}
                  </td>
                  <td>{u.phone}</td>
                  <td className="whitespace-nowrap">{u.joined}</td>
                  <td className="num">{u.entries}</td>
                  <td className="whitespace-nowrap">{u.last_entry ?? "—"}</td>
                  <td>{u.has_recovery ? "Saved" : <span className="text-amber-600">Not yet</span>}</td>
                  <td className="space-y-2">
                    {u.id !== me.id && <AdminReset id={u.id} name={u.name} phone={u.phone} />}
                    {u.id !== me.id && (
                      <form action={adminSetAdmin}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="make" value={u.is_admin ? "0" : "1"} />
                        <button className="text-xs font-semibold text-slate-500 hover:text-ink">
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
    </>
  );
}
