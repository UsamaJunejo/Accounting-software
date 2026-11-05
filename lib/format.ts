/** Paisa -> "123,456.00", negatives in brackets like accountants write them. */
export function money(paisa: number, opts: { brackets?: boolean } = {}): string {
  const neg = paisa < 0;
  const s = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(paisa) / 100,
  );
  if (!neg) return s;
  return opts.brackets === false ? `-${s}` : `(${s})`;
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
