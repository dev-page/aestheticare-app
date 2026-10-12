export function notificationDestination(notification = {}, { userType = '', role = '' } = {}) {
  const kind = `${userType} ${role}`.toLowerCase()
  const fallback = kind.includes('superadmin') ? '/superadmin/notifications'
    : kind.includes('customer') ? '/customer/account-settings?tab=notifications' : '/notifications'
  const link = String(notification.link || '').trim()
  // Notifications navigate within the application; never interpret an external URL as a route.
  if (/^\/(?!\/)/.test(link) && !/[\\\u0000-\u001f]/.test(link)) {
    return { to: link, label: 'Open page' }
  }
  // Older chat notifications did not always save their destination.
  if (String(notification.title || '').toLowerCase() === 'supplier chat') {
    return { to: kind.includes('supplier') ? '/supplier/chat' : '/crm/inbox?tab=suppliers', label: 'Open inbox' }
  }
  return { to: fallback, label: 'View all notifications' }
}
