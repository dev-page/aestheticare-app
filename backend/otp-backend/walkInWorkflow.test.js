import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerWalkInBookings } from './walkInBookings.js'
import { registerWalkInPayments } from './walkInWorkflow.js'
import { registerBookingMilestones } from './bookingMilestones.js'
import * as walkInPaymentRules from './walkInWorkflow.js'

const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const range = row => {
  const minutes = time => /^\d{2}:\d{2}$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
  const start = minutes(row.time), end = row.endTime ? minutes(row.endTime) : start + Number(row.totalServiceDurationMinutes || 60)
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null
}
const fixture = ({ deniedPermissions = [] } = {}) => {
  const h = transactionDb(), routes = new Map(), emails = [], bookingEmails = [], authorizationCalls = []
  let checkoutAttempts = 0
  h.seed('googlePractitionerConnections', 'worker', { active: true })
  h.seed('clinics', 'clinic', { ownerId: 'owner', status: 'Active', isPublished: true })
  for (const id of ['one', 'two']) h.seed('clients', id, { branchId: 'clinic', fullName: id, email: `${id}@test.invalid`, phone: '+639111111111', status: 'Active' })
  for (const id of ['worker', 'other-worker']) {
    h.seed('users', id, { branchId: 'clinic', role: 'Practitioner', fullName: id, status: 'Active' })
    h.seed(`users/${id}/schedules`, 'recurring', { recurring: true, availability: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { start: '08:00', end: '18:00', enabled: true }])) })
  }
  for (const [id, price] of [['facial', 500], ['laser', 700]]) h.seed('productServicePosts', id, { branchId: 'clinic', postType: 'Service', title: id, price, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Treatment terms', sessionCount: 1 })
  const app = { post(path, auth, handler) { routes.set(path, handler) }, get(path, auth, handler) { routes.set(path, handler) } }
  const authorizeClinicAction = async (uid, branch, permission) => {
    authorizationCalls.push(permission)
    if (`${uid}:${branch}` !== 'staff:clinic' || deniedPermissions.includes(permission)) throw Object.assign(Error('Forbidden'), { status: 403 })
  }
  registerWalkInBookings(app, { admin: h.admin, requireAuth() {}, authorizeClinicAction, assertClinicPlanFeature: async () => {}, getBookingRange: range, rangesOverlap: (a, b, c, d) => a < d && c < b, getApprovedLeaveForDate: async () => null, getClinicPoliciesForBranch: async () => ({ policy: {} }), sendBooking: async appointment => bookingEmails.push(appointment.customerEmail) })
  registerWalkInPayments(app, { admin: h.admin, requireAuth() {}, authorizeClinicAction, verifyCheckout: async () => { checkoutAttempts++; throw Error('Unverified checkout') }, sendReceipt: async (email, receipt) => { emails.push({ email, receipt }); return true } })
  registerBookingMilestones(app, { admin: h.admin, requireAuth() {}, authorizeClinicAction })
  const call = async (path, body = {}, params = {}, uid = 'staff') => {
    const result = { code: 200 }
    await routes.get(path)({ user: { uid }, body, params, query: body }, { status(code) { result.code = code; return this }, json(value) { result.body = value } })
    return result
  }
  return { ...h, call, routes, emails, bookingEmails, authorizationCalls, get checkoutAttempts() { return checkoutAttempts } }
}
const row = overrides => ({ clientId: 'one', serviceId: 'facial', practitionerId: 'worker', date: future(5), time: '10:00', ...overrides })
const bookingSignature = 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(40)]).toString('base64')

test('walk-in online checkout requires both booking acceptance and recipient treatment consent', () => {
  assert.equal(typeof walkInPaymentRules.assertWalkInPaymentAgreements, 'function')
  const signed = {
    source: 'walk_in',
    bookingAgreementRequired: true,
    bookingAgreement: { status: 'signed', purpose: 'booking_payment_only' },
    bookingWorkflowVersion: 2,
    contract: { status: 'signed' },
  }

  assert.doesNotThrow(() => walkInPaymentRules.assertWalkInPaymentAgreements(signed))
  assert.throws(() => walkInPaymentRules.assertWalkInPaymentAgreements({ ...signed, contract: { status: 'pending' } }), /treatment agreement/i)
  assert.throws(() => walkInPaymentRules.assertWalkInPaymentAgreements({ ...signed, bookingAgreement: { status: 'pending' } }), /booking terms/i)
  assert.doesNotThrow(() => walkInPaymentRules.assertWalkInPaymentAgreements({ source: 'walk_in' }))
})
const body = appointments => ({ branchId: 'clinic', clientId: 'one', submissionId: '12345678-1234-1234-1234-123456789012', policyAcknowledged: true, bookingAcceptance: { accepted: true, signatureImage: bookingSignature }, appointments })
const create = (h, rows) => h.call('/walk-in/bookings', body(rows))

test('multiple services are saved atomically on separate dates with authoritative prices and individual pending contracts', async () => {
  const h = fixture()
  const result = await create(h, [row({ price: 0, customerEmail: 'forged@test.invalid' }), row({ serviceId: 'laser', date: future(6) })])
  assert.equal(result.code, 200)
  const visits = result.body.data.appointments
  assert.equal(visits.length, 2)
  assert.equal(visits[0].totalAmount, 500)
  assert.equal(visits[1].totalAmount, 700)
  assert.equal(visits[0].customerEmail, 'one@test.invalid')
  assert.ok(visits.every(visit => visit.source === 'walk_in' && visit.status === 'Unpaid' && visit.contract.status === 'pending'))
  assert.equal(h.records.get(`bookings/${result.body.data.bookingId}`).totalAmount, 1200)
  assert.equal(h.records.get(`appointments/${visits[0].parentAppointmentId}`).isBookingOrderParent, true)
})
test('Walk-in rejects online consultations without writes but retains on-site consultations', async () => {
  const h = fixture()
  h.seed('productServicePosts', 'facial', { branchId: 'clinic', postType: 'Consultation', consultationMode: 'online', termsAndConditions: 'Consultation terms', title: 'Consultation', price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', sessionCount: 1 })
  const before = h.records.size
  const result = await create(h, [row({})])
  assert.equal(result.code, 409)
  assert.match(result.body.error, /customer account/)
  assert.equal(h.records.size, before)
  h.records.get('productServicePosts/facial').consultationMode = 'onsite'
  assert.equal((await create(h, [row({})])).code, 200)
})

test('new group walk-ins and mixed service recipients are rejected without writes', async () => {
  const h = fixture(), before = h.records.size
  for (const appointments of [[row({}), row({ clientId: 'two', date: future(6) })], [row({ clientId: 'two' })]]) {
    const result = await create(h, appointments)
    assert.equal(result.code, 400)
    assert.match(result.body.error, /one client/)
    assert.equal(h.records.size, before)
  }
  const explicitGroup = await h.call('/walk-in/bookings', { ...body([row({})]), groupBooking: { guests: [] } })
  assert.equal(explicitGroup.code, 400)
  assert.equal(h.records.size, before)
})

test('a walk-in recipient signs before POS payment and the arranger signature stays separate', async () => {
  const h = fixture()
  const result = await h.call('/walk-in/bookings', { ...body([row({})]), bookingForSomeoneElse: true, booker: { name: 'Friend', phone: '+639222222222', email: 'friend@test.invalid' } })
  assert.equal(result.code, 200)
  const appointment = result.body.data.appointments[0]
  assert.equal(appointment.customerName, 'one')
  assert.equal(appointment.customerEmail, 'one@test.invalid')
  assert.equal(appointment.bookedByName, 'Friend')
  assert.equal(appointment.bookedByPhone, '+639222222222')
  assert.equal(appointment.bookingAgreement.signer.name, 'Friend')
  assert.equal(appointment.bookingAgreement.purpose, 'booking_payment_only')
  assert.equal(appointment.bookingAgreement.signer.witnessedBy, 'staff')
  assert.equal(appointment.bookingAgreement.appointments[0].amount, 500)
  assert.equal(appointment.contract.status, 'pending')
  assert.deepEqual(appointment.contract.signatures, {})
  assert.deepEqual(h.bookingEmails, ['one@test.invalid'])
  const payment = { amount: 500, tendered: 500, method: 'Cash' }
  const unpaidCardAttempt = await h.call('/appointments/:id/walk-in-payment', { amount: 500, method: 'Card', checkoutSessionId: 'not-yet-created' }, { id: appointment.id })
  assert.equal(unpaidCardAttempt.code, 409)
  assert.match(unpaidCardAttempt.body.error, /treatment agreement/i)
  assert.equal(h.checkoutAttempts, 0)
  const unpaidCashAttempt = await h.call('/appointments/:id/walk-in-payment', payment, { id: appointment.id })
  assert.equal(unpaidCashAttempt.code, 409)
  assert.equal(h.records.has(`transactions/walk-in-${appointment.id}`), false)
  const signed = await h.call('/appointments/:id/contract/sign', { accepted: true, signatureImage: bookingSignature }, { id: appointment.id })
  assert.equal(signed.code, 200)
  assert.equal(signed.body.data.status, 'Unpaid')
  assert.equal(signed.body.data.serviceKey, undefined)
  assert.equal(h.records.get(`appointments/${appointment.id}`).serviceKey, null)
  assert.equal(h.records.get(`appointments/${appointment.id}`).status, 'Unpaid')
  assert.equal(h.emails.length, 0)
  const paid = await h.call('/appointments/:id/walk-in-payment', payment, { id: appointment.id })
  assert.equal(paid.code, 200)
  assert.equal(paid.body.data.payerName, 'Friend')
  assert.equal(h.emails[0].email, 'one@test.invalid')
  assert.equal(signed.body.data.contract.signatures.one.name, 'one')
  assert.equal(signed.body.data.contract.signatures.one.email, 'one@test.invalid')
  assert.equal(h.records.get(`appointments/${appointment.id}`).bookingAgreement.signer.name, 'Friend')
  assert.equal(h.records.get(`appointments/${appointment.id}`).contract.status, 'signed')
  assert.equal(h.records.get(`appointments/${appointment.id}`).serviceKey, paid.body.data.serviceKey)
  assert.ok(h.authorizationCalls.includes('appointments:create'))
  assert.ok(h.authorizationCalls.includes('payments:create'))
})

test('booking signatures, acceptance, and arranger contacts are required without partial writes', async () => {
  const h = fixture(), before = h.records.size
  for (const extra of [
    { bookingAcceptance: null },
    { bookingAcceptance: { accepted: false, signatureImage: bookingSignature } },
    { bookingAcceptance: { accepted: true, signatureImage: 'forged' } },
    { bookingForSomeoneElse: true, booker: { name: 'Friend', phone: '' } },
    { bookingForSomeoneElse: true, booker: { name: 'Friend', phone: '+639222222222', email: 'invalid' } },
  ]) {
    const result = await h.call('/walk-in/bookings', { ...body([row({})]), ...extra })
    assert.equal(result.code, 400)
    assert.equal(h.records.size, before)
  }
})

test('walk-in creation and POS payment enforce their separate clinic permissions', async () => {
  const noBookingAccess = fixture({ deniedPermissions: ['appointments:create'] })
  const before = noBookingAccess.records.size
  const deniedBooking = await create(noBookingAccess, [row({})])
  assert.equal(deniedBooking.code, 403)
  assert.equal(noBookingAccess.records.size, before)

  const noPaymentAccess = fixture({ deniedPermissions: ['payments:create'] })
  const created = await create(noPaymentAccess, [row({})])
  const appointment = created.body.data.appointments[0]
  const signed = await noPaymentAccess.call('/appointments/:id/contract/sign', { accepted: true, signatureImage: bookingSignature }, { id: appointment.id })
  assert.equal(signed.code, 200)
  const payment = await noPaymentAccess.call('/appointments/:id/walk-in-payment', { amount: 500, tendered: 500, method: 'Cash' }, { id: appointment.id })
  assert.equal(payment.code, 403)
  assert.equal(noPaymentAccess.records.has(`transactions/walk-in-${appointment.id}`), false)
})

test('POS queue restores only unpaid walk-ins and omits codes, signatures, and clinical notes', async () => {
  const h = fixture()
  assert.equal(typeof h.routes.get('/walk-in/pos'), 'function')
  const created = await create(h, [row({})])
  const appointment = created.body.data.appointments[0]
  const stored = h.records.get(`appointments/${appointment.id}`)
  stored.serviceKey = '482913'
  stored.treatmentNotes = 'private notes'
  stored.resources = [{ id: 'stock-item', quantity: 2 }]
  stored.contract.signatures = { one: { signatureImage: 'private signature', name: 'one' } }
  h.seed('appointments', 'already-paid', { branchId: 'clinic', source: 'walk_in', status: 'Paid', paymentStatus: 'Paid', totalAmount: 500 })
  h.seed('appointments', 'booking-parent', { branchId: 'clinic', source: 'walk_in', status: 'Unpaid', paymentStatus: 'Pending', isBookingOrderParent: true, totalAmount: 500 })
  h.seed('appointments', 'other-branch', { branchId: 'other', source: 'walk_in', status: 'Unpaid', paymentStatus: 'Pending', totalAmount: 500 })

  const response = await h.call('/walk-in/pos', { branchId: 'clinic' })
  assert.equal(response.code, 200)
  assert.equal(response.body.data.appointments.length, 1)
  const queued = response.body.data.appointments[0]
  assert.equal(queued.id, appointment.id)
  assert.equal(queued.totalAmount, 500)
  assert.match(queued.contract.terms, /Treatment terms/)
  assert.equal(queued.contract.status, 'pending')
  assert.equal(queued.serviceKey, undefined)
  assert.equal(queued.contract.signatures, undefined)
  assert.equal(queued.treatmentNotes, undefined)
  assert.equal(queued.resources, undefined)
  assert.ok(h.authorizationCalls.includes('appointments:view'))
  assert.ok(h.authorizationCalls.includes('payments:create'))
  assert.equal((await h.call('/walk-in/pos', { branchId: 'clinic' }, {}, 'outsider')).code, 403)
})

test('new walk-in payments require booking acceptance while legacy appointments remain payable', async () => {
  const h = fixture(), result = await create(h, [row({})]), appointment = result.body.data.appointments[0]
  h.records.get(`appointments/${appointment.id}`).bookingAgreement.status = 'pending'
  const pay = () => h.call('/appointments/:id/walk-in-payment', { amount: 500, tendered: 500, method: 'Cash' }, { id: appointment.id })
  assert.equal((await pay()).code, 409)
  assert.equal(h.records.has(`transactions/walk-in-${appointment.id}`), false)
  delete h.records.get(`appointments/${appointment.id}`).bookingAgreementRequired
  delete h.records.get(`appointments/${appointment.id}`).bookingWorkflowVersion
  assert.equal((await pay()).code, 200)
})

test('same-person same-day services are rejected without partial writes', async () => {
  const h = fixture(), before = h.records.size
  const result = await create(h, [row({}), row({ serviceId: 'laser', time: '12:00' })])
  assert.equal(result.code, 409)
  assert.equal(h.records.size, before)
})

test('each service may have its own lead while support staff remain assigned through the treatment team workflow', async () => {
  const h = fixture()
  const result = await create(h, [row({}), row({ practitionerId: 'other-worker', date: future(6) })])
  assert.equal(result.code, 200)
  const visits = result.body.data.appointments
  assert.equal(visits[0].assignedPractitionerId, 'worker')
  assert.equal(visits[1].assignedPractitionerId, 'other-worker')
  assert.deepEqual(visits[0].treatmentTeam, [])
  assert.ok(visits.every(visit => !visit.isGroupRecipient && !visit.groupBookingId))
  assert.equal([...h.records.keys()].some(key => key.startsWith('groupBookings/')), false)
})

test('materials must cover the whole booking even on separate dates', async () => {
  const h = fixture()
  h.records.get('productServicePosts/facial').requiredSupplyIds = ['supply']
  h.seed('inventoryItems', 'supply', { branchId: 'clinic', currentStock: 1, name: 'Supply' })
  const before = h.records.size
  const result = await create(h, [row({}), row({ date: future(6) })])
  assert.equal(result.code, 409)
  assert.match(result.body.error, /materials/)
  assert.equal(h.records.size, before)
})
test('simultaneous appointments cannot overbook shared equipment', async () => {
  const h = fixture()
  h.records.get('productServicePosts/facial').requiredEquipmentIds = ['machine']
  h.seed('inventoryItems', 'machine', { branchId: 'clinic', currentStock: 1, name: 'Machine' })
  h.seed('appointments', 'busy-machine', { branchId: 'clinic', customerId: 'two', customerEmail: 'two@test.invalid', practitionerId: 'other-worker', date: future(5), time: '10:00', endTime: '10:30', status: 'Paid', resources: [{ id: 'machine', kind: 'equipment', quantity: 1 }] })
  const result = await create(h, [row({})])
  assert.equal(result.code, 409)
  assert.match(result.body.error, /unavailable|equipment/i)
})
test('retrying the same submission returns existing appointments and does not repeat booking emails', async () => {
  const h = fixture(), rows = [row({}), row({ date: future(6) })]
  const first = await create(h, rows), before = h.records.size
  const second = await create(h, rows)
  assert.equal(second.code, 200)
  assert.equal(second.body.data.alreadyCreated, true)
  assert.deepEqual(second.body.data.appointments.map(row => row.id), first.body.data.appointments.map(row => row.id))
  assert.equal(h.records.size, before)
  assert.equal(h.bookingEmails.length, 2)
  const changed = await create(h, [row({ date: future(7) })])
  assert.equal(changed.code, 409)
})
test('payments issue separate receipts and keys, email the actual recipient, and update totals after each payment', async () => {
  const h = fixture()
  const created = await create(h, [row({}), row({ date: future(6), practitionerId: 'other-worker', serviceId: 'laser' })])
  const { appointments, bookingId } = created.body.data
  for (const appointment of appointments) {
    const signed = await h.call('/appointments/:id/contract/sign', { accepted: true, signatureImage: bookingSignature }, { id: appointment.id })
    assert.equal(signed.code, 200)
    assert.equal(h.records.get(`appointments/${appointment.id}`).serviceKey, null)
  }
  const pay = (visit, tendered) => h.call('/appointments/:id/walk-in-payment', { amount: visit.totalAmount, tendered, method: 'Cash' }, { id: visit.id })
  const first = await pay(appointments[0], 1000)
  assert.equal(first.code, 200)
  assert.equal(first.body.data.change, 500)
  assert.equal(h.records.get(`bookings/${bookingId}`).status, 'Partially Paid')
  assert.equal(h.records.get(`appointments/${appointments[0].parentAppointmentId}`).amountPaid, 500)
  assert.equal(h.records.get(`appointments/${appointments[1].id}`).serviceKey, null)
  const second = await pay(appointments[1], 700)
  assert.equal(second.code, 200)
  assert.ok(/^\d{6}$/.test(second.body.data.serviceKey))
  assert.equal(h.records.get(`appointments/${appointments[0].parentAppointmentId}`).paymentStatus, 'Paid')
  assert.equal(h.records.get(`bookings/${bookingId}`).amountPaid, 1200)
  assert.deepEqual(h.emails.map(entry => entry.email), ['one@test.invalid', 'one@test.invalid'])
  const again = await pay(appointments[0], 1000)
  assert.equal(again.body.data.serviceKey, first.body.data.serviceKey)
  assert.equal(h.emails.length, 2)
  assert.equal(h.records.get(`bookings/${bookingId}`).amountPaid, 1200)
})
test('client branch membership, email, and policy acknowledgement are enforced', async () => {
  for (const change of [{ branchId: 'other' }, { email: '' }, { status: 'Inactive' }]) {
    const h = fixture()
    Object.assign(h.records.get('clients/one'), change)
    assert.notEqual((await create(h, [row({})])).code, 200)
  }
  const h = fixture()
  assert.equal((await h.call('/walk-in/bookings', { ...body([row({})]), policyAcknowledged: false })).code, 422)
})
test('multi-session services create future session records while consultations remain individual', async () => {
  const h = fixture()
  h.records.get('productServicePosts/facial').sessionCount = 3
  const result = await create(h, [row({})])
  const id = result.body.data.appointments[0].id
  assert.equal(h.records.get(`treatmentSessions/${id}-1`).status, 'Scheduled')
  assert.equal(h.records.get(`treatmentSessions/${id}-2`).status, 'Unscheduled')
  assert.equal(h.records.get(`treatmentSessions/${id}-3`).practitionerId, '')
})

test('Walk-In availability exposes scheduling data but excludes codes, contracts, and medical notes', async () => {
  const h = fixture()
  h.seed('appointments', 'private', { branchId: 'clinic', date: future(5), time: '10:00', practitionerId: 'worker', customerId: 'one', status: 'Paid', serviceKey: '123456', contract: { signatures: { one: 'private' } }, treatmentNotes: 'private notes', treatmentTeam: [{ employeeId: 'other-worker', privateRate: 500 }] })
  const response = await h.call('/walk-in/availability', { branchId: 'clinic' })
  assert.equal(response.code, 200)
  const appointment = response.body.data.appointments[0]
  assert.equal(appointment.practitionerId, 'worker')
  assert.deepEqual(appointment.treatmentTeam, [{ employeeId: 'other-worker' }])
  assert.equal(appointment.serviceKey, undefined)
  assert.equal(appointment.contract, undefined)
  assert.equal(appointment.treatmentNotes, undefined)
  assert.equal((await h.call('/walk-in/availability', { branchId: 'clinic' }, {}, 'outsider')).code, 403)
  assert.equal((await h.call('/walk-in/bookings', body([row({})]), {}, 'outsider')).code, 403)
})

test('each walk-in treatment agreement can be signed separately before its appointment is paid', async () => {
  const h = fixture()
  const result = await create(h, [row({}), row({ date: future(6), practitionerId: 'other-worker' })])
  const [first, second] = result.body.data.appointments
  const signatureImage = 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(40)]).toString('base64')
  const sign = id => h.call('/appointments/:id/contract/sign', { accepted: true, signatureImage }, { id })
  const signed = await sign(first.id)
  assert.equal(signed.code, 200)
  assert.equal(signed.body.data.status, 'Unpaid')
  assert.equal(signed.body.data.contract.signatures.one.clientId, 'one')
  assert.equal(signed.body.data.contract.signatures.one.witnessedBy, 'staff')
  assert.equal(h.records.get(`appointments/${second.id}`).contract.status, 'pending')
  const paid = await h.call('/appointments/:id/walk-in-payment', { amount: first.totalAmount, tendered: 500, method: 'Cash' }, { id: first.id })
  assert.equal(paid.code, 200)
  assert.equal(h.records.get(`appointments/${first.id}`).contract.status, 'signed')
  assert.equal(h.records.get(`appointments/${second.id}`).status, 'Unpaid')
  assert.equal(h.records.get(`appointments/${second.id}`).contract.status, 'pending')
})
