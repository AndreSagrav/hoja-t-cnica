// ============================================================
// INNOVIO — Service Worker (PWA Offline Support)
// Strategy: Cache First for static assets, Network First for API
// ============================================================

const CACHE_NAME = 'innovio-v2.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon-512.png',
  '/src/styles/tokens.css',
  '/src/styles/base.css',
  '/src/styles/app.css',
  '/src/styles/comprobante.css',
  '/src/styles/impuestos.css'
];

// ─── INSTALL: Pre-cache app shell ─────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: Clean old caches ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME)
             .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH: Route requests ────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore unsupported schemes (chrome-extension, moz-extension, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API calls (Supabase, etc.) → Network First
  if (url.pathname.startsWith('/api') || 
      url.hostname.includes('supabase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets → Cache First
  if (request.method === 'GET') {
    event.respondWith(cacheFirst(request));
    return;
  }
});

// ─── Cache First strategy ─────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback
    return caches.match('/') || new Response('Offline', { status: 503 });
  }
}

// ─── Network First strategy ──────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
