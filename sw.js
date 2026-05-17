const CACHE_NAME = 'da-pos-v2026.05.17.3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './productos.json'
];

// ============================================================
// INSTALL - Precachear estáticos
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => {
      console.log('[SW] Error precacheando:', err);
    })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE - Limpiar caches viejas y tomar control
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Borrando cache vieja:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ============================================================
// FETCH - Estrategia por tipo de recurso
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Estáticos: Cache-first, luego network, luego actualizar cache
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '')))) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Imágenes/CDN: Stale-while-revalidate
  if (request.destination === 'image' || url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Todo lo demás: Network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ============================================================
// MESSAGE - Escuchar mensajes desde la app
// ============================================================
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});