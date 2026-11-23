// آخر رسايل القناة: GET /api/channel?from=640
// بيلف على صفحات الرسايل العامة (t.me/<القناة>/ID?embed=1) بعد الرقم ده، ويرجّع الموجود منها بتاريخه.
// (تقييد المحتوى في القناة مش بيوضّح نوع الرسالة — الداشبورد بتسيب الاختيار لصاحب القناة)
import { CHANNEL as CH } from "./_site.js";
export const config = { runtime: "edge" };

async function probe(id) {
  try {
    const r = await fetch(`https://t.me/${CH}/${id}?embed=1&mode=tme`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const h = await r.text();
    if (h.includes("tgme_widget_message_error")) return null;
    const d = /<time datetime="([^"]+)"/.exec(h);
    return d ? { id, date: d[1] } : null;
  } catch { return null; }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const from = Math.max(0, parseInt(url.searchParams.get("from") || "0", 10) || 0);
  const found = [];
  let id = from + 1, misses = 0, scanned = 0;
  while (misses < 12 && scanned < 120) {
    const batch = Array.from({ length: 6 }, (_, k) => id + k);
    const res = await Promise.all(batch.map(probe));
    for (const r of res) { if (r) { found.push(r); misses = 0; } else misses++; }
    id += batch.length; scanned += batch.length;
  }
  return new Response(JSON.stringify({ from, last: found.length ? found[found.length - 1].id : from, found }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "s-maxage=300" },
  });
}
