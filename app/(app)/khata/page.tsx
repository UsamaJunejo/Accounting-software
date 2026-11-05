import Link from "next/link";
import { Banknote, MessageCircle, PackagePlus, Share2, ShoppingBag, Truck, UserPlus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, khata, subcategories } from "@/lib/books";
import { addAccount } from "@/app/actions/books";
import { Empty, Flash, Money, PageHeader } from "@/components/ui";
import { money } from "@/lib/format";
import { getT } from "@/lib/lang";
import { RankedBars } from "@/components/charts";
import { currencySymbol } from "@/lib/currencies";

export const metadata = { title: "Khata" };

export default async function Khata({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const t = await getT();
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
      <div className="flex items-center justify-between border-b-2 border-rule bg-paper px-4 py-3 text-ink">
        <h2 className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-brand" />{t(title)}</h2>
        <Money value={rows.reduce((s, r) => s + r.balance, 0)} className="font-semibold" />
      </div>
      <p className="px-4 pt-3 text-xs text-muted">{t(hint)}</p>
      {rows.length === 0 ? (
        <Empty>{t("Nobody added yet.")}</Empty>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3 text-sm">
              <div>
                <Link href={`/accounts/${r.id}`} className="font-semibold text-ink hover:text-brand">{r.name}</Link>
                {r.phone && <div className="text-xs text-muted">{r.phone}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Money value={r.balance} className="mr-2 font-bold" />
                {r.phone && (
                  <a
                    href={`https://wa.me/${r.phone.replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent(`Assalam-o-Alaikum ${r.name}, your balance with ${user.business_name || user.name} is ${currencySymbol(user.currency)} ${money(Math.abs(r.balance))}. Thank you.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Send balance on WhatsApp"
                    aria-label="Send balance on WhatsApp"
                    className="inline-flex rounded-md p-1.5 text-ledger hover:bg-ledger-soft"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                {actions(r.id)}
                <Link href={`/accounts/${r.id}#sharing`} title="Share with this person" aria-label="Share" className="inline-flex rounded-md p-1.5 text-muted hover:bg-paper"><Share2 className="h-4 w-4" /></Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {sub && (
        <form action={addAccount} className="flex flex-wrap gap-2 bg-paper p-3">
          <input type="hidden" name="subcategory" value={sub.id} />
          <input type="hidden" name="back" value="/khata" />
          <input name="name" required placeholder={t("Name")} className="input max-w-48" />
          <input name="phone" placeholder={t("Mobile")} className="input max-w-40" />
          <button className="btn-dark"><UserPlus className="h-4 w-4" />{t("Add")}</button>
        </form>
      )}
    </section>
  );

  const small = "inline-flex items-center gap-1 rounded-md border border-rule-strong bg-white px-2 py-1 text-xs font-semibold hover:border-brand";
  return (
    <>
      <PageHeader title={t("Khata")} subtitle={t("Who owes you, and whom you owe.")} actions={<Link href="/reports/late-payers" className="btn-ghost">Who is late paying</Link>} />
      <Flash sp={sp} />
      {customers.some((c) => c.balance > 0) && (
        <div className="card mb-5 p-5">
          <h2 className="text-lg font-bold">{t("Who owes you the most")}</h2>
          <p className="mb-3 text-sm text-muted">{t("Customers with money still to pay, largest first")}</p>
          <RankedBars
            data={customers.filter((c) => c.balance > 0).sort((x, y) => y.balance - x.balance).slice(0, 8).map((c) => ({ name: c.name, value: c.balance }))}
            cur={currencySymbol(user.currency)}
            name={t("Owes you")}
            color="#2a78d6"
          />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Customers (they owe you)"
          Icon={Users}
          rows={customers}
          sub={custSub}
          hint="Udhaar sale: goods given on credit. Payment received: customer paid you."
          actions={(pid) => (
            <>
              <Link className={small} href={`/voucher?type=transfer&from=${sales}&to=${pid}`}><ShoppingBag className="h-3.5 w-3.5" />{t("Udhaar sale")}</Link>
              <Link className={small} href={`/voucher?type=receipt&from=${pid}&to=${cash}`}><Banknote className="h-3.5 w-3.5" />{t("Payment received")}</Link>
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
              <Link className={small} href={`/voucher?type=transfer&from=${pid}&to=${purchases}`}><PackagePlus className="h-3.5 w-3.5" />{t("Bought on credit")}</Link>
              <Link className={small} href={`/voucher?type=payment&from=${cash}&to=${pid}`}><Banknote className="h-3.5 w-3.5" />{t("Paid")}</Link>
            </>
          )}
        />
      </div>
    </>
  );
}
