import { subscriptionDate } from './subscriptionDates.js'

export const TRIAL_DAYS = 14
export const TRIAL_PLAN = 'premium'
export function normalizeSubscriptionPlan(value) {
  const plan = String(value || '').trim().toLowerCase()
  if (plan.includes('premium')) return 'premium'
  if (plan.includes('basic')) return 'basic'
  return 'free'
}
export function subscriptionLifecycle(record = {}, now = new Date()) {
  const storedPlan = normalizeSubscriptionPlan(record.subscriptionPlan || record.plan)
  const expiry = subscriptionDate(record.subscriptionExpiresAt)
  const expired = storedPlan !== 'free' && expiry && expiry <= now
  const plan = expired ? 'free' : storedPlan
  const trial = plan !== 'free' && String(record.paymentStatus).toLowerCase() === 'trial'
  const usedTrial = Boolean(record.subscriptionTrialUsedAt || record.subscriptionTrialStartedAt)
  const paidBefore = Boolean(record.lastPaidSubscriptionPlan || record.paymentId
    || String(record.paymentStatus).toLowerCase() === 'paid')
  return { plan, storedPlan, expired: Boolean(expired), trial,
    expiresAt: plan === 'free' ? null : expiry,
    trialEligible: storedPlan === 'free' && !usedTrial && !paidBefore }
}

// Trial access never delays a paid purchase, including Premium trial → Basic.
export function hasActivePaidCycle(record = {}, now = new Date()) {
  const state = subscriptionLifecycle(record, now)
  return Boolean(state.plan !== 'free' && !state.trial && state.expiresAt && state.expiresAt > now)
}
