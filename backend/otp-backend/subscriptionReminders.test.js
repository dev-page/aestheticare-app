import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { subscriptionDate, subscriptionDateLabel, subscriptionRecord } from '../../shared/subscriptionDates.js'
import { expiryReminderStage, sendSubscriptionReminders, registerSubscriptionReminders } from './subscriptionReminders.js'

const now = new Date('2026-10-13T00:00:00+08:00')
const DAY = 86400000
const expiry = days => new Date(now.getTime() + days * DAY)
function setup(days = 6) {
  const h = transactionDb()
  h.seed('users', 'owner', { role: 'Clinic Owner', subscriptionPlan: 'premium', email: 'owner@example.com', subscriptionExpiresAt: expiry(days) })
  h.seed('clinics', 'owner', { ownerId: 'owner', subscriptionPlan: 'premium', subscriptionExpiresAt: expiry(days) })
  h.seed('clinics', 'branch-two', { ownerId: 'owner', subscriptionPlan: 'premium', subscriptionExpiresAt: expiry(days) })
  const sent = []
  const dependencies = { admin: h.admin, now, websiteUrl: 'https://aestheticare.online', sendEmail: async message => sent.push(message) }
  return { ...h, dependencies, sent }
}

test('subscription dates normalize Unix seconds, milliseconds, Firestore and serialized timestamps', () => {
  const ms = Date.parse('2026-10-12T16:30:00Z')
  for (const value of [ms, ms / 1000, String(ms / 1000), new Date(ms), { seconds: ms / 1000 }, { _seconds: ms / 1000 }, { toDate: () => new Date(ms) }]) {
    assert.equal(subscriptionDate(value)?.getTime(), ms)
    assert.equal(subscriptionDateLabel(value), 'October 13, 2026')
  }
  for (const value of [null, '', 0, 'invalid', new Date('invalid')]) assert.equal(subscriptionDateLabel(value), '-')
})

test('owner billing record wins over stale branch dates; explicit cleared expiry stays cleared', () => {
  const user = { subscriptionPlan: 'free', subscriptionExpiresAt: null }
  assert.equal(subscriptionRecord(user, { subscriptionPlan: 'premium', subscriptionExpiresAt: expiry(6) }).subscriptionExpiresAt, null)
  assert.equal(subscriptionRecord({}, { subscriptionPlan: 'basic' }).subscriptionPlan, 'basic')
  assert.equal(subscriptionRecord({ subscriptionPlan: 'free' }, { subscriptionExpiresAt: expiry(6) }).subscriptionExpiresAt, null)
})

test('reminders select only the current 7, 3 or 1 day threshold and ignore expired or distant dates', () => {
  assert.equal(expiryReminderStage(expiry(7), now), 7)
  assert.equal(expiryReminderStage(expiry(3), now), 3)
  assert.equal(expiryReminderStage(expiry(1), now), 1)
  for (const value of [expiry(8), expiry(0), expiry(-1), null]) assert.equal(expiryReminderStage(value, now), null)
})

test('multiple branches notify and email the owner once per billing period and threshold', async () => {
  const h = setup()
  assert.deepEqual(await sendSubscriptionReminders(h.dependencies), { notifications: 1, emails: 1, failures: 0 })
  assert.deepEqual(await sendSubscriptionReminders(h.dependencies), { notifications: 0, emails: 0, failures: 0 })
  const notification = [...h.records].find(([path]) => path.startsWith('notifications/'))[1]
  assert.equal(notification.recipientUserId, 'owner')
  assert.equal(notification.link, '/account/subscription')
  assert.match(h.sent[0].text, /https:\/\/aestheticare.online\/account\/subscription/)
  assert.equal(h.sent.length, 1)
  assert.deepEqual(await sendSubscriptionReminders({ ...h.dependencies, now: new Date(now.getTime() + 4 * DAY) }), { notifications: 1, emails: 1, failures: 0 })
})

test('failed email retries without recreating notifications or resetting read state', async () => {
  const h = setup()
  assert.deepEqual(await sendSubscriptionReminders({ ...h.dependencies, sendEmail: async () => { throw Error('Provider failure') } }), { notifications: 1, emails: 0, failures: 1 })
  const row = [...h.records].find(([path]) => path.startsWith('notifications/'))[1]
  row.read = true
  assert.deepEqual(await sendSubscriptionReminders(h.dependencies), { notifications: 0, emails: 1, failures: 0 })
  assert.equal(row.read, true)
})

test('overlapping execution skips an email claimed by another execution', async () => {
  const h = setup()
  let other
  const result = await sendSubscriptionReminders({ ...h.dependencies, sendEmail: async () => {
    other = await sendSubscriptionReminders(h.dependencies)
  } })
  assert.deepEqual(other, { notifications: 0, emails: 0, failures: 0 })
  assert.equal(result.emails, 1)
})

test('free plans, expired subscriptions, and a renewed owner with stale branch dates are skipped', async () => {
  for (const change of [{ subscriptionPlan: 'free', subscriptionExpiresAt: null }, { subscriptionExpiresAt: expiry(-1) }, { subscriptionExpiresAt: expiry(30) }]) {
    const h = setup()
    Object.assign(h.records.get('users/owner'), change)
    assert.deepEqual(await sendSubscriptionReminders(h.dependencies), { notifications: 0, emails: 0, failures: 0 })
  }
})

test('missing email configuration still creates a system notification and reports an email failure', async () => {
  const h = setup()
  assert.deepEqual(await sendSubscriptionReminders({ ...h.dependencies, sendEmail: null }), { notifications: 1, emails: 0, failures: 1 })
  assert.deepEqual(await sendSubscriptionReminders(h.dependencies), { notifications: 0, emails: 1, failures: 0 })
})

test('subscription reminder endpoint rejects unauthenticated requests before accessing Firestore', async () => {
  let handler
  registerSubscriptionReminders({ all: (_, value) => { handler = value } }, {})
  const previous = process.env.CRON_SECRET
  process.env.CRON_SECRET = 'test-secret'
  try {
    let status
    const response = { status: value => { status = value; return response }, json: value => value }
    await handler({ get: () => '' }, response)
    assert.equal(status, 401)
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  }
})
