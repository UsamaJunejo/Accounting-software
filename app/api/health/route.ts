import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailySnapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Used to check the site is alive. It also runs a tiny database query, which keeps
// the free Supabase database from pausing (see vercel.json and .github/workflows),
// and saves the daily in-app backup.
export async function GET() {
  try {
    const d = await db();
    await d.q("SELECT 1");
    // The daily ping also takes the daily backup (at most once every 20 hours).
    const backedUp = await dailySnapshot(d).catch(() => false);
    return NextResponse.json({ ok: true, backedUp, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
