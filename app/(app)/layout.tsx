import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sharingBadge } from "@/lib/sharing";
import { getT } from "@/lib/lang";
import { LangSwitch } from "@/components/lang-switch";

const NAV_LABELS = ["Dashboard", "New Entry", "Entries", "Accounts", "Khata", "Invoices", "Shared", "Reports", "Settings", "Admin"];
import { logout } from "@/app/actions/auth";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { KeyRound, LogOut, ShieldAlert, Store } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const badge = await sharingBadge(await db(), user.id);
  const t = await getT();
  return (
    <div>
      <header className="no-print fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-rule bg-sheet px-4 text-ink">
        <div className="flex items-center gap-2">
          <Nav isAdmin={user.is_admin} badge={badge} labels={Object.fromEntries(NAV_LABELS.map((l) => [l, t(l)]))} />
          <Link href="/dashboard" className="text-lg">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-1 text-sm sm:gap-3">
          <span className="hidden items-center gap-1.5 text-muted sm:flex"><Store className="h-4 w-4" />{user.business_name || user.name}</span>
          <LangSwitch lang={t.lang} className="text-ink hover:bg-ink-soft" />
          <form action={logout}>
            <button className="flex items-center gap-1.5 rounded px-2 py-1.5 text-ink hover:bg-ink-soft sm:px-3" aria-label="Sign out"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">{t("Sign out")}</span></button>
          </form>
        </div>
      </header>
      <main className="px-4 pb-16 pt-20 lg:ms-56 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {user.must_change_password && (
            <Link href="/settings?must=1" className="no-print mb-4 flex items-center gap-2 rounded-lg border border-khata/30 bg-khata-soft px-4 py-3 text-sm text-khata">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              {t("You signed in with a temporary password. Please change it now in Settings.")}
            </Link>
          )}
          {!user.has_recovery && !user.must_change_password && (
            <Link href="/recovery-code" className="no-print mb-4 flex items-center gap-2 rounded-lg border border-marigold/30 bg-marigold-soft px-4 py-3 text-sm text-marigold">
              <KeyRound className="h-5 w-5 shrink-0" />
              {t("Save a recovery code so you can get back in if you forget your password. Tap here.")}
            </Link>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
