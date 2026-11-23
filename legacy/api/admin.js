// دخول الداشبورد: POST /api/admin  {password}
// لو الباسورد صح (متغير ADMIN_PASSWORD في Vercel) بيرجع مفتاح GitHub (GITHUB_TOKEN) علشان الداشبورد تحفظ التعديلات.
// المفتاح لازم يكون Fine-grained ومحصور على مستودع الموقع بس (Contents: Read and write).
import { REPO } from "./_site.js";
export const config = { runtime: "edge" };

function same(a, b) {
  // مقارنة ثابتة الوقت
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export default async function handler(req) {
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (req.method !== "POST") return json({ error: "POST فقط" }, 405);
  const pass = process.env.ADMIN_PASSWORD, token = process.env.GITHUB_TOKEN;
  if (!pass || !token) return json({ error: "الداشبورد لسه متظبطتش: لازم ADMIN_PASSWORD و GITHUB_TOKEN في إعدادات Vercel" }, 503);
  let body = {};
  try { body = await req.json(); } catch {}
  if (!same(body.password || "", pass)) {
    await new Promise(r => setTimeout(r, 1200)); // يبطّأ أي محاولات تخمين
    return json({ error: "الباسورد غلط" }, 401);
  }
  return json({ token, repo: REPO });
}
