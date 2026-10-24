const BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'development'
const RELOAD_GUARD_KEY = 'aestheticare:stale-app-reload'
const RELOAD_GUARD_WINDOW_MS = 30_000

function reloadForCurrentBuild() {
  if (typeof window === 'undefined') return false

  try {
    const previous = JSON.parse(sessionStorage.getItem(RELOAD_GUARD_KEY) || 'null')
    const isRepeatedReload = previous?.buildId === BUILD_ID
      && Date.now() - previous.at < RELOAD_GUARD_WINDOW_MS
    if (isRepeatedReload) return false
    sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({ buildId: BUILD_ID, at: Date.now() }))
  } catch {
    // Storage may be disabled; the reload still provides the best recovery.
  }

  window.location.reload()
  return true
}

export function isStaleAssetError(error) {
  const message = String(error?.message || error || '')
  return /unable to preload css|dynamically imported module|importing a module script failed|failed to fetch dynamically imported module|chunkloaderror|loading css chunk/i.test(message)
}

export function recoverFromStaleAsset(error) {
  if (!isStaleAssetError(error)) return false
  return reloadForCurrentBuild()
}

export function installAppUpdateCheck() {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return () => {}

  const checkForUpdate = async () => {
    if (document.visibilityState === 'hidden') return

    try {
      const response = await fetch(`/app-version.json?current=${encodeURIComponent(BUILD_ID)}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) return

      const version = await response.json()
      if (version.buildId && version.buildId !== BUILD_ID) reloadForCurrentBuild()
    } catch {
      // A temporary network failure should not interrupt the current session.
    }
  }

  const onPreloadError = (event) => {
    if (!isStaleAssetError(event?.payload || event?.detail)) return
    event.preventDefault?.()
    reloadForCurrentBuild()
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  }
  const intervalId = window.setInterval(checkForUpdate, 45_000)

  window.addEventListener('vite:preloadError', onPreloadError)
  document.addEventListener('visibilitychange', onVisibilityChange)
  void checkForUpdate()

  return () => {
    window.clearInterval(intervalId)
    window.removeEventListener('vite:preloadError', onPreloadError)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
