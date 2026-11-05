"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, BookUser, FileText, LayoutDashboard, ListOrdered, Menu, PlusCircle, Settings, Share2, ShieldCheck, Wallet, X,
} from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/voucher", label: "New Entry", Icon: PlusCircle },
  { href: "/transactions", label: "Entries", Icon: ListOrdered },
  { href: "/accounts", label: "Accounts", Icon: Wallet },
  { href: "/khata", label: "Khata", Icon: BookUser },
  { href: "/invoices", label: "Invoices", Icon: FileText },
  { href: "/shared", label: "Shared", Icon: Share2 },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function Nav({ isAdmin = false, badge = 0, labels = {} }: { isAdmin?: boolean; badge?: number; labels?: Record<string, string> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = isAdmin ? [...ITEMS, { href: "/admin", label: "Admin", Icon: ShieldCheck }] : ITEMS;
  const links = items.map(({ href, label, Icon }) => {
    const active = path === href || path.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded px-3 py-2 text-[15px] transition-colors ${
          active ? "bg-ink-soft font-semibold text-ink" : "text-body hover:bg-ink-soft/60 hover:text-ink"
        }`}
      >
        {active && <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-ink" />}
        <Icon className="h-5 w-5" strokeWidth={1.8} />
        {labels[label] ?? label}
        {href === "/shared" && badge > 0 && (
          <span className="ms-auto rounded-full bg-khata px-2 text-xs font-bold text-white">{badge}</span>
        )}
      </Link>
    );
  });
  return (
    <>
      <button onClick={() => setOpen(!open)} className="no-print relative rounded p-2 text-ink hover:bg-ink-soft lg:hidden" aria-label="Menu" aria-expanded={open}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        {!open && badge > 0 && <span className="absolute end-1 top-1 h-2.5 w-2.5 rounded-full bg-khata" />}
      </button>
      {open && <nav className="no-print absolute inset-x-0 top-14 z-20 space-y-0.5 border-b border-rule bg-sheet p-3 shadow-md lg:hidden">{links}</nav>}
      {/* The sidebar is the spine of the book: a red binding strip down its outer edge. */}
      <nav className="no-print fixed bottom-0 start-0 top-14 hidden w-56 space-y-0.5 border-e border-rule bg-sheet p-3 ps-4 lg:block">
        <span className="absolute inset-y-0 start-0 w-1.5 bg-khata" aria-hidden="true" />
        {links}
      </nav>
    </>
  );
}
