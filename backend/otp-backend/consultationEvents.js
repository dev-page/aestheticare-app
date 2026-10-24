import { assertWorkflow as check, normalized, balanceSettled, resetAppointmentAccess } from './bookingWorkflow.js'
import { onlineWindow, timestampDate } from '../../shared/onlineConsultation.js'

export const registerConsultationEvents = (app, { admin, requireAuth, authorizeClinicAction }) => {
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  app.post('/appointments/:id/consultation-events', requireAuth, async (req, res) => {
    try {
      const data = await db.runTransaction(async tx => {
        const ref = db.collection('appointments').doc(req.params.id), snapshot = await tx.get(ref), appointment = snapshot.data()
        check(appointment && normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online', 'Online consultation not found.', 404)
        const customer = appointment.source !== 'walk_in' && appointment.customerId === req.user.uid
        const worker = (appointment.assignedPractitionerId || appointment.practitionerId) === req.user.uid
        const action = req.body?.action, note = String(req.body?.note || '').trim().slice(0, 2000), now = new Date(), window = onlineWindow(appointment)
        const update = { updatedAt: stamp() }
        if (action === 'review') {
          await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:review')
          check(!customer && !worker && !(appointment.treatmentTeam || []).some(member => member.employeeId === req.user.uid), 'An independent clinic reviewer must handle this consultation.', 403)
          check(appointment.consultationNeedsReview || appointment.consultationDispute?.status === 'Open', 'This consultation does not need review.')
          check(note.length >= 10, 'Record the review findings (at least 10 characters).', 400)
          const outcome = req.body?.outcome
          check(['received', 'reschedule', 'refund'].includes(outcome), 'Select a review outcome.', 400)
          check(!['ongoing', 'cancelled', 'rejected'].includes(normalized(appointment.status)) && appointment.staffEarningsStatus !== 'Approved', 'Close the active session first, or contact Finance about an already settled appointment.')
          update.consultationReview = { outcome, note, reviewedBy: req.user.uid, reviewedAt: now.toISOString() }
          update.consultationDispute = appointment.consultationDispute ? { ...appointment.consultationDispute, status: 'Resolved', resolution: outcome } : null
          update.consultationNeedsReview = outcome !== 'received'
          if (outcome === 'received') {
            check(appointment.startedAt && appointment.workerCompleted && String(appointment.treatmentNotes || '').trim().length >= 10, 'Document the delivered consultation before resolving it as received.')
            check(!(appointment.treatmentTeam || []).some(member => !member.participationConfirmed), 'Team participation must be confirmed before resolution.')
            update.status = balanceSettled(appointment) ? 'Completed' : 'Balance Due'
            update.completedAt = stamp()
            update.consultationAdjudicated = true
          } else if (outcome === 'reschedule') {
            check(/^\d{4}-\d{2}-\d{2}$/.test(req.body?.date || '') && /^\d{2}:\d{2}$/.test(req.body?.time || ''), 'Select the proposed new date and time.', 400)
            check(new Date(`${req.body.date}T${req.body.time}+08:00`) > now, 'Select a future schedule.', 400)
            update.consultationPreviousAttempts = [...(appointment.consultationPreviousAttempts || []), { date: appointment.date, time: appointment.time, startedAt: appointment.startedAt ? timestampDate(appointment.startedAt).toISOString() : null, notes: appointment.treatmentNotes || '', review: update.consultationReview, dispute: appointment.consultationDispute || null }]
            Object.assign(update, resetAppointmentAccess(), { startedAt: null, startedById: null, workerCompleted: false, workerCompletedAt: null, workerCompletedById: null, customerCompleted: false, customerCompletedAt: null, completedAt: null, treatmentNotes: '', consultationInterruption: null, consultationInterruptions: [], consultationExtensionSeconds: 0 })
            update.status = 'Reschedule Requested'
            update.requestedDate = req.body.date; update.requestedTime = req.body.time
            update.requestedPractitionerId = appointment.assignedPractitionerId || appointment.practitionerId
            update.requestDecisionStatus = 'Pending'; update.rescheduleReason = note; update.rescheduleRequestedAt = stamp()
          } else {
            update.status = 'Cancellation Requested'; update.cancellationReason = note; update.cancellationRequestedAt = stamp(); update.refundStatus = 'Pending Approval'
            update.requestDecisionStatus = 'Pending'
          }
        } else {
          check(customer || worker, 'Only consultation participants can perform this action.', 403)
          if (action === 'save_notes') {
            check(worker && appointment.startedAt && !['cancelled', 'rejected'].includes(normalized(appointment.status)), 'Only the assigned practitioner can document a started consultation.', 403)
            check(appointment.staffEarningsStatus !== 'Approved', 'Documentation is locked after earnings approval.')
            check(note.length >= 10, 'Enter consultation notes (at least 10 characters).', 400)
            update.treatmentNotes = note
          } else if (action === 'report_problem') {
            check(customer, 'Only the customer can report a delivery problem.', 403)
            check(!['cancelled', 'rejected'].includes(normalized(appointment.status)), 'This appointment is closed.')
            check(note.length >= 10, 'Explain the problem (at least 10 characters).', 400)
            check(appointment.consultationDispute?.status !== 'Open', 'Your report is already awaiting review.')
            const closed = appointment.workerCompletedAt || appointment.completedAt
            check(!closed || now - timestampDate(closed) <= window.policy.confirmationHours * 3600000, 'The reporting window has ended. Contact the clinic directly.')
            check(appointment.staffEarningsStatus !== 'Approved', 'Contact the clinic about this already settled appointment.')
            update.consultationDispute = { status: 'Open', note, reportedBy: req.user.uid, reportedAt: now.toISOString() }
            update.consultationNeedsReview = true
            if (normalized(appointment.status) !== 'ongoing') update.status = 'Consultation Review'
          } else if (action === 'report_interruption') {
            check(normalized(appointment.status) === 'ongoing' && now < window.end, 'Only an active consultation can record an interruption.')
            check(note.length >= 10, 'Describe the connection issue (at least 10 characters).', 400)
            check(!appointment.consultationInterruption?.open, 'An interruption is already recorded.')
            check((appointment.consultationInterruptions || []).length < 20, 'Contact the clinic to review repeated connection issues.')
            update.consultationInterruption = { open: true, reportedBy: req.user.uid, startedAt: now.toISOString(), note }
            update.consultationNeedsReview = true
          } else if (action === 'resume') {
            check(worker && normalized(appointment.status) === 'ongoing' && appointment.consultationInterruption?.open, 'Only the practitioner can resume an interrupted active consultation.', 403)
            check(req.body?.participantVerified === true, 'Confirm both participants have reconnected.', 400)
            const interruption = appointment.consultationInterruption
            const seconds = Math.max(0, Math.floor((now - timestampDate(interruption.startedAt)) / 1000))
            const used = Number(appointment.consultationExtensionSeconds || 0)
            const extension = Math.max(0, Math.min(seconds, window.policy.interruptionMinutes * 60 - used, Math.floor((window.reservedEnd - window.end) / 1000)))
            update.consultationInterruption = { ...interruption, open: false, endedAt: now.toISOString(), seconds, extendedSeconds: extension }
            update.consultationInterruptions = [...(appointment.consultationInterruptions || []), update.consultationInterruption]
            update.consultationExtensionSeconds = used + extension
            update.consultationWindowEndAt = new Date(window.end.getTime() + extension * 1000).toISOString()
          } else if (action === 'extend') {
            check(worker && normalized(appointment.status) === 'ongoing' && appointment.startedAt, 'Only the assigned practitioner can extend an active consultation.', 403)
            const reservedEnd = window.reservedEnd
            const nextEnd = new Date(Math.min(window.end.getTime() + 5 * 60000, reservedEnd.getTime()))
            check(nextEnd > window.end, 'The reserved appointment buffer has been used. Continue the call and mark it done when finished.')
            update.consultationWindowEndAt = nextEnd.toISOString()
          } else check(false, 'Invalid consultation action.', 400)
        }
        tx.update(ref, update)
        tx.set(db.collection('appointmentAudit').doc(), { appointmentId: ref.id, branchId: appointment.branchId, action: `consultation_${action}`, actorId: req.user.uid, note, previousStatus: appointment.status, nextStatus: update.status || appointment.status, createdAt: stamp() })
        if (['report_problem', 'review'].includes(action)) tx.set(db.collection('notifications').doc(), { recipientUserId: action === 'review' ? appointment.customerId : null, branchId: appointment.branchId, title: action === 'review' ? 'Consultation review updated' : 'Consultation needs review', message: action === 'review' ? `Review outcome: ${req.body.outcome}. ${note}` : 'A customer reported a problem. Review the appointment before settlement.', link: action === 'review' ? '/customer/appointments' : '/crm/appointments', read: false, createdAt: stamp() })
        return { id: ref.id, ...update }
      })
      res.json({ success: true, data })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
