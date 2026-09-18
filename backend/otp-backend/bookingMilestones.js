import crypto from 'node:crypto'
import { normalized, initialPaymentReceived, balanceSettled, afterPaymentStatus, assertWorkflow as check } from './bookingWorkflow.js'

const getServiceKeyWindow = (appointment) => {
  const date = String(appointment.date || '').trim()
  const time = String(appointment.time || '').trim()
  if (!date || !time) return null
  const start = new Date(`${date}T${time}+08:00`)
  if (Number.isNaN(start.getTime())) return null
  const endTime = String(appointment.endTime || '').trim()
  const end = endTime ? new Date(`${date}T${endTime}+08:00`) : new Date(start.getTime() + Math.max(30, Number(appointment.totalServiceDurationMinutes || 60)) * 60 * 1000)
  if (Number.isNaN(end.getTime()) || end <= start) return null
  return { opensAt: new Date(start.getTime() - 30 * 60 * 1000), closesAt: end }
}

export const registerBookingMilestones = (app, { admin, requireAuth, authorizeClinicAction }) => {
  const run = (path, action) => app.post(path, requireAuth, async (req, res) => {
    try {
      const db = admin.firestore()
      const result = await db.runTransaction(async (tx) => {
        const ref = db.collection('appointments').doc(req.params.id)
        const snapshot = await tx.get(ref)
        check(snapshot.exists, 'Appointment not found.', 404)
        const appointment = snapshot.data()
        const walkIn = appointment.source === 'walk_in'
        const customer = !walkIn && appointment.customerId === req.user.uid
        const worker = [appointment.practitionerId, appointment.assignedPractitionerId, appointment.staffId, appointment.assignedTo].includes(req.user.uid)
        let assistedSigning = false
        if (walkIn && action === 'sign') {
          if (!worker) await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:create')
          assistedSigning = true
        }
        check(customer || worker || assistedSigning, 'Only the booking customer or assigned worker can perform this action.', 403)
        check(!['cancelled', 'rejected'].includes(normalized(appointment.status)), 'This booking is closed.')
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const update = { updatedAt: timestamp }
        const status = normalized(appointment.status)
        if (action === 'sign') {
          check(customer || assistedSigning, 'Only the customer or authorized walk-in assistant can submit the signature.', 403)
          if (walkIn) check(balanceSettled(appointment), 'Collect payment at POS before signing.')
          check(appointment.approvalStatus === 'Approved', 'The clinic must approve this booking before signing.')
          check(normalized(appointment.contract?.status) !== 'signed', 'This contract has already been signed.')
          const signatureImage = String(req.body?.signatureImage || '')
          check(req.body?.accepted === true, 'Please accept the contract before signing.', 400)
          check(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signatureImage) && signatureImage.length <= 200000, 'Draw your electronic signature (PNG, up to 150 KB).', 400)
          const signatureBytes = Buffer.from(signatureImage.split(',')[1], 'base64')
          check(signatureBytes.length > 32 && signatureBytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid signature image.', 400)
          check(appointment.contract?.terms || appointment.contract?.templateUrl, 'The clinic must provide a contract first.')
          check(['contract pending', 'awaiting payment', 'payment pending', 'approved', 'paid', 'ready to start', 'scheduled'].includes(status), 'The contract cannot be signed at this stage.')
          update.contract = { ...appointment.contract, status: 'signed', signatures: { ...(appointment.contract.signatures || {}), [walkIn ? appointment.clientId : req.user.uid]: { uid: walkIn ? null : req.user.uid, clientId: walkIn ? appointment.clientId : null, witnessedBy: walkIn ? req.user.uid : null, signatureImage, method: 'drawn-signature', accepted: true, name: String(walkIn ? appointment.clientName || appointment.customerName || 'Walk-in client' : req.body?.name || req.user.name || req.user.email || 'Customer'), email: walkIn ? appointment.customerEmail || '' : req.user.email || '', signedAt: new Date().toISOString() } } }
          update.contractSignedAt = timestamp
          update.serviceKey = appointment.serviceKey || String(crypto.randomInt(100000, 1000000))
          update.status = afterPaymentStatus({ ...appointment, ...update })
        } else if (action === 'key') {
          check(worker, 'Only the assigned practitioner can verify the service key.', 403)
          check(appointment.approvalStatus === 'Approved' && initialPaymentReceived(appointment) && normalized(appointment.contract?.status) === 'signed', 'Approval, initial payment, and a signed contract are required.')
          check(['paid', 'ready to start', 'scheduled'].includes(status), 'The service key cannot be verified at this stage.')
          const keyWindow = getServiceKeyWindow(appointment)
          if (keyWindow) {
            const now = new Date()
            check(now >= keyWindow.opensAt, 'The service key can be verified only within 30 minutes of the appointment start time.')
            check(now <= keyWindow.closesAt, 'The service key has expired for this appointment.')
          }
          check(appointment.serviceKey && String(req.body?.serviceKey || '').trim() === String(appointment.serviceKey), 'Invalid service key.', 403)
          update.workerKeyVerified = true
          update.workerKeyVerifiedAt = timestamp
          update.status = afterPaymentStatus({ ...appointment, ...update })
        } else {
          const transition = req.body?.action
          if (transition === 'start') {
            check(worker, 'Only the assigned worker can start the service.', 403)
            check((status === 'ready to start' || (walkIn && status === 'paid')) && appointment.workerKeyVerified && normalized(appointment.contract?.status) === 'signed' && initialPaymentReceived(appointment), 'The practitioner must verify the customer service key after payment and signing.')
            const resourceRefs = (appointment.resources || []).filter((r) => r.kind === 'material').map((r) => ({ ...r, ref: db.collection('inventoryItems').doc(r.id) }))
            const stocks = []
            for (const resource of resourceRefs) stocks.push({ resource, snapshot: await tx.get(resource.ref) })
            for (const { resource, snapshot: stock } of stocks) check(stock.exists && Number(stock.data().currentStock) >= resource.quantity, 'A required material is no longer available. Contact the clinic.')
            for (const { resource, snapshot: stock } of stocks) tx.update(resource.ref, { currentStock: Number(stock.data().currentStock) - resource.quantity, updatedAt: timestamp })
            tx.set(db.collection('inventoryMovements').doc('service-' + ref.id), { branchId: appointment.branchId, appointmentId: ref.id, type: 'service_consumption', items: (appointment.resources || []).filter((r) => r.kind === 'material'), createdBy: req.user.uid, createdAt: timestamp })
            update.materialsConsumed = true
            update.status = 'Ongoing'; update.startedAt = timestamp; update.startedById = req.user.uid
          } else if (transition === 'worker_complete') {
            check(worker, 'Only the assigned worker can finish the service.', 403)
            check(status === 'ongoing' && appointment.startedAt, 'Start the service before marking it done.')
            update.workerCompleted = true; update.workerCompletedAt = timestamp; update.workerCompletedById = req.user.uid
            update.status = walkIn ? 'Completed' : 'Awaiting Customer Confirmation'
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
        if (recipientUserId && !walkIn) tx.set(db.collection('notifications').doc(), { recipientUserId, title: 'Booking updated', message: `${appointment.service || 'Your booking'}: ${update.status}.`, link: customer ? '/clinical/appointments' : '/customer/appointments', read: false, deleted: false, createdAt: timestamp })
        return { appointmentId: ref.id, status: update.status, contract: update.contract || appointment.contract }
      })
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  run('/appointments/:id/transition', 'transition')
  run('/appointments/:id/verify-service-key', 'key')
  run('/appointments/:id/contract/sign', 'sign')
}
