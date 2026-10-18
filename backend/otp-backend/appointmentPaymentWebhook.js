import crypto from 'node:crypto'

// Verify the exact bytes received, before trusting any event fields.
export const verifyPayMongoSignature = ({ rawBody, signature, secret, mode, now = Date.now() }) => {
  if (!secret || !['test', 'live'].includes(mode) || !Buffer.isBuffer(rawBody)) return false
  const fields = Object.fromEntries(String(signature || '').split(',').map(part => part.trim().split('=')))
  if (!/^\d+$/.test(fields.t || '') || Math.abs(now / 1000 - Number(fields.t)) > 300) return false
  const supplied = fields[mode === 'live' ? 'li' : 'te'] || ''
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false
  const expected = crypto.createHmac('sha256', secret).update(`${fields.t}.`).update(rawBody).digest()
  return crypto.timingSafeEqual(expected, Buffer.from(supplied, 'hex'))
}

export const registerAppointmentPaymentWebhook = (app, { admin, recordPayment, getSecret, getMode }) => {
  app.post('/paymongo/webhook', async (req, res) => {
    const secret = getSecret(), mode = getMode()
    if (!secret || !['test', 'live'].includes(mode)) return res.status(503).json({ success: false, error: 'Payment webhook is not configured.' })
    if (!verifyPayMongoSignature({ rawBody: req.rawBody, signature: req.get('paymongo-signature'), secret, mode })) {
      return res.status(401).json({ success: false, error: 'Invalid payment webhook signature.' })
    }
    try {
      const event = JSON.parse(req.rawBody.toString('utf8'))?.data?.attributes
      if (event?.livemode !== (mode === 'live')) return res.status(400).json({ success: false, error: 'Payment webhook mode mismatch.' })
      if (event.type !== 'checkout_session.payment.paid') return res.json({ success: true, ignored: true })
      const session = event.data, metadata = session?.attributes?.metadata || {}
      // Other checkout purposes (such as subscriptions) retain their own flow.
      if (!metadata.appointmentId) return res.json({ success: true, ignored: true })
      const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value)
      if (!validId(session.id) || !validId(metadata.appointmentId) || !validId(metadata.customerId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment payment event.' })
      }
      let status = 200, result
      // Reuse the authenticated return flow's provider lookup, amount checks,
      // transaction and session deduplication. The signed event identifies the
      // customer; no browser redirect or customer access token is required.
      await recordPayment({
        params: { id: metadata.appointmentId }, user: { uid: metadata.customerId },
        body: { checkoutSessionId: session.id, paymentAgreementAcknowledged: true },
      }, { status(code) { status = code; return this }, json(body) { result = body; return this } })
      if (status === 200 && result?.success) return res.json({ success: true })
      if ([403, 404, 409].includes(status)) {
        // A paid checkout may arrive after cancellation or a schedule change.
        // Preserve it for reconciliation without reopening the appointment or
        // silently dropping the customer's money. Duplicate deliveries are safe.
        const db = admin.firestore(), ref = db.collection('appointmentPaymentReviews').doc(session.id)
        await db.runTransaction(async tx => {
          if ((await tx.get(ref)).exists) return
          const appointment = (await tx.get(db.collection('appointments').doc(metadata.appointmentId))).data()
          const stamp = admin.firestore.FieldValue.serverTimestamp()
          tx.set(ref, { checkoutSessionId: session.id, appointmentId: metadata.appointmentId, customerId: metadata.customerId, branchId: appointment?.branchId || null, status: 'Needs Review', reason: result?.error || 'Payment could not be applied automatically.', createdAt: stamp })
          tx.set(db.collection('notifications').doc(`payment-review-${session.id}`), {
            ...(appointment?.branchId ? { branchId: appointment.branchId } : { recipientUserId: metadata.customerId }),
            title: 'Appointment payment needs review', message: `Paid checkout ${session.id} for appointment ${metadata.appointmentId} could not be applied automatically: ${result?.error || 'The booking changed.'} Check the checkout in PayMongo before collecting again.`,
            link: appointment?.branchId ? '/crm/appointments' : '/customer/appointments', read: false, deleted: false, createdAt: stamp,
          })
        })
        return res.json({ success: true, needsReview: true })
      }
      return res.status(503).json({ success: false, error: 'Payment reconciliation is temporarily unavailable. Retry delivery.' })
    } catch (error) {
      console.error('Appointment payment webhook failed:', error.message)
      return res.status(503).json({ success: false, error: 'Unable to reconcile payment. Retry delivery.' })
    }
  })
}
