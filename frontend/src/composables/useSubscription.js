import { storeToRefs } from 'pinia'
import { useSubscriptionStore } from '@/stores/subscription'

export function useSubscription() {
  const subscriptionStore = useSubscriptionStore()
  const {
    activeFeatures,
    activePlan,
    isLoading,
    isReadOnly,
    isExpired,
    graceEndsAt,
    subscriptionExpiresAt,
    userRole
  } = storeToRefs(subscriptionStore)

  return {
    activeFeatures,
    activePlan,
    isLoading,
    isReadOnly,
    isExpired,
    graceEndsAt,
    subscriptionExpiresAt,
    userRole,
    initSubscription: subscriptionStore.initSubscription,
    hasFeature: subscriptionStore.hasFeature,
    refreshSubscription: subscriptionStore.refreshSubscription
  }
}
