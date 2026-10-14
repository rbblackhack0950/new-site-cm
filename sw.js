// App shell cache. Map tiles, routing, video and dist/ (APK + version.json) always come from the network.
// Cache first, so the app starts instantly even on a slow car connection. Every release changes CACHE,
// which makes the browser install this worker again: it downloads fresh files, takes over, and the page
// reloads once (see app.js), so updates still arrive on the next launch.
const CACHE = 'carscreen-v37';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'icons/192.png', 'icons/512.png', 'data/dc-stations.json', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet-rotate.js', 'vendor/leaflet/leaflet.css'];
self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache, so the new version's files are really new
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/dist/')) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) c.put(e.request, r.clone());
    return r;
  }).catch(() => c.match('index.html')))));
});
