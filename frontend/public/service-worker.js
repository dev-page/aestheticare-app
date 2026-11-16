const CACHE_NAME = 'aestheticare-v5'
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  )
})

// Cache Storage cannot store partial (206) responses. Media requests and some
// browser revalidations use a Range header, so always leave those to the
// network. Cache only complete, same-origin responses and swallow a cache
// write failure so it never becomes an unhandled service-worker promise.
const canCacheResponse = (request, response) => (
  !request.headers.has('range') &&
  response &&
  response.status === 200 &&
  response.type === 'basic' &&
  !response.headers.has('content-range')
)

const cacheResponse = (key, request, response) => {
  if (!canCacheResponse(request, response)) return Promise.resolve()

  return caches.open(CACHE_NAME)
    .then((cache) => cache.put(key, response.clone()))
    .catch(() => undefined)
}

const offlineResponse = (request) => {
  const isNavigation = request?.mode === 'navigate'
  const body = isNavigation
    ? '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connection unavailable</title><body style="margin:0;padding:3rem;font:16px system-ui,sans-serif;background:#24160f;color:#fff5e8"><main style="max-width:36rem;margin:auto"><h1>Connection unavailable</h1><p>AesthetiCare could not load this page. Check your connection and try again.</p></main></body></html>'
    : 'This resource is temporarily unavailable. Check your connection and try again.'

  return new Response(body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': isNavigation ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
    },
  })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Account and operational data must always come from the authenticated API.
  // Cache keys do not distinguish users by their Authorization header.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') || request.headers.has('authorization')) return

  // Build metadata must always reflect the active deployment. Vite assets are
  // content-hashed and should use the browser's HTTP cache, never this
  // service worker's cache-first fallback across app versions.
  if (url.pathname === '/app-version.json' || url.pathname.startsWith('/assets/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          void cacheResponse('/', request, response)
          return response
        })
        .catch(async () => {
          try {
            return (await caches.match('/')) || offlineResponse(request)
          } catch {
            return offlineResponse(request)
          }
        }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (request.headers.has('range')) return fetch(request).catch(() => offlineResponse(request))
      if (cached) return cached

      return fetch(request).then((response) => {
        void cacheResponse(request, request, response)
        return response
      }).catch(() => offlineResponse(request))
    }),
  )
})
