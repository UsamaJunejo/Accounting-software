import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAttachment } from "@/lib/books";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const a = await getAttachment(await db(), user.id, Number((await params).id));
  if (!a) return new NextResponse("Not found", { status: 404 });
  const download = req.nextUrl.searchParams.has("download");
  return new NextResponse(Buffer.from(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${a.filename.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
