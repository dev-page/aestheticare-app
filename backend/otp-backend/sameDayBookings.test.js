import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerSameDayBookings } from './sameDayBookings.js'

const range = value => {
  const minutes = time => /^\d{2}:\d{2}$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
  const start = minutes(value.time), end = value.endTime ? minutes(value.endTime) : start + Number(value.totalServiceDurationMinutes || 60)
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null
}
const overlap = (a, b, c, d) => a < d && c < b
const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

const fixture = (plan = 'basic') => {
  const h = transactionDb(), routes = new Map()
  h.seed('users', 'customer', { role: 'Customer', status: 'Active', email: 'customer@test.invalid', fullName: 'Customer' })
  h.seed('users', 'worker', { role: 'Practitioner', status: 'Active', branchId: 'clinic', fullName: 'Practitioner' })
  h.seed('users', 'owner', { role: 'Owner', status: 'Active', branchId: 'clinic', permissions: ['appointments:review'] })
  h.seed('clinics', 'clinic', { ownerId: 'owner', isPublished: true, status: 'Active', subscriptionPlan: 'basic' })
  h.seed('users/worker/schedules', 'recurring', {
    recurring: true,
    availability: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { start: '08:00', end: '18:00', enabled: true }])),
  })
  h.seed('productServicePosts', 'assessment', { branchId: 'clinic', postType: 'Consultation', title: 'On-site assessment', price: 200, durationMinutes: 30, isPublished: true, financeStatus: 'approved', consultationModes: ['on-site'], termsAndConditions: 'Consultation terms' })
  h.seed('productServicePosts', 'treatment', { branchId: 'clinic', postType: 'Service', title: 'Treatment', price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Treatment terms', requiresConsultationFirst: true, linkedConsultationId: 'assessment', sameDayConsultationAllowed: true, sameDayConsultationBufferMinutes: 15 })
  registerSameDayBookings({ post: (path, auth, handler) => routes.set(path, handler) }, {
    admin: h.admin,
    requireAuth() {},
    getBookingRange: range,
    rangesOverlap: overlap,
    assertClinicPlanFeature: async () => {},
    getClinicPoliciesForBranch: async () => ({ policy: {} }),
    getApprovedLeaveForDate: async () => null,
    getEffectiveClinicPlan: () => plan,
    loadUserContext: async () => ({ permissions: new Set(['appointments:review']) }),
  })
  h.call = async (body, uid = 'customer') => {
    const result = { code: 200 }
    await routes.get('/bookings/same-day')({ user: { uid, email: `${uid}@test.invalid` }, body }, { status(code) { result.code = code; return this }, json(value) { result.body = value } })
    return result
  }
  return h
}

const request = (overrides = {}) => ({ branchId: 'clinic', serviceId: 'treatment', practitionerId: 'worker', date: future(5), time: '09:00', policyAcknowledged: true, ...overrides })

test('same-day booking creates a linked on-site consultation and provisional treatment with a reserved buffer', async () => {
  const h = fixture()
  const result = await h.call(request())
  assert.equal(result.code, 200, JSON.stringify(result.body))
  const [consultationId, treatmentId] = result.body.data.appointmentIds
  const consultation = h.records.get(`appointments/${consultationId}`)
  const treatment = h.records.get(`appointments/${treatmentId}`)
  assert.equal(consultation.type, 'Consultation')
  assert.equal(consultation.consultationMode, 'on-site')
  assert.equal(consultation.time, '09:00')
  assert.equal(consultation.sameDayConsultationEndTime, '09:30')
  assert.equal(consultation.endTime, '09:45')
  assert.equal(consultation.sameDayTreatmentAppointmentId, treatmentId)
  assert.equal(treatment.type, 'Service')
  assert.equal(treatment.time, '09:45')
  assert.equal(treatment.sameDayConsultationAppointmentId, consultationId)
  assert.equal(treatment.sameDayTreatmentStatus, 'pending_clinical_clearance')
  assert.equal(treatment.status, 'Pending Approval')
  assert.equal(treatment.paymentStatus, 'Not Applicable')
  assert.equal(treatment.totalAmount, 500)
  assert.equal(h.records.get(`bookings/${result.body.data.bookingId}`).amountDueNow, 200)
})

test('same-day booking rejects online-only consultations and writes no appointments', async () => {
  const h = fixture()
  h.seed('productServicePosts', 'assessment', { ...h.records.get('productServicePosts/assessment'), consultationModes: ['online'] })
  const before = h.records.size
  const result = await h.call(request())
  assert.equal(result.code, 422)
  assert.match(result.body.error, /on-site/)
  assert.equal(h.records.size, before)
})

test('same-day booking checks the consultation, buffer, and treatment as one practitioner window', async () => {
  const h = fixture()
  h.seed('appointments', 'busy-buffer', { branchId: 'clinic', practitionerId: 'worker', date: future(5), time: '09:30', endTime: '09:40', status: 'Paid' })
  const before = h.records.size
  const result = await h.call(request())
  assert.equal(result.code, 409)
  assert.match(result.body.error, /full consultation and treatment window/)
  assert.equal(h.records.size, before)
})

test('free-plan clinics use direct approval while retaining the treatment clearance gate', async () => {
  const h = fixture('free')
  const result = await h.call(request())
  assert.equal(result.code, 200, JSON.stringify(result.body))
  const [consultationId, treatmentId] = result.body.data.appointmentIds
  assert.equal(h.records.get(`appointments/${consultationId}`).approvalStatus, 'Approved')
  assert.equal(h.records.get(`appointments/${consultationId}`).status, 'Awaiting Payment')
  assert.equal(h.records.get(`appointments/${treatmentId}`).status, 'Awaiting Clinical Clearance')
  assert.equal(h.records.get(`appointments/${treatmentId}`).paymentStatus, 'Not Applicable')
  assert.equal(h.records.get(`bookings/${result.body.data.bookingId}`).status, 'approved')
})
