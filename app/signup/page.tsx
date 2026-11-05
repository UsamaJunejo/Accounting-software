import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { Flash } from "@/components/ui";
import { getT } from "@/lib/lang";

export const metadata = { title: "Create account" };

export default async function Signup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const t = await getT();
  return (
    <AuthCard title={t("Create your free account")} footer={<>{t("Already registered?")} <Link href="/login" className="font-semibold text-brand">{t("Sign in")}</Link></>}>
      <Flash sp={sp} />
      <form action={signup} className="space-y-4">
        <div>
          <label className="label">{t("Your name")}</label>
          <input name="name" required className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label">{t("Business name (optional)")}</label>
          <input name="business" className="input" placeholder="e.g. Ali General Store" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("Email")}</label>
            <input name="email" type="email" required className="input" autoComplete="email" />
          </div>
          <div>
            <label className="label">{t("Mobile (optional)")}</label>
            <input name="phone" type="tel" className="input" placeholder="03XX-XXXXXXX" />
          </div>
        </div>
        <div>
          <label className="label">{t("Password")}</label>
          <input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
          <p className="mt-1 text-xs text-slate-500">{t("At least 8 characters.")}</p>
        </div>
        <button className="btn-primary w-full py-2.5">{t("Create account")}</button>
        <p className="text-center text-xs text-slate-500">
          By creating an account you agree to our <Link href="/terms" className="text-brand">Terms</Link> and{" "}
          <Link href="/privacy" className="text-brand">Privacy Policy</Link>.
        </p>
      </form>
    </AuthCard>
  );
}
