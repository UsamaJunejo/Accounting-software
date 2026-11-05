"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, BookUser, LayoutDashboard, ListOrdered, Menu, PlusCircle, Settings, ShieldCheck, Wallet, X } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/voucher", label: "New Entry", Icon: PlusCircle },
  { href: "/transactions", label: "Entries", Icon: ListOrdered },
  { href: "/accounts", label: "Accounts", Icon: Wallet },
  { href: "/khata", label: "Khata", Icon: BookUser },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function Nav({ isAdmin = false }: { isAdmin?: boolean }) {
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
        {label}
      </Link>
    );
  });
  return (
    <>
      <button onClick={() => setOpen(!open)} className="no-print rounded-lg p-2 text-white hover:bg-white/10 lg:hidden" aria-label="Menu">
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && <nav className="no-print absolute inset-x-0 top-14 z-20 space-y-1 bg-ink p-3 shadow-lg lg:hidden">{links}</nav>}
      <nav className="no-print fixed bottom-0 left-0 top-14 hidden w-56 space-y-1 bg-ink p-3 lg:block">{links}</nav>
    </>
  );
}
