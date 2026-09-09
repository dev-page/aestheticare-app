import { useAuth } from '@/composables/useAuth'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebaseConfig'

const waitForAuth = (isLoading) => {
  if (!isLoading.value) return Promise.resolve()
  return new Promise((resolve) => {
    let unsubscribe = null
    unsubscribe = onAuthStateChanged(auth, () => {
      if (unsubscribe) unsubscribe()
      resolve()
    })
  })
}

export const requireAuth = async (to, from, next) => {
  const { user, isLoading, initAuth } = useAuth()
  initAuth()

  await waitForAuth(isLoading)

  if (!user.value) {
    next('/login')
  } else {
    next()
  }
}

export const requirePermission = (permission) => {
  return (to, from, next) => {
    const { hasPermission } = usePermissions()

    if (hasPermission(permission)) {
      next()
    } else {
      next('/')
    }
  }
}

export const requireFeature = (feature) => {
  return async (to, from, next) => {
    const { hasFeature, initSubscription } = useSubscription()
    await initSubscription()

    if (hasFeature(feature)) {
      next()
    } else {
      next('/subscription-features')
    }
  }
}
