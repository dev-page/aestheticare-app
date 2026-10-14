// Shared by the navigation guard and notification previews. Feature-specific
// restrictions (for example additional branches) still apply to these routes.
export const FREE_CLINIC_ROUTES = Object.freeze([
  '/clinic/dashboard', '/clinic/branches', '/clinic/profile', '/clinic/page', '/clinic/policies',
  '/catalog/products-services', '/catalog/archived', '/crm/clients', '/crm/appointments',
  '/crm/transactions', '/crm/inbox', '/account/profile', '/account/change-password',
  '/account/subscription', '/account/plans', '/account/closure', '/notifications',
  '/support/report', '/subscription-features', '/subscription/checkout',
])
export const isFreeClinicRoute = path => FREE_CLINIC_ROUTES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
