const CACHE_VERSION = "mm-static-v1";
const PRECACHE_ASSETS = [
  "./",
  "index.html",
  "index.css",
  "index.js",
  "data/progression.json",
  "data/questions.json",
  "images/brand/logo.png",
  "images/additional/gem.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isCacheFirstAsset = (request) => {
  if (request.method !== "GET") return false;
  if (request.destination) {
    return ["style", "script", "image", "font"].includes(request.destination);
  }
  const url = new URL(request.url);
  return [".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".svg", ".webp"].some(
    (ext) => url.pathname.endsWith(ext)
  );
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match("index.html")
        .then((cached) => cached || fetch(request))
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  if (!isCacheFirstAsset(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request))
    )
  );
});
