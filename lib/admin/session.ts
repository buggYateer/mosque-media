/**
 * Dashboard sign-in: the password (ADMIN_PASSWORD on Vercel) opens a signed, HttpOnly session cookie.
 * The GitHub token (GITHUB_TOKEN) never leaves the server — the dashboard calls our own API instead.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "mm_admin";
const TTL_HOURS = 12;

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.GITHUB_TOKEN);
}

function secret() {
  // Derived from both secrets: changing the password (or the token) signs everyone out.
  return createHash("sha256").update(`${process.env.ADMIN_PASSWORD}\u0000${process.env.GITHUB_TOKEN}`).digest();
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function passwordMatches(input: unknown) {
  const pass = process.env.ADMIN_PASSWORD ?? "";
  if (typeof input !== "string" || !pass) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(pass).digest();
  return timingSafeEqual(a, b);
}

export function newSessionValue() {
  const payload = String(Date.now() + TTL_HOURS * 3600_000);
  return `${payload}.${sign(payload)}`;
}

export function sessionValid(value: string | undefined) {
  if (!value || !adminConfigured()) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return false;
  return Number(payload) > Date.now();
}

export async function isAdmin() {
  return sessionValid((await cookies()).get(COOKIE)?.value);
}

export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: TTL_HOURS * 3600 };
