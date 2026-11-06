import { NextResponse, type NextRequest } from "next/server";
import { CURRENCY_CODES } from "@/lib/currencies";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateFor } from "@/lib/fx";

// Today's rate: how many `to` for 1 `from` (default `to` = your main currency). It is the same rate the
// app uses when saving (fetched once a day and kept), so what you see is what gets recorded.
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const from = (q.get("from") || q.get("c") || "").toUpperCase();
  const to = (q.get("to") || user.currency).toUpperCase();
  if (!CURRENCY_CODES.has(from) || !CURRENCY_CODES.has(to) || from === to)
    return NextResponse.json({ error: "Unknown currency" }, { status: 400 });
  try {
    return NextResponse.json({ from, to, rate: await rateFor(await db(), to, from) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
