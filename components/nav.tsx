"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/voucher", label: "New Entry", icon: "M12 5v14M5 12h14" },
  { href: "/transactions", label: "Entries", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/accounts", label: "Accounts", icon: "M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" },
  { href: "/khata", label: "Khata", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1" },
  { href: "/reports", label: "Reports", icon: "M9 17V9m4 8V5m4 12v-6M4 21h16" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 15H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 5V5a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0021 11h0a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = ITEMS.map((i) => {
    const active = path === i.href || path.startsWith(i.href + "/");
    return (
      <Link
        key={i.href}
        href={i.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-brand text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon d={i.icon} />
        {i.label}
      </Link>
    );
  });
  return (
    <>
      <button onClick={() => setOpen(!open)} className="no-print rounded-lg p-2 text-white hover:bg-white/10 lg:hidden" aria-label="Menu">
        <Icon d="M4 6h16M4 12h16M4 18h16" />
      </button>
      {open && <nav className="no-print absolute inset-x-0 top-14 z-20 space-y-1 bg-ink p-3 shadow-lg lg:hidden">{links}</nav>}
      <nav className="no-print fixed bottom-0 left-0 top-14 hidden w-56 space-y-1 bg-ink p-3 lg:block">{links}</nav>
    </>
  );
}
