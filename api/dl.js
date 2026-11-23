// تحميل مقطع باسم الدرس بالعربي: /api/dl?id=640  (و &p=2 للجزء التاني في الألبومات)
// بيجيب الملف من GitHub Releases ويبعته للزائر باسم «العنوان - الشيخ.mp3»
import { AUDIO_BASE } from "./_site.js";
export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const part = url.searchParams.get("p") || "";
  if (!/^\d{1,6}$/.test(id) || (part && !/^\d{1,2}$/.test(part))) return new Response("طلب غير صحيح", { status: 400 });

  // الاسم من بيانات الموقع نفسه (مش من الزائر)
  const db = await fetch(new URL("/lessons.json", url)).then(r => r.json()).catch(() => null);
  const ov = await fetch(new URL("/overrides.json", url)).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  const e = (ov.edit || {})[id] || {}, a = (ov.add || {})[id];
  const base = (db && db.lessons[id]) || a;
  const L = base && !e.hidden ? { ...base, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v !== "" && v !== undefined)) } : null;
  if (!L || !L.p) return new Response("المقطع غير متاح للتحميل", { status: 404 });
  const p = part ? +part : 1;
  if (p < 1 || p > L.p) return new Response("الجزء غير موجود", { status: 404 });
  const sh = ((db && db.sheikhs.find(s => s.key === L.s)) || {}).name;
  let name = L.t + (sh ? ` - الشيخ ${sh}` : "") + (L.p > 1 ? ` (${p})` : "");
  name = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);

  const file = L.p > 1 ? `${id}_${p}.mp3` : `${id}.mp3`;
  const src = `${AUDIO_BASE}/audio-${Math.floor(+id / 500)}/${file}`;
  const r = await fetch(src);
  if (!r.ok || !r.body) return new Response("الملف غير موجود", { status: 404 });

  const h = new Headers({
    "Content-Type": "audio/mpeg",
    "Content-Disposition": `attachment; filename="${id}.mp3"; filename*=UTF-8''${encodeURIComponent(name + ".mp3")}`,
    "Cache-Control": "public, max-age=86400",
  });
  const len = r.headers.get("content-length");
  if (len) h.set("Content-Length", len);
  return new Response(r.body, { headers: h });
}
