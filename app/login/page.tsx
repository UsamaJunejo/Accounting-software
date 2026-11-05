import Link from "next/link";
import { login } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { Flash } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Sign in" footer={<>New here? <Link href="/signup" className="font-semibold text-brand">Create a free account</Link></>}>
      <Flash sp={sp} />
      <form action={login} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <button className="btn-primary w-full py-2.5">Sign in</button>
        <p className="text-center text-sm">
          <Link href="/forgot" className="font-semibold text-brand">Forgot password?</Link>
        </p>
      </form>
    </AuthCard>
  );
}
