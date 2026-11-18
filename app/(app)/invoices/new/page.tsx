import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { khata } from "@/lib/books";
import { listItems } from "@/lib/items";
import { today } from "@/lib/format";
import { AccountSelect, PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";
import { InvoiceTabs } from "@/components/invoice-tabs";

export const metadata = { title: "New invoice" };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ customer?: string; item?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const customers = (await khata(await db(), user.id)).filter((a) => a.role === "receivable");
  const stock = (await listItems(await db(), user.id)).map((i) => ({ id: i.id, name: i.name, unit: i.unit, group: i.group_name, price: i.sale_price, stock: i.stock }));
  const pre = customers.find((c) => c.id === Number(sp.customer))?.id;
  return (
    <>
      <PageHeader title="New invoice" />
      <InvoiceTabs active="bills" />
      <InvoiceForm
        currency={user.currency}
        today={today()}
        stockItems={stock}
        initialCustomer={pre ? String(pre) : ""}
        initialItem={stock.find((i) => i.id === Number(sp.item))?.id}
        customerPicker={<AccountSelect name="customer" accounts={customers} value={pre} suggest="customer" addInto={["receivable"]} noneLabel="New / walk-in customer" />}
      />
    </>
  );
}
