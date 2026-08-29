// sw.js — עדכון תמיד קודם לרשת, מטמון רק כגיבוי לאופליין.
// (הגרסה הקודמת הייתה cache-first ולכן "נתקעה" על גרסה ישנה.)
const VERSION = '2026-08-29.9';
const CACHE = 'piano-guide-' + VERSION;
const ASSETS = [
  './', './index.html', './css/app.css', './manifest.webmanifest', './icon.svg',
  './apple-touch-icon.png', './js/main.js', './js/player.js', './js/render.js', './js/audio.js',
  './js/notation.js', './js/songs.js', './js/midi.js', './js/musicxml.js', './js/input.js', './js/store.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'version') e.source.postMessage({ type: 'version', version: VERSION });
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () =>
        (await caches.match(req)) ||
        (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      )
  );
});
