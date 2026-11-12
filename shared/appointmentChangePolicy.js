const numeric = (value, fallback = 0) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const boundedPercentage = value => Math.min(100, Math.max(0, numeric(value)))

const appointmentStart = appointment => {
  const date = String(appointment?.date || '').trim()
  const time = String(appointment?.time || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null
  const parsed = new Date(`${date}T${time}+08:00`)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

export const isCancellationPolicyEnabled = policy =>
  policy?.serviceCancellationPolicyEnabled === true || policy?.cancellationPolicyEnabled === true

export const isReschedulePolicyEnabled = policy =>
  policy?.serviceReschedulingPolicyEnabled === true || policy?.reschedulePolicyEnabled === true

export const rescheduleAllowanceForPolicy = policy =>
  Math.max(0, Math.floor(numeric(policy?.maximumRescheduleAllowance, 1)))

export const canRequestAppointmentReschedule = (policy = {}, appointment = {}) =>
  isReschedulePolicyEnabled(policy)
  && numeric(appointment?.rescheduleCount) < rescheduleAllowanceForPolicy(policy)

export const isCancellationWindowConfigurationValid = policy => {
  const earlyMinimum = numeric(policy?.earlyMinimumHours, Number.NaN)
  const midMinimum = numeric(policy?.midMinimumHours, Number.NaN)
  const midMaximum = numeric(policy?.midMaximumHours, Number.NaN)
  const lateMaximum = numeric(policy?.lateMaximumHours, Number.NaN)
  return [earlyMinimum, midMinimum, midMaximum, lateMaximum].every(value => Number.isFinite(value) && value >= 0)
    && earlyMinimum === midMaximum
    && midMinimum === lateMaximum
    && midMinimum <= earlyMinimum
}

export const cancellationRefundEstimate = ({ policy = {}, appointment = {}, now = new Date() } = {}) => {
  const start = appointmentStart(appointment)
  const nowDate = now instanceof Date ? now : new Date(now)
  const hoursUntil = start && Number.isFinite(nowDate.getTime())
    ? Math.max(0, (start.getTime() - nowDate.getTime()) / 3_600_000)
    : 0

  const earlyMinimum = Math.max(0, numeric(policy.earlyMinimumHours, 48))
  const midMinimum = Math.max(0, numeric(policy.midMinimumHours, 24))
  const tier = hoursUntil >= earlyMinimum ? 'early' : hoursUntil >= midMinimum ? 'mid' : 'late'
  const nonRefundable = policy[`${tier}NonRefundable`] === true
  const refundPercentage = nonRefundable ? 0 : boundedPercentage(policy[`${tier}RefundPercentage`] ?? (tier === 'early' ? 100 : tier === 'mid' ? 50 : 0))
  const paidAmount = Math.max(0, numeric(appointment.amountPaid))
  const totalAmount = Math.max(0, numeric(appointment.totalAmount ?? appointment.amount ?? paidAmount, paidAmount))
  const commissionAmount = Math.min(paidAmount, Math.max(0, numeric(appointment.commissionAmount ?? appointment.refundCommissionAmount)))
  const eligibleAmount = Math.round((Math.min(totalAmount, paidAmount) - commissionAmount + Number.EPSILON) * 100) / 100
  const refundAmount = Math.round((eligibleAmount * refundPercentage / 100 + Number.EPSILON) * 100) / 100

  return {
    tier,
    hoursUntil,
    refundPercentage,
    eligibleAmount,
    commissionAmount,
    refundAmount,
  }
}
