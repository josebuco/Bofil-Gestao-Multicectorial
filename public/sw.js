// Bofil — guarda o aplicativo no aparelho para abrir sem internet.
const CACHE = "bofil-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // Fontes do Google: guardar também.
    if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
      event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; })));
    }
    return;
  }
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const c = res.clone();
          caches.open(CACHE).then((x) => { x.put(req, c.clone()); x.put("/__shell", c); });
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/__shell")) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
          return res;
        }),
    ),
  );
});
