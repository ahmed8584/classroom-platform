/* ============================================================
   Service Worker — عمل بدون إنترنت (PWA)
   ============================================================ */

const CACHE_NAME = 'interactive-lesson-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './js/utils.js',
  './js/api.js',
  './js/auth.js',
  './js/roster.js',
  './js/tools.js',
  './js/games.js',
  './js/studio.js',
  './js/bank.js',
  './js/live.js',
  './js/ai-media.js',
  './js/ai-ocr.js',
  './js/ai.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('Cache install failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('script.google.com')) return;
  if (event.request.url.includes('cdn.jsdelivr')) return;
  if (event.request.url.includes('cdnjs.cloudflare')) return;
  if (event.request.url.includes('cdn.sheetjs')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});