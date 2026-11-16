import Link from "next/link";

/** Invoices, customers and suppliers live together: one place for "who owes what". */
export function InvoiceTabs({ active }: { active: "bills" | "customers" | "suppliers" }) {
  const tabs = [
    ["bills", "/invoices", "Invoices"],
    ["customers", "/khata?tab=customers", "Customers"],
    ["suppliers", "/khata?tab=suppliers", "Suppliers"],
  ] as const;
  return (
    <nav aria-label="Invoices and khata" className="mb-5 flex w-full max-w-md rounded-xl border border-rule bg-white p-1 shadow-sm">
      {tabs.map(([id, href, label]) => (
        <Link key={id} href={href} aria-current={active === id ? "page" : undefined}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-[15px] font-bold ${active === id ? "bg-peacock text-white" : "text-muted hover:text-ink"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
