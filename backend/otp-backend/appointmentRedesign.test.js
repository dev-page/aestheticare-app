import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { prepareBooking } from './bookingResources.js'
import { registerBookingBatch, validateSchedules } from './bookingBatch.js'
import { registerSupplierVerification, supplierDecision } from './supplierVerification.js'
import { closeExpiredConsultations } from './consultationWindows.js'
import { registerBookingMilestones } from './bookingMilestones.js'
import { hasConsultationRequirement } from '../../shared/consultationRequirements.js'

const range = value => {
  const minutes = time => /^\d{2}:\d{2}$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
  const start = minutes(value.time), end = value.endTime ? minutes(value.endTime) : start + Number(value.totalServiceDurationMinutes || 60)
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null
}
const overlap = (a, b, c, d) => a < d && c < b
const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const fixture = () => {
  const h = transactionDb()
  h.seed('users', 'customer', { role: 'Customer', email: 'customer@test.invalid', fullName: 'Customer' })
  h.seed('users', 'worker', { branchId: 'clinic', role: 'Practitioner', status: 'Active' })
  h.seed('clinics', 'clinic', { isPublished: true, status: 'Active', ownerId: 'owner' })
  h.seed('users/worker/schedules', 'recurring', { recurring: true, availability: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { start: '08:00', end: '18:00', enabled: true }])) })
  for (const id of ['facial', 'laser']) h.seed('productServicePosts', id, { branchId: 'clinic', postType: 'Service', title: id, price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Treatment terms', sessionCount: 1 })
  return h
}
const reservation = (id = 'facial', date = future(5)) => ({ selectedServiceIds: [id], branchId: 'clinic', practitionerId: 'worker', customerId: 'customer', customerName: 'Customer', customerEmail: 'customer@test.invalid', date, time: '10:00', policyAcknowledged: true })
const callRoute = async (handler, uid, body = {}, params = {}) => {
  const result = { code: 200 }
  await handler({ user: { uid, email: `${uid}@test.invalid` }, body, params }, { status(code) { result.code = code; return this }, json(value) { result.body = value } })
  return result
}

test('Linked consultations qualify only after completion in the same branch; approved and legacy clearances remain supported', () => {
  const service = { id: 'facial', branchId: 'clinic', requiresConsultationFirst: true, linkedConsultationId: 'assessment' }
  const visit = { branchId: 'clinic', type: 'Consultation', status: 'Completed', selectedServiceIds: ['assessment'] }
  assert.equal(hasConsultationRequirement(service, [visit]), true)
  assert.equal(hasConsultationRequirement(service, [{ ...visit, status: 'Scheduled' }]), false)
  assert.equal(hasConsultationRequirement(service, [{ ...visit, branchId: 'other' }]), false)
  assert.equal(hasConsultationRequirement(service, [{ ...visit, selectedServiceIds: ['different'], consultationForServiceIds: ['facial'] }]), false)
  assert.equal(hasConsultationRequirement(service, [], [{ branchId: 'clinic', status: 'Approved', serviceIds: ['facial'] }]), true)
  assert.equal(hasConsultationRequirement(service, [], [{ branchId: 'other', status: 'Approved', serviceIds: ['facial'] }]), false)
  assert.equal(hasConsultationRequirement({ ...service, linkedConsultationId: '' }, [{ ...visit, consultationForServiceIds: ['facial'] }]), true)
})

test('Online and walk-in service bookings require the actual linked consultation or approved clearance', async () => {
  const h = fixture()
  h.seed('productServicePosts', 'facial', { branchId: 'clinic', postType: 'Service', title: 'Facial', price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Treatment terms', requiresConsultationFirst: true, linkedConsultationId: 'assessment' })
  const prepare = source => h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: { ...reservation(), source }, getBookingRange: range, rangesOverlap: overlap }))
  for (const source of ['customer_booking_request', 'walk_in']) await assert.rejects(prepare(source), /linked consultation/)
  h.seed('appointments', 'wrong', { customerId: 'customer', branchId: 'clinic', type: 'Consultation', status: 'Completed', selectedServiceIds: ['different'] })
  await assert.rejects(prepare('customer_booking_request'), /linked consultation/)
  h.seed('appointments', 'right', { customerId: 'customer', branchId: 'clinic', type: 'Consultation', status: 'Completed', selectedServiceIds: ['assessment'] })
  for (const source of ['customer_booking_request', 'walk_in']) assert.equal((await prepare(source)).data.service, 'Facial')
})
test('New appointments snapshot the saved clinic contract and its applicable policies', async () => {
  const h = fixture()
  h.seed('clinicPolicies', 'owner', { paymentPolicyEnabled: true, paymentPolicy: 'Pay the required deposit.', cancellationPolicyEnabled: false, cancellationPolicy: 'Disabled terms.', clientContract: { configured: true, additionalTerms: 'Disclose allergies before treatment.', appearance: { header: 'My Clinic', font: 'serif', fontSize: 16 } } })
  h.seed('productServicePosts', 'facial', { branchId: 'clinic', postType: 'Service', title: 'Facial', price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: '', sessionCount: 1 })
  const prepared = await h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: reservation(), getBookingRange: range, rangesOverlap: overlap }))
  assert.match(prepared.data.contract.terms, /required deposit/)
  assert.match(prepared.data.contract.terms, /Disclose allergies/)
  assert.doesNotMatch(prepared.data.contract.terms, /Disabled terms/)
  assert.equal(prepared.data.contract.status, 'pending')
  assert.equal(prepared.data.contract.document.appearance.fontSize, 16)
  assert.equal(prepared.data.contract.document.appearance.font, 'serif')
  h.seed('clinicPolicies', 'owner', { clientContract: { configured: true, additionalTerms: 'Changed later.' } })
  assert.doesNotMatch(prepared.data.contract.terms, /Changed later/)
  assert.equal(prepared.data.contract.document.appearance.fontSize, 16)
})

test('Individual services require separate records and separate dates, across branches', async () => {
  const h = fixture()
  await assert.rejects(h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: { ...reservation(), selectedServiceIds: ['facial', 'laser'] }, getBookingRange: range, rangesOverlap: overlap })), /own appointment/)
  h.seed('appointments', 'other-clinic', { customerId: 'customer', customerEmail: 'customer@test.invalid', branchId: 'other', date: future(5), status: 'Completed' })
  await assert.rejects(h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: reservation(), getBookingRange: range, rangesOverlap: overlap })), /already has a service/)
  assert.throws(() => validateSchedules([reservation('facial'), reservation('laser')]), /different date/)
})
test('Batch submission is atomic and prices come from the catalogue', async () => {
  const h = fixture(), routes = new Map()
  registerBookingBatch({ post: (path, auth, handler) => routes.set(path, handler) }, { admin: h.admin, requireAuth() {}, getBookingRange: range, rangesOverlap: overlap, assertClinicPlanFeature: async () => {}, getClinicPoliciesForBranch: async () => ({ policy: {} }), getApprovedLeaveForDate: async () => null })
  const invalid = [reservation('facial'), reservation('missing', future(6))]
  assert.equal((await callRoute(routes.get('/bookings/batch'), 'customer', { appointments: invalid })).code, 409)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('appointments/')).length, 0)
  const response = await callRoute(routes.get('/bookings/batch'), 'customer', { appointments: [reservation('facial'), { ...reservation('laser', future(6)), amount: 1 }] })
  assert.equal(response.code, 200, JSON.stringify(response.body))
  const parent = h.records.get(`appointments/${response.body.data.appointmentId}`)
  assert.equal(parent.totalAmount, 1000)
  assert.equal(parent.isBookingOrderParent, true)
  assert.equal(parent.appointmentIds.length, 2)
})
test('Packages expand into individual visits and reserve only first-visit resources', async () => {
  const h = fixture()
  h.seed('productServicePosts', 'package', { branchId: 'clinic', postType: 'Package', title: 'Care plan', price: 800, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Package terms', sessionCount: 2, packageServiceIds: ['facial', 'laser'] })
  const prepared = await h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: reservation('package'), getBookingRange: range, rangesOverlap: overlap }))
  assert.equal(prepared.data.totalAmount, 800)
  assert.equal(prepared.data.totalServiceDurationMinutes, 30)
  assert.equal(prepared.data.treatmentPlan.totalSessions, 4)
  assert.deepEqual(prepared.data.treatmentPlan.sessions.map(s => s.serviceId), ['facial', 'laser', 'facial', 'laser'])
})

test('Batch booking cannot reserve the same consumable twice before either visit is written', async () => {
  const h = fixture(), routes = new Map()
  for (const id of ['facial', 'laser']) h.records.get(`productServicePosts/${id}`).requiredSupplyIds = ['material']
  h.seed('inventoryItems', 'material', { branchId: 'clinic', currentStock: 1 })
  registerBookingBatch({ post: (path, auth, handler) => routes.set(path, handler) }, { admin: h.admin, requireAuth() {}, getBookingRange: range, rangesOverlap: overlap, assertClinicPlanFeature: async () => {}, getClinicPoliciesForBranch: async () => ({ policy: {} }), getApprovedLeaveForDate: async () => null })
  const result = await callRoute(routes.get('/bookings/batch'), 'customer', { appointments: [reservation(), reservation('laser', future(6))] })
  assert.equal(result.code, 409)
  assert.match(result.body.error, /not enough materials/)
  assert.equal([...h.records.keys()].some(key => key.startsWith('appointments/')), false)
})
test('Group consultations and duplicate attendee emails are rejected', async () => {
  const h = fixture()
  h.seed('productServicePosts', 'consult', { branchId: 'clinic', postType: 'Consultation', price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Terms', consultationMode: 'online' })
  const groupBooking = { organizerIncluded: true, guests: [{ name: 'Guest', email: 'guest@test.invalid' }] }
  await assert.rejects(h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: { ...reservation('consult'), groupBooking }, getBookingRange: range, rangesOverlap: overlap })), /individual appointments/)
  groupBooking.guests[0].email = 'customer@test.invalid'
  await assert.rejects(h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: { ...reservation(), groupBooking }, getBookingRange: range, rangesOverlap: overlap })), /different email/)
})
test('Supplier review needs documents, rejects self-review, and updates linked accounts', async () => {
  const h = transactionDb(), routes = new Map()
  h.seed('supplierApplications', 'supplier', { ownerId: 'supplier', verificationStatus: 'Draft' })
  h.seed('suppliers', 'linked', { ownerId: 'supplier', status: 'Active' })
  registerSupplierVerification({ get: (path, auth, handler) => routes.set(path, handler), post: (path, auth, handler) => routes.set(path, handler) }, { admin: h.admin, requireAuth() {}, loadUserContext: async uid => ({ roleKey: uid === 'admin' ? 'Superadmin' : 'Supplier', userData: { emailVerified: true }, permissions: new Set() }), storageBucket: () => 'test' })
  const form = { businessName: 'Supplier', registrationNumber: 'R123', taxNumber: 'T123', businessAddress: 'Address', representativeName: 'Representative', contactEmail: 'supplier@test.invalid', contactPhone: '09123456789' }
  assert.equal((await callRoute(routes.get('/supplier-verification/submit'), 'supplier', form)).code, 400)
  h.seed('supplierApplications', 'supplier', { ownerId: 'supplier', verificationStatus: 'Draft', documents: Object.fromEntries(['registration', 'permit', 'representative'].map(kind => [kind, { path: `supplier-verification/supplier/${kind}` }])) })
  assert.equal((await callRoute(routes.get('/supplier-verification/submit'), 'supplier', form)).code, 200)
  assert.equal((await callRoute(routes.get('/admin/supplier-verification/:id/review'), 'supplier', { action: 'approve' }, { id: 'supplier' })).code, 403)
  assert.equal((await callRoute(routes.get('/admin/supplier-verification/:id/review'), 'admin', { action: 'approve' }, { id: 'supplier' })).code, 200)
  assert.equal(h.records.get('suppliers/linked').verificationStatus, 'Verified')
  assert.equal((await callRoute(routes.get('/admin/supplier-verification/:id/review'), 'admin', { action: 'suspend', reason: 'Registration document expired.' }, { id: 'supplier' })).code, 200)
  assert.equal(h.records.get('suppliers/linked').verificationStatus, 'Suspended')
  assert.throws(() => supplierDecision('Draft', 'approve'), /review stage/)
  assert.throws(() => supplierDecision('Submitted', 'reject', ''), /clear reason/)
})

test('A group can select different services, with individual times and a shared authoritative total', async () => {
  const h = fixture()
  h.seed('productServicePosts', 'laser', { branchId: 'clinic', postType: 'Service', title: 'Laser', price: 800, durationMinutes: 60, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Laser terms', requiredSupplyIds: ['material'] })
  h.seed('productServicePosts', 'facial', { branchId: 'clinic', postType: 'Service', title: 'Facial', price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Facial terms', requiredSupplyIds: ['material'] })
  h.seed('inventoryItems', 'material', { branchId: 'clinic', name: 'Material', currentStock: 1 })
  const groupBooking = { organizerIncluded: true, guests: [{ name: 'Guest', email: 'guest@test.invalid', phone: '+639171234567', serviceId: 'laser' }] }
  const prepare = () => h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: { ...reservation(), groupBooking }, getBookingRange: range, rangesOverlap: overlap }))
  await assert.rejects(prepare(), /unavailable/)
  h.seed('inventoryItems', 'material', { branchId: 'clinic', currentStock: 2 })
  const prepared = await prepare()
  assert.equal(prepared.data.totalAmount, 1300)
  assert.equal(prepared.data.groupBooking.guests[0].phone, '+639171234567')
  assert.equal(prepared.data.totalServiceDurationMinutes, 90)
  assert.deepEqual(prepared.data.groupBooking.recipientPlans.map(visit => [visit.serviceId, visit.time, visit.data.totalAmount]), [['facial', '10:00', 500], ['laser', '10:30', 800]])
  assert.match(prepared.data.groupBooking.recipientPlans[0].data.contract.terms, /Facial terms/)
  assert.match(prepared.data.groupBooking.recipientPlans[1].data.contract.terms, /Laser terms/)
  assert.equal(prepared.data.resources[0].quantity, 2)
})

test('Session completion advances the original plan once even when a balance is due', async () => {
  const h = transactionDb(), routes = new Map()
  h.seed('appointments', 'plan', { treatmentPlan: { totalSessions: 3, completedSessions: 1, forfeitedSessions: 1, sessions: [{}, { sessionIntervalDays: 7 }] } })
  h.seed('appointments', 'visit', { customerId: 'customer', practitionerId: 'worker', branchId: 'clinic', date: '2030-01-01', status: 'Awaiting Customer Confirmation', workerCompleted: true, startedAt: new Date(), totalAmount: 1000, amountPaid: 300, treatmentPlanAppointmentId: 'plan', sessionNumber: 2, treatmentPlan: { totalSessions: 3 } })
  registerBookingMilestones({ post: (path, auth, handler) => routes.set(path, handler) }, { admin: h.admin, requireAuth() {}, authorizeClinicAction: async () => {} })
  const confirm = () => callRoute(routes.get('/appointments/:id/transition'), 'customer', { action: 'customer_complete' }, { id: 'visit' })
  assert.equal((await confirm()).code, 200)
  assert.equal(h.records.get('appointments/visit').status, 'Balance Due')
  assert.equal(h.records.get('appointments/plan').treatmentPlan.completedSessions, 2)
  assert.equal(h.records.get('appointments/plan').treatmentPlan.remainingSessions, 0)
  assert.equal(h.records.get('treatmentSessions/plan-2').status, 'Completed')
  assert.equal(h.records.get('treatmentSessions/plan-3').earliestScheduleDate, '2030-01-08')
  assert.equal((await confirm()).code, 409)
})

test('Free-plan batch bookings become payable without a clinic approval queue', async () => {
  const h = fixture(), routes = new Map()
  registerBookingBatch({ post: (path, auth, handler) => routes.set(path, handler) }, { admin: h.admin, requireAuth() {}, getBookingRange: range, rangesOverlap: overlap, assertClinicPlanFeature: async () => {}, getClinicPoliciesForBranch: async () => ({ policy: {} }), getApprovedLeaveForDate: async () => null, getEffectiveClinicPlan: () => 'free' })
  const result = await callRoute(routes.get('/bookings/batch'), 'customer', { appointments: [reservation()] })
  assert.equal(result.code, 200)
  const parent = h.records.get(`appointments/${result.body.data.appointmentId}`)
  assert.equal(parent.status, 'Awaiting Payment')
  assert.equal(parent.approvalStatus, 'Approved')
})
test('Elapsed consultations require customer confirmation; absence is never completed', async () => {
  const h = transactionDb()
  const base = { type: 'Consultation', consultationMode: 'online', branchId: 'clinic', customerId: 'customer', date: '2020-01-01', time: '10:00', totalServiceDurationMinutes: 30 }
  h.seed('appointments', 'active', { ...base, status: 'Ongoing', startedAt: new Date('2020-01-01T02:00:00Z'), clientJoinedAt: new Date(), practitionerJoinedAt: new Date() })
  h.seed('appointments', 'absent', { ...base, status: 'Paid' })
  assert.equal((await closeExpiredConsultations(h.admin)).closed, 2)
  assert.equal(h.records.get('appointments/active').status, 'Awaiting Customer Confirmation')
  assert.equal(h.records.get('appointments/absent').status, 'No-show')
  assert.equal(h.records.get('appointments/absent').workerCompleted, undefined)
  assert.equal((await closeExpiredConsultations(h.admin)).closed, 0)
})
