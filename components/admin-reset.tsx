"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { adminResetPassword, type AdminState } from "@/app/actions/auth";
import { CodeBox } from "@/components/code-box";

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
        <p className="text-xs text-slate-500">Send this to {state.email}. They must change it after signing in.</p>
        {wa && (
          <a className="btn bg-green-600 text-white hover:bg-green-700" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${text}`}>
            Send on WhatsApp
          </a>
        )}
      </div>
    );
  }
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Reset the password for ${name}? Their current password will stop working.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {state.error && <p className="mb-1 text-xs text-red-600">{state.error}</p>}
      <button className="btn-ghost text-xs" disabled={pending}>
        <KeyRound className="h-4 w-4" />
        Reset password
      </button>
    </form>
  );
}
