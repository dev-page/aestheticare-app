import crypto from 'node:crypto'
import { assertWorkflow as check, cents, normalized } from './bookingWorkflow.js'

export const registerWalkInPayments = (app, { admin, requireAuth, authorizeClinicAction, verifyCheckout, sendReceipt }) => {
  app.post('/appointments/:id/walk-in-payment', requireAuth, async (req, res) => {
    try {
      const db = admin.firestore(), ref = db.collection('appointments').doc(req.params.id), initialSnap = await ref.get()
      check(initialSnap.exists, 'Appointment not found.', 404)
      const initial = initialSnap.data() || {}
      await authorizeClinicAction(req.user.uid, initial.branchId, 'payments:create')
      check(initial.source === 'walk_in', 'Use customer checkout for online bookings.')
      const method = String(req.body?.method || ''), sessionId = String(req.body?.checkoutSessionId || '').trim()
      check(['Cash', 'Card', 'GCash'].includes(method), 'Select a valid payment method.', 400)
      const verified = method === 'Cash' ? null : await verifyCheckout(sessionId, ref.id, initial.branchId)
      const result = await db.runTransaction(async tx => {
        const snap = await tx.get(ref), appointment = snap.data() || {}, receiptRef = db.collection('transactions').doc(`walk-in-${ref.id}`)
        const existing = await tx.get(receiptRef); if (existing.exists) return { ...existing.data(), alreadyRecorded: true }
        check(appointment.source === 'walk_in' && normalized(appointment.status) === 'unpaid', 'Only unpaid walk-ins can be paid.')
        if (appointment.bookingAgreementRequired) check(appointment.bookingAgreement?.status === 'signed' && appointment.bookingAgreement?.purpose === 'booking_payment_only', 'Accept and sign the booking terms before payment.', 409)
        const amount = cents(appointment.totalAmount ?? appointment.amount)
        check(amount > 0 && cents(req.body?.amount) === amount, 'The payment must match the full appointment amount.', 400)
        if (method === 'Cash') check(cents(req.body?.tendered) >= amount, 'Cash received is less than the amount due.', 400)
        else check(verified.amount === amount, 'Verified payment does not match the appointment.')
        const bookingRef = appointment.bookingId ? db.collection('bookings').doc(appointment.bookingId) : null
        const booking = bookingRef ? (await tx.get(bookingRef)).data() : null
        const siblingIds = booking?.appointmentIds || []
        const siblings = await Promise.all(siblingIds.map(id => tx.get(db.collection('appointments').doc(id))))
        const parentRef = appointment.parentAppointmentId ? db.collection('appointments').doc(appointment.parentAppointmentId) : null
        const parent = parentRef ? await tx.get(parentRef) : null
        const groupRef = appointment.groupBookingId ? db.collection('groupBookings').doc(appointment.groupBookingId) : null
        const group = groupRef ? await tx.get(groupRef) : null
        const timestamp = admin.firestore.FieldValue.serverTimestamp(), serviceKey = String(crypto.randomInt(100000, 1000000))
        const receipt = { appointmentId: ref.id, branchId: appointment.branchId, clientId: appointment.clientId, clientName: appointment.clientName || 'Walk-in client', service: appointment.service || 'Treatment', date: appointment.date, time: appointment.time, amount: amount / 100, total: amount / 100, method, status: 'Paid', type: 'appointment_payment', source: 'receptionist_pos', serviceKey, createdBy: req.user.uid, createdAt: timestamp, tendered: method === 'Cash' ? Number(req.body.tendered) : amount / 100, change: method === 'Cash' ? (cents(req.body.tendered) - amount) / 100 : 0, paymongoCheckoutSessionId: sessionId || null }
        // The payer and the treatment recipient remain separate identities.
        receipt.payerName = appointment.bookedByName || receipt.clientName
        receipt.payerPhone = appointment.bookedByPhone || appointment.customerPhone || ''
        tx.set(receiptRef, receipt); tx.update(ref, { status: 'Paid', paymentStatus: 'Paid', amountPaid: amount / 100, balance: 0, serviceKey, paidAt: timestamp, paymentMethod: method, updatedAt: timestamp })
        if (bookingRef) {
          const paid = siblingIds.length ? siblings.reduce((sum, sibling) => sum + (sibling.id === ref.id ? amount : cents(sibling.data()?.amountPaid)), 0) : amount
          const total = siblingIds.length ? cents(booking.totalAmount ?? booking.amount) : amount
          const summary = { status: paid >= total ? 'Paid' : 'Partially Paid', paymentStatus: paid >= total ? 'Paid' : 'Partially Paid', amountPaid: paid / 100, updatedAt: timestamp }
          tx.set(bookingRef, summary, { merge: true })
          if (parent?.exists) tx.update(parentRef, summary)
          if (group?.exists) tx.update(groupRef, summary)
        }
        return receipt
      })
      let emailSent = false
      if (!result.alreadyRecorded && initial.customerEmail && sendReceipt) try { emailSent = Boolean(await sendReceipt(initial.customerEmail, result)) } catch {}
      res.json({ success: true, data: { ...result, emailSent } })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
