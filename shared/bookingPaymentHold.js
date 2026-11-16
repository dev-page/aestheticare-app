export const BOOKING_PAYMENT_HOLD_MINUTES = 15
export const BOOKING_PAYMENT_HOLD_MS = BOOKING_PAYMENT_HOLD_MINUTES * 60 * 1000

export const timestampMillis = (value) => {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (Number.isFinite(Number(value))) return Number(value)
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

// A checkout that PayMongo still considers active keeps its slot until the
// backend successfully expires it. Without a checkout, the local hold can
// expire directly at the deadline.
export const isBookingPaymentHoldReleased = (appointment, now = Date.now()) => {
  if (String(appointment?.paymentHoldStatus || '').toLowerCase() === 'released') return true
  if (String(appointment?.paymentHoldStatus || '').toLowerCase() !== 'active') return false
  if (appointment?.activePaymongoCheckoutSessionId) return false
  const expiry = timestampMillis(appointment?.paymentHoldExpiresAt)
  return expiry > 0 && expiry <= now && String(appointment?.paymentStatus || '').toLowerCase() !== 'paid'
}
