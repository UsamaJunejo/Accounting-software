import { NextResponse, type NextRequest } from "next/server";
import { CURRENCY_CODES } from "@/lib/currencies";
import { currentUser } from "@/lib/auth";

// Today's market rate: how many PKR for 1 unit of the currency.
// Uses a free public rates service; cached for 6 hours. Users can always type their own rate.
export async function GET(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const c = (req.nextUrl.searchParams.get("c") || "").toUpperCase();
  if (!CURRENCY_CODES.has(c) || c === "PKR") return NextResponse.json({ error: "Unknown currency" }, { status: 400 });
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/PKR", { next: { revalidate: 21600 } });
    const j = (await r.json()) as { rates?: Record<string, number> };
    const perPkr = j.rates?.[c];
    if (!perPkr) throw new Error("no rate");
    return NextResponse.json({ currency: c, rate: Math.round((1 / perPkr) * 10000) / 10000 });
  } catch {
    return NextResponse.json({ error: "Rate service not available. Please type the rate." }, { status: 503 });
  }
}
