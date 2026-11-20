// This allowlist is the public profile contract. Never copy the clinic document
// wholesale: it also contains registration, verification and financial data.
const TEXT_FIELDS = [
  'ownerId', 'organizationOwnerId', 'clinicName', 'clinicBranch',
  'clinicLocation', 'clinicLocationAddress', 'clinicBarangay', 'clinicPostalCode',
  'description', 'profilePicture', 'bannerPicture',
  'status', 'moderationStatus', 'openTime', 'closeTime',
  'cancellationPolicy', 'reschedulePolicy', 'refundPolicy', 'consultationPolicy',
  'serviceTerms', 'paymentPolicy',
]
const BOOLEAN_FIELDS = [
  'isMainBranch', 'cancellationPolicyEnabled', 'reschedulePolicyEnabled',
  'refundPolicyEnabled', 'consultationPolicyEnabled', 'serviceTermsEnabled', 'paymentPolicyEnabled',
  'serviceCancellationPolicyEnabled', 'serviceReschedulingPolicyEnabled',
  'earlyNonRefundable', 'midNonRefundable', 'lateNonRefundable',
]
const POLICY_NUMBER_FIELDS = [
  'maximumRescheduleAllowance', 'earlyMinimumHours', 'earlyRefundPercentage',
  'midMinimumHours', 'midMaximumHours', 'midRefundPercentage',
  'lateMaximumHours', 'lateRefundPercentage',
]
const POLICY_KEYS = new Set(['cancellationPolicy', 'reschedulePolicy', 'refundPolicy', 'consultationPolicy', 'serviceTerms', 'paymentPolicy', 'noShowPolicy'])
const COORDINATE_FIELDS = [
  'clinicLocationLat', 'clinicLocationLng', 'locationLat', 'locationLng',
  'addressLat', 'addressLng', 'latitude', 'longitude', 'lat', 'lng',
]
const DAYS = new Set(['sun', 'sunday', 'mon', 'monday', 'tue', 'tues', 'tuesday', 'wed', 'wednesday', 'thu', 'thur', 'thurs', 'thursday', 'fri', 'friday', 'sat', 'saturday'])

const dateOf = (value) => {
  if (value == null || value === '') return null
  let date
  if (typeof value?.toDate === 'function') date = value.toDate()
  else if (value instanceof Date) date = value
  else if (typeof value === 'object' && (value.seconds != null || value._seconds != null)) date = new Date(Number(value.seconds ?? value._seconds) * 1000)
  else if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) {
    const number = Number(value)
    date = new Date(number < 1e11 ? number * 1000 : number)
  } else date = new Date(value)
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : null
}

// Matches shared/subscriptionLifecycle.js, but exposes only the resulting
// public availability and its cutoff, not subscription or payment details.
const customerAvailability = (clinic, now = new Date()) => {
  const storedStatus = String(clinic.subscriptionAccessStatus || clinic.subscriptionStatus || '').trim().toLowerCase()
  const paymentStatus = String(clinic.paymentStatus || '').trim().toLowerCase()
  const trial = paymentStatus === 'trial'
  const rawPlan = String(clinic.subscriptionPlan || clinic.plan || clinic.selectedPlan || '').trim().toLowerCase()
  const plan = trial ? 'premium' : rawPlan.includes('free-trial') || rawPlan === 'trial' ? '' : rawPlan.includes('premium') ? 'premium' : rawPlan.includes('basic') ? 'basic' : ''
  const effectiveStoredStatus = plan && storedStatus === 'unsubscribed'
    ? (trial ? 'trial' : ['paid', 'succeeded'].includes(paymentStatus) ? 'active' : storedStatus)
    : storedStatus
  const expiresAt = dateOf(trial ? (clinic.subscriptionTrialEndsAt || clinic.subscriptionExpiresAt) : clinic.subscriptionExpiresAt)
  const graceEndsAt = dateOf(clinic.subscriptionGraceEndsAt || clinic.gracePeriodEndDate) || (expiresAt ? new Date(expiresAt.getTime() + 7 * 86400000) : null)
  const endedCurrentCycle = Boolean(expiresAt && expiresAt <= now)
  const graceEnded = Boolean(graceEndsAt && graceEndsAt <= now && (endedCurrentCycle || storedStatus === 'grace_period'))
  const status = !plan ? 'unsubscribed' : graceEnded ? 'expired'
    : effectiveStoredStatus && !(['trial', 'active', 'canceled'].includes(effectiveStoredStatus) && endedCurrentCycle) ? effectiveStoredStatus
      : endedCurrentCycle ? 'grace_period' : (trial ? 'trial' : 'active')
  const operational = Boolean(plan) && (['trial', 'active', 'canceled'].includes(status) && (!expiresAt || expiresAt > now)
    || status === 'grace_period' && Boolean(graceEndsAt && graceEndsAt > now))
  // An active cycle remains available until its expiry even if an inconsistent
  // legacy grace date precedes it. Once expired, the grace cutoff applies.
  const accessUntil = status === 'grace_period' ? graceEndsAt : expiresAt && graceEndsAt
    ? new Date(Math.max(expiresAt.getTime(), graceEndsAt.getTime())) : null
  return { customerAccess: operational, customerAccessUntil: operational ? accessUntil : null }
}

const publicHours = (hours) => {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return {}
  const result = {}
  for (const [day, value] of Object.entries(hours)) {
    if (!DAYS.has(day.toLowerCase()) || !value || typeof value !== 'object' || Array.isArray(value)) continue
    const entry = {}
    if (typeof value.closed === 'boolean') entry.closed = value.closed
    for (const field of ['open', 'close', 'start', 'end']) if (typeof value[field] === 'string') entry[field] = value[field]
    if (Array.isArray(value.ranges)) entry.ranges = value.ranges.filter((range) => range && typeof range === 'object' && !Array.isArray(range)).map((range) => {
      const publicRange = {}
      for (const field of ['open', 'close', 'start', 'end']) if (typeof range[field] === 'string') publicRange[field] = range[field]
      return publicRange
    })
    result[day] = entry
  }
  return result
}

const projectPublicClinic = (clinic, now = new Date()) => {
  if (!clinic || clinic.isPublished !== true) return null
  const result = { isPublished: true, ...customerAvailability(clinic, now) }
  for (const field of TEXT_FIELDS) if (typeof clinic[field] === 'string') result[field] = clinic[field]
  // Some older approved clinic records stored the registered name only as
  // companyName. Expose it through the public clinicName field without
  // publishing the internal companyName field itself.
  if (!result.clinicName) {
    const fallbackName = clinic.businessName || clinic.companyName || clinic.clinicBranch
    if (typeof fallbackName === 'string' && fallbackName.trim()) result.clinicName = fallbackName.trim()
  }
  // Registration historically stored a personal contact number. Setup asks
  // for customer-facing contact details, so publish them only after setup.
  if (clinic.clinicSetupCompletedAt) {
    for (const field of ['businessEmail', 'contactNumber']) if (typeof clinic[field] === 'string') result[field] = clinic[field]
  }
  for (const field of BOOLEAN_FIELDS) if (typeof clinic[field] === 'boolean') result[field] = clinic[field]
  for (const field of POLICY_NUMBER_FIELDS) {
    const value = clinic[field]
    if (typeof value === 'number' && Number.isFinite(value)) result[field] = value
    else if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) result[field] = Number(value)
  }
  if (Array.isArray(clinic.enforcedPolicyKeys)) result.enforcedPolicyKeys = clinic.enforcedPolicyKeys.filter((key) => typeof key === 'string' && POLICY_KEYS.has(key))
  for (const field of COORDINATE_FIELDS) {
    if (typeof clinic[field] === 'string' || (typeof clinic[field] === 'number' && Number.isFinite(clinic[field]))) result[field] = clinic[field]
  }
  if (typeof clinic.rating === 'number' && Number.isFinite(clinic.rating)) result.rating = clinic.rating
  if (Array.isArray(clinic.services)) result.services = clinic.services.filter((entry) => typeof entry === 'string')
  if (Array.isArray(clinic.openDays)) result.openDays = clinic.openDays.filter((entry) => typeof entry === 'string')
  if (clinic.operatingHours) result.operatingHours = publicHours(clinic.operatingHours)
  return result
}

const syncPublicClinic = (db, clinicId) => db.runTransaction(async (tx) => {
  const sourceRef = db.collection('clinics').doc(clinicId)
  const publicRef = db.collection('publicClinics').doc(clinicId)
  const source = await tx.get(sourceRef)
  const projection = projectPublicClinic(source.exists ? source.data() : null)
  if (projection) tx.set(publicRef, projection) // overwrite removes stale fields
  else tx.delete(publicRef)
})

module.exports = { projectPublicClinic, customerAvailability, syncPublicClinic }
