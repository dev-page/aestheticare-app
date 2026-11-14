import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerPaymentReceiptWorkflow } from './paymentReceiptWorkflow.js'

function fixture({ payment, now = new Date('2026-11-14T10:00:00Z') } = {}) {
  const h = transactionDb(), routes = new Map(), sent = []
  h.seed('planPayments', 'paymongo-cs_Abc123', {
    source: 'paymongo_checkout', status: 'Paid', paymongoStatus: 'paid',
    paymongoCheckoutSessionId: 'cs_Abc123', payerEmail: 'owner@example.com',
    payerName: 'Clinic Owner', planName: 'Premium', amount: 999, currency: 'PHP',
    paymentMethod: 'gcash', referenceNumber: 'REF-123',
    ...(payment || {}),
  })
  registerPaymentReceiptWorkflow({ post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)) }, {
    admin: h.admin,
    now: () => new Date(now),
    sendEmail: async message => { sent.push(message) },
  })
  const call = async body => {
    let status = 200, payload
    await routes.get('POST /send-payment-receipt')({ body }, {
      status(code) { status = code; return this },
      json(value) { payload = value; return this },
    })
    return { status, ...payload }
  }
  return { ...h, sent, call }
}

test('receipt uses the verified payment record and ignores caller-supplied recipient and amounts', async () => {
  const h = fixture()
  const result = await h.call({ checkoutSessionId: 'cs_Abc123', recipient: 'attacker@example.com', amount: 0.01, planName: 'Fake' })
  assert.equal(result.status, 200)
  assert.equal(h.sent.length, 1)
  assert.equal(h.sent[0].To, 'owner@example.com')
  assert.match(h.sent[0].TextBody, /Premium/)
  assert.match(h.sent[0].TextBody, /₱999\.00/)
})

test('unpaid or mismatched payment records cannot trigger a receipt', async () => {
  for (const payment of [
    { paymongoStatus: 'unpaid' },
    { source: 'manual' },
    { paymongoCheckoutSessionId: 'cs_Other' },
  ]) {
    const h = fixture({ payment })
    const result = await h.call({ checkoutSessionId: 'cs_Abc123' })
    assert.equal(result.status, 409)
    assert.equal(h.sent.length, 0)
  }
})

test('the same verified payment can send a receipt only once', async () => {
  const h = fixture()
  assert.equal((await h.call({ checkoutSessionId: 'cs_Abc123' })).status, 200)
  const duplicate = await h.call({ checkoutSessionId: 'cs_Abc123' })
  assert.equal(duplicate.status, 200)
  assert.equal(duplicate.data.alreadySent, true)
  assert.equal(h.sent.length, 1)
})

test('receipt HTML escapes payment record text', async () => {
  const h = fixture({ payment: { payerName: '<img src=x onerror=alert(1)>', planName: '<script>alert(1)</script>' } })
  await h.call({ checkoutSessionId: 'cs_Abc123' })
  assert.doesNotMatch(h.sent[0].HtmlBody, /<script>|<img/)
  assert.match(h.sent[0].HtmlBody, /&lt;script&gt;/)
})
