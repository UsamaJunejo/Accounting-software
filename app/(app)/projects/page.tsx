import Link from "next/link";
import { FolderKanban, FolderPlus, Save } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectSummary } from "@/lib/books";
import { addProject, updateProject } from "@/app/actions/books";
import { monthRange, prettyDate } from "@/lib/format";
import { DateRange, Empty, Flash, Money, PageHeader } from "@/components/ui";

export const metadata = { title: "Projects" };

export default async function Projects({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [, end] = monthRange();
  const to = sp.to || end;
  const from = sp.from || `${to.slice(0, 4)}-01-01`;
  const rows = await projectSummary(await db(), user.id, from, to);
  return (
    <>
      <PageHeader title="Projects" subtitle={`Tag entries with a project (e.g. "Shop 2", "Wedding order") to see each one's profit. ${prettyDate(from)} to ${prettyDate(to)}`} />
      <Flash sp={sp} />
      <form action={addProject} className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="label">New project</label>
          <input name="name" required placeholder="e.g. Shop 2" className="input" />
        </div>
        <button className="btn-primary"><FolderPlus className="h-4 w-4" />Add project</button>
      </form>
      <DateRange from={from} to={to} />
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>No projects yet. Add one above, then choose it when making an entry.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Project</th><th className="num">Entries</th><th className="num">Income</th><th className="num">Expense</th><th className="num">Profit</th><th>Rename / archive</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.archived ? "opacity-60" : ""}>
                  <td>
                    <Link href={`/transactions?project=${p.id}&from=${from}&to=${to}`} className="flex items-center gap-1 font-semibold text-ink hover:text-brand">
                      <FolderKanban className="h-4 w-4 text-purple-600" />{p.name}
                    </Link>
                  </td>
                  <td className="num">{p.entries}</td>
                  <td className="num"><Money value={p.income} /></td>
                  <td className="num"><Money value={p.expense} /></td>
                  <td className="num font-bold"><Money value={p.income - p.expense} /></td>
                  <td>
                    <form action={updateProject} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="name" defaultValue={p.name} className="input max-w-40 py-1" />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="archived" defaultChecked={p.archived} />Archived</label>
                      <button className="text-slate-600 hover:text-ink" aria-label="Save"><Save className="h-4 w-4" /></button>
                    </form>
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
