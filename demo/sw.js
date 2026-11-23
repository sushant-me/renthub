/* Rent Hub demo service worker: installable, works offline after the first visit.
   Network-first so an online visitor always gets the current demo, not a stale cache. */
const CACHE = "renthub-demo-v4";
const CORE = [
  "./",
  "./index.html",
  "./demo.css?v=20261123b",
  "./demo.js?v=20261123b",
  "./manifest.webmanifest",
  "../assets/brand/icon-192.png",
  "../assets/brand/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      try {
        const data = await (await fetch("./data.json", { cache: "reload" })).json();
        await cache.put("./data.json", new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } }));
        const firsts = [...new Set(data.listings.map((l) => l.photos && l.photos[0]).filter(Boolean))];
        await Promise.allSettled(firsts.map((src) => cache.add(src)));
      } catch (error) {
        /* offline install is best effort */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request, { cache: "reload" });
          const cache = await caches.open(CACHE);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch {
          return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
        }
      })()
    );
    return;
  }

  // Network-first for data, scripts and styles. This prevents the demo getting
  // stuck on an older heading or an older screen after a deployment.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request, { cache: "no-cache" });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })()
  );
});
