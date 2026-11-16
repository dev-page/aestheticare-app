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

const hasRecognizedSubscription = (record = {}) => {
  const plan = String(record.subscriptionPlan || record.plan || '').trim().toLowerCase()
  const paymentStatus = String(record.paymentStatus || '').trim().toLowerCase()
  return paymentStatus === 'trial' || plan.includes('basic') || plan.includes('premium')
}

// Prefer a real offer over legacy placeholder values such as `free`.
export function subscriptionRecord(user = {}, clinic = {}) {
  const primary = hasRecognizedSubscription(user)
    ? user
    : hasRecognizedSubscription(clinic)
      ? clinic
      : user.subscriptionPlan || user.plan
        ? user
        : clinic
  const fallback = primary === user ? clinic : user
  const record = { ...fallback, ...primary }
  if (['free', 'free-plan', 'free_plan', 'freeplan'].includes(String(record.subscriptionPlan || '').trim().toLowerCase())) {
    record.subscriptionExpiresAt = null
  }
  return record
}
