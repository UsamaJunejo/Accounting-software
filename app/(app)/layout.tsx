import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sharingBadge } from "@/lib/sharing";
import { runDueSchedules } from "@/lib/schedules";
import { urgentCount } from "@/lib/notifications";
import { today } from "@/lib/format";
import { getT } from "@/lib/lang";
import { LangSwitch } from "@/components/lang-switch";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { remindRecoveryLater } from "@/app/actions/lang";
import { Toaster } from "@/components/toaster";
import { BottomBar } from "@/components/bottom-bar";
import { NumFormatProvider } from "@/components/num-format";
import { SubmitGuard } from "@/components/submit-guard";

const NAV_LABELS = ["Dashboard", "New Entry", "Entries", "Accounts", "Khata", "Invoices", "Scheduled", "Shared", "Reports", "Settings", "Billing", "Admin"];
import { logout } from "@/app/actions/auth";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { Bell, Clock, KeyRound, Lock, LogOut, Search, ShieldAlert, Store } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const d = await db();
  // Add any automatic scheduled entries that have come due since the last visit.
  if (user.plan.state !== "expired") await runDueSchedules(d, user.id, today()).catch(() => 0);
  const [badge, alerts] = await Promise.all([sharingBadge(d, user.id), urgentCount(d, user.id, today(), user.is_admin)]);
  const t = await getT();
  const later = (await cookies()).get("recovery-later")?.value === "1";
  return (
    <div>
      <header className="no-print fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between glass-bar px-4 text-ink lg:ps-64">
        <div className="flex items-center gap-2">
          <Nav isAdmin={user.is_admin} badge={badge} labels={Object.fromEntries(NAV_LABELS.map((l) => [l, t(l)]))} />
          <Link href="/dashboard" className="text-lg lg:hidden">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-1 text-sm sm:gap-3">
          <span className="hidden items-center gap-1.5 text-muted sm:flex"><Store className="h-4 w-4" />{user.business_name || user.name}</span>
          <form action="/search" role="search" className="relative me-1 hidden md:block">
            <Search className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-muted" />
            <input name="q" placeholder={t("Search")} aria-label={t("Search")} className="w-56 rounded-md border border-rule bg-white/70 py-1.5 pe-3 ps-8 text-sm outline-none focus:border-peacock focus:ring-2 focus:ring-peacock/20 lg:w-72" />
          </form>
          <Link href="/search" className="rounded p-2 text-ink hover:bg-ink-soft md:hidden" aria-label={t("Search")}><Search className="h-5 w-5" /></Link>
          <Link href="/notifications" className="relative rounded p-2 text-ink hover:bg-ink-soft" aria-label={`Notifications${alerts ? ` (${alerts})` : ""}`}>
            <Bell className="h-5 w-5" />
            {alerts > 0 && <span className="absolute -end-0.5 -top-0.5 min-w-5 rounded-full bg-khata px-1 text-center text-xs font-bold leading-5 text-white">{alerts}</span>}
          </Link>
          <LangSwitch lang={t.lang} className="text-ink hover:bg-ink-soft" />
          <form action={logout}>
            <button className="flex items-center gap-1.5 rounded px-2 py-1.5 text-ink hover:bg-ink-soft sm:px-3" aria-label="Sign out"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">{t("Sign out")}</span></button>
          </form>
        </div>
      </header>
      <main className="px-4 pb-28 pt-20 lg:ms-60 lg:px-8 lg:pb-16">
        <NumFormatProvider value={user.num_format}>
        <div className="mx-auto max-w-6xl">
          {user.plan.state === "expired" && (
            <Link href="/billing" className="no-print mb-4 flex items-center gap-2 rounded-lg border border-khata/30 bg-khata-soft px-4 py-3 text-[15px] text-khata">
              <Lock className="h-5 w-5 shrink-0" />
              Your plan has ended. You can still view and download everything. Tap here to pay and keep adding entries.
            </Link>
          )}
          {user.plan.state === "trial" && user.plan.daysLeft <= 5 && (
            <Link href="/billing" className="no-print mb-4 flex items-center gap-2 rounded-lg border border-marigold/30 bg-marigold-soft px-4 py-3 text-[15px] text-marigold">
              <Clock className="h-5 w-5 shrink-0" />
              Your free trial ends in {user.plan.daysLeft} {user.plan.daysLeft === 1 ? "day" : "days"}. Tap here to see how to pay.
            </Link>
          )}
          {user.must_change_password && (
            <Link href="/settings?must=1" className="no-print mb-4 flex items-center gap-2 rounded-lg border border-khata/30 bg-khata-soft px-4 py-3 text-sm text-khata">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              {t("You signed in with a temporary password. Please change it now in Settings.")}
            </Link>
          )}
          {!user.has_recovery && !user.must_change_password && !later && (
            <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-marigold/30 bg-marigold-soft px-4 py-2.5 text-sm text-marigold">
              <Link href="/recovery-code" className="flex flex-1 items-center gap-2">
                <KeyRound className="h-5 w-5 shrink-0" />
                {t("Save a recovery code so you can get back in if you forget your password. Tap here.")}
              </Link>
              <form action={remindRecoveryLater}><button className="whitespace-nowrap rounded px-2 py-1 font-semibold hover:bg-white/50">{t("Remind me later")}</button></form>
            </div>
          )}
          {children}
        </div>
        </NumFormatProvider>
      </main>
      <BottomBar labels={Object.fromEntries(["Home", "Entries", "New Entry", "Khata", "More"].map((l) => [l, t(l)]))} />
      <Suspense>
        <Toaster />
        <SubmitGuard />
      </Suspense>
    </div>
  );
}
