import Link from "next/link";
import { Logo } from "@/components/logo";
import { LangSwitch } from "@/components/lang-switch";
import { getLang } from "@/lib/lang";
import { Suspense } from "react";
import { Toaster } from "@/components/toaster";
import { SubmitGuard } from "@/components/submit-guard";

export async function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  const lang = await getLang();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-2 flex justify-end"><LangSwitch lang={lang} className="text-ink hover:bg-ink-soft" /></div>
        <Link href="/" className="mb-6 block text-center text-2xl text-ink">
          <Logo />
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="mb-5 text-xl font-bold text-ink">{title}</h1>
          {children}
        </div>
        <p className="mt-5 text-center text-[15px] text-body">{footer}</p>
        <Suspense>
          <Toaster />
          <SubmitGuard />
        </Suspense>
      </div>
    </div>
  );
}
