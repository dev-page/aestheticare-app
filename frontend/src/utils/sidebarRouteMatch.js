const accountTabs = new Set(['profile', 'notifications', 'account', 'help', 'privacy'])

// Vue Router's built-in active state ignores query parameters. Sidebar links
// to tabs must also match the query values they explicitly select.
export function sidebarRouteMatches(current, target, exact = false) {
  if (!target?.path || !current?.path) return false
  if (current.path !== target.path && (exact || !current.path.startsWith(`${target.path}/`))) return false
  const currentQuery = { ...(current.query || {}) }
  if (current.path === '/customer/account-settings') {
    const tab = String(currentQuery.tab || '')
    currentQuery.tab = accountTabs.has(tab) ? tab : 'profile'
  }
  return Object.entries(target.query || {}).every(([key, value]) => JSON.stringify(currentQuery[key]) === JSON.stringify(value))
    && (!target.hash || target.hash === current.hash)
}
