import type { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { getSite } from "@/lib/data";

/**
 * Latest channel posts after a message number, for the dashboard: GET /api/channel?from=640
 * Reads the public pages t.me/<channel>/<id>?embed=1 and returns the ones that exist with their date.
 */
async function probe(id: number) {
  try {
    const r = await fetch(`https://t.me/${config.telegramChannel}/${id}?embed=1&mode=tme`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const h = await r.text();
    if (h.includes("tgme_widget_message_error")) return null;
    const d = /<time datetime="([^"]+)"/.exec(h);
    return d ? { id, date: d[1] } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const from = Math.max(0, parseInt(req.nextUrl.searchParams.get("from") ?? "0", 10) || 0);
  // No channel set, or demo data (a placeholder channel name: never probe a real stranger's channel).
  if (!config.telegramChannel || (await getSite()).demo) return Response.json({ from, last: from, found: [] });
  const found: { id: number; date: string }[] = [];
  let id = from + 1,
    misses = 0,
    scanned = 0;
  while (misses < 12 && scanned < 120) {
    const batch = Array.from({ length: 6 }, (_, k) => id + k);
    for (const r of await Promise.all(batch.map(probe))) {
      if (r) {
        found.push(r);
        misses = 0;
      } else misses++;
    }
    id += batch.length;
    scanned += batch.length;
  }
  return Response.json({ from, last: found.at(-1)?.id ?? from, found }, { headers: { "Cache-Control": "s-maxage=300" } });
}
