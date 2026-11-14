const check = (condition, message, status = 409) => {
  if (!condition) throw Object.assign(new Error(message), { status })
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

const dateOf = value => {
  if (value?.toDate) return value.toDate()
  if (value instanceof Date) return value
  const parsed = new Date(value || 0)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

const receiptMessage = payment => {
  const recipient = String(payment.payerEmail || '').trim().toLowerCase()
  check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient), 'The verified payment has no valid receipt email.')
  const payer = String(payment.payerName || 'Customer').trim().slice(0, 180) || 'Customer'
  const plan = String(payment.planName || 'Subscription').trim().slice(0, 120) || 'Subscription'
  const amount = Number(payment.amount)
  check(Number.isFinite(amount) && amount > 0, 'The verified payment amount is invalid.')
  const amountLabel = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
  const method = String(payment.paymentMethod || '').trim().slice(0, 80)
  const reference = String(payment.referenceNumber || '').trim().slice(0, 120)
  const details = [
    `Plan: ${plan}`,
    `Amount: ${amountLabel}`,
    ...(method ? [`Payment Method: ${method}`] : []),
    ...(reference ? [`Reference: ${reference}`] : []),
  ].join('\n')
  const htmlDetails = [
    ['Plan', plan], ['Amount', amountLabel], ...(method ? [['Payment Method', method]] : []), ...(reference ? [['Reference', reference]] : []),
  ].map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0"><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`).join('')
  return {
    To: recipient,
    Subject: 'Subscription payment successful',
    TextBody: `Hi ${payer},\n\nYour subscription payment was successful.\n${details}\n\nThank you for subscribing to AesthetiCare.`,
    HtmlBody: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#2a1408"><h2>Payment Successful</h2><p>Hi ${escapeHtml(payer)},</p><p>Your subscription payment was successful.</p><table style="border-collapse:collapse;margin-top:12px">${htmlDetails}</table><p style="margin-top:16px">Thank you for subscribing to AesthetiCare.</p></div>`,
  }
}

export function registerPaymentReceiptWorkflow(app, { admin, sendEmail, now = () => new Date() }) {
  const db = admin.firestore()
  app.post('/send-payment-receipt', async (req, res) => {
    const checkoutSessionId = String(req.body?.checkoutSessionId || '').trim()
    if (!/^cs_[A-Za-z0-9]{5,120}$/.test(checkoutSessionId)) {
      return res.status(400).json({ success: false, error: 'A valid checkout session is required.' })
    }
    if (typeof sendEmail !== 'function') {
      return res.status(503).json({ success: false, error: 'Payment receipt email is unavailable.' })
    }

    const ref = db.collection('planPayments').doc(`paymongo-${checkoutSessionId}`)
    const attemptAt = now()
    let claimed
    try {
      claimed = await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref)
        check(snapshot.exists, 'Verified payment was not found.', 404)
        const payment = snapshot.data() || {}
        check(payment.source === 'paymongo_checkout'
          && payment.status === 'Paid'
          && String(payment.paymongoStatus || '').toLowerCase() === 'paid'
          && payment.paymongoCheckoutSessionId === checkoutSessionId,
        'A successful subscription payment could not be verified.')
        if (payment.receiptEmailStatus === 'sent') return { alreadySent: true }
        if (payment.receiptEmailStatus === 'sending'
          && attemptAt.getTime() - dateOf(payment.receiptEmailAttemptAt).getTime() < 10 * 60 * 1000) {
          return { inProgress: true }
        }
        tx.set(ref, { receiptEmailStatus: 'sending', receiptEmailAttemptAt: attemptAt }, { merge: true })
        return { payment }
      })
    } catch (error) {
      return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Could not verify the payment receipt.' })
    }

    if (claimed.alreadySent) return res.json({ success: true, data: { alreadySent: true } })
    if (claimed.inProgress) return res.status(202).json({ success: true, data: { alreadyInProgress: true } })

    try {
      const message = receiptMessage(claimed.payment)
      await sendEmail(message)
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref)
        if (snapshot.exists) tx.set(ref, { receiptEmailStatus: 'sent', receiptEmailSentAt: now() }, { merge: true })
      })
      return res.json({ success: true, data: { sent: true } })
    } catch (error) {
      try {
        await db.runTransaction(async tx => {
          const snapshot = await tx.get(ref)
          if (snapshot.exists) tx.set(ref, { receiptEmailStatus: 'failed', receiptEmailFailedAt: now() }, { merge: true })
        })
      } catch (_) {}
      return res.status(error.status || 502).json({ success: false, error: error.status ? error.message : 'The receipt email could not be sent.' })
    }
  })
}
