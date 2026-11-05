import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Used to check the site is alive. It also runs a tiny database query, which keeps
// the free Supabase database from pausing (see vercel.json and .github/workflows).
export async function GET() {
  try {
    await (await db()).q("SELECT 1");
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
