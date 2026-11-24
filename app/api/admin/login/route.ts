import { cookies } from "next/headers";
import { adminConfigured, COOKIE, cookieOptions, newSessionValue, passwordMatches } from "@/lib/admin/session";

/** POST {password} → sets the session cookie. */
export async function POST(req: Request) {
  if (!adminConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (!passwordMatches(body.password)) {
    await new Promise((r) => setTimeout(r, 1200)); // slows down guessing
    return Response.json({ error: "wrong-password" }, { status: 401 });
  }
  (await cookies()).set(COOKIE, newSessionValue(), cookieOptions);
  return Response.json({ ok: true });
}
