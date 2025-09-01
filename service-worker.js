const CACHE_NAME = 'z1cars-cache-v2';
const STATIC_CACHE_NAME = 'z1cars-static-v2';
const IMAGE_CACHE_NAME = 'z1cars-images-v2';
const OFFLINE_URL = '/404';

// URLs to cache on install
const urlsToCache = [
  '/',
  '/index',
  '/vehicles',
  '/book',
  '/404',
  '/manifest.json',
  '/favicon/favicon.ico',
  '/favicon/favicon-16x16.png',
  '/favicon/favicon-32x32.png',
  '/favicon/apple-touch-icon.png',
  '/favicon/site.webmanifest',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap'
];

// Install event - cache static resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Opened static cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [STATIC_CACHE_NAME, IMAGE_CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Handle image requests with a separate cache
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME)
        .then(cache => {
          return cache.match(request)
            .then(response => {
              // If image is in cache, return it
              if (response) {
                return response;
              }
              
              // Otherwise, fetch from network
              return fetch(request)
                .then(networkResponse => {
                  // Cache the fetched image
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
                })
                .catch(() => {
                  // If both cache and network fail, return a fallback image
                  return new Response(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="20" fill="#999" text-anchor="middle" dominant-baseline="middle">Image not available</text></svg>',
                    { headers: { 'Content-Type': 'image/svg+xml' } }
                  );
                });
            });
        })
    );
    return;
  }
  
  // For non-image requests, use network-first strategy
  event.respondWith(
    fetch(request)
      .then(response => {
        // Clone the response
        const responseClone = response.clone();
        
        // Cache the response for future offline use
        if (request.method === 'GET' && response.status === 200) {
          caches.open(STATIC_CACHE_NAME)
            .then(cache => {
              cache.put(request, responseClone);
            });
        }
        
        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(request)
          .then(response => {
            if (response) {
              return response;
            }
            
            // If the request is for a page, show the offline page
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
            
            // For other requests, return a generic error response
            return new Response('Network error', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Background sync for form submissions when offline
self.addEventListener('sync', event => {
  if (event.tag === 'form-submission') {
    event.waitUntil(
      // Get all stored form submissions from IndexedDB
      getStoredFormSubmissions()
        .then(formSubmissions => {
          // Submit each form
          return Promise.all(
            formSubmissions.map(formSubmission => {
              return fetch(formSubmission.url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(formSubmission.data)
              })
              .then(response => {
                if (response.ok) {
                  // If successful, remove from IndexedDB
                  deleteStoredFormSubmission(formSubmission.id);
                }
                return response;
              });
            })
          );
        })
    );
  }
});

// Helper functions for IndexedDB operations
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('z1cars-offline-db', 1);
    
    request.onerror = event => {
      reject('Error opening IndexedDB');
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Create an object store for form submissions if it doesn't exist
      if (!db.objectStoreNames.contains('form-submissions')) {
        const store = db.createObjectStore('form-submissions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('url', 'url', { unique: false });
      }
    };
  });
}

function getStoredFormSubmissions() {
  return openIndexedDB()
    .then(db => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['form-submissions'], 'readonly');
        const store = transaction.objectStore('form-submissions');
        const request = store.getAll();
        
        request.onsuccess = event => {
          resolve(event.target.result);
        };
        
        request.onerror = event => {
          reject('Error getting form submissions from IndexedDB');
        };
      });
    });
}

function deleteStoredFormSubmission(id) {
  return openIndexedDB()
    .then(db => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['form-submissions'], 'readwrite');
        const store = transaction.objectStore('form-submissions');
        const request = store.delete(id);
        
        request.onsuccess = event => {
          resolve();
        };
        
        request.onerror = event => {
          reject('Error deleting form submission from IndexedDB');
        };
      });
    });
}
