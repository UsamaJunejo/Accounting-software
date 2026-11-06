import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { khata } from "@/lib/books";
import { today } from "@/lib/format";
import { AccountSelect, PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";

export const metadata = { title: "New invoice" };

export default async function NewInvoice() {
  const user = await requireUser();
  const customers = (await khata(await db(), user.id)).filter((a) => a.role === "receivable");
  return (
    <>
      <PageHeader title="New invoice" subtitle="Make a bill for a customer. You can print it or send it on WhatsApp." />
      <InvoiceForm
        currency={user.currency}
        today={today()}
        customerPicker={<AccountSelect name="customer" accounts={customers} suggest="customer" addInto={["receivable"]} noneLabel="New / walk-in customer" />}
      />
    </>
  );
}
