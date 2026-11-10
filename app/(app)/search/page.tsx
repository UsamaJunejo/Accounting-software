import Link from "next/link";
import { ArrowRight, FileText, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchAll } from "@/lib/search";
import { friendlyDate, money } from "@/lib/format";
import { friendlyCategory } from "@/lib/look";
import { PageHeader } from "@/components/ui";
import { CategoryBadge } from "@/components/icons";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").slice(0, 80);
  const r = await searchAll(await db(), user.id, q);
  const total = r.accounts.length + r.entries.length + r.invoices.length;
  return (
    <>
      <PageHeader title="Search" subtitle="Customers, accounts, entries and invoices. Type a name, a note, a mobile number or an amount." />
      <form className="card mb-5 flex gap-2 p-3" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-2.5 h-5 w-5 text-muted" />
          <input name="q" defaultValue={q} autoFocus placeholder="e.g. Ahmed, rent, 0300…, 35000" className="input ps-10 text-lg" aria-label="Search" />
        </div>
        <button className="btn-primary">Search</button>
      </form>
      {q.trim().length >= 2 && total === 0 && <p className="card p-6 text-center text-muted">Nothing found for &ldquo;{q}&rdquo;. Try fewer letters, or a different word.</p>}
      {r.accounts.length > 0 && (
        <section className="card mb-5 overflow-hidden">
          <h2 className="px-5 pb-2 pt-4 text-lg font-bold">Accounts and customers</h2>
          <ul>
            {r.accounts.map((a) => (
              <li key={a.id} className="border-t border-rule/70">
                <Link href={`/accounts/${a.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/60">
                  <CategoryBadge name={a.category} kind="" size="sm" />
                  <span className="flex-1"><b className="text-ink">{a.name}</b><span className="block text-sm text-muted">{friendlyCategory(a.category)} › {a.sub}{a.phone ? ` | ${a.phone}` : ""}</span></span>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.entries.length > 0 && (
        <section className="card mb-5 overflow-hidden">
          <h2 className="px-5 pb-2 pt-4 text-lg font-bold">Entries</h2>
          <ul>
            {r.entries.map((e) => (
              <li key={e.id} className="border-t border-rule/70">
                <Link href={`/voucher?edit=${e.id}&back=${encodeURIComponent(`/search?q=${encodeURIComponent(q)}`)}`} className="flex items-start gap-3 px-5 py-2.5 hover:bg-white/60">
                  <span className="flex-1"><span className="text-ink">{e.from_name} → <b>{e.to_name}</b></span><span className="block text-sm text-muted">{friendlyDate(e.date)} {e.note}</span></span>
                  <span className={`font-bold tabular-nums ${e.type === "payment" ? "text-khata" : e.type === "receipt" ? "text-inflow" : "text-ink"}`}>{money(e.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.invoices.length > 0 && (
        <section className="card mb-5 overflow-hidden">
          <h2 className="px-5 pb-2 pt-4 text-lg font-bold">Invoices</h2>
          <ul>
            {r.invoices.map((i) => (
              <li key={i.id} className="border-t border-rule/70">
                <Link href={`/invoices/${i.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/60">
                  <FileText className="h-5 w-5 text-muted" />
                  <span className="flex-1"><b className="text-ink">#{i.number} {i.customer_name}</b><span className="block text-sm text-muted">{friendlyDate(i.date)}{i.cancelled ? " | Cancelled" : ""}</span></span>
                  <span className="font-bold tabular-nums">{money(i.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
