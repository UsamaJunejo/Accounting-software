import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getInvoiceByToken } from "@/lib/invoices";
import { InvoiceView } from "@/components/invoice-view";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

// Public page: what the customer opens from WhatsApp. No login needed.
export default async function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const inv = await getInvoiceByToken(await db(), (await params).token);
  if (!inv) notFound();
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end"><PrintButton label="Save as PDF / Print" /></div>
      <InvoiceView inv={inv} />
    </div>
  );
}
