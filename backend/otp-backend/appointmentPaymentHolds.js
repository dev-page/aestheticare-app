import { timestampMillis } from '../../shared/bookingPaymentHold.js'

const isPaid = attributes => Boolean(attributes?.paid_at)
  || (Array.isArray(attributes?.payments) && attributes.payments.some(payment => payment?.attributes?.status === 'paid'))

const paidAtMillis = attributes => {
  const payment = Array.isArray(attributes?.payments)
    ? attributes.payments.find(item => item?.attributes?.status === 'paid')
    : null
  const value = Number(payment?.attributes?.paid_at || attributes?.paid_at || 0)
  return value > 0 ? (value < 1e12 ? value * 1000 : value) : 0
}

const expireAppointmentHold = async ({ admin, appointmentId, latePayment = null }) => {
  const db = admin.firestore()
  const appointmentRef = db.collection('appointments').doc(appointmentId)
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(appointmentRef)
    if (!snapshot.exists) return false
    const appointment = snapshot.data() || {}
    const holdStatus = String(appointment.paymentHoldStatus || '').toLowerCase()
    const expiry = timestampMillis(appointment.paymentHoldExpiresAt)
    if (!['active', 'checkout_active'].includes(holdStatus) || !expiry || expiry > Date.now()) return false
    if (String(appointment.paymentStatus || '').toLowerCase() === 'paid') return false

    const relatedIds = new Set([
      ...(appointment.isBookingOrderParent && Array.isArray(appointment.appointmentIds) ? appointment.appointmentIds : []),
      ...(appointment.isGroupParent && Array.isArray(appointment.groupRecipientAppointmentIds) ? appointment.groupRecipientAppointmentIds : []),
      ...(appointment.sameDayTreatmentAppointmentId ? [appointment.sameDayTreatmentAppointmentId] : []),
    ].map(value => String(value || '').trim()).filter(Boolean))
    let groupRef = null
    if (appointment.isGroupParent && appointment.groupBookingId) {
      groupRef = db.collection('groupBookings').doc(String(appointment.groupBookingId))
      const group = (await tx.get(groupRef)).data() || {}
      for (const id of group.recipientAppointmentIds || []) relatedIds.add(String(id))
    }
    const related = []
    for (const id of relatedIds) {
      const ref = db.collection('appointments').doc(id)
      const child = await tx.get(ref)
      if (child.exists) related.push({ ref, data: child.data() || {} })
    }
    const bookingRef = appointment.bookingId ? db.collection('bookings').doc(String(appointment.bookingId)) : null
    const sessionQueries = []
    for (const id of [appointmentId, ...related.map(row => row.ref.id)]) {
      sessionQueries.push(tx.get(db.collection('treatmentSessions').where('treatmentPlanAppointmentId', '==', id)))
    }
    const sessionSnapshots = await Promise.all(sessionQueries)
    const stamp = admin.firestore.FieldValue.serverTimestamp()
    const released = {
      status: 'Expired', approvalStatus: 'Expired',
      paymentStatus: 'Expired', paymentHoldStatus: 'released',
      activePaymongoCheckoutSessionId: '', paymentHoldDeadlineAt: appointment.paymentHoldExpiresAt,
      paymentHoldExpiresAt: null, holdReleasedAt: stamp,
      updatedAt: stamp,
    }
    tx.update(appointmentRef, released)
    for (const { ref, data } of related) {
      if (String(data.paymentStatus || '').toLowerCase() === 'paid') continue
      tx.update(ref, {
        ...released,
        ...(data.sameDayConsultationAppointmentId ? { sameDayTreatmentStatus: 'booking_expired' } : {}),
      })
    }
    for (const sessions of sessionSnapshots) for (const session of sessions.docs) {
      const state = String(session.data()?.status || '').toLowerCase()
      if (!['completed', 'forfeited', 'cancelled', 'expired'].includes(state)) tx.update(session.ref, { status: 'Expired', updatedAt: stamp })
    }
    if (bookingRef) tx.set(bookingRef, { ...released, amountPaid: appointment.amountPaid || 0 }, { merge: true })
    if (groupRef) tx.set(groupRef, { ...released, updatedAt: stamp }, { merge: true })
    if (latePayment?.checkoutSessionId) {
      const reviewRef = db.collection('appointmentPaymentReviews').doc(String(latePayment.checkoutSessionId))
      tx.set(reviewRef, {
        checkoutSessionId: latePayment.checkoutSessionId,
        paymentId: latePayment.paymentId || null,
        appointmentId,
        customerId: appointment.customerId || '',
        branchId: appointment.branchId || '',
        status: 'Needs Review',
        reason: 'PayMongo confirmed payment after the appointment slot hold expired.',
        createdAt: stamp,
      }, { merge: true })
    }
    if (appointment.customerId) tx.set(db.collection('notifications').doc(`booking-expired-${appointmentId}`), {
      recipientUserId: appointment.customerId,
      title: latePayment ? 'Payment needs clinic review' : 'Appointment hold expired',
      message: latePayment
        ? 'Payment arrived after the appointment hold expired. The clinic will review it and contact you.'
        : 'The payment window ended, so the appointment time was released. Choose another available time to book again.',
      link: '/customer/appointments', read: false, deleted: false, createdAt: stamp,
    })
    return true
  })
}

export const createAppointmentPaymentHoldReaper = ({ app, admin, getPayMongoHeaders, recordPayment, getCronSecret }) => {
  let running = false
  const expireDueHolds = async () => {
    if (running) return { expired: 0, skipped: true }
    running = true
    let expired = 0
    try {
      const db = admin.firestore()
      const now = Date.now()
      const due = await db.collection('appointments')
        .where('paymentHoldExpiresAt', '<=', admin.firestore.Timestamp.fromMillis(now))
        .limit(100)
        .get()
      for (const snapshot of due.docs) {
        const appointment = snapshot.data() || {}
        const holdStatus = String(appointment.paymentHoldStatus || '').toLowerCase()
        if (!['active', 'checkout_active'].includes(holdStatus) || appointment.paymentHoldParentId) {
          // Clear old/child deadlines so they cannot occupy the first page of
          // the expiry query and starve active parent holds behind them.
          await db.runTransaction(async tx => {
            const current = await tx.get(snapshot.ref)
            if (!current.exists) return
            const fresh = current.data() || {}
            if (timestampMillis(fresh.paymentHoldExpiresAt) !== timestampMillis(appointment.paymentHoldExpiresAt)) return
            if (fresh.paymentHoldParentId || !['active', 'checkout_active'].includes(String(fresh.paymentHoldStatus || '').toLowerCase())) {
              tx.update(snapshot.ref, { paymentHoldDeadlineAt: fresh.paymentHoldExpiresAt, paymentHoldExpiresAt: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
            }
          })
          continue
        }
        // Child appointments share the checkout and expiry of their order/group
        // parent; the parent expires them together in one transaction.
        const checkoutSessionId = String(appointment.activePaymongoCheckoutSessionId || '').trim()
        let sessionAttributes = null
        if (checkoutSessionId) {
          const lookup = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`, { headers: getPayMongoHeaders() })
          const lookupBody = await lookup.json().catch(() => ({}))
          if (!lookup.ok) continue
          sessionAttributes = lookupBody?.data?.attributes || {}
          if (isPaid(sessionAttributes)) {
            const paidAt = paidAtMillis(sessionAttributes)
            const paidEntry = Array.isArray(sessionAttributes.payments) ? sessionAttributes.payments.find(item => item?.attributes?.status === 'paid') : null
            if (!paidAt || paidAt <= timestampMillis(appointment.paymentHoldExpiresAt)) {
              let status = 200, body = null
              await recordPayment({
                params: { id: snapshot.id },
                user: { uid: String(appointment.customerId || '') },
                body: { checkoutSessionId, paymentAgreementAcknowledged: true },
              }, {
                status(code) { status = code; return this },
                json(value) { body = value; return this },
              })
              if (status === 200 && body?.success) continue
            }
            await expireAppointmentHold({ admin, appointmentId: snapshot.id, latePayment: { checkoutSessionId, paymentId: paidEntry?.id || null } })
            expired += 1
            continue
          }
          if (String(sessionAttributes.status || '').toLowerCase() !== 'expired') {
            const expire = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(checkoutSessionId)}/expire`, {
              method: 'POST', headers: getPayMongoHeaders(),
            })
            if (!expire.ok) {
              // PayMongo refuses to expire an in-flight payment. Keep the slot
              // until the payment outcome is known, then retry.
              continue
            }
          }
        }
        if (await expireAppointmentHold({ admin, appointmentId: snapshot.id })) expired += 1
      }
      return { expired }
    } finally {
      running = false
    }
  }

  const cron = async (req, res) => {
    const secret = String(getCronSecret() || '').trim()
    if (!secret || String(req.get('authorization') || '') !== `Bearer ${secret}`) return res.status(401).json({ success: false, error: 'Unauthorized.' })
    try { return res.json({ success: true, ...(await expireDueHolds()) }) }
    catch (error) {
      console.error('Appointment payment hold expiry failed:', error?.message || error)
      return res.status(500).json({ success: false, error: 'Unable to release expired appointment holds.' })
    }
  }
  app.all('/cron/appointment-payment-holds', cron)
  const timer = setInterval(() => { expireDueHolds().catch(error => console.error('Appointment payment hold sweep failed:', error?.message || error)) }, 15_000)
  timer.unref?.()
  expireDueHolds().catch(error => console.error('Initial appointment payment hold sweep failed:', error?.message || error))
  return { expireDueHolds }
}
