import { BRAND } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[11px] font-extrabold text-ink">FC</span>
      <span>
        {BRAND[0]}
        <span className="text-brand">{BRAND[1]}</span>
      </span>
    </span>
  );
}
