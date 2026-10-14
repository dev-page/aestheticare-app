import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerSubscriptionTrial } from './subscriptionTrial.js'
import { subscriptionLifecycle, hasActivePaidCycle, TRIAL_DAYS } from '../../shared/subscriptionLifecycle.js'

function fixture(roleKey = 'Owner') {
  const h = transactionDb()
  h.seed('users', 'owner', { subscriptionPlan: 'free', role: 'Owner', status: 'Active', email: 'owner@example.com' })
  h.seed('clinics', 'owner', { subscriptionPlan: 'free', ownerId: 'owner', approvalStatus: 'Approved', isPublished: true })
  let handler
  registerSubscriptionTrial({ post: (path, ...handlers) => { handler = handlers.at(-1) } }, {
    admin: h.admin, requireAuth: () => {}, loadUserContext: async () => ({ roleKey }),
  })
  const call = async () => {
    let status = 200, payload
    const res = { status: code => { status = code; return res }, json: value => { payload = value } }
    await handler({ user: { uid: 'owner' } }, res)
    return { status, ...payload }
  }
  return { ...h, call }
}

test('Premium trial activates atomically, charges nothing and retries retain its original expiry', async () => {
  const h = fixture(), before = Date.now()
  const result = await h.call()
  assert.equal(result.status, 200)
  const user = h.records.get('users/owner'), clinic = h.records.get('clinics/owner')
  assert.equal(user.subscriptionPlan, 'premium')
  assert.equal(clinic.subscriptionPlan, 'premium')
  assert.equal(user.subscriptionTrialPlan, 'premium')
  assert.equal(result.data.plan, 'premium')
  assert.equal(user.paymentStatus, 'trial')
  assert.equal(user.subscriptionStartedAt, null)
  assert.equal(user.paymentId, null)
  assert.equal(user.subscriptionTrialEndsAt.getTime() - user.subscriptionTrialStartedAt.getTime(), TRIAL_DAYS * 86400000)
  assert.ok(user.subscriptionTrialStartedAt.getTime() >= before)
  assert.equal(clinic.isPublished, true)
  assert.equal((await h.call()).data.expiresAt, result.data.expiresAt)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('notifications/')).length, 1)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('planPayments/')).length, 0)
})

test('expiry returns Premium trials and paid plans to Free without a new trial entitlement', async () => {
  const now = new Date('2026-10-13T00:00:00Z')
  for (const paymentStatus of ['trial', 'paid']) {
    const state = subscriptionLifecycle({ subscriptionPlan: 'premium', paymentStatus,
      subscriptionExpiresAt: { seconds: now.getTime() / 1000 }, subscriptionTrialUsedAt: now }, now)
    assert.equal(state.plan, 'free')
    assert.equal(state.trial, false)
    assert.equal(state.trialEligible, false)
    assert.equal(state.expiresAt, null)
  }
  const h = fixture()
  await h.call()
  h.records.get('users/owner').subscriptionExpiresAt = new Date(1)
  h.records.get('clinics/owner').subscriptionExpiresAt = new Date(1)
  assert.equal((await h.call()).status, 409)
})

test('Premium trials allow an immediate paid purchase; paid cycles retain downgrade scheduling', () => {
  const now = new Date('2026-10-13T00:00:00Z')
  const record = { subscriptionPlan: 'premium', subscriptionExpiresAt: new Date(now.getTime() + 86400000) }
  assert.equal(hasActivePaidCycle({ ...record, paymentStatus: 'trial' }, now), false)
  assert.equal(hasActivePaidCycle({ ...record, paymentStatus: 'paid' }, now), true)
  assert.equal(hasActivePaidCycle({ ...record, paymentStatus: 'paid', subscriptionExpiresAt: now }, now), false)
  assert.equal(hasActivePaidCycle({ subscriptionPlan: 'free' }, now), false)
})

test('trial eligibility rejects staff, unapproved clinics and previous paid subscriptions', async () => {
  assert.equal((await fixture('Practitioner').call()).status, 403)
  const unapproved = fixture()
  unapproved.records.get('clinics/owner').approvalStatus = 'Pending'
  assert.equal((await unapproved.call()).status, 403)
  for (const payment of [{ ownerUid: 'owner', status: 'paid' }, { payerEmail: 'owner@example.com', paymongoStatus: 'paid' }]) {
    const h = fixture()
    h.seed('planPayments', 'previous', payment)
    assert.equal((await h.call()).status, 409)
    assert.equal(h.records.get('users/owner').subscriptionPlan, 'free')
  }
  assert.equal(subscriptionLifecycle({ subscriptionPlan: 'free', paymentId: 'previous-payment' }).trialEligible, false)
  assert.equal(subscriptionLifecycle({ subscriptionPlan: 'free', subscriptionTrialUsedAt: new Date() }).trialEligible, false)
})
