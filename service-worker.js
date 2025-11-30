/* =========================================================
   service-worker.js（GitHub Pages用・sales.js対応 完全版）
========================================================= */

const CACHE_NAME = "shukka-app-v5";
const BASE = "/my-first-repo";

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/style.css`,
  `${BASE}/js/app.js?v=202501`,
  `${BASE}/js/analysis.js?v=202501`,   // ←★絶対必要
  `${BASE}/js/shipment.js`,
  `${BASE}/js/history.js`,
  `${BASE}/js/sales.js`,
  `${BASE}/js/summary.js`,            // ←★これも追加
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`
];

/* ===== インストール ===== */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* ===== アクティベート ===== */
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

/* ===== fetch ===== */
self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

/* ===== fetch（オンライン優先 + オフライン fallback） ===== */
self.addEventListener("f




