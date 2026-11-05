import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { RecoveryCodeForm } from "@/components/recovery-code-form";

export const metadata = { title: "Recovery code" };

export default async function RecoveryCode({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={sp.new ? "Welcome! One last step" : "Recovery code"} />
      <div className="card max-w-2xl space-y-4 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
          <div className="text-sm text-slate-700">
            <p>
              A <b>recovery code</b> lets you set a new password if you ever forget it. Keep it somewhere safe, like a
              screenshot in your phone&apos;s gallery or written in your diary.
            </p>
            <p className="mt-2">Anyone with your email <i>and</i> this code can get into your account, so don&apos;t share it.</p>
          </div>
        </div>
        <RecoveryCodeForm hasCode={user.has_recovery} />
      </div>
    </>
  );
}
