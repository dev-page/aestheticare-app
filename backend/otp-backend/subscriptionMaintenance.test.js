import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { transactionDb } from './testTransactionDb.js'
import { normalizeSubscriptionPlan } from '../../shared/subscriptionLifecycle.js'
import { subscriptionDate } from '../../shared/subscriptionDates.js'
const { runSubscriptionMaintenance } = createRequire(import.meta.url)('../functions/subscriptionMaintenance.cjs')
const now = new Date('2026-10-13T00:00:00Z')
function fixture(paymentStatus = 'paid') {
  const h = transactionDb()
  const record = { subscriptionPlan: paymentStatus === 'trial' ? 'premium' : 'basic', paymentStatus, subscriptionExpiresAt: new Date(now - 1000),
    ...(paymentStatus === 'trial' ? { subscriptionTrialUsedAt: new Date(now - 86400000) } : {}) }
  h.seed('users', 'owner', record)
  for (const id of ['owner', 'branch']) h.seed('clinics', id, { ...record, ownerId: 'owner', isPublished: true })
  h.seed('appointments', 'existing', { branchId: 'owner', status: 'Paid' })
  const run = () => runSubscriptionMaintenance({ admin: h.admin, now,
    normalizePlanKey: value => value ? normalizeSubscriptionPlan(value) : '', toDate: subscriptionDate,
    getPlanDurationDays: () => 30, clearPendingSubscriptionFields: () => ({ pendingSubscriptionPlan: null }) })
  return { ...h, run }
}

for (const paymentStatus of ['paid', 'trial']) test(`${paymentStatus} expiry changes owner and branches together, retains records and notifies only once`, async () => {
  const h = fixture(paymentStatus)
  assert.equal((await h.run()).updated, 3)
  for (const key of ['users/owner', 'clinics/owner', 'clinics/branch']) {
    const record = h.records.get(key)
    assert.equal(record.subscriptionPlan, 'free')
    assert.equal(record.subscriptionAccessStatus, 'active')
    assert.equal(record.subscriptionExpiresAt, null)
    if (paymentStatus === 'trial') {
      assert.ok(record.subscriptionTrialUsedAt)
      assert.equal(record.lastPaidSubscriptionPlan, undefined)
    } else assert.equal(record.lastPaidSubscriptionPlan, 'basic')
  }
  assert.equal(h.records.get('clinics/owner').isPublished, true)
  assert.equal(h.records.get('appointments/existing').status, 'Paid')
  const notification = [...h.records].find(([key]) => key.startsWith('notifications/'))[1]
  notification.read = true
  assert.equal((await h.run()).updated, 0)
  assert.equal(notification.read, true)
})

test('a scheduled paid cycle takes effect before the old cycle expires', async () => {
  const h = fixture()
  Object.assign(h.records.get('users/owner'), { pendingSubscriptionPlan: 'premium', pendingSubscriptionApplyAt: now,
    pendingSubscriptionPaymentId: 'verified-payment', pendingSubscriptionNextExpiresAt: new Date(now.getTime() + 30 * 86400000) })
  await h.run()
  assert.equal(h.records.get('users/owner').subscriptionPlan, 'premium')
  assert.equal(h.records.get('users/owner').paymentStatus, 'paid')
  assert.equal(h.records.get('clinics/branch').paymentId, 'verified-payment')
  assert.equal([...h.records.keys()].filter(key => key.startsWith('notifications/')).length, 0)
})

test('maintenance leaves active paid subscriptions intact and restores legacy Free access', async () => {
  const h = fixture()
  for (const key of ['users/owner', 'clinics/owner', 'clinics/branch']) h.records.get(key).subscriptionExpiresAt = new Date(now.getTime() + 86400000)
  assert.equal((await h.run()).updated, 0)
  h.records.get('users/owner').subscriptionPlan = 'free'
  h.records.get('users/owner').subscriptionAccessStatus = 'read_only'
  await h.run()
  assert.equal(h.records.get('users/owner').subscriptionExpiresAt, null)
  assert.equal(h.records.get('clinics/branch').subscriptionAccessStatus, 'active')
})
