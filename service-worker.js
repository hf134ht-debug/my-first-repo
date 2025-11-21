/* =========================================================
   service-worker.js
   - PWA キャッシュ制御
========================================================= */

const CACHE_NAME = "shukka-app-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/shipment.js",
  "./js/history.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* ===== インストール（初回） ===== */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

/* ===== アクティベート（古いキャッシュ削除） ===== */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

/* ===== fetch（オンライン優先 + オフライン fallback） ===== */
self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
