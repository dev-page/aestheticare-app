// Pages needed to sign in, renew, manage the account, or contact support stay
// available when a clinic has not selected a plan or its grace period ends.
export const SUBSCRIPTION_RECOVERY_ROUTES = Object.freeze([
  '/account/subscription', '/account/plans', '/account/profile', '/account/change-password',
  '/account/closure', '/notifications', '/support/report',
  '/subscription-features', '/subscription/checkout',
])

export const isSubscriptionRecoveryRoute = path =>
  SUBSCRIPTION_RECOVERY_ROUTES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
