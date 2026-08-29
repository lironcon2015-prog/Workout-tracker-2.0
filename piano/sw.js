const CACHE = 'piano-guide-v1';
const ASSETS = [
  './', './index.html', './css/app.css', './manifest.webmanifest', './icon.svg',
  './apple-touch-icon.png', './js/main.js', './js/player.js', './js/render.js', './js/audio.js',
  './js/notation.js', './js/songs.js', './js/midi.js', './js/musicxml.js', './js/input.js', './js/store.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
