import { NextResponse, type NextRequest } from "next/server";
import { CURRENCY_CODES, rateCode } from "@/lib/currencies";
import { currentUser } from "@/lib/auth";

// Today's market rate: how many `to` for 1 `from` (default `to` = your main currency).
// Uses a free public rates service, cached for 6 hours. You can always type your own rate.
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const from = (q.get("from") || q.get("c") || "").toUpperCase();
  const to = (q.get("to") || user.currency).toUpperCase();
  if (!CURRENCY_CODES.has(from) || !CURRENCY_CODES.has(to) || from === to)
    return NextResponse.json({ error: "Unknown currency" }, { status: 400 });
  // USDT follows the US dollar, so USDT↔USD is 1 and other pairs use the dollar's rate.
  if (rateCode(from) === rateCode(to)) return NextResponse.json({ from, to, rate: 1 });
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${rateCode(from)}`, { next: { revalidate: 21600 } });
    const j = (await r.json()) as { rates?: Record<string, number> };
    const rate = j.rates?.[rateCode(to)];
    if (!rate) throw new Error("no rate");
    return NextResponse.json({ from, to, rate: Number(rate.toPrecision(6)) });
  } catch {
    return NextResponse.json({ error: "Rate service not available. Please type the rate." }, { status: 503 });
  }
}
