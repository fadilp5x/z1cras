const CACHE_NAME = 'z1cars-v3'; // Changed to v3 to force update
const urlsToCache = [
  '/',
  '/vehicles',
  '/book',
  '/manifest.json',
  'https://i.ibb.co/hRKhMQgh/Whats-App-Image-2025-08-31-at-03-14-20-bc96ac1f-removebg-preview.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install a service worker
self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Cache and return requests
self.addEventListener('fetch', event => {
  // Check if this is a navigation request
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          
          // For navigation requests, try fetching from network
          return fetch(event.request).catch(() => {
            // If network fails, try serving index.html as fallback
            return caches.match('/');
          });
        })
    );
  } else {
    // For all other requests, use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Cache hit - return response
          if (response) {
            return response;
          }
          return fetch(event.request);
        })
    );
  }
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});
