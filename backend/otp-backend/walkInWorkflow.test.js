import test from 'node:test'
import assert from 'node:assert/strict'
import { registerWalkInPayments } from './walkInWorkflow.js'
import { registerBookingMilestones } from './bookingMilestones.js'

const signature = { accepted: true, signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=' }
const setup = () => {
  const records = new Map([['appointments/a', { source: 'walk_in', clientId: 'client', customerId: 'client', clientName: 'Walk-in client', customerEmail: 'client@example.test', branchId: 'branch', practitionerId: 'worker', approvalStatus: 'Approved', status: 'Unpaid', totalAmount: 1000, amountPaid: 0, date: '', time: '', contract: { terms: 'Treatment agreement', status: 'pending' }, resources: [], bookingId: 'b' }]])
  const snapshot = ref => ({ exists: records.has(ref.path), data: () => records.get(ref.path) })
  let sequence = 0, emails = 0
  const db = {
    collection: name => ({ doc: (id = String(++sequence)) => { const ref = { id, path: `${name}/${id}` }; ref.get = async () => snapshot(ref); return ref } }),
    runTransaction: async callback => {
      const writes = []
      const result = await callback({ get: async ref => snapshot(ref), set: (ref, data) => writes.push([ref.path, data]), update: (ref, data) => writes.push([ref.path, data]) })
      for (const [key, data] of writes) records.set(key, { ...records.get(key), ...data })
      return result
    },
  }
  const firestore = () => db
  firestore.FieldValue = { serverTimestamp: () => new Date() }
  const handlers = new Map()
  const app = { post: (path, auth, handler) => handlers.set(path, handler) }
  const dependencies = { admin: { firestore }, requireAuth() {}, authorizeClinicAction: async (uid, branch) => {
    if (uid !== 'receptionist' || branch !== 'branch') throw Object.assign(new Error('Forbidden'), { status: 403 })
  } }
  registerBookingMilestones(app, dependencies)
  registerWalkInPayments(app, { ...dependencies, sendReceipt: async () => { emails++; return true }, verifyCheckout: async session => {
    if (session !== 'paid-session') throw Object.assign(new Error('Payment not verified'), { status: 409 })
    return { amount: 100000 }
  } })
  const call = async (action, uid, body = {}) => {
    const response = { code: 200 }
    await handlers.get(`/appointments/:id/${action}`)({ user: { uid }, params: { id: 'a' }, body }, { status(code) { response.code = code; return this }, json(body) { response.body = body } })
    return response
  }
  return { call, records, current: () => records.get('appointments/a'), emails: () => emails }
}
const cash = { method: 'Cash', amount: 1000, tendered: 1200 }

test('walk-in pays first, signs with staff assistance, verifies key, and finishes without customer login', async () => {
  const h = setup()
  assert.equal((await h.call('contract/sign', 'receptionist', signature)).code, 409)
  assert.equal((await h.call('walk-in-payment', 'stranger', cash)).code, 403)
  assert.equal((await h.call('walk-in-payment', 'receptionist', { ...cash, amount: 1 })).code, 400)
  assert.equal((await h.call('walk-in-payment', 'receptionist', { ...cash, tendered: 1 })).code, 400)
  const paid = await h.call('walk-in-payment', 'receptionist', cash)
  assert.equal(paid.code, 200)
  assert.equal(paid.body.data.change, 200)
  assert.equal(h.current().status, 'Paid')
  assert.match(paid.body.data.serviceKey, /^\d{6}$/)
  assert.equal((await h.call('transition', 'worker', { action: 'start' })).code, 409)
  assert.equal((await h.call('contract/sign', 'stranger', signature)).code, 403)
  assert.equal((await h.call('contract/sign', 'receptionist', signature)).code, 200)
  assert.equal(h.current().contract.signatures.client.witnessedBy, 'receptionist')
  assert.equal(h.current().contract.signatures.client.name, 'Walk-in client')
  assert.equal((await h.call('verify-service-key', 'worker', { serviceKey: 'wrong' })).code, 403)
  assert.equal((await h.call('verify-service-key', 'worker', { serviceKey: h.current().serviceKey })).code, 200)
  assert.equal(h.current().status, 'Paid')
  assert.equal((await h.call('transition', 'worker', { action: 'start' })).code, 200)
  assert.equal(h.current().status, 'Ongoing')
  assert.equal((await h.call('transition', 'receptionist', { action: 'worker_complete' })).code, 403)
  assert.equal((await h.call('transition', 'worker', { action: 'worker_complete' })).code, 200)
  assert.equal(h.current().status, 'Completed')
  assert.ok(h.current().completedAt)
  assert.equal(h.current().customerCompleted, undefined)
  const retry = await h.call('walk-in-payment', 'receptionist', cash)
  assert.equal(retry.body.data.serviceKey, paid.body.data.serviceKey)
  assert.equal(retry.body.data.alreadyRecorded, true)
  assert.equal(h.emails(), 1)
  assert.equal([...h.records.keys()].filter(k => k.startsWith('transactions/')).length, 1)
})

test('digital payments require verified provider results and cannot pay an online booking', async () => {
  const h = setup()
  assert.equal((await h.call('walk-in-payment', 'receptionist', { method: 'GCash', amount: 1000, checkoutSessionId: 'unpaid' })).code, 409)
  assert.equal(h.current().status, 'Unpaid')
  assert.equal((await h.call('walk-in-payment', 'receptionist', { method: 'GCash', amount: 1000, checkoutSessionId: 'paid-session' })).code, 200)
  const online = setup()
  online.current().source = 'customer_booking_request'
  assert.equal((await online.call('walk-in-payment', 'receptionist', cash)).code, 409)
})
