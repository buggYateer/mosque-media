// Service worker: lets the site open as an app and keeps working on a weak connection.
// Pages: network first, falling back to the last saved copy. Built assets (/_next/static): cache first.
// Audio, downloads, the API and the dashboard are never cached here.
const CACHE = "mosque-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || /\/lawha(\/|$)/.test(u.pathname) || req.headers.has("range")) return;
  if (u.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((r) => {
            if (r.ok) {
              const copy = r.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return r;
          }),
      ),
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok && (req.mode === "navigate" || u.pathname.startsWith("/icons/") || u.pathname === "/data/index.json")) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return r;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/") : undefined)).then((r) => r || Response.error())),
  );
});
