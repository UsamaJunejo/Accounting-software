import { BRAND } from "@/lib/brand";

/** The mark is a small red khata book: the cloth-bound ledger every shop keeps. */
export function LogoMark({ className = "h-7 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="26" rx="2.5" fill="#c2263a" />
      <rect x="1" y="1" width="4.5" height="26" rx="1.5" fill="#9e1c2e" />
      <path d="M9 9.5h10M9 13.5h10M9 17.5h6" stroke="#fbe5e8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <LogoMark />
      <span>
        {BRAND[0]}
        <span className={dark ? "text-mustard" : "text-khata"}>{BRAND[1]}</span>
      </span>
    </span>
  );
}
