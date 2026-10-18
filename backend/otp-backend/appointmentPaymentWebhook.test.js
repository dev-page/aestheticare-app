import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { registerAppointmentPaymentWebhook, verifyPayMongoSignature } from './appointmentPaymentWebhook.js'
import { transactionDb } from './testTransactionDb.js'

const secret = 'test-webhook-secret'
const payload = (overrides = {}) => ({ data: { attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: 'cs_paid', attributes: { metadata: { appointmentId: 'appointment', customerId: 'customer' } } }, ...overrides } } })
const signature = (rawBody, time = Math.floor(Date.now() / 1000), key = 'te') => `t=${time},${key}=${crypto.createHmac('sha256', secret).update(`${time}.`).update(rawBody).digest('hex')}`
const harness = response => {
  const h = transactionDb(), calls = []
  h.seed('appointments', 'appointment', { branchId: 'clinic', status: 'Cancelled' })
  let handler
  registerAppointmentPaymentWebhook({ post: (_path, callback) => { handler = callback } }, {
    admin: h.admin, getSecret: () => secret, getMode: () => 'test',
    recordPayment: async (req, res) => { calls.push(req); res.status(response?.code || 200).json(response?.body || { success: true }) },
  })
  const call = async (event = payload(), header) => {
    const rawBody = Buffer.from(JSON.stringify(event)), result = { code: 200 }
    await handler({ rawBody, get: () => header ?? signature(rawBody) }, { status(code) { result.code = code; return this }, json(body) { result.body = body; return this } })
    return result
  }
  return { ...h, calls, call }
}

test('Webhook signatures reject tampering, stale requests, wrong modes and parsed bodies', () => {
  const rawBody = Buffer.from(JSON.stringify(payload()))
  const verify = overrides => verifyPayMongoSignature({ rawBody, signature: signature(rawBody), secret, mode: 'test', ...overrides })
  assert.equal(verify({}), true)
  assert.equal(verify({ rawBody: Buffer.concat([rawBody, Buffer.from(' ')]) }), false)
  assert.equal(verify({ signature: signature(rawBody, Math.floor(Date.now() / 1000) - 601) }), false)
  assert.equal(verify({ mode: 'live' }), false)
  assert.equal(verify({ rawBody: payload() }), false)
  assert.equal(verify({ secret: '' }), false)
})

test('Only signed appointment checkout payments reach the existing provider verifier', async () => {
  const h = harness()
  assert.equal((await h.call(payload(), 'invalid')).code, 401)
  assert.equal((await h.call(payload({ livemode: true }))).code, 400)
  assert.equal((await h.call(payload({ type: 'payment.failed' }))).body.ignored, true)
  assert.equal((await h.call(payload({ data: { id: 'cs_other', attributes: { metadata: { ownerUid: 'owner' } } } }))).body.ignored, true)
  assert.equal(h.calls.length, 0)
  assert.equal((await h.call()).code, 200)
  assert.equal(h.calls[0].params.id, 'appointment')
  assert.equal(h.calls[0].user.uid, 'customer')
  assert.equal(h.calls[0].body.checkoutSessionId, 'cs_paid')
})

test('Late payments go to reconciliation once and never reopen a cancelled appointment', async () => {
  const h = harness({ code: 409, body: { success: false, error: 'This booking cannot receive payment at this stage.' } })
  assert.equal((await h.call()).body.needsReview, true)
  const count = h.records.size
  assert.equal((await h.call()).body.needsReview, true)
  assert.equal(h.records.size, count)
  assert.equal(h.records.get('appointments/appointment').status, 'Cancelled')
  assert.equal(h.records.get('appointmentPaymentReviews/cs_paid').status, 'Needs Review')
  assert.equal(h.records.get('notifications/payment-review-cs_paid').branchId, 'clinic')
})

test('Temporary provider failures request retry without treating the payment as recorded', async () => {
  const h = harness({ code: 503, body: { success: false } })
  assert.equal((await h.call()).code, 503)
  assert.equal(h.records.has('appointmentPaymentReviews/cs_paid'), false)
})
