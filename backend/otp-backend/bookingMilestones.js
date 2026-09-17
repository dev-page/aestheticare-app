import crypto from 'node:crypto'
import { normalized, initialPaymentReceived, balanceSettled, afterPaymentStatus, assertWorkflow as check } from './bookingWorkflow.js'

export const registerBookingMilestones = (app, { admin, requireAuth }) => {
  const run = (path, action) => app.post(path, requireAuth, async (req, res) => {
    try {
      const db = admin.firestore()
      const result = await db.runTransaction(async (tx) => {
        const ref = db.collection('appointments').doc(req.params.id)
        const snapshot = await tx.get(ref)
        check(snapshot.exists, 'Appointment not found.', 404)
        const appointment = snapshot.data()
        const customer = appointment.customerId === req.user.uid
        const worker = [appointment.practitionerId, appointment.assignedPractitionerId, appointment.staffId, appointment.assignedTo].includes(req.user.uid)
        check(customer || worker, 'Only the booking customer or assigned worker can perform this action.', 403)
        check(!['cancelled', 'rejected'].includes(normalized(appointment.status)), 'This booking is closed.')
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const update = { updatedAt: timestamp }
        const status = normalized(appointment.status)
        if (action === 'sign') {
          check(customer, 'Only the booking customer can sign this contract.', 403)
          check(appointment.approvalStatus === 'Approved' && initialPaymentReceived(appointment), 'Pay the required initial amount after clinic approval before signing.')
          check(appointment.contract?.terms || appointment.contract?.templateUrl, 'The clinic must provide a contract first.')
          check(['contract pending', 'paid', 'ready to start', 'scheduled'].includes(status), 'The contract cannot be signed at this stage.')
          update.contract = { ...appointment.contract, status: 'signed', signatures: { ...(appointment.contract.signatures || {}), [req.user.uid]: { uid: req.user.uid, name: String(req.body?.name || req.user.name || req.user.email || 'Customer'), email: req.user.email || '', signedAt: new Date().toISOString() } } }
          update.contractSignedAt = timestamp
          update.serviceKey = appointment.serviceKey || String(crypto.randomInt(100000, 1000000))
          update.status = afterPaymentStatus({ ...appointment, ...update })
        } else if (action === 'key') {
          check(appointment.approvalStatus === 'Approved' && initialPaymentReceived(appointment) && normalized(appointment.contract?.status) === 'signed', 'Approval, initial payment, and a signed contract are required.')
          check(['paid', 'ready to start', 'scheduled'].includes(status), 'The service key cannot be verified at this stage.')
          check(appointment.serviceKey && String(req.body?.serviceKey || '').trim() === String(appointment.serviceKey), 'Invalid service key.', 403)
          update[customer ? 'customerKeyVerified' : 'workerKeyVerified'] = true
          update[customer ? 'customerKeyVerifiedAt' : 'workerKeyVerifiedAt'] = timestamp
          update.status = afterPaymentStatus({ ...appointment, ...update })
        } else {
          const transition = req.body?.action
          if (transition === 'start') {
            check(worker, 'Only the assigned worker can start the service.', 403)
            check(status === 'ready to start' && appointment.customerKeyVerified && appointment.workerKeyVerified && normalized(appointment.contract?.status) === 'signed' && initialPaymentReceived(appointment), 'Both parties must verify the key after payment and signing.')
            const resourceRefs = (appointment.resources || []).filter((r) => r.kind === 'material').map((r) => ({ ...r, ref: db.collection('inventoryItems').doc(r.id) }))
            const stocks = []
            for (const resource of resourceRefs) stocks.push({ resource, snapshot: await tx.get(resource.ref) })
            for (const { resource, snapshot: stock } of stocks) check(stock.exists && Number(stock.data().currentStock) >= resource.quantity, 'A required material is no longer available. Contact the clinic.')
            for (const { resource, snapshot: stock } of stocks) tx.update(resource.ref, { currentStock: Number(stock.data().currentStock) - resource.quantity, updatedAt: timestamp })
            update.materialsConsumed = true
            update.status = 'Ongoing'; update.startedAt = timestamp; update.startedById = req.user.uid
          } else if (transition === 'worker_complete') {
            check(worker, 'Only the assigned worker can finish the service.', 403)
            check(status === 'ongoing' && appointment.startedAt, 'Start the service before marking it done.')
            update.workerCompleted = true; update.workerCompletedAt = timestamp; update.workerCompletedById = req.user.uid
            update.status = 'Awaiting Customer Confirmation'
          } else if (transition === 'customer_complete') {
            check(customer, 'Only the customer can confirm completion.', 403)
            check(appointment.workerCompleted && ['awaiting customer confirmation', 'balance due'].includes(status), 'The worker must finish the service first.')
            update.customerCompleted = true; update.customerCompletedAt = timestamp
            update.status = balanceSettled(appointment) ? 'Completed' : 'Balance Due'
          } else check(false, 'Invalid booking action.', 400)
        }
        if (update.status === 'Completed') update.completedAt = timestamp
        tx.update(ref, update)
        if (appointment.bookingId) tx.set(db.collection('bookings').doc(appointment.bookingId), { status: update.status, updatedAt: timestamp }, { merge: true })
        const recipientUserId = customer ? appointment.practitionerId || appointment.assignedPractitionerId : appointment.customerId
        if (recipientUserId) tx.set(db.collection('notifications').doc(), { recipientUserId, title: 'Booking updated', message: `${appointment.service || 'Your booking'}: ${update.status}.`, link: customer ? '/practitioner/appointments' : '/customer/appointments', read: false, deleted: false, createdAt: timestamp })
        return { appointmentId: ref.id, status: update.status, contract: update.contract || appointment.contract }
      })
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  run('/appointments/:id/transition', 'transition')
  run('/appointments/:id/verify-service-key', 'key')
  run('/appointments/:id/contract/sign', 'sign')
}
