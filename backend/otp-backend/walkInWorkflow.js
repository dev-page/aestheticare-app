import crypto from 'node:crypto'
import { assertWorkflow as check, cents, normalized } from './bookingWorkflow.js'

export const registerWalkInPayments = (app, { admin, requireAuth, authorizeClinicAction, verifyCheckout, sendReceipt }) => {
  app.post('/appointments/:id/walk-in-payment', requireAuth, async (req, res) => {
    try {
      const db = admin.firestore()
      const ref = db.collection('appointments').doc(req.params.id)
      const snapshot = await ref.get()
      check(snapshot.exists, 'Appointment not found.', 404)
      const initial = snapshot.data()
      await authorizeClinicAction(req.user.uid, initial.branchId, 'payments:create')
      check(initial.source === 'walk_in', 'Use customer checkout for online bookings.')
      const sessionId = String(req.body?.checkoutSessionId || '').trim()
      const method = String(req.body?.method || '')
      check(['Cash', 'Card', 'GCash'].includes(method), 'Select a valid payment method.', 400)
      const verified = method === 'Cash' ? null : await verifyCheckout(sessionId, req.params.id, initial.branchId)
      const result = await db.runTransaction(async tx => {
        const fresh = await tx.get(ref)
        const appointment = fresh.data()
        check(appointment.source === 'walk_in' && appointment.branchId === initial.branchId, 'Appointment changed. Refresh POS.')
        const receiptRef = db.collection('transactions').doc(`walk-in-${ref.id}`)
        const existing = await tx.get(receiptRef)
        if (existing.exists) return { ...existing.data(), alreadyRecorded: true }
        check(appointment.approvalStatus === 'Approved' && normalized(appointment.status) === 'unpaid', 'Only unpaid approved walk-ins can be paid.')
        const amount = cents(appointment.totalAmount ?? appointment.amount)
        check(amount > 0 && Number.isFinite(amount), 'This appointment has no valid price.')
        check(cents(req.body?.amount) === amount, 'The payment must match the full appointment amount.', 400)
        if (method === 'Cash') check(Number.isFinite(Number(req.body?.tendered)) && cents(req.body.tendered) >= amount, 'Cash received is less than the amount due.', 400)
        else check(verified.amount === amount, 'Verified payment does not match this appointment.')
        const serviceKey = String(crypto.randomInt(100000, 1000000))
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const receipt = {
          appointmentId: ref.id, branchId: appointment.branchId, clientId: appointment.clientId,
          clientName: appointment.clientName || appointment.customerName || 'Walk-in client',
          service: appointment.service || 'Treatment', date: appointment.date, time: appointment.time,
          amount: amount / 100, total: amount / 100, method, status: 'Paid', type: 'appointment_payment',
          source: 'receptionist_pos', serviceKey, createdBy: req.user.uid, createdAt: timestamp,
          tendered: method === 'Cash' ? Number(req.body.tendered) : amount / 100,
          change: method === 'Cash' ? (cents(req.body.tendered) - amount) / 100 : 0,
          paymongoCheckoutSessionId: sessionId || null,
        }
        tx.set(receiptRef, receipt)
        tx.update(ref, { status: 'Paid', paymentStatus: 'Paid', amountPaid: amount / 100, balance: 0, serviceKey, paidAt: timestamp, paymentMethod: method, updatedAt: timestamp })
        if (appointment.bookingId) tx.set(db.collection('bookings').doc(appointment.bookingId), { status: 'Paid', amountPaid: amount / 100, updatedAt: timestamp }, { merge: true })
        return receipt
      })
      let emailSent = false
      if (!result.alreadyRecorded && initial.customerEmail && sendReceipt) {
        try { emailSent = Boolean(await sendReceipt(initial.customerEmail, result)) } catch { /* Receipt remains available at POS if email delivery fails. */ }
      }
      res.json({ success: true, data: { ...result, emailSent } })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
