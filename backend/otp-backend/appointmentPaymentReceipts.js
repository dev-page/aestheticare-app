import { jsPDF } from 'jspdf'

const clean = (value, max = 180) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
const dateValue = value => value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value || '')
const receiptDate = value => {
  const date = dateValue(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
}
const currency = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))

export const createAppointmentPaymentReceiptPdf = ({ appointment = {}, payment = {}, clinicName = '' }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const reference = clean(payment.transactionCode || payment.referenceNumber || payment.checkoutSessionId || payment.id || appointment.id, 120)
  const service = clean(appointment.service || appointment.serviceName || payment.service || 'Clinic appointment', 180)
  const total = Number(appointment.totalAmount || appointment.amount || payment.invoiceTotal || payment.total || payment.amount || 0)
  const paidToDate = Number(appointment.amountPaid || payment.paidToDate || payment.amount || 0)
  const balance = Math.max(0, total - paidToDate)

  pdf.setFillColor(61, 40, 29)
  pdf.rect(0, 0, 210, 42, 'F')
  pdf.setTextColor(255, 248, 235)
  pdf.setFont('helvetica', 'bold').setFontSize(20)
  pdf.text('AesthetiCare', 15, 18)
  pdf.setFont('helvetica', 'normal').setFontSize(10)
  pdf.text('PAYMENT RECEIPT', 15, 27)
  pdf.text(clean(clinicName || appointment.clinicName || appointment.clinicBranch || appointment.branchName || 'AesthetiCare clinic', 180), 15, 35, { maxWidth: 180 })

  pdf.setTextColor(61, 40, 29)
  pdf.setFont('helvetica', 'bold').setFontSize(12)
  pdf.text('Payment details', 15, 55)
  const rows = [
    ['Receipt reference', reference],
    ['Payment date', receiptDate(payment.paidAt || payment.createdAt)],
    ['Payment method', clean(payment.method || payment.paymentMethod || 'Online payment', 80)],
    ['Customer', clean(appointment.customerName || appointment.clientName || payment.customerName || 'Customer')],
    ['Service', service],
    ...(appointment.serviceKey ? [['Service code', clean(appointment.serviceKey, 32)]] : []),
    ['Appointment', [clean(appointment.date, 20), clean(appointment.time, 20)].filter(Boolean).join(' at ') || 'Schedule not available'],
    ['Total appointment amount', currency(total)],
    ['This payment', currency(payment.amount)],
    ['Paid to date', currency(paidToDate)],
    ['Remaining balance', currency(balance)],
  ]
  let y = 63
  for (const [label, value] of rows) {
    pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(77, 56, 42)
    pdf.text(label, 15, y)
    pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(clean(value, 180), 125)
    pdf.text(lines, 65, y)
    y += Math.max(8, lines.length * 4.5)
  }
  const pricing = appointment.pricingSnapshot || {}
  if (pricing.subtotal != null || pricing.vatAmount != null) {
    y += 5
    pdf.setFont('helvetica', 'bold').setFontSize(10)
    pdf.text('Price summary', 15, y)
    y += 7
    pdf.setFont('helvetica', 'normal').setFontSize(9)
    pdf.text(`Subtotal: ${currency(pricing.subtotal ?? total)}`, 15, y)
    y += 5
    pdf.text(`VAT: ${currency(pricing.vatAmount || 0)}`, 15, y)
    y += 5
    pdf.text(`Total: ${currency(pricing.total ?? total)}`, 15, y)
  }
  pdf.setDrawColor(230, 207, 176).line(15, 278, 195, 278)
  pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120, 97, 79)
  pdf.text('Generated from the verified AesthetiCare appointment payment record.', 15, 284)
  return {
    Filename: `AesthetiCare-Receipt-${reference.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
    ContentType: 'application/pdf',
    Base64Content: Buffer.from(pdf.output('arraybuffer')).toString('base64'),
  }
}

export const emailAppointmentPaymentReceipt = async ({ db, transactionId, appointment, clinicName = '', senderEmail = '', sendEmail, now = () => new Date() }) => {
  const transactionRef = db.collection('transactions').doc(String(transactionId || ''))
  const claimed = await db.runTransaction(async tx => {
    const snapshot = await tx.get(transactionRef)
    if (!snapshot.exists) return { skip: true }
    const payment = snapshot.data() || {}
    if (payment.receiptEmailStatus === 'sent') return { alreadySent: true }
    const attemptAt = payment.receiptEmailAttemptAt?.toDate?.() || new Date(payment.receiptEmailAttemptAt || 0)
    if (payment.receiptEmailStatus === 'sending' && now().getTime() - attemptAt.getTime() < 10 * 60 * 1000) return { inProgress: true }
    tx.set(transactionRef, { receiptEmailStatus: 'sending', receiptEmailAttemptAt: now() }, { merge: true })
    return { payment }
  })
  if (claimed.skip || claimed.alreadySent || claimed.inProgress) return { sent: claimed.alreadySent === true, inProgress: claimed.inProgress === true }

  const recipients = [...new Set([appointment.customerEmail, appointment.bookedByEmail, claimed.payment.payerEmail]
    .map(value => clean(value, 254).toLowerCase())
    .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))]
  try {
    if (!recipients.length) throw new Error('No valid receipt email is available.')
    if (typeof sendEmail !== 'function' || !senderEmail) throw new Error('Receipt email is unavailable.')
    const attachment = createAppointmentPaymentReceiptPdf({ appointment, payment: claimed.payment, clinicName })
    const customerName = clean(appointment.bookedByName || appointment.customerName || appointment.clientName || 'Customer', 120)
    const service = clean(appointment.service || appointment.serviceName || 'your appointment', 180)
    const amount = currency(claimed.payment.amount)
    const failedRecipients = []
    for (const to of recipients) {
      const recipientKey = Buffer.from(to).toString('base64url')
      if (claimed.payment.receiptEmailRecipients?.[recipientKey]?.status === 'sent') continue
      await transactionRef.set({ receiptEmailRecipients: { [recipientKey]: { status: 'sending', attemptAt: now() } } }, { merge: true })
      const recipientName = to === String(appointment.customerEmail || '').trim().toLowerCase()
        ? clean(appointment.customerName || appointment.clientName || customerName, 120)
        : customerName
      try {
        const result = await sendEmail({
          From: senderEmail,
          To: to,
          Subject: 'Your AesthetiCare appointment payment receipt',
          TextBody: `Hi ${recipientName},\n\nYour payment of ${amount} for ${service} has been verified. Your PDF receipt is attached. You can also download it from My Appointments.${appointment.serviceKey ? `\n\nYour appointment service code is ${clean(appointment.serviceKey, 32)}. Keep it private and show it at check-in.` : ''}`,
          HtmlBody: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408"><p>Hi ${escapeHtml(recipientName)},</p><p>Your payment of <strong>${escapeHtml(amount)}</strong> for ${escapeHtml(service)} has been verified. Your PDF receipt is attached and is also available in My Appointments.${appointment.serviceKey ? ` Your appointment service code is <strong>${escapeHtml(clean(appointment.serviceKey, 32))}</strong>; keep it private and show it at check-in.` : ''}</p></div>`,
          Attachments: [attachment],
        })
        if (result?.ErrorCode != null && result.ErrorCode !== 0) throw new Error('Receipt email delivery failed.')
        await transactionRef.set({ receiptEmailRecipients: { [recipientKey]: { status: 'sent', sentAt: now() } } }, { merge: true })
      } catch (error) {
        failedRecipients.push(to)
        await transactionRef.set({ receiptEmailRecipients: { [recipientKey]: { status: 'failed', failedAt: now() } } }, { merge: true })
      }
    }
    if (failedRecipients.length) throw new Error(`Receipt email could not be sent to ${failedRecipients.length} recipient${failedRecipients.length === 1 ? '' : 's'}.`)
    await transactionRef.set({ receiptEmailStatus: 'sent', receiptEmailSentAt: now() }, { merge: true })
    return { sent: true }
  } catch (error) {
    await transactionRef.set({ receiptEmailStatus: 'failed', receiptEmailFailedAt: now() }, { merge: true })
    return { sent: false, error: error?.message || 'Receipt email delivery failed.' }
  }
}
