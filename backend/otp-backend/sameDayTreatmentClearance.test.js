import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerSameDayTreatmentClearance } from './sameDayTreatmentClearance.js'

const fixture = ({ source = 'customer_booking_request', workerCompleted = true, consultationStatus = 'Awaiting Customer Confirmation' } = {}) => {
  const h = transactionDb(), routes = new Map()
  h.seed('appointments', 'consult', {
    branchId: 'clinic', source, sameDayBookingId: 'pair', sameDayTreatmentAppointmentId: 'treatment',
    type: 'Consultation', consultationMode: 'on-site', practitionerId: 'worker', assignedPractitionerId: 'worker',
    date: '2027-04-02', time: '09:00', endTime: '09:45', sameDayConsultationEndTime: '09:30', status: consultationStatus, approvalStatus: 'Approved', workerCompleted,
  })
  h.seed('appointments', 'treatment', {
    branchId: 'clinic', source, sameDayBookingId: 'pair', sameDayConsultationAppointmentId: 'consult',
    type: 'Service', practitionerId: 'worker', assignedPractitionerId: 'worker', date: '2027-04-02', time: '09:45',
    status: 'Awaiting Clinical Clearance', approvalStatus: 'Approved', paymentStatus: 'Not Applicable',
    sameDayTreatmentStatus: 'pending_clinical_clearance', contract: { status: 'pending', terms: 'Treatment terms' }, amount: 500,
    treatmentPlan: { totalSessions: 2, sessionIntervalDays: 30 },
  })
  registerSameDayTreatmentClearance({ post: (path, middleware, handler) => routes.set(path, handler) }, { admin: h.admin, requireAuth() {} })
  h.call = async (id, body, uid = 'worker') => {
    const response = { statusCode: 200 }
    await routes.get('/appointments/:id/same-day-treatment-clearance')({ params: { id }, body, user: { uid } }, {
      status(code) { response.statusCode = code; return this }, json(value) { response.body = value },
    })
    return response
  }
  return h
}

test('assigned practitioner clears treatment only after the linked on-site consultation is completed', async () => {
  const h = fixture()
  const result = await h.call('consult', { decision: 'clear' })
  assert.equal(result.statusCode, 200, JSON.stringify(result.body))
  const treatment = h.records.get('appointments/treatment')
  assert.equal(treatment.sameDayTreatmentStatus, 'cleared')
  assert.equal(treatment.paymentStatus, 'Pending')
  assert.equal(treatment.status, 'Contract Pending')
  assert.equal(h.records.get('treatmentSessions/treatment-1').status, 'Scheduled')
  assert.equal(h.records.get('treatmentSessions/treatment-2').status, 'Unscheduled')
})

test('walk-in treatment becomes unpaid only after practitioner clearance', async () => {
  const h = fixture({ source: 'walk_in' })
  const result = await h.call('treatment', { decision: 'clear' })
  assert.equal(result.statusCode, 200, JSON.stringify(result.body))
  const treatment = h.records.get('appointments/treatment')
  assert.equal(treatment.status, 'Unpaid')
  assert.equal(treatment.paymentStatus, 'Pending')
})

test('clearance is limited to the assigned practitioner and completed consultations', async () => {
  const unauthorized = fixture()
  assert.equal((await unauthorized.call('consult', { decision: 'clear' }, 'other-worker')).statusCode, 403)
  const incomplete = fixture({ workerCompleted: false })
  assert.equal((await incomplete.call('consult', { decision: 'clear' })).statusCode, 409)
  assert.equal(incomplete.records.get('appointments/treatment').sameDayTreatmentStatus, 'pending_clinical_clearance')
})

test('practitioner cannot clear same-day treatment while the consultation cancellation is awaiting review', async () => {
  const h = fixture({ consultationStatus: 'Cancellation Requested' })
  const result = await h.call('consult', { decision: 'clear' })
  assert.equal(result.statusCode, 409)
  assert.match(result.body.error, /pending cancellation request/)
  assert.equal(h.records.get('appointments/treatment').sameDayTreatmentStatus, 'pending_clinical_clearance')
})

test('practitioner can decline same-day treatment and close its provisional slot', async () => {
  const h = fixture()
  const result = await h.call('consult', { decision: 'do_not_clear', note: 'Needs a separate follow-up assessment.' })
  assert.equal(result.statusCode, 200, JSON.stringify(result.body))
  const treatment = h.records.get('appointments/treatment')
  assert.equal(treatment.status, 'Cancelled')
  assert.equal(treatment.sameDayTreatmentStatus, 'not_cleared')
  assert.equal(treatment.paymentStatus, 'Not Applicable')
  assert.equal(h.records.has('treatmentSessions/treatment-1'), false)
})
