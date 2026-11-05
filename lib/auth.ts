import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db.ts";

const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return new TextEncoder().encode(s || "dev-only-secret-do-not-use-in-production");
}

/** Log in. The session remembers the user's "session version": bumping it logs out every device. */
export async function startSession(userId: number) {
  const [u] = await (await db()).q<{ session_version: number }>("SELECT session_version FROM users WHERE id = $1", [userId]);
  const token = await new SignJWT({ uid: userId, sv: u?.session_version ?? 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  currency: string;
  is_admin: boolean;
  must_change_password: boolean;
  has_recovery: boolean;
};

// Cached per request so the layout and page share one lookup.
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [u] = await (await db()).q<User & { session_version: number }>(
      `SELECT id, name, email, phone, business_name, currency, is_admin, must_change_password,
              recovery_hash IS NOT NULL AS has_recovery, session_version
       FROM users WHERE id = $1`,
      [Number(payload.uid)],
    );
    if (!u || u.session_version !== Number(payload.sv ?? 1)) return null;
    return u;
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.is_admin) redirect("/dashboard");
  return u;
}
