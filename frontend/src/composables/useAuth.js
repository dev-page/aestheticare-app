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
  const WARNING_BEFORE_MS = 30 * 1000           // warn 30 seconds before expiry

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

  const resetInactivityTimer = () => {
    clearInactivityTimers()
    if (!user.value) return

    // Set warning timer
    warningTimer = setTimeout(() => {
      inactivityWarning.value = true
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS)

    // Set logout timer
    inactivityTimer = setTimeout(async () => {
      inactivityWarning.value = false
      await performInactivityLogout()
    }, INACTIVITY_TIMEOUT_MS)
  }

  const performInactivityLogout = async () => {
    stopInactivityTracking()
    setLoggingOut(true)
    setProcessLoading(true, 'Session expired...')
    try {
      await signOut(auth)
      clearCache()
      await router.push('/login?expired=inactivity')
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
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer, { passive: true })
    })
    resetInactivityTimer()
  }

  const stopInactivityTracking = () => {
    clearInactivityTimers()
    ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, resetInactivityTimer)
    })
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
    stopInactivityTracking
  }
}
