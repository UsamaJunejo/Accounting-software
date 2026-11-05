import Link from "next/link";
import { Logo } from "@/components/logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-ink px-4 py-4">
        <Link href="/" className="text-xl text-white"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Last updated: {updated}</p>
        <div className="prose-legal mt-8 space-y-5 text-[15px] leading-7 text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
        <p className="mt-12 text-sm">
          <Link href="/privacy" className="text-brand">Privacy Policy</Link> · <Link href="/terms" className="text-brand">Terms of Use</Link> · <Link href="/" className="text-brand">Home</Link>
        </p>
      </main>
    </div>
  );
}
