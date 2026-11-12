import { normalized } from './bookingWorkflow.js'

const toDate = value => {
  if (value?.toDate) return value.toDate()
  if (Number.isFinite(Number(value?._seconds))) return new Date(Number(value._seconds) * 1000)
  return new Date(value)
}

// Remind account holders to acknowledge completed, non-online appointments.
// Keep the appointment pending until the customer confirms; never infer consent
// from a missed reminder. Online consultations have their own review workflow.
export const remindPendingAppointmentConfirmations = async (admin, now = new Date()) => {
  const db = admin.firestore()
  const rows = await db.collection('appointments')
    .where('status', 'in', ['Awaiting Customer Confirmation', 'awaiting customer confirmation'])
    .get()
  let reminders = 0

  for (const row of rows.docs) {
    const reminderRef = db.collection('notifications').doc(`service-confirmation-reminder-${row.id}`)
    const created = await db.runTransaction(async tx => {
      const [appointmentSnapshot, reminderSnapshot] = await Promise.all([
        tx.get(row.ref),
        tx.get(reminderRef),
      ])
      const appointment = appointmentSnapshot.exists ? appointmentSnapshot.data() || {} : null
      const onlineConsultation = normalized(appointment?.type) === 'consultation'
        && normalized(appointment?.consultationMode) === 'online'
      if (!appointment || reminderSnapshot.exists || appointment.customerCompletionReminderAt
        || appointment.customerCompleted || appointment.isGroupRecipient || appointment.isGroupParent
        || appointment.isBookingOrderParent || appointment.source === 'walk_in'
        || !appointment.customerId || onlineConsultation
        || normalized(appointment.status) !== 'awaiting customer confirmation') return false

      const completedAt = toDate(appointment.workerCompletedAt || appointment.updatedAt)
      if (!Number.isFinite(completedAt.getTime()) || now.getTime() - completedAt.getTime() < 24 * 60 * 60 * 1000) return false

      const stamp = admin.firestore.FieldValue.serverTimestamp()
      tx.update(row.ref, { customerCompletionReminderAt: stamp, updatedAt: stamp })
      tx.set(reminderRef, {
        recipientUserId: appointment.customerId,
        branchId: appointment.branchId || '',
        title: 'Please confirm service receipt',
        message: `${appointment.service || 'Your appointment'} was marked complete. Confirm receipt in My Appointments. If you have a concern, contact the clinic.`,
        link: '/customer/appointments',
        read: false,
        deleted: false,
        createdAt: stamp,
      })
      return true
    })
    if (created) reminders += 1
  }

  return reminders
}
