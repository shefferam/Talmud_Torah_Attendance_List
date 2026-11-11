const CACHE = "tt-attendance-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Stale-while-revalidate: serve from cache instantly, refresh in the background
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then(response => {
          if (response.ok || response.type === "opaque") cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
