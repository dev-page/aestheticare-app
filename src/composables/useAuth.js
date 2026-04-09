import { storeToRefs } from 'pinia'
import { auth } from '@/config/firebaseConfig'
import { signOut } from 'firebase/auth'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const authStore = useAuthStore()
  const { user, isLoading, isLoggingOut } = storeToRefs(authStore)
  const { initAuth, setLoggingOut } = authStore

  const setProcessLoading = (active, label) => {
    window.dispatchEvent(new CustomEvent('app-process-loading', { detail: { active, label } }))
  }
  
  const logout = async () => {
    setLoggingOut(true)
    setProcessLoading(true, 'Logging out...')
    try {
      await new Promise((resolve) => setTimeout(resolve, 600))
      await signOut(auth)
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
    logout,
    initAuth
  }
}
