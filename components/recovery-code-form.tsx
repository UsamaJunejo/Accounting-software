"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { createRecoveryCode, type CodeState } from "@/app/actions/auth";
import { CodeBox } from "@/components/code-box";

export function RecoveryCodeForm({ hasCode }: { hasCode: boolean }) {
  const [state, action, pending] = useActionState<CodeState>(createRecoveryCode, {});
  if (state.code)
    return (
      <div className="space-y-4">
        <CodeBox value={state.code} />
        <p className="text-sm text-body">
          <b>Save this now.</b> Take a screenshot or write it down. It won&apos;t be shown again.
          {hasCode && " Your old code no longer works."}
        </p>
        <Link href="/dashboard" className="btn-primary">I&apos;ve saved it</Link>
      </div>
    );
  return (
    <form action={action}>
      <button className="btn-primary" disabled={pending}>
        <KeyRound className="h-4 w-4" />
        {pending ? "Creating…" : hasCode ? "Create a new code" : "Show my recovery code"}
      </button>
    </form>
  );
}
