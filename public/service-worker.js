// service-worker.js
const CACHE_NAME = 'saas-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  // Add other CSS/JS files you want to work offline here
];

// Install event: Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Fetch event: Serve from cache if available, otherwise network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
