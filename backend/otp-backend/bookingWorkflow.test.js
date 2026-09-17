import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentDue, afterPaymentStatus, resourceConflict } from './bookingWorkflow.js'
import { registerBookingMilestones } from './bookingMilestones.js'
import fs from 'node:fs'
import vm from 'node:vm'
import { normalized, assertWorkflow, initialPaymentReceived } from './bookingWorkflow.js'

const fixture = (installmentsAllowed) => ({ customerId: 'customer', practitionerId: 'worker', branchId: 'clinic', service: 'Treatment', status: 'Awaiting Payment', approvalStatus: 'Approved', totalAmount: 1000, amountPaid: 0, installmentsAllowed, depositPercent: 30, contract: { terms: 'Clinic terms', status: 'pending' }, resources: [{ id: 'material', kind: 'material', quantity: 1 }], bookingId: 'booking' })

const harness = (appointment) => {
  const records = new Map([['appointments/a', appointment], ['inventoryItems/material', { currentStock: 5 }]])
  const handlers = new Map()
  let sequence = 0
  const firestore = () => ({
    collection: (name) => ({ doc: (id = String(++sequence)) => ({ path: `${name}/${id}`, id }) }),
    runTransaction: async (callback) => {
      const writes = []
      const tx = {
        get: async (ref) => ({ exists: records.has(ref.path), data: () => records.get(ref.path) }),
        update: (ref, value) => writes.push([ref.path, value]),
        set: (ref, value) => writes.push([ref.path, value]),
      }
      const result = await callback(tx)
      writes.forEach(([path, value]) => records.set(path, { ...records.get(path), ...value }))
      return result
    },
  })
  firestore.FieldValue = { serverTimestamp: () => new Date() }
  registerBookingMilestones({ post: (path, auth, handler) => handlers.set(path, handler) }, { admin: { firestore }, requireAuth() {} })
  const call = async (path, uid, body = {}) => {
    const result = { code: 200 }
    await handlers.get(`/appointments/:id/${path}`)({ params: { id: 'a' }, user: { uid, email: `${uid}@test.invalid` }, body }, { status(code) { result.code = code; return this }, json(body) { result.body = body } })
    return result
  }
  return { records, call, current: () => records.get('appointments/a') }
}

for (const installmentsAllowed of [false, true]) {
  test(`${installmentsAllowed ? 'Installment' : 'Full payment'} booking lifecycle`, async () => {
    const h = harness(fixture(installmentsAllowed))
    assert.equal((await h.call('contract/sign', 'customer')).code, 409)
    assert.equal((await h.call('transition', 'worker', { action: 'start' })).code, 409)
    const due = paymentDue(h.current())
    assert.equal(due, installmentsAllowed ? 30000 : 100000)
    h.current().amountPaid = due / 100
    h.current().status = afterPaymentStatus(h.current())
    assert.equal(h.current().status, 'Contract Pending')
    assert.equal((await h.call('contract/sign', 'stranger')).code, 403)
    assert.equal((await h.call('contract/sign', 'customer')).code, 200)
    assert.equal(h.current().status, 'Paid')
    assert.match(h.current().serviceKey, /^\d{6}$/)
    assert.equal((await h.call('verify-service-key', 'customer', { serviceKey: 'wrong' })).code, 403)
    const serviceKey = h.current().serviceKey
    await h.call('verify-service-key', 'customer', { serviceKey })
    assert.equal((await h.call('transition', 'worker', { action: 'start' })).code, 409)
    await h.call('verify-service-key', 'worker', { serviceKey })
    assert.equal(h.current().status, 'Ready to Start')
    assert.equal((await h.call('transition', 'customer', { action: 'start' })).code, 403)
    await h.call('transition', 'worker', { action: 'start' })
    assert.equal(h.current().status, 'Ongoing')
    assert.equal(h.records.get('inventoryItems/material').currentStock, 4)
    assert.equal((await h.call('transition', 'worker', { action: 'start' })).code, 409)
    assert.equal((await h.call('transition', 'customer', { action: 'customer_complete' })).code, 409)
    await h.call('transition', 'worker', { action: 'worker_complete' })
    assert.equal(h.current().status, 'Awaiting Customer Confirmation')
    await h.call('transition', 'customer', { action: 'customer_complete' })
    if (installmentsAllowed) {
      assert.equal(h.current().status, 'Balance Due')
      assert.equal(paymentDue(h.current()), 70000)
      h.current().amountPaid += paymentDue(h.current()) / 100
      h.current().status = afterPaymentStatus(h.current())
    }
    assert.equal(h.current().status, 'Completed')
    assert.equal(paymentDue(h.current()), 0)
    assert.equal((await h.call('verify-service-key', 'worker', { serviceKey })).code, 409)
    assert.equal(h.records.get('inventoryItems/material').currentStock, 4)
  })
}

test('Materials reserve stock; reusable equipment reserves overlapping slots only', () => {
  const inventory = [{ id: 'm', currentStock: 1, name: 'Material' }, { id: 'e', currentStock: 1, name: 'Machine' }]
  const requirements = [{ id: 'm', kind: 'material', quantity: 1 }, { id: 'e', kind: 'equipment', quantity: 1 }]
  const appointments = [{ resources: requirements }]
  assert.match(resourceConflict({ requirements, inventory, appointments, overlaps: () => false }), /Material/)
  appointments[0].materialsConsumed = true
  assert.equal(resourceConflict({ requirements, inventory, appointments, overlaps: () => false }), '')
  assert.match(resourceConflict({ requirements, inventory, appointments, overlaps: () => true }), /Machine/)
})

test('Deposit rounding never underpays fractional cents', () => {
  assert.equal(paymentDue({ totalAmount: 100.01, installmentsAllowed: true, depositPercent: 33 }), 3301)
})

test('Payment endpoint records deposit once and completes after final payment', async () => {
  const source = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8')
  const start = source.indexOf("app.post('/appointments/:id/record-payment'")
  const end = source.indexOf("app.get('/paymongo/checkout-session/:id'", start)
  let handler
  let providerAmount = 30000
  let providerPaid = true
  const appointment = fixture(true)
  let updates = 0
  const ledger = new Map()
  const ref = { get: async () => ({ exists: true, data: () => ({ ...appointment }) }) }
  const db = { collection: (name) => ({ doc: (id) => name === 'appointments' ? ref : { path: name + '/' + id } }), runTransaction: async (callback) => callback({ get: ref.get, update: (_, update) => { Object.assign(appointment, update); updates++ }, set(ref, value) { if (ref.path.startsWith('transactions/')) ledger.set(ref.path, value) } }) }
  const firestore = () => db
  firestore.FieldValue = { serverTimestamp: () => new Date() }
  vm.runInNewContext(source.slice(start, end), {
    app: { post: (path, auth, callback) => { handler = callback } }, requireAuth() {}, assertPayMongoConfigured: () => true,
    admin: { firestore }, normalizeBookingStatus: normalized, normalized, paymentDue, afterPaymentStatus, initialPaymentReceived, assertWorkflow,
    buildPayMongoHeaders: () => ({}), console: { error() {} },
    fetch: async () => ({ ok: true, json: async () => ({ data: { attributes: { paid_at: providerPaid ? 123 : null, metadata: { appointmentId: 'a', customerId: 'customer' }, payments: [{ id: 'payment', attributes: { amount: providerAmount, status: providerPaid ? 'paid' : 'failed' } }] } } }) }),
  })
  const call = async (checkoutSessionId) => {
    let status = 200; let body
    await handler({ params: { id: 'a' }, body: { checkoutSessionId, paymentAgreementAcknowledged: true }, user: { uid: 'customer' } }, { status(value) { status = value; return this }, json(value) { body = value; return this } })
    return { status, body }
  }
  providerPaid = false
  assert.equal((await call('failed')).status, 409)
  assert.equal(updates, 0)
  providerPaid = true
  assert.equal((await call('deposit')).status, 200)
  assert.equal(appointment.status, 'Contract Pending')
  assert.equal(appointment.amountPaid, 300)
  await call('deposit')
  assert.equal(updates, 1)
  Object.assign(appointment, { status: 'Balance Due', contract: { status: 'signed' }, workerCompleted: true, customerCompleted: true })
  providerAmount = 70000
  assert.equal((await call('balance')).status, 200)
  assert.equal(appointment.status, 'Completed')
  assert.equal(appointment.amountPaid, 1000)
  assert.equal(appointment.balance, 0)
  assert.ok(appointment.completedAt)
  await call('balance'); await call('deposit')
  assert.equal(updates, 2)
  assert.equal(ledger.size, 2)
  assert.equal([...ledger.values()].reduce((sum, row) => sum + row.amount, 0), 1000)
})


test('Booking availability uses clinic prices, weekly shifts, stock and worker conflicts', async () => {
  const { prepareBooking } = await import('./bookingResources.js')
  const records = new Map([
    ['productServicePosts/service', { branchId: 'clinic', postType: 'Service', isPublished: true, financeStatus: 'approved', price: 1200, durationMinutes: 60, termsAndConditions: 'Clinic agreement', requiredSupplyIds: ['m'], requiredEquipmentIds: ['e'], allowInstallments: true, depositPercent: 25 }],
    ['users/worker', { branchId: 'clinic', status: 'Active' }],
    ['inventoryItems/m', { branchId: 'clinic', currentStock: 2 }],
    ['inventoryItems/e', { branchId: 'clinic', currentStock: 1 }],
  ])
  const groups = {
    'users/worker/schedules': [{ id: '2099-01-05', assignments: { Monday: 'day' }, assignmentLabels: { Monday: 'Day || 09:00 - 17:00' } }],
    shifts: [{ id: 'day', shiftType: 'Day', start: '09:00', end: '17:00' }],
    appointments: [],
  }
  const collection = (path) => ({ path, doc: (id) => ({ path: path + '/' + id, id, collection: (name) => collection(path + '/' + id + '/' + name) }), where() { return this } })
  const db = { collection }
  const tx = { get: async (ref) => groups[ref.path] ? { docs: groups[ref.path].map((data) => ({ id: data.id, data: () => data })) } : { id: ref.id, exists: records.has(ref.path), data: () => records.get(ref.path) } }
  const minutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
  const getBookingRange = (r) => ({ start: minutes(r.time), end: r.endTime ? minutes(r.endTime) : minutes(r.time) + r.totalServiceDurationMinutes })
  const reservation = { branchId: 'clinic', selectedServiceIds: ['service'], practitionerId: 'worker', date: '2099-01-05', time: '10:00', amount: 1, endTime: '10:01' }
  const run = (changes = {}) => prepareBooking({ tx, db, reservation: { ...reservation, ...changes }, getBookingRange, rangesOverlap: (a,b,c,d) => a < d && c < b })
  const result = await run()
  assert.equal(result.data.amount, 1200)
  assert.equal(result.data.endTime, '11:00')
  assert.equal(result.data.depositPercent, 25)
  assert.equal(result.data.resources.length, 2)
  await assert.rejects(run({ date: '2099-02-30' }), /valid booking date/)
  await assert.rejects(run({ date: '2000-01-01' }), /future booking/)
  await assert.rejects(run({ time: '17:00' }), /assigned shift/)
  records.get('inventoryItems/m').currentStock = 0
  await assert.rejects(run(), /available/)
  records.get('inventoryItems/m').currentStock = 2
  groups.appointments.push({ id: 'other', ...reservation, endTime: '11:00', status: 'Awaiting Payment' })
  await assert.rejects(run(), /already booked/)
})
