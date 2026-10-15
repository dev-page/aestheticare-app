export const CUSTOMER_APP_LOGIN = '/customer-app/login'
export const CUSTOMER_APP_REGISTER = '/customer-app/register'
const APP_SESSION_KEY = 'aestheticare:customer-app'
const appAuthPaths = new Set([CUSTOMER_APP_LOGIN, CUSTOMER_APP_REGISTER, '/customer-app/forgot-password'])
const sharedPaths = new Set(['/change-password', '/support/report', '/activate-account', '/group-consent'])

export const customerAppAuthRedirect = path => ({
  '/': CUSTOMER_APP_LOGIN,
  '/login': CUSTOMER_APP_LOGIN,
  '/register': CUSTOMER_APP_REGISTER,
  '/forgot-password': '/customer-app/forgot-password',
})[path] || ''

export const isCustomerAppRoute = path => appAuthPaths.has(path) || sharedPaths.has(path) || path.startsWith('/customer/')
export function isCustomerAppAccount(record = {}) {
  const key = value => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const role = key(record.role || record.customRoleName), type = key(record.userType)
  return (role === 'customer' || (!role && type === 'customer')) && (!type || type === 'customer')
}

// Keep app navigation local to its browser tab, without changing ordinary
// website tabs. A refresh in the customer workspace retains the app entry.
export function createCustomerAppContext(storage, initialPath = '') {
  let active = initialPath === '/customer-app' || initialPath.startsWith('/customer-app/')
  try { active ||= storage?.getItem(APP_SESSION_KEY) === '1' } catch { /* Private browsing may block storage. */ }
  return (path = '', mobileBuild = false) => {
    active ||= mobileBuild || path === '/customer-app' || path.startsWith('/customer-app/')
    if (active) { try { storage?.setItem(APP_SESSION_KEY, '1') } catch { /* Retain in memory. */ } }
    return active
  }
}
let storage
try { storage = globalThis.sessionStorage } catch { /* Retain in memory. */ }
export const isCustomerAppContext = createCustomerAppContext(storage, typeof window === 'undefined' ? '' : window.location.pathname)
