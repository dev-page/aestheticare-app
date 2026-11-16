export const NOTIFICATION_READ_STATE_EVENT = 'notification-read-state-changed'

export const publishNotificationReadState = (notificationId, read = true) => {
  if (!notificationId || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_STATE_EVENT, {
    detail: { notificationId, read: Boolean(read) }
  }))
}
