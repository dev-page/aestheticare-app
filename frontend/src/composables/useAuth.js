import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { auth } from '@/config/firebaseConfig'
import { signOut } from 'firebase/auth'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const authStore = useAuthStore()
  const { user, isLoading, isLoggingOut } = storeToRefs(authStore)
  const { initAuth, setLoggingOut } = authStore

  // ── Inactivity auto-logout ───────────────────────────────────────────────
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
  const WARNING_BEFORE_MS = 30 * 1000 // warn 30 seconds before expiry
  const LAST_ACTIVITY_KEY = 'auth:last-activity-at'

  let inactivityTimer = null
  let warningTimer = null

  const inactivityWarning = ref(false)

  const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']

  const clearInactivityTimers = () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
      inactivityTimer = null
    }
    if (warningTimer) {
      clearTimeout(warningTimer)
      warningTimer = null
    }
    inactivityWarning.value = false
  }

  const lastActivityAt = () => {
    try {
      return Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) || 0)
    } catch (_error) {
      return 0
    }
  }

  const recordActivity = () => {
    if (!user.value || document.visibilityState === 'hidden') return
    try {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    } catch (_error) {
      // The in-memory timer still protects the session if storage is unavailable.
    }
    resetInactivityTimer()
  }

  const resetInactivityTimer = () => {
    clearInactivityTimers()
    if (!user.value) return

    const lastActive = lastActivityAt() || Date.now()
    const elapsed = Math.max(0, Date.now() - lastActive)
    const remaining = INACTIVITY_TIMEOUT_MS - elapsed

    if (remaining <= 0) {
      performInactivityLogout()
      return
    }

    // Warn 30 seconds before expiry, unless the warning period already began.
    warningTimer = setTimeout(() => {
      inactivityWarning.value = true
    }, Math.max(0, remaining - WARNING_BEFORE_MS))

    inactivityTimer = setTimeout(async () => {
      inactivityWarning.value = false
      await performInactivityLogout()
    }, remaining)
  }

  const performInactivityLogout = async () => {
    stopInactivityTracking()
    setLoggingOut(true)
    setProcessLoading(true, 'Session expired...')
    try {
      await signOut(auth)
      clearCache()
      try { window.localStorage.removeItem(LAST_ACTIVITY_KEY) } catch (_error) {}
      await router.replace('/login?expired=inactivity')
      window.dispatchEvent(new CustomEvent('toast', {
        detail: { message: 'Session has expired due to inactivity. Please log in again.', type: 'info' }
      }))
    } catch (error) {
      console.error('Inactivity logout error:', error)
    } finally {
      setLoggingOut(false)
      setProcessLoading(false)
    }
  }

  const startInactivityTracking = () => {
    stopInactivityTracking()
    if (!user.value) return
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    window.addEventListener('focus', resetInactivityTimer)
    window.addEventListener('storage', handleStorageActivity)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (!lastActivityAt()) recordActivity()
    else resetInactivityTimer()
  }

  const stopInactivityTracking = () => {
    clearInactivityTimers()
    ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, recordActivity))
    window.removeEventListener('focus', resetInactivityTimer)
    window.removeEventListener('storage', handleStorageActivity)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  const handleStorageActivity = (event) => {
    if (event.key === LAST_ACTIVITY_KEY) resetInactivityTimer()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') resetInactivityTimer()
  }

  // ── Process loading helper ──────────────────────────────────────────────
  const setProcessLoading = (active, label) => {
    window.dispatchEvent(new CustomEvent('app-process-loading', { detail: { active, label } }))
  }

  // ── Cache cleanup ───────────────────────────────────────────────────────
  const clearCache = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith('permissions:user:') ||
          key.startsWith('permissions:role:') ||
          key.startsWith('subscription:plan') ||
          key.startsWith('subscription:features:')
        ) {
          localStorage.removeItem(key)
        }
      })
    } catch (_error) {
      // ignore cache clear errors
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────
  const logout = async () => {
    stopInactivityTracking()
    setLoggingOut(true)
    setProcessLoading(true, 'Logging out...')
    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      await signOut(auth)
      clearCache()
      try { window.localStorage.removeItem(LAST_ACTIVITY_KEY) } catch (_error) {}
      await router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoggingOut(false)
      setProcessLoading(false)
    }
  }

  return {
    user,
    isLoading,
    isLoggingOut,
    inactivityWarning,
    logout,
    initAuth,
    startInactivityTracking,
    stopInactivityTracking,
    continueSession: recordActivity
  }
}
