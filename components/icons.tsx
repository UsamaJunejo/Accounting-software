import type { Kind } from "@/lib/books";
import { iconFor } from "@/lib/look";

export function CategoryBadge({
  name,
  kind,
  size = "md",
  color,
  icon,
}: {
  name: string;
  kind: Kind | string;
  size?: "sm" | "md" | "lg";
  color?: string | null;
  icon?: string | null;
}) {
  const Icon = iconFor(icon, name, kind);
  const box = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const ic = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${color ? "text-white" : "bg-peacock-soft text-peacock"} ${box}`}
      style={color ? { background: color } : undefined}
    >
      <Icon className={ic} strokeWidth={1.9} />
    </span>
  );
}
