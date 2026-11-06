import type { Db } from "./db.ts";

/**
 * Exchange rates, fetched once a day from a free public service and kept in the database, so every
 * page and every entry that day uses the same rate. People can't type their own rate.
 *
 * A rate here is "how much of the main currency (base) for 1 unit of `code`", e.g. base PKR, code USD → 280.
 */

const API = "https://open.er-api.com/v6/latest/";
/** USDT is a digital dollar: it uses the US dollar's rate. */
const apiCode = (c: string) => (c === "USDT" ? "USD" : c);

const memo = new Map<string, Map<string, number>>();

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/** Fetch today's rates for a main currency, save them, and return them. */
async function fetchDay(d: Db, base: string, day: string): Promise<Map<string, number>> {
  const test = process.env.FX_TEST_RATES; // tests: fixed rates instead of the internet, e.g. "USD:280,AED:76.2"
  let perBase: Record<string, number>;
  if (test) {
    // Test rates are PKR per 1 unit; work out the cross rates for whatever the main currency is.
    const pkr: Record<string, number> = { PKR: 1, ...Object.fromEntries(test.split(",").map((p) => p.split(":")).map(([c, r]) => [c.trim(), Number(r)])) };
    const b = pkr[apiCode(base)] ?? pkr[base];
    if (!b) throw new Error("no test rate for " + base);
    perBase = Object.fromEntries(Object.entries(pkr).map(([c, r]) => [c, b / r]));
  } else {
    const res = await fetch(API + apiCode(base), { cache: "no-store" });
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (!j.rates) throw new Error("no rates");
    perBase = j.rates; // units of each currency for 1 base
  }
  const out = new Map<string, number>();
  for (const [c, r] of Object.entries(perBase)) if (r > 0) out.set(c, Number((1 / r).toPrecision(8)));
  if (out.has("USD") && !out.has("USDT")) out.set("USDT", out.get("USD")!);
  // One statement (works inside another transaction too).
  await d.q(
    `INSERT INTO fx_rates (day, base, code, rate)
     SELECT $1::date, $2, c, r FROM unnest($3::text[], $4::float8[]) AS t(c, r)
     ON CONFLICT (day, base, code) DO NOTHING`,
    [day, base, [...out.keys()], [...out.values()]],
  );
  return out;
}

/**
 * Today's rate for each currency (main currency per 1 unit). Taken from the database if already
 * fetched today; otherwise fetched now. If the service can't be reached, the latest saved rate is used.
 */
export async function ratesToday(d: Db, base: string): Promise<Map<string, number>> {
  const day = todayUtc();
  const key = `${base}:${day}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const rows = await d.q<{ code: string; rate: number }>("SELECT code, rate FROM fx_rates WHERE day = $1 AND base = $2", [day, base]);
  let map: Map<string, number>;
  if (rows.length) map = new Map(rows.map((r) => [r.code, r.rate]));
  else {
    try {
      map = await fetchDay(d, base, day);
    } catch {
      // Offline: the most recent rate we have for each currency.
      const last = await d.q<{ code: string; rate: number }>(
        "SELECT DISTINCT ON (code) code, rate FROM fx_rates WHERE base = $1 ORDER BY code, day DESC",
        [base],
      );
      // Don't remember a fallback for the whole day: try the service again next time.
      return new Map(last.map((r) => [r.code, r.rate]));
    }
  }
  if (map.size) memo.set(key, map);
  return map;
}

/** The rate for one currency: main currency per 1 unit (1 when it is the main currency). */
export async function rateFor(d: Db, base: string, code: string): Promise<number> {
  if (code === base || apiCode(code) === apiCode(base)) return 1;
  const r = (await ratesToday(d, base)).get(code);
  if (!r) throw new Error(`Couldn't get today's rate for ${code}. Please check your internet and try again in a minute.`);
  return r;
}

/** For tests and admin fixes: put a rate in for a day. */
export async function setRate(d: Db, base: string, code: string, rate: number, day = todayUtc()) {
  await d.q("INSERT INTO fx_rates (day, base, code, rate) VALUES ($1, $2, $3, $4) ON CONFLICT (day, base, code) DO UPDATE SET rate = $4", [day, base, code, rate]);
  memo.delete(`${base}:${day}`);
}
