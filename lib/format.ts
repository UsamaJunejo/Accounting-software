import { cache } from "react";

/**
 * Number style for this request: "intl" = 1,234,567.00, "lakh" = 12,34,567.00 (the South Asian way).
 * Set once per request from the signed-in user's setting (see lib/auth.ts); defaults to intl.
 */
export const numberStyle = cache(() => ({ v: "intl" as "intl" | "lakh" }));

const FMT = {
  intl: new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  lakh: new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

/** Paisa -> "123,456.00". Negatives get a minus sign, easier for most people than accountant brackets. */
export function money(paisa: number, opts: { brackets?: boolean; style?: "intl" | "lakh" } = {}): string {
  const neg = paisa < 0;
  let style: "intl" | "lakh" = "intl";
  try {
    style = opts.style ?? numberStyle().v;
  } catch {}
  const s = FMT[style].format(Math.abs(paisa) / 100);
  if (!neg) return s;
  return opts.brackets ? `(${s})` : `−${s}`;
}

/** "1,500.50" or "1500.5" -> 150050 paisa. Returns NaN for bad input. */
export function toPaisa(input: string): number {
  const clean = String(input).replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean) * 100);
}

export function today(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function monthRange(date = today()): [string, string] {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, "0")}`];
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** "Today", "Yesterday", "5 Nov", or "5 Nov 2025" for other years: easier to scan in lists. */
export function friendlyDate(iso: string, now = today()): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  if (d === now) return "Today";
  const y = new Date(Date.parse(now + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
  if (d === y) return "Yesterday";
  const dt = new Date(d + "T00:00:00Z");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  if (d.slice(0, 4) !== now.slice(0, 4)) opts.year = "numeric";
  return dt.toLocaleDateString("en-GB", opts);
}
