import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Used by the hosting service to check the site is alive.
export function GET() {
  db().prepare("SELECT 1").get();
  return NextResponse.json({ ok: true });
}
