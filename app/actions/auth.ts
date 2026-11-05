"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createUser } from "@/lib/books";
import { endSession, requireUser, startSession } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (path: string, msg: string): never => redirect(`${path}?error=${encodeURIComponent(msg)}`);

export async function signup(form: FormData) {
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const phone = str(form, "phone");
  const businessName = str(form, "business");
  const password = str(form, "password");
  if (!name || !email || !password) fail("/signup", "Please fill in name, email and password.");
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("/signup", "Please enter a valid email.");
  if (password.length < 8) fail("/signup", "Password must be at least 8 characters.");
  const d = await db();
  if ((await d.q("SELECT 1 FROM users WHERE email = $1", [email])).length)
    fail("/signup", "An account with this email already exists.");
  let id = 0;
  try {
    id = await createUser(d, { name, email, phone, businessName, passwordHash: await bcrypt.hash(password, 10) });
  } catch {
    fail("/signup", "Could not create the account. Please try again.");
  }
  await startSession(id);
  redirect("/dashboard?welcome=1");
}

export async function login(form: FormData) {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const [u] = await (await db()).q<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email],
  );
  if (!u || !(await bcrypt.compare(password, u.password_hash))) fail("/login", "Wrong email or password.");
  await startSession(u!.id);
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function updateProfile(form: FormData) {
  const u = await requireUser();
  const name = str(form, "name");
  if (!name) fail("/settings", "Name is required.");
  await (await db()).q("UPDATE users SET name = $1, phone = $2, business_name = $3 WHERE id = $4", [
    name,
    str(form, "phone") || null,
    str(form, "business") || null,
    u.id,
  ]);
  redirect("/settings?ok=Profile saved");
}

export async function changePassword(form: FormData) {
  const u = await requireUser();
  const d = await db();
  const [row] = await d.q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id]);
  if (!(await bcrypt.compare(str(form, "current"), row.password_hash))) fail("/settings", "Current password is wrong.");
  const next = str(form, "next");
  if (next.length < 8) fail("/settings", "New password must be at least 8 characters.");
  await d.q("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(next, 10), u.id]);
  redirect("/settings?ok=Password changed");
}
