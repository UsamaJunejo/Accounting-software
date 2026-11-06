import Link from "next/link";
import { CircleCheck, RotateCcw, ShieldCheck, TriangleAlert, Wrench } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkBooks } from "@/lib/maintenance";
import { today } from "@/lib/format";
import { Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { adminFixEntryTypes, adminResetUser } from "@/app/actions/maintenance";

export const metadata = { title: "Check books" };

/** Admin: reconcile every person's books and list anything that looks wrong. */
export default async function CheckBooks({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const d = await db();
  const users = await d.q<{ id: number; name: string; email: string; entries: number }>(
    `SELECT u.id, u.name, u.email,
            (SELECT COUNT(*)::int FROM transactions t WHERE t.user_id = u.id AND t.deleted_at IS NULL) AS entries
     FROM users u ORDER BY u.id LIMIT 500`,
  );
  const now = today();
  const results = [];
  for (const u of users) results.push({ ...u, issues: await checkBooks(d, u.id, now) });
  const withIssues = results.filter((r) => r.issues.length);
  const problems = results.reduce((s, r) => s + r.issues.filter((i) => i.level === "problem").length, 0);

  return (
    <>
      <PageHeader
        title="Check books"
        subtitle={`${users.length} accounts checked: ${withIssues.length} need a look, ${problems} real problems.`}
        actions={
          <>
            <form action={adminFixEntryTypes}><button className="btn-dark"><Wrench className="h-4 w-4" />Fix entry labels</button></form>
            <Link href="/admin" className="btn-ghost">Back to Admin</Link>
          </>
        }
      />
      <Flash sp={sp} />
      <p className="mb-4 text-sm text-muted">
        For each person: do the totals agree both ways, is cash below zero, are there entries saved twice, dates that look mistyped,
        or labels that don&apos;t match the accounts. Nothing here changes anyone&apos;s data unless you press a button.
      </p>
      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-semibold text-ink">
                  {r.issues.length ? <TriangleAlert className="h-4 w-4 text-marigold" /> : <CircleCheck className="h-4 w-4 text-ledger" />}
                  {r.name} <span className="font-normal text-muted">{r.email}</span>
                </div>
                <div className="text-sm text-muted">{r.entries} entries · {r.issues.length ? `${r.issues.length} to look at` : "All good"}</div>
              </div>
              <form action={adminResetUser}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmButton className="inline-flex items-center gap-1 text-xs font-semibold text-khata" message={`Reset ${r.name}'s books? All their entries and accounts are removed and the ready-made accounts put back. Their login stays.`} confirmLabel="Reset books">
                  <RotateCcw className="h-3.5 w-3.5" />Reset books
                </ConfirmButton>
              </form>
            </div>
            {r.issues.length > 0 && (
              <ul className="mt-2 space-y-1 text-[15px]">
                {r.issues.map((i, k) => (
                  <li key={k} className={i.level === "problem" ? "text-khata" : "text-body"}>
                    <ShieldCheck className="me-1 inline h-4 w-4 align-[-2px]" />{i.text}
                    {i.fix && <span className="text-muted"> {i.fix}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
