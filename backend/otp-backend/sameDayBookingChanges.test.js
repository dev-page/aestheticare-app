import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { cancelPendingSameDayTreatment, sameDayChangeError } from './sameDayBookingChanges.js'

test('same-day change policy blocks consultation reschedules and post-clearance consultation cancellation', () => {
  const consultation = { type: 'Consultation', sameDayBookingId: 'pair', sameDayTreatmentStatus: 'pending_clinical_clearance' }
  assert.match(sameDayChangeError(consultation, 'reschedule'), /cannot be rescheduled separately/)
  assert.equal(sameDayChangeError(consultation, 'cancel'), '')
  assert.match(sameDayChangeError({ ...consultation, sameDayTreatmentStatus: 'cleared' }, 'cancel'), /treatment appointment separately/)
  assert.match(sameDayChangeError({ type: 'Service', sameDayBookingId: 'pair', sameDayTreatmentStatus: 'pending_clinical_clearance' }, 'reschedule'), /after the practitioner clears/)
  assert.equal(sameDayChangeError({ type: 'Service', sameDayBookingId: 'pair', sameDayTreatmentStatus: 'cleared' }, 'reschedule'), '')
  assert.equal(sameDayChangeError({ type: 'Service' }, 'reschedule'), '')
})

test('approving cancellation of a same-day consultation atomically releases pending treatment', async () => {
  const h = transactionDb()
  h.seed('appointments', 'consult', { sameDayBookingId: 'pair', sameDayTreatmentAppointmentId: 'treatment' })
  h.seed('appointments', 'treatment', { sameDayBookingId: 'pair', sameDayConsultationAppointmentId: 'consult', sameDayTreatmentStatus: 'pending_clinical_clearance', status: 'Awaiting Clinical Clearance', paymentStatus: 'Not Applicable' })
  await h.db.runTransaction(async tx => {
    const consultationRef = h.db.collection('appointments').doc('consult')
    const consultation = (await tx.get(consultationRef)).data()
    const releasedId = await cancelPendingSameDayTreatment({ tx, db: h.db, appointmentId: 'consult', consultation, timestamp: new Date('2030-01-01T00:00:00Z') })
    assert.equal(releasedId, 'treatment')
    tx.update(consultationRef, { status: 'Cancelled', sameDayTreatmentStatus: 'booking_cancelled' })
  })
  assert.equal(h.records.get('appointments/consult').status, 'Cancelled')
  assert.equal(h.records.get('appointments/treatment').status, 'Cancelled')
  assert.equal(h.records.get('appointments/treatment').sameDayTreatmentStatus, 'booking_cancelled')
  assert.equal(h.records.get('appointments/treatment').paymentStatus, 'Not Applicable')
})

test('same-day cancellation helper refuses a cleared treatment and detects broken links', async () => {
  const h = transactionDb()
  h.seed('appointments', 'consult', { sameDayBookingId: 'pair', sameDayTreatmentAppointmentId: 'treatment' })
  h.seed('appointments', 'treatment', { sameDayBookingId: 'pair', sameDayConsultationAppointmentId: 'consult', sameDayTreatmentStatus: 'cleared' })
  await assert.rejects(h.db.runTransaction(async tx => {
    const ref = h.db.collection('appointments').doc('consult')
    const consultation = (await tx.get(ref)).data()
    await cancelPendingSameDayTreatment({ tx, db: h.db, appointmentId: ref.id, consultation, timestamp: new Date() })
  }), /treatment appointment separately/)
  h.seed('appointments', 'treatment', { sameDayBookingId: 'another-pair', sameDayConsultationAppointmentId: 'consult', sameDayTreatmentStatus: 'pending_clinical_clearance' })
  await assert.rejects(h.db.runTransaction(async tx => {
    const ref = h.db.collection('appointments').doc('consult')
    const consultation = (await tx.get(ref)).data()
    await cancelPendingSameDayTreatment({ tx, db: h.db, appointmentId: ref.id, consultation, timestamp: new Date() })
  }), /links do not match/)
})
