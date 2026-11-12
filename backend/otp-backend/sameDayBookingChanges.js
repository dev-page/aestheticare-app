import { assertWorkflow, normalized } from './bookingWorkflow.js'

export const sameDayChangeError = (appointment, action) => {
  if (!appointment?.sameDayBookingId) return ''
  const type = normalized(appointment.type)
  const treatmentStatus = normalized(appointment.sameDayTreatmentStatus)
  if (action === 'cancel' && type === 'consultation' && treatmentStatus === 'cleared') {
    return 'This consultation is linked to treatment that was cleared. Cancel the treatment appointment separately.'
  }
  if (action === 'reschedule') {
    if (type === 'consultation') return 'A same-day consultation and treatment cannot be rescheduled separately. Contact the clinic for help.'
    if (type !== 'service' || treatmentStatus !== 'cleared') return 'The treatment can only be rescheduled after the practitioner clears it.'
  }
  return ''
}

export const cancelPendingSameDayTreatment = async ({ tx, db, appointmentId, consultation, timestamp }) => {
  const treatmentId = String(consultation?.sameDayTreatmentAppointmentId || '').trim()
  if (!treatmentId) return null

  const treatmentRef = db.collection('appointments').doc(treatmentId)
  const treatmentSnap = await tx.get(treatmentRef)
  assertWorkflow(treatmentSnap.exists, 'The linked same-day treatment is missing. Contact the clinic to resolve this cancellation.', 409)
  const treatment = treatmentSnap.data() || {}
  assertWorkflow(treatment.sameDayBookingId === consultation.sameDayBookingId
    && treatment.sameDayConsultationAppointmentId === appointmentId,
  'The same-day consultation and treatment links do not match. Contact the clinic to resolve this cancellation.', 409)
  assertWorkflow(treatment.sameDayTreatmentStatus !== 'cleared', 'This consultation is linked to treatment that was cleared. Cancel the treatment appointment separately.', 409)

  if (treatment.sameDayTreatmentStatus !== 'pending_clinical_clearance') return null
  tx.update(treatmentRef, {
    status: 'Cancelled',
    sameDayTreatmentStatus: 'booking_cancelled',
    sameDayTreatmentCancelledAt: timestamp,
    sameDayTreatmentCancelReason: 'consultation_cancelled',
    paymentStatus: 'Not Applicable',
    updatedAt: timestamp,
  })
  return treatmentId
}
