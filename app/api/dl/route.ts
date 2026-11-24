import type { NextRequest } from "next/server";
import { getSite } from "@/lib/data";
import { localAudio } from "@/lib/dev-audio";
import { audioStore } from "@/lib/storage";

/**
 * Download with an Arabic file name: /api/dl?id=640 (&p=2 for the second part).
 * The name comes from the site's own data (never from the visitor): «Title - الشيخ Name.mp3».
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const part = req.nextUrl.searchParams.get("p") ?? "";
  if (!/^\d{1,6}$/.test(id) || (part && !/^\d{1,2}$/.test(part))) return new Response("Bad request", { status: 400 });
  const site = await getSite();
  const L = site.lessons[id];
  if (!L || !L.p) return new Response("Not available for download", { status: 404 });
  const p = part ? Number(part) : 1;
  if (p < 1 || p > L.p) return new Response("No such part", { status: 404 });

  const sh = site.sheikhs.find((s) => s.key === L.s)?.name;
  const name = `${L.t}${sh ? ` - الشيخ ${sh}` : ""}${L.p > 1 ? ` (${p})` : ""}`
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  const headers = new Headers({
    "Content-Disposition": `attachment; filename="${id}.mp3"; filename*=UTF-8''${encodeURIComponent(`${name}.mp3`)}`,
    "Cache-Control": "public, max-age=86400",
  });

  if (site.demo || process.env.NODE_ENV === "development") {
    const { body, type } = localAudio(Number(id), p);
    headers.set("Content-Type", type);
    return new Response(body, { headers });
  }
  const r = await fetch(audioStore.audioUrl(Number(id), p, L));
  if (!r.ok || !r.body) return new Response("File not found", { status: 404 });
  headers.set("Content-Type", "audio/mpeg");
  const len = r.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new Response(r.body, { headers });
}
