import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin/session";
import { parseVideo } from "@/lib/media";

/**
 * The title of a YouTube video, to fill the title for the admin: GET /api/admin/oembed?url=…
 * (YouTube's public oEmbed; asked from the server so the dashboard needs no outside requests.)
 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return Response.json({ error: "signed-out" }, { status: 401 });
  const v = parseVideo(req.nextUrl.searchParams.get("url") ?? "");
  if (!v || v.source !== "youtube") return Response.json({});
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(v.url)}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return Response.json({});
    const j = (await r.json()) as { title?: string; author_name?: string };
    return Response.json({ title: j.title ?? "", author: j.author_name ?? "" });
  } catch {
    return Response.json({});
  }
}
