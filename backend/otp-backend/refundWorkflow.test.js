import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerRefundWorkflow } from './refundWorkflow.js'

const defaultOrder = {
  branchId: 'branch', customerId: 'customer', customerName: 'Clinic Customer',
  paymentStatus: 'Paid', source: 'manual', amountPaid: 200, total: 200,
  status: 'Delivered', refundRequestId: 'request-1', refundRequestStatus: 'Requested',
}

const defaultRequest = {
  branchId: 'branch', customerId: 'customer', orderId: 'order-1',
  requestType: 'return', status: 'Requested', amount: 80,
}

const fixture = ({ permissions = ['finance:refunds:manage'], order = {}, request = {} } = {}) => {
  const h = transactionDb()
  const routes = new Map()
  h.seed('clinics', 'branch', { ownerId: 'owner' })
  h.seed('customerOrders', 'order-1', { ...defaultOrder, ...order })
  h.seed('refundRequests', 'request-1', { ...defaultRequest, ...request })
  registerRefundWorkflow({
    post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)),
  }, {
    admin: h.admin,
    requireAuth() {},
    loadUserContext: async uid => ({ uid, userData: { branchId: 'branch' }, permissions: new Set(permissions) }),
    buildPayMongoHeaders: () => ({}),
    finalizeCancelledOrder: async () => {},
  })
  const call = async (path, body = {}, uid = 'finance') => {
    let status = 200, payload
    const handler = routes.get(`POST ${path}`)
    assert.ok(handler, `Expected registered route ${path}`)
    await handler({ user: { uid }, params: { id: 'order-1' }, body }, {
      status(code) { status = code; return this },
      json(value) { payload = value; return this },
    })
    return { status, ...payload }
  }
  return { ...h, call }
}

test('offline settlement records the returned amount once and completes the active refund request', async () => {
  const h = fixture()
  const body = {
    refundRequestId: 'request-1', method: 'offline', amount: 80,
    reason: 'Verified returned item', reference: 'CASH-1024',
  }
  const result = await h.call('/finance/refunds/orders/:id/settle', body)
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.data.status, 'Refunded')
  assert.equal(result.data.method, 'Offline')
  assert.equal(h.records.get('customerOrders/order-1').refundedAmountTotal, 80)
  assert.equal(h.records.get('customerOrders/order-1').paymentStatus, 'Partially Refunded')
  assert.equal(h.records.get('refundRequests/request-1').status, 'Refunded')
  const refunds = [...h.records.values()].filter(row => row.type === 'customer_order_refund')
  assert.equal(refunds.length, 1)
  assert.equal(refunds[0].amount, -80)

  const repeated = await h.call('/finance/refunds/orders/:id/settle', body)
  assert.equal(repeated.status, 409)
  assert.equal([...h.records.values()].filter(row => row.type === 'customer_order_refund').length, 1)
})

test('refund settlement checks permission, eligible amount, and offline reference before writing', async () => {
  const body = {
    refundRequestId: 'request-1', method: 'offline', amount: 80,
    reason: 'Verified returned item', reference: 'CASH-1024',
  }
  const denied = fixture({ permissions: ['finance:refunds:view'] })
  assert.equal((await denied.call('/finance/refunds/orders/:id/settle', body)).status, 403)
  assert.equal(denied.records.get('refundRequests/request-1').status, 'Requested')

  const excessive = fixture()
  assert.equal((await excessive.call('/finance/refunds/orders/:id/settle', { ...body, amount: 81 })).status, 400)
  assert.equal(excessive.records.get('refundRequests/request-1').status, 'Requested')

  const missingReference = fixture()
  assert.equal((await missingReference.call('/finance/refunds/orders/:id/settle', { ...body, reference: '' })).status, 400)
  assert.equal(missingReference.records.get('refundRequests/request-1').status, 'Requested')
})

