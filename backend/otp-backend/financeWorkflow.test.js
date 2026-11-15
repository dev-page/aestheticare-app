import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerFinanceWorkflow } from './financeWorkflow.js'

const fixture = () => {
  const h = transactionDb()
  const routes = new Map()
  registerFinanceWorkflow({
    get: (path, ...handlers) => routes.set(`GET ${path}`, handlers.at(-1)),
    post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)),
  }, {
    admin: h.admin,
    requireAuth() {},
    loadUserContext: async uid => ({ uid, userData: { branchId: 'branch' }, permissions: new Set(['finance:refunds:manage']) }),
  })
  const call = async path => {
    let status = 200, payload
    await routes.get(`POST ${path}`)({ user: { uid: 'finance' }, params: { id: 'order-1' }, body: {} }, {
      status(code) { status = code; return this },
      json(value) { payload = value; return this },
    })
    return { status, ...payload }
  }
  return { ...h, call }
}

test('legacy voucher refund route stays closed with guidance to use settlement', async () => {
  const h = fixture()
  const result = await h.call('/finance/refunds/orders/:id/issue-voucher')
  assert.equal(result.status, 410)
  assert.match(result.error, /refund settlement workflow/)
  assert.equal([...h.records.keys()].some(path => path.startsWith('refundVouchers/')), false)
})

test('legacy refund rejection route directs clinic staff to refresh the current Finance Refunds page', async () => {
  const h = fixture()
  const result = await h.call('/finance/refunds/orders/:id/reject-request')
  assert.equal(result.status, 410)
  assert.match(result.error, /Refresh the Finance Refunds page/)
})
