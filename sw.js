// Offline cache. Bump VERSION on every deploy.
const VERSION = 'sb-dev-1';
const CORE = ['./', 'index.html', 'style.css', 'js/game.js', 'js/data.js', 'sound/sound.js', 'sound/sounds.json', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERSION).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Network first for the page and code, so updates arrive. Cache first for audio, icons and fonts.
  const fresh = url.origin === location.origin && /\.(html|js|css|json)$|\/$/.test(url.pathname);
  if (fresh) {
    e.respondWith(fetch(e.request).then((res) => { const cl = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, cl)); return res; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { if (res.ok || res.type === 'opaque') { const cl = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, cl)); } return res; })));
  }
});
