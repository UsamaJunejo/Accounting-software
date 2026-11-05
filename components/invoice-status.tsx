import { STATUS_LABEL, type InvoiceStatus } from "@/lib/invoices";

const TONE: Record<InvoiceStatus, string> = {
  paid: "bg-ledger-soft text-ledger",
  part: "bg-marigold-soft text-marigold",
  unpaid: "bg-ink-soft text-ink",
  overdue: "bg-khata text-white",
  cancelled: "bg-paper text-muted",
};

export function StatusPill({ status }: { status: InvoiceStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
