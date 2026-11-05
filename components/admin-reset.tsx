"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { adminResetPassword, type AdminState } from "@/app/actions/auth";
import { CodeBox } from "@/components/code-box";
import { ConfirmButton } from "@/components/confirm-button";

export function AdminReset({ id, name, phone }: { id: number; name: string; phone: string | null }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(adminResetPassword, {});
  if (state.temp) {
    const wa = phone?.replace(/\D/g, "").replace(/^0/, "92");
    const text = encodeURIComponent(
      `Assalam-o-Alaikum ${name}, your FinanceChachu temporary password is: ${state.temp}\nPlease sign in and change it in Settings.`,
    );
    return (
      <div className="space-y-2">
        <CodeBox value={state.temp} />
        <p className="text-xs text-muted">Send this to {state.email}. They must change it after signing in.</p>
        {wa && (
          <a className="btn bg-ledger text-white hover:bg-ledger-dark" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${text}`}>
            Send on WhatsApp
          </a>
        )}
      </div>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state.error && <p className="mb-1 text-xs text-khata">{state.error}</p>}
      <ConfirmButton className="btn-ghost text-xs" message={`Reset the password for ${name}? Their current password will stop working.`} confirmLabel="Reset password">
        <KeyRound className="h-4 w-4" />
        {pending ? "Resetting…" : "Reset password"}
      </ConfirmButton>
    </form>
  );
}
