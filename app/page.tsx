import Link from "next/link";
import { ArrowRightLeft, BarChart3, BookUser, ShieldCheck, Smartphone, Target, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

const FEATURES: [string, string, LucideIcon][] = [
  ["Payments & receipts in seconds", "Record money in and out with one simple form. Attach a note and colour-highlight important entries.", ArrowRightLeft],
  ["Khata for customers & suppliers", "See who owes you and whom you owe. Send a balance reminder on WhatsApp in one tap.", BookUser],
  ["Proper accounting, no jargon", "Every entry is double-entry behind the scenes, so your Balance Sheet always balances.", ShieldCheck],
  ["Reports that matter", "Profit & Loss, Balance Sheet, account statements, and a log of deleted entries. Print or save as PDF.", BarChart3],
  ["Budgets with alerts", "Set a monthly limit on any expense and see at a glance when you are close to it.", Target],
  ["Works on any device", "Phone, tablet or computer, nothing to install. Download your data any time as Excel/CSV.", Smartphone],
];

export default async function Home() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <div className="bg-white">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo className="text-xl" />
          <div className="flex gap-2">
            <Link href="/login" className="btn text-white hover:bg-white/10">Sign in</Link>
            <Link href="/signup" className="btn-primary">Start free</Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:pt-20">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand">Accounting for Pakistani small businesses</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Your business ka hisaab, sorted. Keep every rupee in order.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            Record sales, expenses and udhaar, see your profit, and keep a clean khata for every customer, all in
            PKR and without needing to know accounting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">Create free account</Link>
            <Link href="/login" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">I have an account</Link>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-2xl font-bold text-ink">Everything a shop or small business needs</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d, Icon]) => (
            <div key={t} className="card p-5">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-brand"><Icon className="h-5 w-5" /></span>
              <h3 className="font-semibold text-ink">{t}</h3>
              <p className="mt-2 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-2xl font-bold text-ink">How it works</h2>
          <ol className="grid gap-5 sm:grid-cols-3">
            {[
              ["Sign up", "Your accounts are ready instantly: Cash, Bank, JazzCash, Easypaisa, Sales, Rent and more."],
              ["Record entries", "Money came in? Add a Receipt. Money went out? Add a Payment. That's it."],
              ["See your business", "Dashboard, profit, khata balances and reports update automatically."],
            ].map(([t, d], i) => (
              <li key={t} className="card p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</div>
                <h3 className="font-semibold text-ink">{t}</h3>
                <p className="mt-2 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <footer className="bg-ink py-8 text-center text-sm text-slate-400">
        <Logo className="text-white" /> · Simple accounting for everyone
        <div className="mt-2"><Link href="/privacy" className="hover:text-white">Privacy</Link> · <Link href="/terms" className="hover:text-white">Terms</Link></div>
      </footer>
    </div>
  );
}
