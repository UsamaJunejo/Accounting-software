import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { LogOut, Store } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div>
      <header className="no-print fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-white">
        <div className="flex items-center gap-2">
          <Nav />
          <Link href="/dashboard" className="text-lg">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden items-center gap-1.5 text-slate-300 sm:flex"><Store className="h-4 w-4" />{user.business_name || user.name}</span>
          <form action={logout}>
            <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" />Sign out</button>
          </form>
        </div>
      </header>
      <main className="px-4 pb-16 pt-20 lg:ml-56 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
