/* =========================================================
   service-worker.js（完全修正版）
========================================================= */

const CACHE_NAME = "shukka-app-v11";     // ← 必ず新しい名前にする
const BASE = "/my-first-repo";

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/style.css`,
  `${BASE}/js/app.js?v=202501`,
  `${BASE}/js/analysis.js?v=202501`,
  `${BASE}/js/shipment.js`,
  `${BASE}/js/history.js`,
  `${BASE}/js/sales.js`,
  `${BASE}/js/summary.js`,
  `${BASE}/analysis_view.html`,
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`
];

/* ===== install ===== */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* ===== activate ===== */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
      )
    )
  );
  self.clients.claim();
});

/* ===== fetch（オンライン優先） ===== */
self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

