import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerFinanceWorkflow } from './financeWorkflow.js'

function fixture({ permissions = ['finance:refunds:manage'], order = {}, request = null } = {}) {
  const h = transactionDb(), routes = new Map()
  h.seed('clinics', 'branch', { ownerId: 'owner' })
  h.seed('customerOrders', 'order-1', {
    branchId: 'branch', customerId: 'customer', customerName: 'Clinic Customer',
    paymentStatus: 'Paid', amountPaid: 1000, total: 1000, status: 'Completed',
    ...(request ? { refundRequestId: 'request-1', refundRequestStatus: 'Pending', status: 'Refund Requested' } : {}),
    ...(order || {}),
  })
  if (request) h.seed('refundRequests', 'request-1', {
    branchId: 'branch', customerId: 'customer', orderId: 'order-1', status: 'Pending',
    orderStatusAtRequest: 'Completed', ...(request || {}),
  })
  registerFinanceWorkflow({
    get: (path, ...handlers) => routes.set(`GET ${path}`, handlers.at(-1)),
    post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)),
  }, {
    admin: h.admin,
    requireAuth() {},
    loadUserContext: async uid => ({ uid, userData: { branchId: 'branch' }, permissions: new Set(permissions) }),
  })
  const call = async (path, body = {}, id = 'order-1', uid = 'finance') => {
    let status = 200, payload
    await routes.get(`POST ${path}`)({ user: { uid }, params: { id }, body }, {
      status(code) { status = code; return this }, json(value) { payload = value; return this },
    })
    return { status, ...payload }
  }
  return { ...h, call }
}

test('refund voucher issuance validates paid amount and atomically records the refund', async () => {
  const h = fixture({ request: { reason: 'Damaged product' } })
  const result = await h.call('/finance/refunds/orders/:id/issue-voucher', {
    refundRequestId: 'request-1', code: 'RF-ORDER-1001', amount: 250, reason: 'Verified damaged item',
  })
  assert.equal(result.status, 200, JSON.stringify(result))
  const order = h.records.get('customerOrders/order-1')
  assert.equal(order.status, 'Refunded')
  assert.equal(order.refundAmount, 250)
  assert.equal(order.refundRequestStatus, 'Approved')
  const vouchers = [...h.records.entries()].filter(([key]) => key.startsWith('refundVouchers/'))
  assert.equal(vouchers.length, 1)
  assert.equal(vouchers[0][1].amount, 250)
  const transactionRows = [...h.records.entries()].filter(([key, row]) => key.startsWith('transactions/') && row.type === 'refund_voucher')
  assert.equal(transactionRows.length, 1, JSON.stringify(transactionRows))
  assert.equal(h.records.get('refundRequests/request-1').status, 'Approved')
})

test('refund issuance rejects unauthorized users, unpaid orders, and over-refunds', async () => {
  const path = '/finance/refunds/orders/:id/issue-voucher'
  const noPermission = fixture({ permissions: ['finance:refunds:view'] })
  assert.equal((await noPermission.call(path, { code: 'RF-1', amount: 1, reason: 'Reason' })).status, 403)
  const unpaid = fixture({ order: { paymentStatus: 'Pending' } })
  assert.equal((await unpaid.call(path, { code: 'RF-2', amount: 1, reason: 'Reason' })).status, 409)
  const excessive = fixture()
  assert.equal((await excessive.call(path, { code: 'RF-3', amount: 1001, reason: 'Reason' })).status, 400)
})

test('an order and voucher code cannot be refunded twice', async () => {
  const h = fixture(), path = '/finance/refunds/orders/:id/issue-voucher'
  const body = { code: 'RF-ORDER-1001', amount: 250, reason: 'Approved refund' }
  assert.equal((await h.call(path, body)).status, 200)
  assert.equal((await h.call(path, body)).status, 409)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('refundVouchers/')).length, 1)
})

test('voucher codes cannot be reused when an older voucher has no normalized code field', async () => {
  const h = fixture()
  h.seed('customerOrders', 'order-2', { branchId: 'branch', customerId: 'customer', paymentStatus: 'Paid', amountPaid: 1000, total: 1000, status: 'Completed' })
  h.seed('refundVouchers', 'legacy-voucher', { branchId: 'branch', code: 'RF-LEGACY-1', amount: 50 })
  const result = await h.call('/finance/refunds/orders/:id/issue-voucher', { code: 'RF-LEGACY-1', amount: 20, reason: 'Duplicate code test' }, 'order-2')
  assert.equal(result.status, 409)
  assert.equal(h.records.get('customerOrders/order-2').refundVoucherId, undefined)
})

test('refund request rejection is permission checked and restores the original order status', async () => {
  const h = fixture({ order: { status: 'Refund Requested', refundRequestId: 'request-1' }, request: { orderStatusAtRequest: 'Delivered' } })
  const result = await h.call('/finance/refunds/orders/:id/reject-request', { refundRequestId: 'request-1', reason: 'Evidence does not support the request.' })
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(h.records.get('customerOrders/order-1').status, 'Delivered')
  assert.equal(h.records.get('refundRequests/request-1').status, 'Rejected')
  const denied = fixture({ permissions: ['finance:refunds:view'], request: {} })
  assert.equal((await denied.call('/finance/refunds/orders/:id/reject-request', { refundRequestId: 'request-1', reason: 'Reason.' })).status, 403)
})
