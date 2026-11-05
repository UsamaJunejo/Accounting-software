import { BRAND } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold ${className}`}>
      {BRAND[0]}
      <span className="text-brand">{BRAND[1]}</span>
    </span>
  );
}
