/* =========================================================
   service-worker.js（GitHub Pages用・完全動作品）
========================================================= */

const CACHE_NAME = "shukka-app-v2";

const BASE = "/my-first-repo";

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/style.css`,
  `${BASE}/js/app.js`,
  `${BASE}/js/shipment.js`,
  `${BASE}/js/history.js`,
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`
];

/* ===== インストール（初回） ===== */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
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
self.addEventListener("f
