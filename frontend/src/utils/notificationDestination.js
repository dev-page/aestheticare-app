export function notificationDestination(notification = {}, { userType = '', role = '' } = {}) {
  const kind = `${userType} ${role}`.toLowerCase()
  const fallback = kind.includes('superadmin') ? '/superadmin/notifications'
    : kind.includes('customer') ? '/customer/account-settings?tab=notifications' : '/notifications'
  const link = String(notification.link || '').trim()
  if (/^\/customer\/(cart|checkout|orders)(?:[/?#]|$)/.test(link)) {
    return { to: '/customer/home', label: 'Discover clinics' }
  }
  const retiredSupplierDestination = kind.includes('supplier')
    ? { to: '/login', label: 'Go to sign in' }
    : { to: '/procurement/orders', label: 'Open Procurement' }
  if (/^\/crm\/inbox\?tab=suppliers?$/i.test(link)) {
    return retiredSupplierDestination
  }
  // Notifications navigate within the application; never interpret an external URL as a route.
  if (/^\/(?!\/)/.test(link) && !/[\\\u0000-\u001f]/.test(link)) {
    return { to: link, label: 'Open page' }
  }
  // Older chat notifications did not always save their destination.
  if (String(notification.title || '').toLowerCase() === 'supplier chat') {
    return retiredSupplierDestination
  }
  return { to: fallback, label: 'View all notifications' }
}
