import Link from "next/link";
import { Download } from "lucide-react";
import { HowOrganised, OrganizeButtons } from "@/components/organize";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances, categories } from "@/lib/books";
import { categoryColorMap } from "@/lib/palette";
import { accountingTerm, colorAt, friendlyCategory } from "@/lib/look";
import { currencySymbol } from "@/lib/currencies";
import { Flash, PageHeader } from "@/components/ui";
import { DrillCharts, DrillTiles, type DrillItem } from "@/components/drill";
import { AccountsList } from "./list-view";
import { ViewToggle } from "@/components/view-toggle";

export const metadata = { title: "Accounts" };

export default async function Accounts({ searchParams }: { searchParams: Promise<{ view?: string; error?: string; ok?: string; archived?: string }> }) {
  const sp = await searchParams;
  if (sp.view === "list") return <AccountsList sp={sp} />;
  const user = await requireUser();
  const d = await db();
  const [cats, accs] = await Promise.all([categories(d, user.id), accountsWithBalances(d, user.id)]);
  const colors = categoryColorMap(cats);
  const cur = currencySymbol(user.currency);
  const live = accs.filter((a) => !a.archived);

  const actions = (
    <>
      <OrganizeButtons user={user} back="/accounts" />
      <ViewToggle list={false} />
      <Link href="/export?what=accounts" className="btn-ghost"><Download className="h-4 w-4" />Download</Link>
    </>
  );

  // Simple view: every account as a tile.
  if (user.level === 1) {
    const items: DrillItem[] = [...live]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a, i) => ({ key: String(a.id), href: `/accounts/${a.id}`, name: a.name, balance: a.balance, native: a.currency && a.native !== null ? { amount: a.native, currency: a.currency } : null, color: colors.get(a.category_id) ?? colorAt(i), kind: a.kind, note: a.category }));
    const chartItems = items.filter((i) => i.kind === "asset" || i.kind === "liability" || i.kind === "equity").sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 8);
    return (
      <>
        <PageHeader title="Accounts" subtitle="Tap an account to see its statement." actions={actions} />
        <Flash sp={sp} />
        <HowOrganised level={1} />
        <DrillTiles items={items} />
        <DrillCharts items={chartItems} cur={cur} donutTitle="Biggest balances" barsTitle="Account balances" />
      </>
    );
  }

  const items: DrillItem[] = cats.map((c, i) => {
    const mine = live.filter((a) => a.category_id === c.id);
    return {
      key: String(c.id),
      href: `/accounts/category/${c.id}`,
      name: friendlyCategory(c.name),
      balance: mine.reduce((s, a) => s + a.balance, 0),
      color: colors.get(c.id) ?? colorAt(i),
      icon: c.icon,
      kind: c.kind,
      note: [accountingTerm(c.name), `${mine.length} ${mine.length === 1 ? "account" : "accounts"}`].filter(Boolean).join(" | "),
    };
  });
  const balanceSheet = items.filter((i) => i.kind !== "income" && i.kind !== "expense");
  return (
    <>
      <PageHeader title="Accounts" subtitle="Tap a category to open it. Each one has its own colour, used in every chart." actions={actions} />
      <Flash sp={sp} />
      <HowOrganised level={user.level} />
      <DrillTiles items={items} />
      <DrillCharts items={balanceSheet} cur={cur} donutTitle="Share of each category" barsTitle="Category balances" />
    </>
  );
}
