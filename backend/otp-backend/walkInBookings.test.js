import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerWalkInBookings } from './walkInBookings.js'

const appointmentRange = value => {
  const minutes = time => /^\d{2}:\d{2}$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
  const start = minutes(value.time), end = value.endTime ? minutes(value.endTime) : start + Number(value.totalServiceDurationMinutes || 60)
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null
}
const overlap = (a, b, c, d) => a < d && c < b
const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

const fixture = () => {
  const h = transactionDb(), routes = new Map()
  h.seed('clinics', 'clinic', { status: 'Active', isPublished: true, ownerId: 'owner' })
  h.seed('users', 'reception', { role: 'Receptionist', branchId: 'clinic' })
  h.seed('users', 'worker', { role: 'Practitioner', branchId: 'clinic', fullName: 'Practitioner', status: 'Active' })
  h.seed('clients', 'client', { branchId: 'clinic', status: 'Active', email: 'client@test.invalid', fullName: 'Walk-in Client' })
  h.seed('users/worker/schedules', 'recurring', {
    recurring: true,
    availability: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { start: '08:00', end: '18:00', enabled: true }])),
  })
  h.seed('productServicePosts', 'assessment', { branchId: 'clinic', postType: 'Consultation', title: 'On-site assessment', price: 200, durationMinutes: 30, isPublished: true, financeStatus: 'approved', consultationModes: ['on-site'], termsAndConditions: 'Consultation terms' })
  h.seed('productServicePosts', 'treatment', { branchId: 'clinic', postType: 'Service', title: 'Treatment', price: 500, durationMinutes: 30, isPublished: true, financeStatus: 'approved', termsAndConditions: 'Treatment terms', requiresConsultationFirst: true, linkedConsultationId: 'assessment', sameDayConsultationAllowed: true, sameDayConsultationBufferMinutes: 15 })
  registerWalkInBookings({ get() {}, post: (path, middleware, handler) => routes.set(path, handler) }, {
    admin: h.admin,
    requireAuth() {},
    authorizeClinicAction: async () => {},
    assertClinicPlanFeature: async () => {},
    getBookingRange: appointmentRange,
    rangesOverlap: overlap,
    getApprovedLeaveForDate: async () => null,
    getClinicPoliciesForBranch: async () => ({ policy: {} }),
  })
  h.call = async body => {
    const response = { statusCode: 200 }
    await routes.get('/walk-in/bookings')({ user: { uid: 'reception' }, body }, {
      status(code) { response.statusCode = code; return this }, json(value) { response.body = value },
    })
    return response
  }
  return h
}

const validSignature = `data:image/png;base64,${Buffer.from([137,80,78,71,13,10,26,10,...Array.from({ length: 48 }, () => 0)]).toString('base64')}`
const request = (overrides = {}) => ({
  branchId: 'clinic', clientId: 'client', submissionId: 'subm-1234567890123456', policyAcknowledged: true,
  bookingAcceptance: { accepted: true, signatureImage: validSignature },
  appointments: [{ clientId: 'client', serviceId: 'treatment', practitionerId: 'worker', date: future(5), time: '09:00', sameDayConsultationRequested: true }],
  ...overrides,
})

test('walk-in same-day request creates separate linked consultation and provisional treatment appointments', async () => {
  const h = fixture()
  const result = await h.call(request())
  assert.equal(result.statusCode, 200, JSON.stringify(result.body))
  const [consultation, treatment] = result.body.data.appointments
  assert.equal(consultation.type, 'Consultation')
  assert.equal(consultation.source, 'walk_in')
  assert.equal(consultation.status, 'Unpaid')
  assert.equal(treatment.type, 'Service')
  assert.equal(treatment.status, 'Awaiting Clinical Clearance')
  assert.equal(treatment.paymentStatus, 'Not Applicable')
  assert.equal(consultation.sameDayTreatmentAppointmentId, treatment.id)
  assert.equal(treatment.sameDayConsultationAppointmentId, consultation.id)
  assert.equal(h.records.get(`appointments/${treatment.id}`).contract.status, 'pending')
})

test('walk-in same-day booking rejects a treatment without an on-site linked consultation before writing', async () => {
  const h = fixture()
  h.seed('productServicePosts', 'assessment', { ...h.records.get('productServicePosts/assessment'), consultationModes: ['online'] })
  const before = h.records.size
  const result = await h.call(request())
  assert.equal(result.statusCode, 422)
  assert.match(result.body.error, /on-site/)
  assert.equal(h.records.size, before)
})
