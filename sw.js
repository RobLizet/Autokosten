const CACHE = 'autokosten-v3';
const ASSETS = [
  '/Autokosten/',
  '/Autokosten/index.html',
  '/Autokosten/manifest.json',
  '/Autokosten/sw.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/Autokosten/index.html')))
));
