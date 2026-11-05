"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import {
  CalendarClock,
  CreditCard,
  BarChart3, BookUser, FileText, LayoutDashboard, ListOrdered, Menu, PlusCircle, Settings, Share2, ShieldCheck, Wallet, X,
} from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/voucher", label: "New Entry", Icon: PlusCircle },
  { href: "/transactions", label: "Entries", Icon: ListOrdered },
  { href: "/accounts", label: "Accounts", Icon: Wallet },
  { href: "/khata", label: "Khata", Icon: BookUser },
  { href: "/invoices", label: "Invoices", Icon: FileText },
  { href: "/scheduled", label: "Scheduled", Icon: CalendarClock },
  { href: "/shared", label: "Shared", Icon: Share2 },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/billing", label: "Billing", Icon: CreditCard },
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
        className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors ${
          active ? "bg-nav-active font-semibold text-nav-active-text" : "text-nav-text hover:bg-nav-hover hover:text-nav-active-text"
        }`}
      >
        <Icon className={`h-5 w-5 ${active ? "text-nav-marker" : "text-nav-muted"}`} strokeWidth={1.8} />
        {labels[label] ?? label}
        {href === "/shared" && badge > 0 && (
          <span className="ms-auto rounded-full bg-khata px-2 text-xs font-bold text-white">{badge}</span>
        )}
      </Link>
    );
  });
  return (
    <>
      <button onClick={() => setOpen(!open)} className="no-print relative rounded p-2 text-ink hover:bg-paper lg:hidden" aria-label="Menu" aria-expanded={open}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        {!open && badge > 0 && <span className="absolute end-1 top-1 h-2.5 w-2.5 rounded-full bg-khata" />}
      </button>
      {open && <nav className="glass-nav no-print absolute inset-x-0 top-14 z-20 space-y-0.5 p-3 shadow-lg lg:hidden">{links}</nav>}
      <aside className="glass-nav no-print fixed inset-y-0 start-0 z-40 hidden w-60 flex-col border-e border-nav-border lg:flex">
        <Link href="/dashboard" className="flex h-14 items-center px-5 text-lg text-nav-logo">
          <Logo dark />
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">{links}</nav>
      </aside>
    </>
  );
}
