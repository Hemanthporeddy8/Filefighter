// Editroy Service Worker v1.0
// Handles offline caching, faster loads, and PWA install support

const CACHE_NAME = 'editroy-v1';
const STATIC_CACHE = 'editroy-static-v1';

// Assets to cache on install (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/video-editor',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/dynamic, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API routes: always go to network, no caching
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Static assets (fonts, icons, images): cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Pages: network-first with offline fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Cache successful page responses
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline fallback: serve cached version if available
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback to home if nothing cached
          return caches.match('/');
        });
      })
  );
});

// Background sync (future: sync edits when back online)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

// Push notifications (future)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  self.registration.showNotification(data.title || 'Editroy', {
    body: data.body || 'You have a new notification.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  });
});
