import Link from "next/link";
import { Banknote, MessageCircle, PackagePlus, Share2, ShoppingBag, Truck, UserPlus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, khata, subcategories } from "@/lib/books";
import { addAccount } from "@/app/actions/books";
import { Empty, Flash, Money, PageHeader } from "@/components/ui";
import { money } from "@/lib/format";

export const metadata = { title: "Khata" };

export default async function Khata({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const people = await khata(d, user.id);
  const accs = await accountsWithBalances(d, user.id);
  const subs = await subcategories(d, user.id);
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
    Icon,
  }: {
    Icon: typeof Users;
    title: string;
    rows: typeof people;
    sub?: { id: number };
    hint: string;
    actions: (pid: number) => React.ReactNode;
  }) => (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
        <h2 className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-brand" />{title}</h2>
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
                {r.phone && (
                  <a
                    href={`https://wa.me/${r.phone.replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent(`Assalam-o-Alaikum ${r.name}, your balance with ${user.business_name || user.name} is Rs ${money(Math.abs(r.balance))}. Thank you.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Send balance on WhatsApp"
                    aria-label="Send balance on WhatsApp"
                    className="inline-flex rounded-md p-1.5 text-green-600 hover:bg-green-50"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                {actions(r.id)}
                <Link href={`/accounts/${r.id}#sharing`} title="Share with this person" aria-label="Share" className="inline-flex rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><Share2 className="h-4 w-4" /></Link>
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
          <button className="btn-dark"><UserPlus className="h-4 w-4" />Add</button>
        </form>
      )}
    </section>
  );

  const small = "inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:border-brand";
  return (
    <>
      <PageHeader title="Khata" subtitle="Who owes you, and whom you owe." />
      <Flash sp={sp} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Customers (they owe you)"
          Icon={Users}
          rows={customers}
          sub={custSub}
          hint="Udhaar sale: goods given on credit. Payment received: customer paid you."
          actions={(pid) => (
            <>
              <Link className={small} href={`/voucher?type=transfer&from=${sales}&to=${pid}`}><ShoppingBag className="h-3.5 w-3.5" />Udhaar sale</Link>
              <Link className={small} href={`/voucher?type=receipt&from=${pid}&to=${cash}`}><Banknote className="h-3.5 w-3.5" />Payment received</Link>
            </>
          )}
        />
        <Section
          title="Suppliers (you owe them)"
          Icon={Truck}
          rows={suppliers}
          sub={supSub}
          hint="Bought on credit: stock received, not paid yet. Paid: you paid the supplier."
          actions={(pid) => (
            <>
              <Link className={small} href={`/voucher?type=transfer&from=${pid}&to=${purchases}`}><PackagePlus className="h-3.5 w-3.5" />Bought on credit</Link>
              <Link className={small} href={`/voucher?type=payment&from=${cash}&to=${pid}`}><Banknote className="h-3.5 w-3.5" />Paid</Link>
            </>
          )}
        />
      </div>
    </>
  );
}
