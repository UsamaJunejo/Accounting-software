import Link from "next/link";
import { Logo } from "@/components/logo";

export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-md">
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
