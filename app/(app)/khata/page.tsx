import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, khata, subcategories } from "@/lib/books";
import { addAccount } from "@/app/actions/books";
import { Empty, Flash, Money, PageHeader } from "@/components/ui";

export const metadata = { title: "Khata" };

export default async function Khata({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = db();
  const people = khata(d, user.id);
  const accs = accountsWithBalances(d, user.id);
  const subs = subcategories(d, user.id);
  const custSub = subs.find((s) => s.name.startsWith("Customers"));
  const supSub = subs.find((s) => s.name === "Suppliers");
  const id = (name: string) => accs.find((a) => a.name === name)?.id ?? "";
  const cash = accs.find((a) => a.category === "Cash")?.id ?? "";
  const sales = id("Sales");
  const purchases = id("Purchases");

  const customers = people.filter((p) => p.category === "Receivables");
  const suppliers = people.filter((p) => p.category === "Payables");

  const Section = ({
    title,
    rows,
    sub,
    hint,
    actions,
  }: {
    title: string;
    rows: typeof people;
    sub?: { id: number };
    hint: string;
    actions: (pid: number) => React.ReactNode;
  }) => (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
        <h2 className="font-semibold">{title}</h2>
        <Money value={rows.reduce((s, r) => s + r.balance, 0)} className="font-semibold" />
      </div>
      <p className="px-4 pt-3 text-xs text-slate-500">{hint}</p>
      {rows.length === 0 ? (
        <Empty>Nobody added yet.</Empty>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3 text-sm">
              <div>
                <Link href={`/accounts/${r.id}`} className="font-semibold text-ink hover:text-brand">{r.name}</Link>
                {r.phone && <div className="text-xs text-slate-500">{r.phone}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Money value={r.balance} className="mr-2 font-bold" />
                {actions(r.id)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {sub && (
        <form action={addAccount} className="flex flex-wrap gap-2 bg-slate-50 p-3">
          <input type="hidden" name="subcategory" value={sub.id} />
          <input type="hidden" name="back" value="/khata" />
          <input name="name" required placeholder="Name" className="input max-w-48" />
          <input name="phone" placeholder="Mobile" className="input max-w-40" />
          <button className="btn-dark">Add</button>
        </form>
      )}
    </section>
  );

  const small = "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:border-brand";
  return (
    <>
      <PageHeader title="Khata" subtitle="Who owes you, and whom you owe." />
      <Flash sp={sp} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Customers (they owe you)"
          rows={customers}
          sub={custSub}
          hint="Udhaar sale: goods given on credit. Payment received: customer paid you."
          actions={(pid) => (
            <>
              <Link className={small} href={`/voucher?type=transfer&from=${sales}&to=${pid}`}>Udhaar sale</Link>
              <Link className={small} href={`/voucher?type=receipt&from=${pid}&to=${cash}`}>Payment received</Link>
            </>
          )}
        />
        <Section
          title="Suppliers (you owe them)"
          rows={suppliers}
          sub={supSub}
          hint="Bought on credit: stock received, not paid yet. Paid: you paid the supplier."
          actions={(pid) => (
            <>
              <Link className={small} href={`/voucher?type=transfer&from=${pid}&to=${purchases}`}>Bought on credit</Link>
              <Link className={small} href={`/voucher?type=payment&from=${cash}&to=${pid}`}>Paid</Link>
            </>
          )}
        />
      </div>
    </>
  );
}
