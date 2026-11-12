import { prepareBooking } from './bookingResources.js'
import { assertWorkflow as check, normalized } from './bookingWorkflow.js'
import { sameDayServiceConfigurationError } from './listingApproval.js'
import { appointmentStaffIds } from '../../shared/practitionerTeam.js'
import { prepareClinicBookingRecipients, writeClinicBookingNotifications } from './clinicBookingNotifications.js'

const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const parseTime = value => /^\d{2}:\d{2}$/.test(String(value || '')) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN
const activeStatus = value => !['cancelled', 'rejected', 'completed', 'expired', 'no-show', 'incomplete', 'forfeited'].includes(normalized(value))
export const sameDayAppointment = (data, { reservation, bookingId, treatmentAppointmentId, consultationAppointmentId, directBooking, createdAt }) => ({
  ...reservation,
  ...data,
  bookingWorkflowVersion: 2,
  bookingId,
  sameDayBookingId: bookingId,
  ...(treatmentAppointmentId ? { sameDayTreatmentAppointmentId: treatmentAppointmentId, sameDayTreatmentRequested: true } : {}),
  ...(consultationAppointmentId ? { sameDayConsultationAppointmentId: consultationAppointmentId, sameDayTreatmentStatus: 'pending_clinical_clearance', sameDayTreatmentRequestedAt: createdAt } : {}),
  approvalStatus: directBooking ? 'Approved' : 'Pending',
  status: directBooking
    ? (consultationAppointmentId ? 'Awaiting Clinical Clearance' : 'Awaiting Payment')
    : 'Pending Approval',
  paymentStatus: consultationAppointmentId ? 'Not Applicable' : 'Pending',
  amountPaid: 0,
  serviceKey: null,
  customerKeyVerified: false,
  workerKeyVerified: false,
  workerCompleted: false,
  customerCompleted: false,
  createdAt,
  updatedAt: createdAt,
})

export const prepareSameDayPair = async ({ tx, db, reservation, getBookingRange, rangesOverlap }) => {
  check(reservation.groupBooking !== true && !reservation.groupBooking, 'Same-day consultation and treatment requests are individual bookings.', 400)
  const ids = [...new Set(reservation.selectedServiceIds || reservation.serviceIds || [])]
  check(ids.length === 1, 'Choose one treatment service for a same-day consultation request.', 400)
  const serviceSnap = await tx.get(db.collection('productServicePosts').doc(String(ids[0])))
  const service = serviceSnap.data()
  check(service && service.branchId === reservation.branchId && service.postType === 'Service' && service.isPublished === true && service.financeStatus === 'approved' && !service.archived, 'The selected treatment service is unavailable.')
  const consultationId = String(service.linkedConsultationId || '').trim()
  const consultationSnap = consultationId ? await tx.get(db.collection('productServicePosts').doc(consultationId)) : null
  const consultation = consultationSnap?.data() ? { ...consultationSnap.data(), id: consultationSnap.id } : null
  const configurationError = sameDayServiceConfigurationError({ ...service, id: serviceSnap.id }, consultation)
  check(!configurationError, configurationError || 'Same-day treatment is not enabled for this service.', 422)
  const bufferMinutes = Number(service.sameDayConsultationBufferMinutes ?? 15)
  const consultationStart = parseTime(reservation.time)
  const consultationDuration = Math.max(1, Number(consultation.durationMinutes || 60))
  check(Number.isFinite(consultationStart) && consultationStart >= 0 && consultationStart < 24 * 60, 'Choose a valid consultation start time.', 400)
  const treatmentStart = consultationStart + consultationDuration + bufferMinutes
  check(treatmentStart < 24 * 60, 'The consultation, buffer, and treatment must fit within the same day.', 400)
  const consultationTime = clock(consultationStart)
  const treatmentTime = clock(treatmentStart)
  const source = String(reservation.source || 'customer_booking_request')
  const consultationReservation = {
    ...reservation,
    selectedServiceIds: [consultationId], serviceIds: [consultationId], consultationMode: 'on-site',
    time: consultationTime, endTime: '', source, groupBooking: null,
  }
  const treatmentReservation = {
    ...reservation,
    selectedServiceIds: [serviceSnap.id], serviceIds: [serviceSnap.id], consultationMode: null,
    time: treatmentTime, endTime: '', source, groupBooking: null,
  }
  const consultationVisit = await prepareBooking({ tx, db, reservation: consultationReservation, getBookingRange, rangesOverlap })
  const treatmentVisit = await prepareBooking({ tx, db, reservation: treatmentReservation, getBookingRange, rangesOverlap, allowSameDayConsultationRequest: true })
  const consultationRange = getBookingRange({ ...consultationReservation, ...consultationVisit.data })
  const treatmentRange = getBookingRange({ ...treatmentReservation, ...treatmentVisit.data })
  check(consultationRange && treatmentRange && consultationRange.end + bufferMinutes === treatmentRange.start, 'The linked treatment schedule is invalid.', 409)
  const pairRange = { start: consultationRange.start, end: treatmentRange.end }
  const existing = await tx.get(db.collection('appointments').where('branchId', '==', reservation.branchId))
  const conflict = existing.docs.some(doc => {
    const appointment = doc.data() || {}
    if (!activeStatus(appointment.status) || !appointmentStaffIds(appointment).includes(String(reservation.practitionerId || '')) || appointment.date !== reservation.date) return false
    const range = getBookingRange(appointment)
    return range && rangesOverlap(pairRange.start, pairRange.end, range.start, range.end)
  })
  check(!conflict, 'The full consultation and treatment window conflicts with another appointment. Choose another time.', 409)

  return {
    service: { ...service, id: serviceSnap.id }, consultation,
    bufferMinutes, consultationTime, treatmentTime,
    consultationReservation, treatmentReservation,
    consultationVisit, treatmentVisit,
    consultationRange, treatmentRange,
  }
}

export const registerSameDayBookings = (app, {
  admin, requireAuth, getBookingRange, rangesOverlap, assertClinicPlanFeature,
  getClinicPoliciesForBranch, getApprovedLeaveForDate, getEffectiveClinicPlan = () => 'paid', loadUserContext,
}) => {
  app.post('/bookings/same-day', requireAuth, async (req, res) => {
    try {
      const body = req.body || {}
      const branchId = String(body.branchId || '').trim()
      const serviceId = String(body.serviceId || '').trim()
      const practitionerId = String(body.practitionerId || '').trim()
      const date = String(body.date || '').trim()
      const time = String(body.time || '').trim()
      check(branchId && serviceId && practitionerId && date && time, 'Choose a service, practitioner, consultation date, and start time.', 400)
      const db = admin.firestore(), uid = String(req.user.uid || '')
      const profile = (await db.collection('users').doc(uid).get()).data() || {}
      check(normalized(profile.role || profile.userType) === 'customer', 'Customer access is required.', 403)
      check(!['inactive', 'disabled', 'archived', 'closed'].includes(normalized(profile.status)), 'This customer account is unavailable.', 403)
      await assertClinicPlanFeature(db, branchId, 'booking_availability')
      const customer = {
        customerId: uid,
        customerName: String(profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || req.user.name || req.user.email || 'Customer'),
        customerEmail: String(req.user.email || profile.email || '').trim().toLowerCase(),
        customerPhone: String(body.customerPhone || profile.contactNumber || req.user.phoneNumber || '').trim().slice(0, 32),
      }
      const approvedLeave = await getApprovedLeaveForDate(practitionerId, date)
      check(!approvedLeave, 'The selected practitioner is on approved leave for this date.', 409)
      const reservation = {
        ...customer, branchId, selectedServiceIds: [serviceId], practitionerId, date, time,
        notes: String(body.notes || '').trim().slice(0, 2000), policyAcknowledged: true,
        source: 'customer_booking_request', groupBooking: null,
      }
      const bookingRef = db.collection('bookings').doc()
      const consultationRef = db.collection('appointments').doc()
      const treatmentRef = db.collection('appointments').doc()
      const result = await db.runTransaction(async tx => {
        const branchSnap = await tx.get(db.collection('clinics').doc(branchId))
        const branch = branchSnap.data() || {}
        check(branchSnap.exists && branch.isPublished === true && !['inactive', 'archived', 'closed'].includes(normalized(branch.status)), 'This clinic is unavailable.', 409)
        const directBooking = getEffectiveClinicPlan(branch) === 'free'
        const { policy } = await getClinicPoliciesForBranch(db, branchId, branch)
        const policyRequired = Object.entries(policy || {}).some(([key, value]) => key.endsWith('Enabled') && value === true && String(policy[key.slice(0, -7)] || '').trim())
        check(!policyRequired || body.policyAcknowledged === true, 'Please review and acknowledge the active clinic policies before submitting.', 422)
        const pair = await prepareSameDayPair({ tx, db, reservation, getBookingRange, rangesOverlap })
        const recipients = await prepareClinicBookingRecipients({ tx, db, branchId, branch, loadUserContext })
        const now = admin.firestore.FieldValue.serverTimestamp()
        const consult = sameDayAppointment(pair.consultationVisit.data, {
          reservation: pair.consultationReservation, bookingId: bookingRef.id,
          treatmentAppointmentId: treatmentRef.id, directBooking, createdAt: now,
        })
        consult.endTime = pair.treatmentTime
        consult.sameDayConsultationEndTime = pair.consultationVisit.data.endTime
        consult.sameDayTreatmentAppointmentId = treatmentRef.id
        consult.sameDayTreatmentName = pair.treatmentVisit.data.service
        const treatment = sameDayAppointment(pair.treatmentVisit.data, {
          reservation: pair.treatmentReservation, bookingId: bookingRef.id,
          consultationAppointmentId: consultationRef.id, directBooking, createdAt: now,
        })
        treatment.sameDayConsultationBufferMinutes = pair.bufferMinutes
        treatment.paymentStatus = 'Not Applicable'
        tx.set(consultationRef, consult)
        tx.set(treatmentRef, treatment)
        tx.set(bookingRef, {
          ...customer, branchId, source: 'customer_booking_request', status: directBooking ? 'approved' : 'requested',
          bookingWorkflowVersion: 2, sameDayBooking: true, appointmentIds: [consultationRef.id, treatmentRef.id],
          appointmentId: consultationRef.id, totalAmount: pair.consultationVisit.data.totalAmount + pair.treatmentVisit.data.totalAmount,
          amountDueNow: pair.consultationVisit.data.totalAmount, createdAt: now, updatedAt: now,
        })
        tx.set(pair.consultationVisit.lock, { updatedAt: now })
        tx.set(pair.treatmentVisit.lock, { updatedAt: now })
        for (const lock of new Map([...(pair.consultationVisit.customerLocks || []), ...(pair.treatmentVisit.customerLocks || [])].map(item => [item.id, item])).values()) tx.set(lock, { updatedAt: now })
        tx.set(db.collection('notifications').doc(), {
          recipientUserId: uid, title: directBooking ? 'Same-day booking created' : 'Same-day booking request submitted',
          message: directBooking
            ? 'Your consultation is booked and the treatment slot is provisional. Pay for the consultation after signing; treatment is not charged unless the practitioner clears it.'
            : 'Your consultation and provisional treatment time were sent to the clinic. The consultation must be approved first; treatment is not charged unless the practitioner clears it.',
          link: '/customer/appointments', read: false, createdAt: now,
        })
        writeClinicBookingNotifications({ tx, db, recipients, branchId, bookingId: bookingRef.id, appointmentId: consultationRef.id, customerName: customer.customerName, count: 2, directBooking, createdAt: now })
        return { bookingId: bookingRef.id, appointmentIds: [consultationRef.id, treatmentRef.id], appointments: [{ id: consultationRef.id, ...consult }, { id: treatmentRef.id, ...treatment }] }
      })
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
