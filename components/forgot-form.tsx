"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetWithCode, type CodeState } from "@/app/actions/auth";
import { CodeBox } from "@/components/code-box";

export function ForgotForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(resetWithCode, {});
  if (state.code)
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Password changed. You are now signed in.
        </div>
        <p className="text-sm text-slate-700">Your old recovery code has been used up. Here is your <b>new</b> one. Save it:</p>
        <CodeBox value={state.code} />
        <Link href="/dashboard" className="btn-primary w-full">I&apos;ve saved it, continue</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div>
        <label className="label">Email</label>
        <input name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label">Recovery code</label>
        <input name="code" required placeholder="FC-XXXX-XXXX-XXXX" autoComplete="off" className="input font-mono uppercase" />
      </div>
      <div>
        <label className="label">New password</label>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Checking…" : "Set new password"}</button>
      <p className="text-xs text-slate-500">
        Lost your recovery code too? Contact FinanceChachu support and we&apos;ll reset it for you.
      </p>
    </form>
  );
}
