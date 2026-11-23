// Service Worker بسيط: الموقع يفتح كتطبيق، ويشتغل حتى لو النت ضعيف (بيرجع آخر نسخة محفوظة)
// الصوت والتحميل والداشبورد مش بيتحفظوا هنا خالص
const CACHE = "masjed-v1"; // غيّر الرقم لو عايز تجبر كل الأجهزة تنزّل نسخة جديدة
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", "/style.css", "/app.js", "/lessons.json", "/logo-mark.svg", "/site.js", "/theme.css"]))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/lawha")) return;
  // الشبكة الأول (علشان التحديثات تظهر على طول)، ولو مفيش نت نرجع المحفوظ
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(e.request.mode === "navigate" ? "/" : e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request.mode === "navigate" ? "/" : e.request)));
});
