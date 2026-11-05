import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProof } from "@/lib/billing";

// The payment screenshot: visible to the person who sent it and to admins.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const p = await getProof(await db(), user.id, user.is_admin, Number((await params).id));
  if (!p) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(p.proof!), {
    headers: {
      "Content-Type": p.proof_mime!,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=600",
    },
  });
}
