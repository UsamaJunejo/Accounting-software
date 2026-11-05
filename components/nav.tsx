"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, BookUser, FileText, LayoutDashboard, ListOrdered, Menu, PlusCircle, Settings, Share2, ShieldCheck, Wallet, X } from "lucide-react";

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
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-brand text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
        {labels[label] ?? label}
        {href === "/shared" && badge > 0 && (
          <span className="ms-auto rounded-full bg-red-500 px-2 text-xs font-bold text-white">{badge}</span>
        )}
      </Link>
    );
  });
  return (
    <>
      <button onClick={() => setOpen(!open)} className="no-print rounded-lg p-2 text-white hover:bg-white/10 lg:hidden" aria-label="Menu">
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        {!open && badge > 0 && <span className="absolute ms-3 -mt-6 h-2.5 w-2.5 rounded-full bg-red-500" />}
      </button>
      {open && <nav className="no-print absolute inset-x-0 top-14 z-20 space-y-1 bg-ink p-3 shadow-lg lg:hidden">{links}</nav>}
      <nav className="no-print fixed bottom-0 start-0 top-14 hidden w-56 space-y-1 bg-ink p-3 lg:block">{links}</nav>
    </>
  );
}
