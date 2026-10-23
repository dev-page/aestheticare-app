import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentDue, afterPaymentStatus, resourceConflict, resetAppointmentAccess } from './bookingWorkflow.js'
import { registerBookingMilestones } from './bookingMilestones.js'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { registerAppointmentPaymentWebhook } from './appointmentPaymentWebhook.js'
import { normalized, assertWorkflow, initialPaymentReceived } from './bookingWorkflow.js'

const fixture = (installmentsAllowed) => ({ customerId: 'customer', practitionerId: 'worker', branchId: 'clinic', service: 'Treatment', status: 'Awaiting Payment', approvalStatus: 'Approved', totalAmount: 1000, amountPaid: 0, installmentsAllowed, depositPercent: 30, contract: { terms: 'Clinic terms', status: 'pending' }, resources: [{ id: 'material', kind: 'material', quantity: 1 }], bookingId: 'booking' })

const harness = (appointment) => {
  const records = new Map([['appointments/a', appointment], ['inventoryItems/material', { currentStock: 5 }]])
  records.set('users/worker', { branchId: 'clinic', status: 'Active', role: 'Practitioner' })
  const handlers = new Map()
  let sequence = 0
  const firestore = () => ({
    collection: (name) => ({ where: () => ({ collectionName: name }), doc: (id = String(++sequence)) => ({ path: `${name}/${id}`, id }) }),
    runTransaction: async (callback) => {
      const writes = []
      const tx = {
        get: async (ref) => ref.collectionName ? { docs: [...records].filter(([path]) => path.startsWith(ref.collectionName + '/')).map(([path,value]) => ({ id: path.split('/').at(-1), data: () => value })) } : ({ exists: records.has(ref.path), data: () => records.get(ref.path) }),
        update: (ref, value) => writes.push([ref.path, value]),
        set: (ref, value) => writes.push([ref.path, value]),
      }
      const result = await callback(tx)
      writes.forEach(([path, value]) => records.set(path, { ...records.get(path), ...value }))
      return result
    },
  })
  firestore.FieldValue = { serverTimestamp: () => new Date() }
  registerBookingMilestones({ post: (path, auth, handler) => handlers.set(path, handler) }, { admin: { firestore }, requireAuth() {}, authorizeClinicAction: async uid => { assertWorkflow(['receptionist', 'worker'].includes(uid), 'Check-in permission required.', 403) } })
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
    assert.equal((await h.call('contract/sign', 'customer')).code, 400)
    const signature = { accepted: true, signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=' }
    assert.equal((await h.call('contract/sign', 'stranger', signature)).code, 403)
    assert.equal((await h.call('contract/sign', 'customer', { ...signature, accepted: false })).code, 400)
    assert.equal((await h.call('contract/sign', 'customer', { ...signature, signatureImage: 'invalid' })).code, 400)
    assert.equal((await h.call('contract/sign', 'customer', signature)).code, 200)
    assert.equal(h.current().status, 'Awaiting Payment')
    assert.equal(h.current().contract.signatures.customer.signatureImage, signature.signatureImage)
    assert.equal((await h.call('contract/sign', 'customer', signature)).code, 409)
    assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 409)
    const due = paymentDue(h.current())
    assert.equal(due, installmentsAllowed ? 30000 : 100000)
    h.current().amountPaid = due / 100
    h.current().status = afterPaymentStatus(h.current())
    assert.equal(h.current().status, 'Paid')
    assert.match(h.current().serviceKey, /^\d{6}$/)
    assert.equal((await h.call('verify-service-key', 'customer', { serviceKey: 'wrong' })).code, 403)
    const serviceKey = h.current().serviceKey
    await h.call('verify-service-key', 'customer', { serviceKey })
    assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 409)
    await h.call('verify-service-key', 'receptionist', { serviceKey })
    assert.equal(h.current().status, 'Checked in')
    assert.equal(h.current().checkedInById, 'receptionist')
    assert.equal((await h.call('transition', 'customer', { action: 'start', participantVerified: true })).code, 403)
    await h.call('transition', 'worker', { action: 'start', participantVerified: true })
    assert.equal(h.current().status, 'Ongoing')
    assert.equal(h.records.get('inventoryItems/material').currentStock, 4)
    assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 409)
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

test('Online consultation requires both waiting-room entries and a system meeting before start', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T02:00:00Z') })
  const appointment = {
    ...fixture(false),
    type: 'Consultation',
    consultationMode: 'online',
    status: 'Paid',
    amountPaid: 1000,
    contract: { terms: 'Consultation terms', status: 'signed' },
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()),
    consultationDurationMinutes: 30,
    consultationCodeVerifiedAt: new Date(), consultationCodeVerifiedBy: 'customer',
  }
  const h = harness(appointment)
  h.records.set('appointmentMeetings/a', { meetLink: 'https://meet.google.com/test-meeting', hostVerified: true, practitionerId: 'worker', customerId: 'customer', scheduledStartAt: new Date(`${appointment.date}T${appointment.time}+08:00`).toISOString() })
  delete h.current().consultationCodeVerifiedAt
  assert.equal((await h.call('transition', 'customer', { action: 'join_consultation' })).code, 409)
  h.current().consultationCodeVerifiedAt = new Date()
  h.records.get('appointmentMeetings/a').practitionerId = 'another-worker'
  assert.equal((await h.call('transition', 'customer', { action: 'join_consultation' })).code, 409)
  h.records.get('appointmentMeetings/a').practitionerId = 'worker'
  assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 409)
  assert.equal((await h.call('transition', 'customer', { action: 'join_consultation' })).code, 200)
  assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 409)
  assert.equal((await h.call('transition', 'worker', { action: 'join_consultation' })).code, 200)
  h.records.get('appointmentMeetings/a').hostVerified = false
  assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 409)
  h.records.get('appointmentMeetings/a').hostVerified = true
  assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 200)
  assert.equal(h.current().status, 'Ongoing')
  assert.ok(h.current().startedAt)
  assert.equal(h.records.get('inventoryItems/material').currentStock, 4)
})

test('demo participant can exercise customer and practitioner waiting-room steps from one account', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T02:00:00Z') })
  const appointment = {
    ...fixture(false), customerId: 'worker', assignedPractitionerId: 'worker', practitionerId: 'worker',
    demoMode: true, source: 'demo_online_consultation', type: 'Consultation', consultationMode: 'online',
    status: 'Scheduled', approvalStatus: 'Approved', amount: 0, totalAmount: 0, amountPaid: 0,
    contract: { status: 'signed' }, serviceKey: '123456', consultationCodeVerifiedAt: new Date(),
    consultationCodeVerifiedBy: 'worker', consultationCustomerReadyAt: new Date(), consultationInviteAt: new Date(),
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()),
    consultationDurationMinutes: 15,
  }
  const h = harness(appointment)
  h.records.set('appointmentMeetings/a', { meetLink: 'https://meet.google.com/test-meeting', hostVerified: true, consultationQueueEnabled: true, meetPresenceTrackingEnabled: false, practitionerId: 'worker', customerId: 'worker', scheduledStartAt: new Date(`${appointment.date}T${appointment.time}+08:00`).toISOString() })
  assert.equal((await h.call('transition', 'worker', { action: 'join_consultation', demoParticipantRole: 'practitioner' })).code, 200)
  assert.ok(h.current().practitionerJoinedAt)
  assert.equal(h.current().clientJoinedAt, undefined)
  assert.equal((await h.call('transition', 'worker', { action: 'join_consultation' })).code, 200)
  assert.ok(h.current().clientJoinedAt)
  assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 200)
  assert.equal(h.current().status, 'Ongoing')
})

test('Reassignment revokes old lead aliases while the current assigned practitioner can start', async () => {
  const h = harness({ ...fixture(false), practitionerId: 'old-worker', assignedPractitionerId: 'worker', staffId: 'old-worker', assignedTo: 'old-worker', status: 'Checked in', amountPaid: 1000, workerKeyVerified: true, contract: { status: 'signed' } })
  assert.equal((await h.call('transition', 'old-worker', { action: 'start', participantVerified: true })).code, 403)
  assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 200)
})

test('A changed appointment requires a new code verification and fresh waiting-room entries', async () => {
  const h = harness({ ...fixture(false), type: 'Consultation', consultationMode: 'online', amountPaid: 1000, status: 'Paid', contract: { status: 'signed' }, consultationCodeVerifiedAt: new Date(), consultationCodeVerifiedBy: 'customer', clientJoinedAt: new Date(), practitionerJoinedAt: new Date(), workerKeyVerified: true })
  Object.assign(h.current(), resetAppointmentAccess())
  assert.equal(h.current().clientJoinedAt, null)
  assert.equal(h.current().practitionerJoinedAt, null)
  assert.equal(h.current().workerKeyVerified, false)
  assert.equal((await h.call('transition', 'customer', { action: 'join_consultation' })).code, 409)
  assert.match((await h.call('transition', 'customer', { action: 'join_consultation' })).body.error, /submit their service code/)
})

test('Online completion flags short delivery and preserves earlier review flags', async () => {
  for (const [notes, existingFlag, expected] of [['Treatment recorded.', true, true], ['Treatment recorded.', false, true]]) {
    const h = harness({ ...fixture(false), type: 'Consultation', consultationMode: 'online', amountPaid: 1000, status: 'Ongoing', date: '2026-10-12', time: '10:00', startedAt: new Date(Date.now() - 120000), treatmentTeam: [], consultationNeedsReview: existingFlag })
    assert.equal((await h.call('transition', 'worker', { action: 'worker_complete', treatmentNotes: notes })).code, 200)
    assert.equal(h.current().consultationNeedsReview, expected)
    assert.equal(h.current().status, 'Awaiting Customer Confirmation')
  }
})

test('Reception check-in requires an authorized actor, identity evidence, and an unused code', async () => {
  const h = harness({ ...fixture(false), amountPaid: 1000, status: 'Paid', contract: { status: 'signed' }, serviceKey: '123456' })
  assert.equal((await h.call('verify-service-key', 'stranger', { serviceKey: '123456' })).code, 403)
  assert.equal((await h.call('verify-service-key', 'receptionist', { serviceKey: '654321' })).code, 403)
  assert.equal((await h.call('transition', 'receptionist', { action: 'manual_check_in', reason: 'ID' })).code, 400)
  assert.equal((await h.call('transition', 'receptionist', { action: 'manual_check_in', reason: 'Verified attendee photo ID; their email was unavailable.' })).code, 200)
  assert.equal(h.current().status, 'Checked in')
  assert.match(h.current().manualCheckInReason, /photo ID/)
  assert.equal((await h.call('verify-service-key', 'receptionist', { serviceKey: '123456' })).code, 409)
  assert.equal((await h.call('transition', 'receptionist', { action: 'start', participantVerified: true })).code, 403)
  assert.equal((await h.call('transition', 'worker', { action: 'start', participantVerified: true })).code, 200)
})

test('An old on-site check-in cannot start a service after its appointment window', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T02:00:00Z') })
  const h = harness({ ...fixture(false), bookingWorkflowVersion: 2, date: '2026-10-11', time: '10:00', endTime: '11:00', status: 'Checked in', amountPaid: 1000, workerKeyVerified: true, contract: { status: 'signed' } })
  const result = await h.call('transition', 'worker', { action: 'start' })
  assert.equal(result.code, 409)
  assert.match(result.body.error, /expired/)
  assert.equal(h.current().startedAt, undefined)
  assert.equal(h.records.get('inventoryItems/material').currentStock, 5)
})

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
  const start = source.indexOf('const recordAppointmentPayment = async')
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
    registerAppointmentPaymentWebhook() {},
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
  let webhook
  registerAppointmentPaymentWebhook({ post: (_path, callback) => { webhook = callback } }, {
    admin: { firestore }, recordPayment: handler, getSecret: () => 'webhook-test-secret', getMode: () => 'test',
  })
  const notify = async () => {
    const rawBody = Buffer.from(JSON.stringify({ data: { attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: 'deposit', attributes: { metadata: { appointmentId: 'a', customerId: 'customer' } } } } } }))
    const time = Math.floor(Date.now() / 1000)
    const signature = crypto.createHmac('sha256', 'webhook-test-secret').update(`${time}.`).update(rawBody).digest('hex')
    let code = 200, body
    await webhook({ rawBody, get: () => `t=${time},te=${signature},li=` }, { status(value) { code = value; return this }, json(value) { body = value; return this } })
    return { code, body }
  }
  // Payment is recorded without a browser return, including duplicate delivery.
  assert.equal((await notify()).code, 200)
  assert.equal((await notify()).body.success, true)
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
    ['users/worker', { branchId: 'clinic', status: 'Active', role: 'Practitioner' }],
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
