import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPhoto } from "@/lib/profile";

/** Your own profile photo. Only you can load it. */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const p = await getPhoto(await db(), user.id);
  if (!p) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(p.data), {
    headers: {
      "Content-Type": p.mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // The address changes (?v=…) whenever the photo changes, so it can be kept for long.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
