import { manilaDate, validateSupplierQuote } from './supplierQuoteValidation.js'

export const registerSupplierQuoteRoutes = (app, { admin, requireAuth }) => {
  app.post('/supplier/quotes', requireAuth, async (req, res) => {
    try {
      const input = req.body || {}
      const requestId = String(input.purchaseRequestId || '')
      if (!requestId || requestId.includes('/')) return res.status(400).json({ error: 'Select a valid purchase request.' })
      const db = admin.firestore()
      const result = await db.runTransaction(async (tx) => {
        const requestRef = db.collection('purchaseRequests').doc(requestId)
        const requestSnap = await tx.get(requestRef)
        const request = requestSnap.data()
        const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
        if (!request) fail('Purchase request not found.', 404)
        if (!request.supplierId || !request.branchId) fail('This request has no assigned supplier or clinic.')
        const supplierSnap = await tx.get(db.collection('suppliers').doc(request.supplierId))
        const supplier = supplierSnap.data()
        if (!supplier || supplier.ownerId !== req.user.uid) fail('This purchase request is not assigned to your business.', 403)
        if (['Cancelled', 'Delivered'].includes(request.status)) fail('This request no longer accepts quotations.')
        const error = validateSupplierQuote(input, request.quantity)
        if (error) fail(error)
        const existing = await tx.get(db.collection('supplierQuotes').where('purchaseRequestId', '==', requestId).where('supplierId', '==', request.supplierId))
        if (existing.docs.some((doc) => doc.data().status === 'Accepted')) fail('An accepted quotation cannot be changed.', 409)
        const quoteSnap = existing.docs[0]
        const quoteRef = quoteSnap?.ref || db.collection('supplierQuotes').doc(`request-${requestId}`)
        const old = quoteSnap?.data() || {}
        const counterRef = db.collection('systemCounters').doc('supplierQuoteReference')
        const counter = await tx.get(counterRef)
        const clinic = (await tx.get(db.collection('clinics').doc(request.branchId))).data() || {}
        const staff = await tx.get(db.collection('users').where('branchId', '==', request.branchId))
        const recipients = new Set([clinic.ownerId, clinic.branchAdminId, request.createdBy].filter(Boolean))
        staff.docs.forEach((doc) => {
          const role = String(doc.data().role || '').toLowerCase().replace(/[\s_-]/g, '')
          if (['owner', 'clinicadmin', 'manager', 'supply', 'finance'].includes(role) || role.includes('inventory') || role.includes('procurement')) recipients.add(doc.id)
        })
        recipients.delete(req.user.uid)
        if (!recipients.size) fail('No clinic recipient is configured for this request. Please contact the clinic.')
        const sequence = Number(counter.data()?.value || 0) + 1
        const reference = /^QT-\d{8}-\d+$/.test(old.reference || '') ? old.reference : `QT-${manilaDate().replaceAll('-', '')}-${String(sequence).padStart(6, '0')}`
        if (reference !== old.reference) tx.set(counterRef, { value: sequence })
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const quantity = Number(input.quantity)
        const unitPrice = Number(input.unitPrice)
        tx.set(quoteRef, {
          branchId: request.branchId, purchaseRequestId: requestId, supplierId: request.supplierId,
          supplierName: supplier.businessName || supplier.name || 'Supplier', item: request.item || '',
          quantity, unitPrice, amount: Math.round(unitPrice * 100) * quantity / 100,
          fulfillmentDate: input.fulfillmentDate, reference, notes: String(input.notes || '').trim(),
          details: String(input.notes || '').trim(), status: 'Submitted',
          createdAt: old.createdAt || timestamp, createdBy: old.createdBy || req.user.uid,
          updatedAt: timestamp, updatedBy: req.user.uid,
        }, { merge: true })
        for (const recipientUserId of recipients) {
          tx.set(db.collection('notifications').doc(`supplier-quote-${quoteRef.id}-${recipientUserId}`), {
            recipientUserId, branchId: request.branchId,
            title: quoteSnap ? 'Supplier quotation updated' : 'New supplier quotation',
            message: `${supplier.businessName || supplier.name || 'Supplier'} submitted ${reference} for ${quantity} × ${request.item || 'requested item'}. Review the price, availability, and terms.`,
            link: '/manager/procurement', read: false, deleted: false, createdAt: timestamp,
          })
        }
        return { id: quoteRef.id, reference }
      })
      return res.json({ success: true, data: result })
    } catch (error) {
      console.error('Supplier quotation failed:', error)
      return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save the quotation and notify the clinic. Please try again.' })
    }
  })
}
