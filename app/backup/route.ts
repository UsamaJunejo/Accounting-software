import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fullSnapshot, getBackup, userSnapshot } from "@/lib/backup";
import { today } from "@/lib/format";

/**
 * /backup              → your own data (any signed-in user)
 * /backup?full=1       → the whole site, right now (admins only)
 * /backup?id=12        → one of the saved daily backups (admins only)
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const p = req.nextUrl.searchParams;
  const d = await db();
  let body: string;
  let name: string;
  if (p.get("id") || p.get("full")) {
    if (!user.is_admin) return new NextResponse("Not allowed", { status: 403 });
    if (p.get("id")) {
      const b = await getBackup(d, Number(p.get("id")));
      if (!b) return new NextResponse("Not found", { status: 404 });
      body = b.data;
      name = `financechachu-site-${b.created_at}.json`;
    } else {
      body = JSON.stringify(await fullSnapshot(d));
      name = `financechachu-site-${today()}.json`;
    }
  } else {
    body = JSON.stringify(await userSnapshot(d, user.id), null, 1);
    name = `financechachu-my-data-${today()}.json`;
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
