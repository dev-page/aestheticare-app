import { ref } from 'vue'
import { defineStore } from 'pinia'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { getSuspendedCenterAccess } from '@/utils/centerAccess'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isLoading = ref(true)
  const isLoggingOut = ref(false)

  let unsubscribe = null

  const initAuth = () => {
    if (unsubscribe) return

    unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      user.value = firebaseUser
      isLoading.value = false
      if (!firebaseUser) return

      try {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) return
        const data = userSnap.data() || {}

        const suspendedCenter = await getSuspendedCenterAccess(firebaseUser.uid, data)
        if (suspendedCenter) {
          await signOut(auth)
          user.value = null
          return
        }

        if (!data.welcomeNotificationSent) {
          await updateDoc(userRef, {
            welcomeNotificationSent: true,
            welcomeNotificationAt: serverTimestamp(),
            welcomeNotificationRead: false,
            welcomeNotificationDeleted: false
          })
        }
      } catch (error) {
        console.error('Failed to set welcome notification flag:', error)
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
