import { onlineWindow, timestampDate } from '../../shared/onlineConsultation.js'
import { normalized } from './bookingWorkflow.js'

// Close application records, never claim to disconnect an external Meet call.
export const closeExpiredConsultations = async admin => {
  const db = admin.firestore(), now = new Date()
  // Use the existing single-field status index; do not reread completed history every minute.
  const rows = await db.collection('appointments').where('status', 'in', ['Paid', 'Scheduled', 'Ready to Start', 'Ongoing', 'Awaiting Customer Confirmation', 'paid', 'scheduled', 'ready to start', 'ongoing', 'awaiting customer confirmation']).get()
  let closed = 0
  const appointmentIds = []
  for (const doc of rows.docs) {
    const result = await db.runTransaction(async tx => {
      const appointment = (await tx.get(doc.ref)).data()
      if (!appointment || normalized(appointment.type) !== 'consultation' || normalized(appointment.consultationMode) !== 'online') return false
      const window = onlineWindow(appointment)
      if (!Number.isFinite(window.start.getTime())) return false
      const stamp = admin.firestore.FieldValue.serverTimestamp()
      if (normalized(appointment.status) === 'awaiting customer confirmation') {
        const finished = timestampDate(appointment.workerCompletedAt || appointment.consultationEndedAt)
        const elapsed = now - finished
        if (elapsed >= window.policy.confirmationHours * 3600000) {
          tx.update(doc.ref, { status: 'Consultation Review', consultationNeedsReview: true, consultationReviewReason: 'Customer confirmation was not received within 48 hours.', updatedAt: stamp })
          tx.set(db.collection('notifications').doc('consultation-confirmation-review-' + doc.id), { branchId: appointment.branchId, title: 'Consultation confirmation needs review', message: 'Customer confirmation is overdue. Review delivery; do not automatically confirm it.', link: '/crm/appointments', read: false, createdAt: stamp })
          return true
        }
        if (elapsed >= 24 * 3600000 && !appointment.consultationConfirmationReminderAt) {
          tx.update(doc.ref, { consultationConfirmationReminderAt: stamp, updatedAt: stamp })
          tx.set(db.collection('notifications').doc('consultation-confirmation-reminder-' + doc.id), { recipientUserId: appointment.customerId, title: 'Confirm your consultation', message: 'Confirm receipt or report a problem from your appointments.', link: '/customer/appointments', read: false, createdAt: stamp })
        }
        return false
      }
      if (!['paid', 'scheduled', 'ready to start', 'ongoing'].includes(normalized(appointment.status))) return false
      const active = normalized(appointment.status) === 'ongoing' && appointment.startedAt
      if (now < (active ? window.end : window.arrivalDeadline)) return false
      const status = active && appointment.consultationDispute?.status !== 'Open' ? 'Awaiting Customer Confirmation' : 'Consultation Review'
      const actualEnd = timestampDate(appointment.consultationEndedAt || window.end)
      const duration = active ? Math.max(0, Math.floor((actualEnd - timestampDate(appointment.startedAt)) / 1000)) : 0
      tx.update(doc.ref, { status, consultationReviewReason: active ? 'Consultation time elapsed; review documentation and any interruptions.' : 'Arrival grace period elapsed. Review attendance, practitioner availability, and technical problems before assigning fault.', consultationWindowEndedAt: stamp, consultationEndedByTimer: true, consultationEndedAt: appointment.consultationEndedAt || (active ? window.end : window.arrivalDeadline).toISOString(), consultationEndedById: appointment.consultationEndedById || 'system', consultationActualDurationSeconds: duration, consultationNeedsReview: true, ...(active ? { workerCompleted: true, workerCompletedAt: stamp, workerCompletedById: 'system' } : {}), updatedAt: stamp })
      tx.set(db.collection('appointmentAudit').doc(), { appointmentId: doc.id, branchId: appointment.branchId, actorId: 'system', action: 'consultation_window_expired', previousStatus: appointment.status, nextStatus: status, createdAt: stamp })
      tx.set(db.collection('notifications').doc('consultation-host-end-' + doc.id), { recipientUserId: appointment.assignedPractitionerId || appointment.practitionerId, branchId: appointment.branchId, title: 'Consultation window closed', message: 'End Google Meet for everyone and save your notes. Closing this record does not disconnect the external call.', link: '/crm/appointments?tab=queue&mode=online', read: false, createdAt: stamp })
      if (appointment.customerId) tx.set(db.collection('notifications').doc('consultation-ended-' + doc.id), { recipientUserId: appointment.customerId, title: 'Consultation window ended', message: active ? 'Confirm receipt or report a problem from your appointments.' : 'The consultation needs clinic review. Contact the clinic about a reschedule or refund; no automatic no-show penalty was applied.', link: '/customer/appointments', read: false, createdAt: stamp })
      return true
    })
    if (result) { closed++; appointmentIds.push(doc.id) }
  }
  return { closed, appointmentIds }
}

export const registerConsultationWindows = (app, { admin, ready = () => true }) => {
  app.all('/cron/consultation-windows', async (req, res) => {
    const secret = String(process.env.CRON_SECRET || '')
    if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(401).json({ success: false, error: 'Unauthorized.' })
    try { res.json({ success: true, data: await closeExpiredConsultations(admin) }) }
    catch (error) { console.error('Consultation window cleanup failed:', error.message); res.status(500).json({ success: false, error: 'Unable to close consultation windows.' }) }
  })
  let running = false
  const timer = setInterval(async () => {
    if (!ready() || running) return
    running = true
    try { await closeExpiredConsultations(admin) } catch (error) { console.warn('Consultation window cleanup failed:', error.message) } finally { running = false }
  }, 60000)
  timer.unref()
  return () => clearInterval(timer)
}
