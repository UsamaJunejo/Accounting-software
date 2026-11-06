/** Round profile picture, or the person's initials when there is no photo. */
export function Avatar({ name, v, size = 32, className = "" }: { name: string; v: string | null; size?: number; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  const style = { width: size, height: size };
  return v ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/photo?v=${v}`} alt="" width={size} height={size} style={style} className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`} />
  ) : (
    <span aria-hidden="true" style={{ ...style, fontSize: size * 0.4 }} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white ring-2 ring-white ${className}`}>{initials}</span>
  );
}
