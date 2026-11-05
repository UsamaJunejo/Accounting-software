import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/logo";

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
          <span className="hidden text-slate-300 sm:inline">{user.business_name || user.name}</span>
          <form action={logout}>
            <button className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white">Sign out</button>
          </form>
        </div>
      </header>
      <main className="px-4 pb-16 pt-20 lg:ml-56 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
