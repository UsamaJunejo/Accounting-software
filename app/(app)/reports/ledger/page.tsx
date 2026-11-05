import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, categories } from "@/lib/books";
import { money, prettyDate, today } from "@/lib/format";
import { DateRange, Money, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Group Ledger" };

const SORTS: Record<string, string> = { name: "Name (A–Z)", high: "Highest balance", low: "Lowest balance" };

export default async function Ledger({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; sort?: string; hideZero?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const to = sp.to || today();
  const from = sp.from || "2000-01-01";
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "name";
  const d = await db();
  let rows = (await accountsWithBalances(d, user.id, { from, to })).filter((a) => !a.archived);
  if (sp.hideZero) rows = rows.filter((r) => r.money_in || r.money_out);
  const cmp = sort === "high" ? (a: (typeof rows)[0], b: (typeof rows)[0]) => b.balance - a.balance
    : sort === "low" ? (a: (typeof rows)[0], b: (typeof rows)[0]) => a.balance - b.balance
    : (a: (typeof rows)[0], b: (typeof rows)[0]) => a.name.localeCompare(b.name);

  return (
    <>
      <PageHeader title="Group Ledger" subtitle={`${prettyDate(from)} to ${prettyDate(to)}`} actions={<PrintButton />} />
      <DateRange
        from={from}
        to={to}
        extra={
          <>
            <div>
              <label className="label">Sort</label>
              <select name="sort" defaultValue={sort} className="input">
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="hideZero" value="1" defaultChecked={!!sp.hideZero} /> Hide unused
            </label>
          </>
        }
      />
      {(await categories(d, user.id)).map((c) => {
        const r = rows.filter((x) => x.category_id === c.id).sort(cmp);
        if (!r.length) return null;
        return (
          <div key={c.id} className="card mb-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th className="w-1/3">{c.name}</th><th>Sub-category</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                {r.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={`/accounts/${a.id}?from=${from}&to=${to}`} className="hover:text-brand">{a.name}</Link></td>
                    <td className="text-muted">{a.subcategory}</td>
                    <td className="num">{money(a.money_in)}</td>
                    <td className="num">{money(a.money_out)}</td>
                    <td className="num font-medium"><Money value={a.balance} /></td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={4}>Total {c.name}</td>
                  <td className="num"><Money value={r.reduce((s, a) => s + a.balance, 0)} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
