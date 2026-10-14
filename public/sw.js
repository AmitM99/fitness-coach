/**
 * Minimal service worker.
 *
 * Two jobs:
 *   1. Make the app installable and let it open instantly on a repeat visit.
 *   2. Provide showNotification() — on iOS this is the *only* way a web app is
 *      allowed to raise a notification, and only once installed to the home
 *      screen. The Notification constructor alone does not work there.
 *
 * Deliberately not caching the exercise media: 177 MB does not belong in a
 * cache the browser may evict at an unhelpful moment.
 */

const CACHE = 'coach-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {
        /* a failed pre-cache must not block installation */
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always go to the network, bypassing the HTTP cache — otherwise
  // a stale index.html keeps pointing at a previous build's hashed bundles and
  // deploys never reach the user. The cached copy is an offline fallback only,
  // and is refreshed on every successful load so it never drifts far behind.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r ?? Response.error()))
    );
    return;
  }

  // Cache-first for the built assets and datasets — their names are hashed or
  // they change only when the data is rebuilt.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/data/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return response;
          })
      )
    );
  }
});

// Tapping a notification should bring the workout back, not open a new tab.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
