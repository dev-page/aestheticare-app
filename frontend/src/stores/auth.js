import { ref } from 'vue'
import { defineStore } from 'pinia'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { clearSidebarTransientState } from '@/composables/useSidebarState'
import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isLoading = ref(true)
  const isLoggingOut = ref(false)

  let unsubscribe = null

  // This is intentionally performed by the authenticated backend. Some user
  // profiles are created by trusted registration flows and do not grant the
  // browser general profile-write access; a welcome flag must not make login
  // depend on that permission.
  const ensureWelcomeNotification = async (firebaseUser) => {
    const token = await firebaseUser.getIdToken()
    let lastError = null
    for (const baseUrl of OTP_API_BASE_CANDIDATES) {
      try {
        const response = await fetch(`${baseUrl}/auth/ensure-welcome-notification`, {
          method: 'POST', headers: { authorization: `Bearer ${token}` },
        })
        if (response.ok) return
        lastError = new Error(`Welcome notification request failed (${response.status}).`)
      } catch (error) {
        lastError = error
      }
    }
    // Do not fail sign-in if an older API deployment has not yet received the
    // endpoint. The notification can be initialized on the next sign-in.
    console.warn('Welcome notification could not be initialized:', lastError)
  }

  const initAuth = () => {
    if (unsubscribe) return

    unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      user.value = firebaseUser
      isLoading.value = false
      if (!firebaseUser) {
        clearSidebarTransientState()
        return
      }

      try {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) return
        const data = userSnap.data() || {}

        if (!data.welcomeNotificationSent) await ensureWelcomeNotification(firebaseUser)
      } catch (error) {
        console.error('Failed to initialize welcome notification:', error)
      }
    })
  }

  const setLoggingOut = (active) => {
    isLoggingOut.value = active
  }

  return {
    user,
    isLoading,
    isLoggingOut,
    initAuth,
    setLoggingOut
  }
})
