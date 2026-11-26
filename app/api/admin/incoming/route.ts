import { listRepoDir } from "@/lib/admin/github";
import { isAdmin } from "@/lib/admin/session";

/**
 * Files published from the dashboard that the GitHub Action hasn't moved yet (still converting / uploading):
 * GET → { pending: [{ id, kind }] }. Once a file is gone from incoming/, it is on the site.
 */
export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "signed-out" }, { status: 401 });
  if (!process.env.GITHUB_TOKEN) return Response.json({ pending: [] });
  try {
    const names = await listRepoDir("incoming");
    const pending = names
      .map((n) => /^(\d{1,7})(?:_\d{1,2})?(\.video)?\.(json|mp3)$/.exec(n))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => ({ id: Number(m[1]), kind: m[2] ? "video" : "audio" }));
    return Response.json({ pending });
  } catch (e) {
    return Response.json({ pending: [], error: String(e) });
  }
}
