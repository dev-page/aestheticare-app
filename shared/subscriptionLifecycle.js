import { subscriptionDate } from './subscriptionDates.js'

export const TRIAL_DAYS = 14
export const TRIAL_PLAN = 'free-trial'
export const GRACE_PERIOD_DAYS = 7
export const RETENTION_DAYS = 90

export function normalizeSubscriptionPlan(value) {
  const plan = String(value || '').trim().toLowerCase()
  if (plan.includes('free-trial') || plan === 'trial') return TRIAL_PLAN
  if (plan.includes('premium')) return 'premium'
  if (plan.includes('basic')) return 'basic'
  // Legacy `free` values represented an unselected subscription, not a plan.
  return ''
}

// Pure projection only. Trusted backend jobs, never browser time, persist state.
export function subscriptionLifecycle(record = {}, now = new Date()) {
  const storedStatus = String(record.subscriptionAccessStatus || record.subscriptionStatus || '').trim().toLowerCase()
  const paymentStatus = String(record.paymentStatus || '').trim().toLowerCase()
  const trial = paymentStatus === 'trial'
  // A trial is the standalone Free Trial offer, whose entitlement is always Premium.
  // This also upgrades the effective access of legacy trial records that stored Basic.
  const storedPlan = normalizeSubscriptionPlan(record.subscriptionPlan || record.plan || record.selectedPlan)
  // `free-trial` is an offer, not an entitlement on its own. Only a trusted
  // trial activation (`paymentStatus: trial`) grants Premium permissions.
  const plan = trial ? 'premium' : storedPlan === TRIAL_PLAN ? '' : storedPlan
  const expiresAt = subscriptionDate(trial ? (record.subscriptionTrialEndsAt || record.subscriptionExpiresAt) : record.subscriptionExpiresAt)
  const recordedGraceEndsAt = subscriptionDate(record.subscriptionGraceEndsAt || record.gracePeriodEndDate)
  const graceEndsAt = recordedGraceEndsAt || (expiresAt ? new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * 86400000) : null)
  const retentionEndsAt = subscriptionDate(record.subscriptionRetentionEndsAt || record.retentionEndDate)
  const usedTrial = Boolean(record.subscriptionTrialUsedAt || record.subscriptionTrialStartedAt)
  const paidBefore = Boolean(record.lastPaidSubscriptionPlan || record.paymentId || paymentStatus === 'paid')
  const endedCurrentCycle = Boolean(expiresAt && expiresAt <= now)
  const gracePeriodEnded = Boolean(graceEndsAt && graceEndsAt <= now && (endedCurrentCycle || storedStatus === 'grace_period'))
  const status = !plan
    ? 'unsubscribed'
    : gracePeriodEnded
      ? 'expired'
    : storedStatus && !(['trial', 'active', 'canceled'].includes(storedStatus) && endedCurrentCycle)
      ? storedStatus
      : endedCurrentCycle ? 'grace_period' : (trial ? 'trial' : 'active')
  return { plan, status, trial, expiresAt, graceEndsAt, retentionEndsAt,
    isOperational: Boolean(plan) && (['trial', 'active', 'canceled'].includes(status) && (!expiresAt || expiresAt > now)
      || status === 'grace_period' && Boolean(graceEndsAt && graceEndsAt > now)),
    trialEligible: !usedTrial && !paidBefore }
}

export function hasActivePaidCycle(record = {}, now = new Date()) {
  const state = subscriptionLifecycle(record, now)
  return Boolean(state.plan && !state.trial && state.expiresAt && state.expiresAt > now && ['active', 'canceled'].includes(state.status))
}
