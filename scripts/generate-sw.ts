#!/usr/bin/env tsx
/**
 * Service Worker Generator
 *
 * Generates sw.js with build-time cache version to ensure users
 * get fresh assets after each deploy.
 *
 * The cache version is based on build timestamp, ensuring:
 * 1. Each deploy creates new cache names
 * 2. Old caches are automatically cleaned up on SW activation
 * 3. SW auto-activates via skipWaiting() — no user prompt needed
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT_DIR = join(__dirname, '..');
const SW_OUTPUT = join(ROOT_DIR, 'public', 'sw.js');

// Generate a short hash from timestamp for cache versioning
const buildTime = Date.now();
const buildHash = createHash('md5')
  .update(buildTime.toString())
  .digest('hex')
  .slice(0, 8);

const swContent = `/// <reference lib="webworker" />

/**
 * Service Worker for DebateKit PWA
 * Generated at build time: ${new Date(buildTime).toISOString()}
 *
 * Caching Strategies:
 * - Static assets (/assets/*): Cache-first, immutable (1 year)
 * - Navigation requests: Stale-while-revalidate (instant navigation)
 * - API requests: Network-only (always fresh)
 * - Images/fonts: Cache-first with network fallback
 *
 * Auto-update: skipWaiting() + clients.claim() for seamless deploys.
 */

// Build-time generated version - changes on each deploy
const CACHE_VERSION = '${buildHash}';
const STATIC_CACHE = \`debatekit-static-\${CACHE_VERSION}\`;
const RUNTIME_CACHE = \`debatekit-runtime-\${CACHE_VERSION}\`;
const DOCUMENT_CACHE = \`debatekit-docs-\${CACHE_VERSION}\`;

// Assets to precache on install - critical paths for fast navigation
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Critical pages for faster subsequent navigation
  '/auth/sign-in',
  '/chat/pricing',
  '/legal/terms',
  '/legal/privacy',
  // Logo for LCP optimization
  '/static/logo.webp',
  '/static/og-image.png',
];

// Install event - cache core assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up ALL old caches from previous builds
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE, DOCUMENT_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('debatekit-') && !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Take control of all pages immediately
  );
});

/**
 * Determine if a request should use cache-first strategy
 * These assets are immutable and can be served from cache indefinitely
 */
function isImmutableAsset(url) {
  const path = url.pathname;
  return (
    // Vite/TanStack static bundles - includes content hash, immutable
    path.startsWith('/assets/')
    // Font files
    || path.match(/\\.(woff2?)$/)
    // Static directory
    || path.startsWith('/static/')
  );
}

/**
 * Determine if a request is for a cacheable image/media
 */
function isCacheableMedia(url) {
  const path = url.pathname;
  return (
    path.startsWith('/icons/')
    || path.match(/\\.(png|jpg|jpeg|svg|gif|webp|ico|avif)$/)
  );
}

/**
 * Fetch handler with different strategies per request type
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API requests - always fetch fresh
  if (url.pathname.startsWith('/api/')) return;

  // Skip auth routes - security sensitive
  if (url.pathname.startsWith('/auth/')) return;

  // Skip authenticated routes - user-specific, should not be cached
  // Caching these causes stale data issues during impersonation/logout
  if (url.pathname.startsWith('/chat/') || url.pathname.startsWith('/admin/')) return;

  // Strategy 1: IMMUTABLE ASSETS - Cache-first, never revalidate
  // These have content hashes in filenames, so they're immutable
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }

  // Strategy 2: MEDIA ASSETS - Cache-first with network fallback
  if (isCacheableMedia(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }

  // Strategy 3: NAVIGATION - Stale-while-revalidate for instant navigation
  // Serves cached HTML immediately while fetching fresh version in background
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(DOCUMENT_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(async () => {
            // Network failed, return cached or fallback to root
            if (cached) return cached;
            const fallback = await cache.match('/');
            if (fallback) return fallback;
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });

          // Return cached immediately if available, otherwise wait for network
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 4: OTHER REQUESTS - Network-first with cache fallback
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && request.url.includes('/assets/')) {
        const responseClone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
        dateOfArrival: Date.now(),
      },
      actions: data.actions || [],
      tag: data.tag || 'default',
      renotify: data.renotify || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'DebateKit', options)
    );
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('DebateKit', { body: text })
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  // Clear document cache on auth state change (login, logout, impersonation)
  if (event.data && event.data.type === 'CLEAR_AUTH_CACHE') {
    event.waitUntil(
      caches.delete(DOCUMENT_CACHE).then(() => {
        return caches.open(DOCUMENT_CACHE);
      })
    );
  }

  // Proactive route caching - warm up cache when browser is idle
  if (event.data && event.data.type === 'WARM_CACHE') {
    const routes = event.data.routes || [];
    event.waitUntil(warmUpCache(routes));
  }
});

/**
 * Proactively cache routes for faster navigation
 * Called from main thread when browser is idle
 */
async function warmUpCache(routes) {
  const cache = await caches.open(DOCUMENT_CACHE);
  const fetchPromises = routes.map(async (route) => {
    try {
      const cached = await cache.match(route);
      if (cached) return;

      const response = await fetch(route, { priority: 'low' });
      if (response.ok) {
        await cache.put(route, response);
      }
    } catch {
      // Silently fail - this is just optimization
    }
  });

  await Promise.allSettled(fetchPromises);
}
`;

writeFileSync(SW_OUTPUT, swContent);
console.log(`Generated sw.js with cache version: ${buildHash}`);
