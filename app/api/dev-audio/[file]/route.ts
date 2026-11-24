import { getSite } from "@/lib/data";
import { localAudio } from "@/lib/dev-audio";

/** Local preview / demo audio: /api/dev-audio/640.mp3 or /api/dev-audio/640_2.mp3 (supports Range for seeking). */
export async function GET(req: Request, { params }: RouteContext<"/api/dev-audio/[file]">) {
  const site = await getSite();
  if (process.env.NODE_ENV !== "development" && !site.demo) return new Response("Not found", { status: 404 });
  const m = /^(\d{1,6})(?:_(\d{1,2}))?\.mp3$/.exec((await params).file);
  if (!m) return new Response("Bad request", { status: 400 });
  const { body, type } = localAudio(Number(m[1]), Number(m[2] ?? 1));
  const size = body.length;
  const r = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  if (r && r[1]) {
    const start = Number(r[1]),
      end = r[2] ? Number(r[2]) : size - 1;
    return new Response(body.slice(start, end + 1), {
      status: 206,
      headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(body, { headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(size) } });
}
