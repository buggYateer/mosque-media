import { config } from "@/lib/config";

/**
 * Audio for iPhone / Safari: /api/audio/640.mp3 (or 640_2.mp3).
 * GitHub Releases serve files as application/octet-stream, which Safari refuses to play,
 * so this passes the file through (Range included, for seeking) labelled as audio/mpeg.
 * Other browsers keep playing straight from GitHub.
 */
export async function GET(req: Request, { params }: RouteContext<"/api/audio/[file]">) {
  const file = (await params).file;
  const m = /^(\d{1,6})(?:_\d{1,2})?\.mp3$/.exec(file);
  if (!m || config.audioBase.startsWith("/")) return new Response("Bad request", { status: 400 });
  const range = req.headers.get("range");
  const r = await fetch(`${config.audioBase}/audio-${Math.floor(Number(m[1]) / 500)}/${file}`, { headers: range ? { Range: range } : {} });
  if (!r.ok || !r.body) return new Response("File not found", { status: 404 });
  const headers = new Headers({ "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=604800" });
  for (const h of ["content-length", "content-range"]) {
    const v = r.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Small ranges (Safari's first probe is bytes=0-1) go back whole, so the length header survives
  const want = /bytes=(\d+)-(\d+)/.exec(range ?? "");
  if (want && Number(want[2]) - Number(want[1]) < 4_000_000) {
    const buf = await r.arrayBuffer();
    headers.set("Content-Length", String(buf.byteLength));
    return new Response(buf, { status: r.status, headers });
  }
  return new Response(r.body, { status: r.status, headers });
}
