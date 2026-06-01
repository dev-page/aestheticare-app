import { useAuth } from '@/composables/useAuth'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'

export const requireAuth = (to, from, next) => {
  const { user, isLoading, initAuth } = useAuth()
  initAuth()

  if (isLoading.value) {
    // Still loading, wait
    return next()
  }

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
      next('/unauthorized')
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
