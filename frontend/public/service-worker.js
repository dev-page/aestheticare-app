const CACHE_NAME = 'aestheticare-v4'
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
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (request.headers.has('range')) return fetch(request)
      if (cached) return cached

      return fetch(request).then((response) => {
        void cacheResponse(request, request, response)
        return response
      })
    }),
  )
})
