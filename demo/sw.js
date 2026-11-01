/* Rent Hub demo service worker: installable, works offline after the first visit. */
const CACHE = "renthub-demo-v1";
const CORE = [
  "./",
  "./index.html",
  "./demo.css",
  "./demo.js",
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
        // Keep the first photo of every listing so the deck and feed render offline.
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
          const fresh = await fetch(request);
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

  if (url.pathname.endsWith("/data.json")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(request)) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    })()
  );
});
