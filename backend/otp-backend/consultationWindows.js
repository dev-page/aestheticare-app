import { normalized } from './bookingWorkflow.js'

// Close application records, never claim to disconnect an external Meet call.
export const closeExpiredConsultations = async admin => {
  const db = admin.firestore(), now = new Date()
  const rows = await db.collection('appointments').where('type', '==', 'Consultation').get()
  let closed = 0
  const appointmentIds = []
  for (const doc of rows.docs) {
    const result = await db.runTransaction(async tx => {
      const appointment = (await tx.get(doc.ref)).data()
      if (!appointment || normalized(appointment.consultationMode) !== 'online') return false
      if (!['paid', 'scheduled', 'ready to start', 'ongoing'].includes(normalized(appointment.status))) return false
      const start = new Date(`${appointment.date}T${appointment.time}+08:00`)
      const end = new Date(start.getTime() + Math.min(240, Math.max(5, Number(appointment.consultationDurationMinutes || appointment.totalServiceDurationMinutes || 30))) * 60000)
      if (!Number.isFinite(end.getTime()) || now < end) return false
      const active = appointment.status === 'Ongoing' && appointment.startedAt && appointment.clientJoinedAt && appointment.practitionerJoinedAt
      const status = active ? 'Awaiting Customer Confirmation' : appointment.clientJoinedAt ? 'Incomplete' : 'No-show'
      const stamp = admin.firestore.FieldValue.serverTimestamp()
      const actualEnd = new Date(appointment.consultationEndedAt?.toDate?.() || appointment.consultationEndedAt || end)
      const duration = active ? Math.max(0, Math.floor((actualEnd.getTime() - new Date(appointment.startedAt?.toDate?.() || appointment.startedAt).getTime()) / 1000)) : 0
      tx.update(doc.ref, { status, consultationWindowEndedAt: stamp, consultationEndedByTimer: true, consultationEndedAt: appointment.consultationEndedAt || end.toISOString(), consultationEndedById: appointment.consultationEndedById || 'system', consultationActualDurationSeconds: duration, consultationNeedsReview: !active || duration < 60 || !appointment.treatmentNotes, ...(active ? { workerCompleted: true, workerCompletedAt: stamp, workerCompletedById: 'system' } : {}), updatedAt: stamp })
      tx.set(db.collection('appointmentAudit').doc(), { appointmentId: doc.id, branchId: appointment.branchId, actorId: 'system', action: 'consultation_window_expired', previousStatus: appointment.status, nextStatus: status, createdAt: stamp })
      if (appointment.customerId) tx.set(db.collection('notifications').doc(), { recipientUserId: appointment.customerId, title: 'Consultation window ended', message: active ? 'The scheduled consultation window ended. Confirm whether you received your consultation or contact the clinic about a problem.' : 'The consultation was not completed. Contact the clinic to resolve the schedule.', link: '/customer/appointments', read: false, createdAt: stamp })
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
