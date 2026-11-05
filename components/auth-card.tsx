import Link from "next/link";
import { Logo } from "@/components/logo";
import { LangSwitch } from "@/components/lang-switch";
import { getLang } from "@/lib/lang";

export async function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  const lang = await getLang();
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-2 flex justify-end"><LangSwitch lang={lang} className="text-slate-300 hover:bg-white/10" /></div>
        <Link href="/" className="mb-6 block text-center text-2xl text-white">
          <Logo />
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="mb-5 text-xl font-bold text-ink">{title}</h1>
          {children}
        </div>
        <p className="mt-5 text-center text-sm text-slate-300">{footer}</p>
      </div>
    </div>
  );
}
