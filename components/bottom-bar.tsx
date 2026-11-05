"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookUser, LayoutDashboard, ListOrdered, Menu, Plus } from "lucide-react";

/** Phone navigation: four big tabs and a + button in the middle, reachable with one thumb. */
export function BottomBar({ labels = {} }: { labels?: Record<string, string> }) {
  const path = usePathname();
  const L = (s: string) => labels[s] ?? s;
  const tab = (href: string, label: string, Icon: typeof Menu) => {
    const active = path === href || path.startsWith(href + "/");
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? "font-semibold text-brand" : "text-muted"}`}>
        <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} />
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="glass-bar no-print fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-white/80 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {tab("/dashboard", L("Home"), LayoutDashboard)}
      {tab("/transactions", L("Entries"), ListOrdered)}
      <Link href="/voucher" aria-label={L("New Entry")} className="-mt-5 flex flex-1 justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-white">
          <Plus className="h-7 w-7" strokeWidth={2.4} />
        </span>
      </Link>
      {tab("/khata", L("Khata"), BookUser)}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("open-menu"))}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted"
      >
        <Menu className="h-6 w-6" strokeWidth={1.8} />
        {L("More")}
      </button>
    </nav>
  );
}
