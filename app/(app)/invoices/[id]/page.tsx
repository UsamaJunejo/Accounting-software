import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Ban, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInvoice } from "@/lib/invoices";
import { cancelInvoice } from "@/app/actions/invoices";
import { money } from "@/lib/format";
import { Flash, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { InvoiceView } from "@/components/invoice-view";
import { CodeBox } from "@/components/code-box";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const inv = await getInvoice(await db(), user.id, Number((await params).id));
  if (!inv) notFound();
  const sp = await searchParams;
  const h = await headers();
  const link = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/i/${inv.share_token}`;
  const phone = inv.customer_phone?.replace(/\D/g, "").replace(/^0/, "92");
  const text = encodeURIComponent(`Assalam-o-Alaikum ${inv.customer_name}, here is invoice #${inv.number} from ${inv.business} for Rs ${money(inv.total)}:\n${link}`);
  return (
    <>
      <PageHeader
        title={`Invoice #${inv.number}`}
        actions={
          <>
            <a href={`https://wa.me/${phone ?? ""}?text=${text}`} target="_blank" rel="noreferrer" className="btn bg-green-600 text-white hover:bg-green-700">
              <MessageCircle className="h-4 w-4" />Send on WhatsApp
            </a>
            <PrintButton />
            {!inv.cancelled && (
              <form action={cancelInvoice}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="btn-danger"><Ban className="h-4 w-4" />Cancel invoice</button>
              </form>
            )}
          </>
        }
      />
      <Flash sp={sp} />
      <div className="no-print mb-5 space-y-2">
        <p className="text-sm text-slate-600">Customer link (anyone with it can view this invoice, nothing else):</p>
        <CodeBox value={link} />
      </div>
      <InvoiceView inv={inv} />
    </>
  );
}
