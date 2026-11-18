export const AUTH_LAST_ACTIVITY_KEY = 'auth:last-activity-at'

export const markAuthSessionActivity = () => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(Date.now()))
  } catch (_error) {
    // The in-memory inactivity timer still protects the session.
  }
}
