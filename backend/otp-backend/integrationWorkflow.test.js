import test from 'node:test'
import assert from 'node:assert/strict'
import { registerPayrollWorkflow } from './payrollWorkflow.js'
import { recordVerifiedOrder, registerOrderWorkflow, lockOrderCancellation, finalizeCancelledOrder } from './orderWorkflow.js'

const harness = (seed) => {
  const records = new Map(Object.entries(seed)), routes = new Map()
  let serial = 0, queue = Promise.resolve()
  const ref = (path) => ({ path, id: path.split('/').pop(), collection: (name) => collection(path + '/' + name) })
  const collection = (path, filters = []) => ({ path, filters, doc: (id = 'auto' + ++serial) => ref(path + '/' + id), where: (key, op, value) => collection(path, [...filters, [key, value]]) })
  const snap = (path, data) => ({ id: path.split('/').pop(), ref: ref(path), exists: data !== undefined, data: () => data === undefined ? undefined : structuredClone(data) })
  const db = { collection, runTransaction(fn) {
    const run = queue.then(async () => {
      const writes = []
      const tx = {
        async get(target) {
          assert.equal(writes.length, 0, 'All transaction reads must precede writes')
          if (target.filters) return { docs: [...records].filter(([path, data]) => path.startsWith(target.path + '/') && path.split('/').length === target.path.split('/').length + 1 && target.filters.every(([key, value]) => data[key] === value)).map(([path, data]) => snap(path, data)) }
          return snap(target.path, records.get(target.path))
        },
        update: (target, data) => { assert.ok(records.has(target.path)); writes.push([target.path, data, true]) },
        set: (target, data, options) => writes.push([target.path, data, options?.merge]),
      }
      const result = await fn(tx)
      for (const [path, data, merge] of writes) records.set(path, { ...(merge ? records.get(path) : {}), ...structuredClone(data) })
      return result
    })
    queue = run.catch(() => {})
    return run
  } }
  const firestore = () => db
  const timestamp = () => new Date('2026-09-17T04:00:00Z')
  firestore.FieldValue = { serverTimestamp: timestamp }
  const contexts = {
    procurement: { uid: 'procurement', roleKey: 'Manager', userData: { branchId: 'clinic' }, permissions: new Set(['procurement:review', 'orders:update']) },
    finance: { uid: 'finance', roleKey: 'Finance', userData: { branchId: 'clinic' }, permissions: new Set(['finance:payables:approve', 'finance:payables:settle', 'payroll:approve']) },
    hr: { uid: 'hr', roleKey: 'HR', userData: { branchId: 'clinic' }, permissions: new Set(['payroll:update']) },
    outsider: { uid: 'outsider', roleKey: 'Manager', userData: { branchId: 'other' }, permissions: new Set(['procurement:review', 'orders:update']) },
  }
  const app = { post(path, auth, handler) { routes.set(path, handler) } }
  const deps = { admin: { firestore }, requireAuth() {}, loadUserContext: async (uid) => contexts[uid], buildPayMongoHeaders() {} }
  registerPayrollWorkflow(app, deps); registerOrderWorkflow(app, deps)
  const call = async (path, uid, params, body = {}) => {
    const result = { code: 200 }
    await routes.get(path)({ user: { uid }, params, body }, { status(code) { result.code = code; return this }, json(data) { result.body = data } })
    return result
  }
  return { records, db, timestamp, call }
}
const base = () => ({ 'clinics/clinic': { ownerId: 'owner' }, 'users/finance': { branchId: 'clinic', role: 'Finance' } })

const orderSeed = (stock) => ({ ...base(), 'inventoryItems/i': { branchId: 'clinic', currentStock: stock }, 'orderCheckouts/cs_test': { branchId: 'clinic', customerId: 'customer', total: 100, items: [{ id: 'product', inventoryItemId: 'i', branchId: 'clinic', name: 'Oil', price: 50, quantity: 2 }], delivery: { fullName: 'Customer' }, referenceNumber: 'ORD-12345' } })
const paidAttributes = () => ({ metadata: { customerId: 'customer', module: 'customer_order' }, payments: [{ id: 'pay_test', attributes: { status: 'paid', amount: 10000 } }] })
test('Verified order payment records one sale and deducts stock once across retries', async () => {
  const h = harness(orderSeed(5))
  const record = () => recordVerifiedOrder({ db: h.db, timestamp: h.timestamp, sessionId: 'cs_test', customerId: 'customer', attributes: paidAttributes() })
  await Promise.all([record(), record()])
  assert.equal(h.records.get('inventoryItems/i').currentStock, 3)
  assert.equal(h.records.get('transactions/order-cs_test').amount, 100)
  assert.equal(h.records.get('customerOrders/cs_test').status, 'Preparing')
})
test('Paid order retains payment and alerts clinic if stock changes; replenishment resumes fulfillment', async () => {
  const h = harness(orderSeed(1))
  await recordVerifiedOrder({ db: h.db, timestamp: h.timestamp, sessionId: 'cs_test', customerId: 'customer', attributes: paidAttributes() })
  assert.equal(h.records.get('customerOrders/cs_test').status, 'Awaiting Stock')
  assert.equal(h.records.get('inventoryItems/i').currentStock, 1)
  assert.equal((await h.call('/logistics/customer-orders/:id/transition', 'procurement', { id: 'cs_test' }, { nextStatus: 'Preparing' })).code, 409)
  h.records.get('inventoryItems/i').currentStock = 5
  assert.equal((await h.call('/logistics/customer-orders/:id/transition', 'procurement', { id: 'cs_test' }, { nextStatus: 'Preparing' })).code, 200)
  assert.equal(h.records.get('inventoryItems/i').currentStock, 3)
})
test('Unpaid or mismatched payments cannot create an order', async () => {
  const h = harness(orderSeed(5)), attributes = paidAttributes()
  attributes.payments[0].attributes.status = 'failed'
  await assert.rejects(recordVerifiedOrder({ db: h.db, timestamp: h.timestamp, sessionId: 'cs_test', customerId: 'customer', attributes }), /not confirmed/)
  assert.equal(h.records.has('customerOrders/cs_test'), false)
})
test('Products cannot consume materials already reserved for an active service', async () => {
  const h = harness({ ...orderSeed(3), 'appointments/a': { branchId: 'clinic', status: 'Paid', resources: [{ id: 'i', kind: 'material', quantity: 2 }] } })
  await recordVerifiedOrder({ db: h.db, timestamp: h.timestamp, sessionId: 'cs_test', customerId: 'customer', attributes: paidAttributes() })
  assert.equal(h.records.get('customerOrders/cs_test').status, 'Awaiting Stock')
  assert.equal(h.records.get('inventoryItems/i').currentStock, 3)
})
test('Cancellation blocks fulfillment and restores deducted stock once with one refund record', async () => {
  const h = harness(orderSeed(5))
  await recordVerifiedOrder({ db: h.db, timestamp: h.timestamp, sessionId: 'cs_test', customerId: 'customer', attributes: paidAttributes() })
  await lockOrderCancellation(h.db, 'cs_test', 'customer')
  assert.equal((await h.call('/logistics/customer-orders/:id/transition', 'procurement', { id: 'cs_test' }, { nextStatus: 'Packed' })).code, 409)
  const cancel = () => finalizeCancelledOrder({ db: h.db, timestamp: h.timestamp, orderId: 'cs_test', update: { status: 'Cancelled', paymentStatus: 'Refunded', refundAmount: 100, paymongoRefundId: 'refund' } })
  await cancel(); await cancel()
  assert.equal(h.records.get('inventoryItems/i').currentStock, 5)
  assert.equal(h.records.get('transactions/refund-cs_test').amount, -100)
})

test('Payroll requires Finance-approved snapshot; repeat release creates only one payslip', async () => {
  const h = harness({ ...base(), 'payrollSummaries/clinic_2026-09': { branchId: 'clinic', monthKey: '2026-09', status: 'pending', totalNetPay: 900, updatedBy: 'hr' }, 'payrolls/p': { branchId: 'clinic', employeeId: 'worker', employeeName: 'Worker', payPeriodMonthKey: '2026-09', totalPay: 1000, netPay: 900, totalDeductions: 100 } })
  assert.equal((await h.call('/payroll/:id/release', 'hr', { id: 'p' })).code, 409)
  assert.equal((await h.call('/finance/payroll/:id/approve', 'hr', { id: 'clinic_2026-09' })).code, 403)
  assert.equal((await h.call('/finance/payroll/:id/approve', 'finance', { id: 'clinic_2026-09' })).code, 200)
  // The release uses the approved snapshot rather than trusting a modified amount.
  h.records.get('payrolls/p').netPay = 1
  assert.equal((await h.call('/payroll/:id/release', 'hr', { id: 'p' })).code, 200)
  assert.equal((await h.call('/payroll/:id/release', 'hr', { id: 'p' })).code, 200)
  assert.equal(h.records.get('payslips/p').netPay, 900)
  assert.deepEqual(h.records.get('payslips/p'), h.records.get('users/worker/payslips/p'))
  assert.equal(h.records.get('payrollSummaries/clinic_2026-09').releasedCount, 1)
})
test('HR submission and Finance rejection notify the assigned branch participants', async () => {
  const h = harness({ ...base(), 'payrolls/p': { branchId: 'clinic', employeeId: 'worker', payPeriodMonthKey: '2026-09', totalPay: 1000, totalDeductions: 100, netPay: 900 } })
  assert.equal((await h.call('/payroll/summaries/:id/submit', 'hr', { id: 'clinic_2026-09' }, { branchId: 'clinic', monthKey: '2026-09', payrollEntryIds: ['p'] })).code, 200)
  assert.equal(h.records.get('payrollSummaries/clinic_2026-09').totalNetPay, 900)
  assert.equal((await h.call('/finance/payroll/:id/reject', 'finance', { id: 'clinic_2026-09' }, { reason: 'Correct hours' })).code, 200)
  assert.equal(h.records.get('payrollSummaries/clinic_2026-09').status, 'rejected')
  const notifications = [...h.records].filter(([path]) => path.startsWith('notifications/')).map(([, record]) => record)
  assert.ok(notifications.some((n) => n.recipientUserId === 'finance'))
  assert.ok(notifications.some((n) => n.recipientUserId === 'hr'))
})
