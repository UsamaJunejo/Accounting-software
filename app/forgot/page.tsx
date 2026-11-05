import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ForgotForm } from "@/components/forgot-form";

export const metadata = { title: "Forgot password" };

export default function Forgot() {
  return (
    <AuthCard title="Forgot password" footer={<>Remembered it? <Link href="/login" className="font-semibold text-brand">Sign in</Link></>}>
      <ForgotForm />
    </AuthCard>
  );
}
