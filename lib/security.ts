import { randomInt } from "node:crypto";
import type { Db } from "./db.ts";

// Letters and digits that can't be confused when read aloud or written down (no 0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChars(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** e.g. FC-7KQ2-M9XA-P3RT */
export function newRecoveryCode() {
  return `FC-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`;
}

/** Accept the code typed in any case, with or without dashes/spaces. */
export function normalizeRecoveryCode(input: string) {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^FC/, "");
  return c.length === 12 ? `FC-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}` : "";
}

/** e.g. Temp-48Kq-x7Pd (shown once by an admin) */
export function newTempPassword() {
  return `Temp-${randomChars(4)}-${randomChars(4)}`;
}

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 8;

/** True if this key (e.g. "login:ali@x.pk") failed too often recently. */
export async function isLimited(d: Db, key: string) {
  const [{ n }] = await d.q<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM auth_attempts WHERE key = $1 AND created_at > now() - interval '${WINDOW_MINUTES} minutes'`,
    [key],
  );
  return n >= MAX_FAILURES;
}

export async function recordFailure(d: Db, key: string) {
  await d.q("INSERT INTO auth_attempts (key) VALUES ($1)", [key]);
  // Housekeeping: forget old attempts.
  await d.q("DELETE FROM auth_attempts WHERE created_at < now() - interval '1 day'");
}

export async function clearFailures(d: Db, key: string) {
  await d.q("DELETE FROM auth_attempts WHERE key = $1", [key]);
}

export const LIMIT_MESSAGE = `Too many wrong tries. Please wait ${WINDOW_MINUTES} minutes and try again.`;
