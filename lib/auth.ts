import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db.ts";
import { planOf, type Plan } from "./billing.ts";
import { numberStyle, today } from "./format.ts";

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
  level: 1 | 2 | 3;
  address: string | null;
  ntn: string | null;
  nok_name: string | null;
  nok_relation: string | null;
  nok_phone: string | null;
  nok_email: string | null;
  trial_end: string | null;
  paid_until: string | null;
  plan: Plan;
  num_format: "intl" | "lakh";
  /** Changes whenever the profile photo changes (null = no photo), so browsers fetch the new one. */
  photo_v: string | null;
};

// Cached per request so the layout and page share one lookup.
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [u] = await (await db()).q<Omit<User, "plan"> & { session_version: number }>(
      `SELECT id, name, email, phone, business_name, currency, is_admin, must_change_password,
              recovery_hash IS NOT NULL AS has_recovery, session_version, level, address, ntn,
              nok_name, nok_relation, nok_phone, nok_email,
              to_char(trial_ends_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD') AS trial_end,
              to_char(paid_until, 'YYYY-MM-DD') AS paid_until, num_format,
              CASE WHEN photo IS NULL THEN NULL ELSE extract(epoch FROM photo_at)::bigint::text END AS photo_v
       FROM users WHERE id = $1`,
      [Number(payload.uid)],
    );
    if (!u || u.session_version !== Number(payload.sv ?? 1)) return null;
    numberStyle().v = u.num_format;
    return { ...u, plan: planOf(u, today()) };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

/** For anything that adds or changes entries: the plan must be active (trial, paid, or admin). */
export async function requireWriter(): Promise<User> {
  const u = await requireUser();
  if (u.plan.state === "expired") redirect("/billing?expired=1");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.is_admin) redirect("/dashboard");
  return u;
}
