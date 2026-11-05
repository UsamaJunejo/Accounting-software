import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightLeft, BarChart3, BookUser, FileText, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { getT } from "@/lib/lang";
import { LangSwitch } from "@/components/lang-switch";
import { db } from "@/lib/db";
import { getBillingSettings } from "@/lib/billing";

const FEATURES: [string, string, LucideIcon][] = [
  ["Money in, money out", "One simple form for every sale, expense and payment. Add a note or a photo of the bill.", ArrowRightLeft],
  ["Khata for every customer", "See who owes you and whom you owe. Send someone their balance on WhatsApp in one tap.", BookUser],
  ["Bills your customers can open", "Make an invoice with GST, then send the link on WhatsApp or print it.", FileText],
  ["Reports that add up", "Profit & Loss, Balance Sheet and charts. Every entry is double-entry, so the totals always match.", BarChart3],
  ["Your books, your control", "Share one account with a partner or staff member. They see only that account.", ShieldCheck],
  ["Works on any phone", "Nothing to install. Download everything for Excel any time.", Smartphone],
];

// Sample page shown in the hero: what a day in a cement shop's khata looks like.
const SAMPLE: [string, string, number, "in" | "out"][] = [
  ["4 Nov", "Cash sale, 20 bags cement", 31_000, "in"],
  ["4 Nov", "Ahmed Traders paid (JazzCash)", 12_500, "in"],
  ["4 Nov", "Shop rent, November", 18_000, "out"],
  ["5 Nov", "K-Electric bill", 6_420, "out"],
  ["5 Nov", "Delivery, Gulberg order", 1_500, "out"],
];
const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(n);

export default async function Home() {
  if (await currentUser()) redirect("/dashboard");
  const t = await getT();
  const billing = await getBillingSettings(await db()).catch(() => ({ price: 50000, trialDays: 15 }));
  const price = new Intl.NumberFormat("en-PK").format(billing.price / 100);
  const net = SAMPLE.reduce((s, [, , a, k]) => s + (k === "in" ? a : -a), 0);
  return (
    <div className="min-h-screen">
      <header className="glass-bar sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo className="text-xl text-ink" />
          <div className="flex items-center gap-1 sm:gap-2">
            <LangSwitch lang={t.lang} className="text-ink hover:bg-ink-soft" />
            <Link href="/login" className="btn text-ink hover:bg-ink-soft">{t("Sign in")}</Link>
            <Link href="/signup" className="btn-primary hidden sm:inline-flex">{t("Start free")}</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.15] tracking-tight text-ink sm:text-5xl">
            {t("Your business ka hisaab, sorted. Keep every rupee in order.")}
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-body">
            FinanceChachu is the khata register on your phone. Record sales, expenses and udhaar, and see your profit,
            without needing to know accounting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">{t("Create free account")}</Link>
            <Link href="/login" className="btn-ghost px-6 py-3 text-base">{t("I have an account")}</Link>
          </div>
        </div>

        {/* A khata page: red binding on the left, ruled lines, the total double-underlined. */}
        <figure className="relative" aria-label="Example: two days in a shop's khata">
          <div className="card relative overflow-hidden">
            <div className="absolute inset-y-0 start-0 w-3 bg-khata" />
            <div className="ps-7 pe-5 pt-5 pb-6">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-lg font-bold text-ink">Ali Cement Store</span>
                <span className="text-sm text-muted">Cash book</span>
              </div>
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b-2 border-khata/40 text-sm text-muted">
                    <th className="py-1.5 text-start font-semibold">Date</th>
                    <th className="py-1.5 text-start font-semibold">Details</th>
                    <th className="py-1.5 text-end font-semibold">In</th>
                    <th className="py-1.5 text-end font-semibold">Out</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.map(([d, what, amt, k]) => (
                    <tr key={what} className="border-b border-rule">
                      <td className="py-2 pe-3 whitespace-nowrap text-muted">{d}</td>
                      <td className="py-2 pe-3 text-body">{what}</td>
                      <td className="py-2 text-end tabular-nums text-inflow">{k === "in" ? fmt(amt) : ""}</td>
                      <td className="py-2 text-end tabular-nums text-khata">{k === "out" ? fmt(amt) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="total mt-4 flex items-baseline justify-between">
                <span>Left in hand</span>
                <span className="tabular-nums text-xl">Rs {fmt(net)}</span>
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-sm text-muted">Every entry you make lands in the right place, and the totals do themselves.</figcaption>
        </figure>
      </section>

      <section className="border-y border-white/70 bg-white/45 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-8 max-w-xl text-2xl font-bold">What a shop or small business needs, and nothing it doesn&apos;t</h2>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, desc, Icon]) => (
              <div key={title} className="flex gap-4">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-khata" strokeWidth={1.8} />
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 leading-relaxed text-body">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="card flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
          <div>
            <h2 className="text-2xl font-bold">One simple price</h2>
            <p className="mt-1 text-body">Everything included: khata, invoices, reports, sharing, backups.</p>
          </div>
          <div className="text-end">
            <div className="text-4xl font-bold text-ink">Rs {price}<span className="text-lg font-semibold text-muted"> / month</span></div>
            <div className="text-[15px] text-ledger">First {billing.trialDays} days free. No card needed.</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-6 text-2xl font-bold">Start in three steps</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {[
            ["Sign up", "Your accounts are ready straight away: Cash, Bank, JazzCash, Easypaisa, Sales, Rent and more."],
            ["Write entries", "Money came in? Add Money In. Money went out? Add Money Out. That's the whole job."],
            ["See your business", "Your dashboard, profit, khata balances and reports update by themselves."],
          ].map(([title, desc], i) => (
            <li key={title} className="border-t-2 border-ink pt-4">
              <div className="text-sm font-semibold text-muted">Step {i + 1}</div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-1 leading-relaxed text-body">{desc}</p>
            </li>
          ))}
        </ol>
        <Link href="/signup" className="btn-primary mt-10 px-6 py-3 text-base">{t("Create free account")}</Link>
      </section>

      <footer className="glass-bar py-8 text-center text-sm text-muted">
        <Logo className="text-ink" />
        <div className="mt-2">
          <Link href="/privacy" className="underline hover:text-ink">Privacy</Link>
          <span className="mx-2">|</span>
          <Link href="/terms" className="underline hover:text-ink">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
