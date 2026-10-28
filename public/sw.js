// Minimal service worker: makes the app installable and keeps the shell
// available on flaky in-store Wi-Fi. API calls are NEVER cached: every
// sync/voucher decision must come fresh from the server.
const CACHE = "twinsync-v1";
const SHELL = ["/", "/manifest.webmanifest", "/pwa-icon/192"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Static build assets: cache-first (they're content-hashed).
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) => hit || fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // Pages: network-first, fall back to cached shell when offline.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
  }
});
