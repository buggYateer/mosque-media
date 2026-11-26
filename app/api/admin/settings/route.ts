import raw from "@/site.config.json";
import { commitFiles, readRepoFile } from "@/lib/admin/github";
import { isAdmin } from "@/lib/admin/session";
import { configProblems } from "@/lib/config";

/**
 * The site's settings (site.config.json) for the dashboard's settings screen.
 * GET → { config }   POST { config, before } → checks it, then commits it (Vercel rebuilds the site).
 * `before` is what the screen loaded: if the file changed since, nothing is overwritten (409).
 */
async function current() {
  const text = process.env.GITHUB_TOKEN ? await readRepoFile("site.config.json") : null;
  return text ? (JSON.parse(text) as unknown) : raw;
}

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "signed-out" }, { status: 401 });
  try {
    return Response.json({ config: await current(), canSave: Boolean(process.env.GITHUB_TOKEN) });
  } catch (e) {
    // GitHub unreachable (or the token is wrong): show the settings the site was built with, read-only
    return Response.json({ config: raw, canSave: false, detail: String(e) });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "signed-out" }, { status: 401 });
  if (!process.env.GITHUB_TOKEN) return Response.json({ error: "not-configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { config?: unknown; before?: unknown } | null;
  if (!body?.config || typeof body.config !== "object") return Response.json({ error: "invalid" }, { status: 400 });
  const problems = configProblems(body.config);
  if (problems.length) return Response.json({ error: "invalid", problems }, { status: 400 });
  try {
    if (JSON.stringify(await current()) !== JSON.stringify(body.before)) return Response.json({ error: "changed" }, { status: 409 });
    await commitFiles([{ path: "site.config.json", content: JSON.stringify(body.config, null, 2) + "\n" }], "Settings");
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "save-failed", detail: String(e) }, { status: 502 });
  }
}
