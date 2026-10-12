// Firestore timestamps, serialized timestamps, PayMongo Unix seconds and ISO dates.
export function subscriptionDate(value) {
  if (value == null || value === '') return null
  let date
  if (typeof value?.toDate === 'function') date = value.toDate()
  else if (value instanceof Date) date = value
  else if (typeof value === 'object' && (value.seconds != null || value._seconds != null)) {
    date = new Date(Number(value.seconds ?? value._seconds) * 1000)
  } else if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) {
    const number = Number(value)
    date = new Date(number < 1e11 ? number * 1000 : number)
  } else date = new Date(value)
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : null
}

export function subscriptionDateLabel(value) {
  const date = subscriptionDate(value)
  return date ? new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila',
  }).format(date) : '-'
}

// Use a coherent owner record. An explicit null means cleared, not missing.
export function subscriptionRecord(user = {}, clinic = {}) {
  const primary = user.subscriptionPlan ? user : clinic
  const fallback = primary === user ? clinic : user
  const record = { ...fallback, ...primary }
  if (String(record.subscriptionPlan || '').toLowerCase().includes('free')) record.subscriptionExpiresAt = null
  return record
}
