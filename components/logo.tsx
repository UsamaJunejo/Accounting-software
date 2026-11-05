import { BRAND } from "@/lib/brand";

/** The mark is a small red khata book: the cloth-bound ledger every shop keeps. */
export function LogoMark({ className = "h-7 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="26" rx="2.5" fill="#a4282b" />
      <rect x="1" y="1" width="4.5" height="26" rx="1.5" fill="#861f22" />
      <path d="M9 9.5h10M9 13.5h10M9 17.5h6" stroke="#f7e6e5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <LogoMark />
      <span>
        {BRAND[0]}
        <span className="text-khata">{BRAND[1]}</span>
      </span>
    </span>
  );
}
