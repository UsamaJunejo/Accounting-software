import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card p-10 text-center">
      <h1 className="text-xl font-bold text-ink">Not found</h1>
      <p className="mt-2 text-muted">This page or record doesn&apos;t exist.</p>
      <Link href="/dashboard" className="btn-primary mt-4">Back to dashboard</Link>
    </div>
  );
}
