"use server";

import bcrypt from "bcryptjs";
import { go as redirect } from "@/lib/go";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { changeMainCurrency, createUser } from "@/lib/books";
import { setTrialForNewUser } from "@/lib/billing";
import { CURRENCY_CODES } from "@/lib/currencies";
import { rateFor } from "@/lib/fx";
import { endSession, requireAdmin, requireUser, startSession } from "@/lib/auth";
import {
  clearFailures,
  isLimited,
  LIMIT_MESSAGE,
  newRecoveryCode,
  newTempPassword,
  normalizeRecoveryCode,
  recordFailure,
} from "@/lib/security";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}n=${Date.now()}&error=${encodeURIComponent(msg)}`);
const MIN_PASSWORD = 8;

export async function signup(form: FormData) {
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const phone = str(form, "phone");
  const businessName = str(form, "business");
  const password = str(form, "password");
  if (!name || !email || !password) fail("/signup", "Please fill in name, email and password.");
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("/signup", "Please enter a valid email.");
  if (password.length < MIN_PASSWORD) fail("/signup", "Password must be at least 8 characters.");
  const d = await db();
  if ((await d.q("SELECT 1 FROM users WHERE email = $1", [email])).length)
    fail("/signup", "An account with this email already exists.");
  let id = 0;
  try {
    id = await createUser(d, { name, email, phone, businessName, passwordHash: await bcrypt.hash(password, 10) });
    await setTrialForNewUser(d, id);
  } catch {
    fail("/signup", "Could not create the account. Please try again.");
  }
  await startSession(id);
  redirect("/recovery-code?new=1");
}

export async function login(form: FormData) {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const d = await db();
  const key = `login:${email}`;
  if (await isLimited(d, key)) fail("/login", LIMIT_MESSAGE);
  const [u] = await d.q<{ id: number; password_hash: string; must_change_password: boolean }>(
    "SELECT id, password_hash, must_change_password FROM users WHERE email = $1",
    [email],
  );
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    await recordFailure(d, key);
    fail("/login", "Wrong email or password.");
  }
  await clearFailures(d, key);
  await startSession(u!.id);
  redirect(u!.must_change_password ? "/settings?must=1" : "/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function updateProfile(form: FormData) {
  const u = await requireUser();
  const name = str(form, "name");
  if (!name) fail("/settings", "Name is required.");
  await (await db()).q(
    "UPDATE users SET name = $1, phone = $2, business_name = $3, address = $4, ntn = $5 WHERE id = $6",
    [name, str(form, "phone") || null, str(form, "business") || null, str(form, "address") || null, str(form, "ntn") || null, u.id],
  );
  revalidatePath("/", "layout");
  redirect(`/settings?n=${Date.now()}&ok=Profile saved`);
}

export async function updateCurrency(form: FormData) {
  const u = await requireUser();
  const next = str(form, "currency");
  if (!CURRENCY_CODES.has(next)) fail("/settings", "Choose a currency from the list.");
  const convert = form.get("convert") === "on";
  try {
    // Today's rate from the rates service (1 old main currency = how many of the new one).
    const rate = convert ? await rateFor(await db(), next, u.currency) : null;
    await changeMainCurrency(await db(), u.id, next, rate);
  } catch (e) {
    fail("/settings", (e as Error).message);
  }
  revalidatePath("/", "layout");
  redirect(`/settings?n=${Date.now()}&ok=${encodeURIComponent(convert ? `Main currency is now ${next}. All records were converted.` : `Main currency is now ${next}.`)}`);
}

export async function updateNextOfKin(form: FormData) {
  const u = await requireUser();
  await (await db()).q(
    "UPDATE users SET nok_name = $1, nok_relation = $2, nok_phone = $3, nok_email = $4 WHERE id = $5",
    [str(form, "nok_name") || null, str(form, "nok_relation") || null, str(form, "nok_phone") || null, str(form, "nok_email") || null, u.id],
  );
  redirect(`/settings?n=${Date.now()}&ok=Next of kin saved`);
}

export async function updateNumberStyle(form: FormData) {
  const u = await requireUser();
  const v = form.get("num_format") === "lakh" ? "lakh" : "intl";
  await (await db()).q("UPDATE users SET num_format = $1 WHERE id = $2", [v, u.id]);
  revalidatePath("/", "layout");
  redirect(`/settings?n=${Date.now()}&ok=Number style saved`);
}

export async function updateLevel(form: FormData) {
  const u = await requireUser();
  const level = Number(form.get("level"));
  if (![1, 2, 3].includes(level)) fail("/settings", "Choose a level");
  await (await db()).q("UPDATE users SET level = $1 WHERE id = $2", [level, u.id]);
  revalidatePath("/", "layout");
  redirect(`/settings?n=${Date.now()}&ok=View updated`);
}

/** Changing the password also logs out every other device. */
export async function changePassword(form: FormData) {
  const u = await requireUser();
  const d = await db();
  const [row] = await d.q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id]);
  if (!(await bcrypt.compare(str(form, "current"), row.password_hash))) fail("/settings", "Current password is wrong.");
  const next = str(form, "next");
  if (next.length < MIN_PASSWORD) fail("/settings", "New password must be at least 8 characters.");
  await d.q(
    `UPDATE users SET password_hash = $1, must_change_password = false, session_version = session_version + 1
     WHERE id = $2`,
    [await bcrypt.hash(next, 10), u.id],
  );
  await startSession(u.id);
  redirect(`/settings?n=${Date.now()}&ok=Password changed. Other devices have been signed out.`);
}

// ---------- Recovery code ----------

export type CodeState = { code?: string; error?: string };

/** Make a new recovery code (the old one stops working) and show it once. */
export async function createRecoveryCode(_prev?: CodeState): Promise<CodeState> {
  const u = await requireUser();
  const code = newRecoveryCode();
  await (await db()).q("UPDATE users SET recovery_hash = $1 WHERE id = $2", [await bcrypt.hash(code, 10), u.id]);
  revalidatePath("/", "layout");
  return { code };
}

/** Forgot password: email + recovery code + new password. Shows a fresh code afterwards. */
export async function resetWithCode(_prev: CodeState, form: FormData): Promise<CodeState> {
  const email = str(form, "email").toLowerCase();
  const code = normalizeRecoveryCode(str(form, "code"));
  const next = str(form, "password");
  if (next.length < MIN_PASSWORD) return { error: "New password must be at least 8 characters." };
  const d = await db();
  const key = `recover:${email}`;
  if (await isLimited(d, key)) return { error: LIMIT_MESSAGE };
  const [u] = await d.q<{ id: number; recovery_hash: string | null }>(
    "SELECT id, recovery_hash FROM users WHERE email = $1",
    [email],
  );
  if (!u || !u.recovery_hash || !code || !(await bcrypt.compare(code, u.recovery_hash))) {
    await recordFailure(d, key);
    return { error: "Email or recovery code is wrong. If you lost your code, contact support on WhatsApp." };
  }
  const fresh = newRecoveryCode();
  await d.q(
    `UPDATE users SET password_hash = $1, recovery_hash = $2, must_change_password = false,
            session_version = session_version + 1 WHERE id = $3`,
    [await bcrypt.hash(next, 10), await bcrypt.hash(fresh, 10), u.id],
  );
  await clearFailures(d, key);
  await clearFailures(d, `login:${email}`);
  await startSession(u.id);
  revalidatePath("/", "layout");
  return { code: fresh };
}

// ---------- Admin ----------

export type AdminState = { temp?: string; email?: string; error?: string };

/** Admin gives a user a temporary password; they must change it after logging in. */
export async function adminResetPassword(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  const d = await db();
  const [u] = await d.q<{ email: string }>("SELECT email FROM users WHERE id = $1", [id]);
  if (!u) return { error: "User not found" };
  if (id === admin.id) return { error: "Use Settings to change your own password." };
  const temp = newTempPassword();
  await d.q(
    `UPDATE users SET password_hash = $1, must_change_password = true, session_version = session_version + 1
     WHERE id = $2`,
    [await bcrypt.hash(temp, 10), id],
  );
  await clearFailures(d, `login:${u.email}`);
  revalidatePath("/admin");
  return { temp, email: u.email };
}

export async function adminSetAdmin(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (id === admin.id) fail("/admin", "You can't remove your own admin access.");
  await (await db()).q("UPDATE users SET is_admin = $1 WHERE id = $2", [form.get("make") === "1", id]);
  redirect(`/admin?n=${Date.now()}&ok=Saved`);
}
