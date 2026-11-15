export const DEFAULT_LEAVE_POLICY = Object.freeze({ annualPaidDays: 5, eligibilityMonths: 12 })

const validDateKey = value => {
  const key = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const date = new Date(`${key}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? date : null
}

export const normalizeLeavePolicy = input => {
  const source = input || {}
  const annualPaidDays = Number(source.annualPaidDays ?? DEFAULT_LEAVE_POLICY.annualPaidDays)
  const eligibilityMonths = Number(source.eligibilityMonths ?? DEFAULT_LEAVE_POLICY.eligibilityMonths)
  if (!Number.isInteger(annualPaidDays) || annualPaidDays < 0 || annualPaidDays > 365) {
    throw Object.assign(new Error('Annual paid leave days must be a whole number from 0 to 365.'), { status: 400 })
  }
  if (!Number.isInteger(eligibilityMonths) || eligibilityMonths < 0 || eligibilityMonths > 60) {
    throw Object.assign(new Error('Paid leave eligibility must be between 0 and 60 months.'), { status: 400 })
  }
  return { annualPaidDays, eligibilityMonths }
}

const plusMonths = (date, months) => {
  const firstOfTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const lastDayOfTargetMonth = new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)).getUTCDate()
  firstOfTargetMonth.setUTCDate(Math.min(date.getUTCDate(), lastDayOfTargetMonth))
  return firstOfTargetMonth
}

export const isEligibleForPaidLeave = (employmentStartDate, asOfDate, eligibilityMonths = DEFAULT_LEAVE_POLICY.eligibilityMonths) => {
  const start = validDateKey(employmentStartDate)
  const asOf = validDateKey(asOfDate)
  const months = Number(eligibilityMonths)
  if (!asOf || !Number.isInteger(months) || months < 0 || months > 60) return false
  if (months === 0) return !employmentStartDate || Boolean(start && start <= asOf)
  if (!start || start > asOf) return false
  return plusMonths(start, months) <= asOf
}
