import crypto from 'node:crypto'
import { assertWorkflow as check, cents, normalized } from './bookingWorkflow.js'

export const assertWalkInPaymentAgreements = (appointment) => {
  check(appointment?.sameDayTreatmentStatus !== 'pending_clinical_clearance', 'The assigned practitioner must clear same-day treatment before it can be signed or paid.', 409)
  if (appointment?.bookingAgreementRequired) {
    check(appointment.bookingAgreement?.status === 'signed' && appointment.bookingAgreement?.purpose === 'booking_payment_only', 'Accept and sign the booking terms before payment.', 409)
  }
  if (Number(appointment?.bookingWorkflowVersion || 0) === 2) {
    check(normalized(appointment.contract?.status) === 'signed', 'The treatment recipient must sign the treatment agreement before payment.', 409)
  }
}

export const registerWalkInPayments = (app, { admin, requireAuth, authorizeClinicAction, verifyCheckout, sendReceipt }) => {
  app.get('/walk-in/pos', requireAuth, async (req, res) => {
    try {
      const branchId = String(req.query?.branchId || '').trim()
      check(branchId, 'Select a branch.', 400)
      await authorizeClinicAction(req.user.uid, branchId, 'payments:create')
      await authorizeClinicAction(req.user.uid, branchId, 'appointments:view')
      const snapshot = await admin.firestore().collection('appointments').where('branchId', '==', branchId).get()
      const appointments = snapshot.docs
        .filter(doc => {
          const appointment = doc.data() || {}
          return appointment.source === 'walk_in'
            && !appointment.isGroupParent
            && !appointment.isBookingOrderParent
            && appointment.sameDayTreatmentStatus !== 'pending_clinical_clearance'
            && normalized(appointment.status) === 'unpaid'
            && normalized(appointment.paymentStatus) !== 'paid'
        })
        .map(doc => {
          const appointment = doc.data() || {}
          const contract = appointment.contract || {}
          return {
            id: doc.id,
            branchId: appointment.branchId,
            clientId: appointment.clientId || null,
            clientName: appointment.clientName || appointment.customerName || 'Walk-in client',
            customerName: appointment.customerName || appointment.clientName || 'Walk-in client',
            customerEmail: appointment.customerEmail || '',
            bookedByName: appointment.bookedByName || appointment.clientName || appointment.customerName || 'Walk-in client',
            bookedByEmail: appointment.bookedByEmail || '',
            service: appointment.service || 'Treatment',
            date: appointment.date || '',
            time: appointment.time || '',
            practitionerName: appointment.practitionerName || '',
            amount: appointment.amount ?? appointment.totalAmount ?? 0,
            totalAmount: appointment.totalAmount ?? appointment.amount ?? 0,
            pricingSnapshot: appointment.pricingSnapshot || null,
            status: appointment.status,
            paymentStatus: appointment.paymentStatus || 'Pending',
            approvalStatus: appointment.approvalStatus || '',
            bookingAgreementStatus: appointment.bookingAgreement?.status || '',
            bookingWorkflowVersion: Number(appointment.bookingWorkflowVersion || 0),
            contract: {
              title: contract.title || 'Treatment agreement',
              terms: contract.terms || '',
              templateUrl: contract.templateUrl || '',
              document: contract.document || null,
              status: contract.status || 'pending',
            },
          }
        })
        .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`))
      res.json({ success: true, data: { appointments } })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })

  app.post('/appointments/:id/walk-in-payment', requireAuth, async (req, res) => {
    try {
      const db = admin.firestore(), ref = db.collection('appointments').doc(req.params.id), initialSnap = await ref.get()
      check(initialSnap.exists, 'Appointment not found.', 404)
      const initial = initialSnap.data() || {}
      await authorizeClinicAction(req.user.uid, initial.branchId, 'payments:create')
      check(initial.source === 'walk_in', 'Use customer checkout for online bookings.')
      assertWalkInPaymentAgreements(initial)
      const method = String(req.body?.method || ''), sessionId = String(req.body?.checkoutSessionId || '').trim()
      check(['Cash', 'Card', 'GCash'].includes(method), 'Select a valid payment method.', 400)
      const verified = method === 'Cash' ? null : await verifyCheckout(sessionId, ref.id, initial.branchId)
      const result = await db.runTransaction(async tx => {
        const snap = await tx.get(ref), appointment = snap.data() || {}, receiptRef = db.collection('transactions').doc(`walk-in-${ref.id}`)
        const existing = await tx.get(receiptRef); if (existing.exists) return { ...existing.data(), alreadyRecorded: true }
        check(appointment.source === 'walk_in' && normalized(appointment.status) === 'unpaid', 'Only unpaid walk-ins can be paid.')
        assertWalkInPaymentAgreements(appointment)
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
        const timestamp = admin.firestore.FieldValue.serverTimestamp(), paidAt = admin.firestore.Timestamp.now(), serviceKey = String(crypto.randomInt(100000, 1000000))
        const receipt = { transactionCode: receiptRef.id, appointmentId: ref.id, branchId: appointment.branchId, customerId: appointment.customerId || null, clientId: appointment.clientId || null, clientName: appointment.clientName || 'Walk-in client', customerEmail: appointment.customerEmail || '', customerPhone: appointment.customerPhone || '', practitionerName: appointment.practitionerName || '', service: appointment.service || 'Treatment', date: appointment.date, time: appointment.time, amount: amount / 100, total: amount / 100, pricingSnapshot: appointment.pricingSnapshot || null, method, status: 'Paid', type: 'appointment_payment', source: 'receptionist_pos', serviceKey, createdBy: req.user.uid, createdAt: paidAt, tendered: method === 'Cash' ? Number(req.body.tendered) : amount / 100, change: method === 'Cash' ? (cents(req.body.tendered) - amount) / 100 : 0, paymongoCheckoutSessionId: sessionId || null, receiptEmailStatus: 'pending' }
        // The payer and the treatment recipient remain separate identities.
        receipt.payerName = appointment.bookedByName || receipt.clientName
        receipt.payerEmail = appointment.bookedByEmail || appointment.customerEmail || ''
        receipt.payerPhone = appointment.bookedByPhone || appointment.customerPhone || ''
        tx.set(receiptRef, receipt); tx.update(ref, { status: 'Paid', paymentStatus: 'Paid', amountPaid: amount / 100, balance: 0, serviceKey, paidAt, paymentMethod: method, updatedAt: timestamp })
        if (appointment.customerId) tx.set(db.collection('notifications').doc(`payment-receipt-${receiptRef.id}`), {
          recipientUserId: appointment.customerId,
          branchId: appointment.branchId,
          title: 'Payment received and receipt ready',
          message: `Your payment for ${appointment.service || 'your appointment'} was recorded. Download the PDF receipt from My Appointments.`,
          link: '/customer/appointments?tab=history', read: false, deleted: false, createdAt: timestamp,
        })
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
      const receiptEmail = initial.bookedByEmail || initial.customerEmail
      if (!result.alreadyRecorded && receiptEmail && sendReceipt) try { emailSent = Boolean(await sendReceipt(receiptEmail, result)) } catch {}
      if (!result.alreadyRecorded) {
        try {
          await db.collection('transactions').doc(result.transactionCode).set({
            receiptEmailStatus: emailSent ? 'sent' : 'failed',
            ...(emailSent ? { receiptEmailSentAt: admin.firestore.Timestamp.now() } : { receiptEmailFailedAt: admin.firestore.Timestamp.now() }),
          }, { merge: true })
        } catch (error) { console.warn('Could not record appointment receipt email status:', error?.message || error) }
      }
      res.json({ success: true, data: { ...result, emailSent } })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
