import { subscriptionDate } from './subscriptionDates.js'

export const TRIAL_DAYS = 14
// Compatibility default for callers that have not yet supplied a selected plan.
export const TRIAL_PLAN = 'premium'
export const GRACE_PERIOD_DAYS = 7
export const RETENTION_DAYS = 90

export function normalizeSubscriptionPlan(value) {
  const plan = String(value || '').trim().toLowerCase()
  if (plan.includes('premium')) return 'premium'
  if (plan.includes('basic')) return 'basic'
  return ''
}

// Pure projection only. Trusted backend jobs, never browser time, persist state.
export function subscriptionLifecycle(record = {}, now = new Date()) {
  const plan = normalizeSubscriptionPlan(record.subscriptionPlan || record.plan || record.selectedPlan)
  const storedStatus = String(record.subscriptionAccessStatus || record.subscriptionStatus || '').trim().toLowerCase()
  const paymentStatus = String(record.paymentStatus || '').trim().toLowerCase()
  const trial = paymentStatus === 'trial'
  const expiresAt = subscriptionDate(trial ? (record.subscriptionTrialEndsAt || record.subscriptionExpiresAt) : record.subscriptionExpiresAt)
  const graceEndsAt = subscriptionDate(record.subscriptionGraceEndsAt || record.gracePeriodEndDate)
  const retentionEndsAt = subscriptionDate(record.subscriptionRetentionEndsAt || record.retentionEndDate)
  const usedTrial = Boolean(record.subscriptionTrialUsedAt || record.subscriptionTrialStartedAt)
  const paidBefore = Boolean(record.lastPaidSubscriptionPlan || record.paymentId || paymentStatus === 'paid')
  const status = storedStatus || (expiresAt && expiresAt <= now ? 'grace_period' : (trial ? 'trial' : (plan ? 'active' : 'expired')))
  return { plan, status, trial, expiresAt, graceEndsAt, retentionEndsAt,
    isOperational: ['trial', 'active', 'canceled'].includes(status) && (!expiresAt || expiresAt > now)
      || status === 'grace_period' && Boolean(graceEndsAt && graceEndsAt > now),
    trialEligible: !usedTrial && !paidBefore }
}

export function hasActivePaidCycle(record = {}, now = new Date()) {
  const state = subscriptionLifecycle(record, now)
  return Boolean(state.plan && !state.trial && state.expiresAt && state.expiresAt > now && ['active', 'canceled'].includes(state.status))
}
