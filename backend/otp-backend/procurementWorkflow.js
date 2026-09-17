const check = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
export const procurementPermission = (context, action) => {
  const permissions = context.permissions || new Set()
  if (action === 'approve') return permissions.has('finance:payables:approve')
  if (action === 'settle') return permissions.has('finance:payables:settle')
  return ['procurement:review', 'procurement:create', 'orders:update', 'inventory:review'].some((p) => permissions.has(p))
}
export const acceptedQuoteFields = (request, quote) => {
  const quantity = Number(quote.quantity), unitCost = Number(quote.unitPrice)
  check(Number.isInteger(quantity) && quantity > 0 && quantity <= Number(request.originalRequestedQuantity || request.quantity), 'Invalid quoted quantity.')
  check(Number.isFinite(unitCost) && unitCost > 0, 'Invalid quoted price.')
  const totalCost = Math.round(unitCost * 100) * quantity / 100
  return { originalRequestedQuantity: Number(request.originalRequestedQuantity || request.quantity), quantity, unitCost, totalCost, balance: totalCost, supplierQuoteAmount: totalCost, supplierQuoteQuantity: quantity, supplierQuoteUnitPrice: unitCost }
}
export const normalizedLogisticsStatus = (record) => ['', 'Not Claimed', 'Pending'].includes(String(record.logisticsStatus || '')) && record.status === 'Approved' && record.budgetStatus === 'Approved' ? 'Ready for Claim' : record.logisticsStatus

export const registerProcurementWorkflow = (app, { admin, requireAuth, loadUserContext }) => {
  const db = admin.firestore()
  const timestamp = () => admin.firestore.FieldValue.serverTimestamp()
  const scope = async (tx, context, branchId) => {
    const clinic = (await tx.get(db.collection('clinics').doc(branchId))).data() || {}
    check(context.userData?.branchId === branchId || (context.roleKey === 'Owner' && (clinic.ownerId === context.uid || branchId === context.uid)), 'This record belongs to another clinic.', 403)
    const staff = await tx.get(db.collection('users').where('branchId', '==', branchId))
    return { ...clinic, financeIds: staff.docs.filter((d) => String(d.data().role || '').toLowerCase() === 'finance').map((d) => d.id) }
  }
  const receive = async (tx, ref, record, uid, recipients = []) => {
    // All receipt entry points share this marker and transaction.
    if (record.inventoryReceiptId) return { id: ref.id, status: 'Received', alreadyRecorded: true }
    check(record.status !== 'Delivered', 'This legacy delivery is already recorded. Reconcile inventory instead of receiving it twice.')
    check(record.budgetStatus === 'Approved' && Number(record.approvedBudgetAmount) >= Number(record.totalCost), 'Finance must approve enough budget before receipt.')
    check(['Approved', 'Delivered'].includes(record.status) && ['Shipped', 'In Transit', 'Received', 'Delivered'].includes(record.logisticsStatus || record.purchaseOrderStatus), 'Mark the approved order shipped or in transit before receiving it.')
    const quantity = Number(record.quantity)
    check(Number.isFinite(quantity) && quantity > 0, 'Invalid receipt quantity.')
    let inventoryRef
    if (record.inventoryItemId) inventoryRef = db.collection('inventoryItems').doc(record.inventoryItemId)
    else {
      const inventory = await tx.get(db.collection('inventoryItems').where('branchId', '==', record.branchId))
      const matches = inventory.docs.filter((s) => String(s.data().name || '').trim().toLowerCase() === String(record.item || '').trim().toLowerCase() && String(s.data().supplier || '').trim().toLowerCase() === String(record.supplier || '').trim().toLowerCase())
      check(matches.length <= 1, 'Multiple inventory items match this purchase. Assign an inventory item first.')
      inventoryRef = matches[0]?.ref || db.collection('inventoryItems').doc(`purchase-${ref.id}`)
    }
    const stockSnap = await tx.get(inventoryRef), stock = stockSnap.data() || {}
    check(!stockSnap.exists || stock.branchId === record.branchId, 'Inventory item belongs to another clinic.', 403)
    const currentStock = Number(stock.currentStock || 0)
    check(Number.isFinite(currentStock), 'Inventory stock is invalid.')
    const receiptId = `purchase-${ref.id}`, now = timestamp()
    tx.set(inventoryRef, { ...(!stockSnap.exists ? { name: record.item, supplier: record.supplier || '', supplierId: record.supplierId || null, supplierItemId: record.itemId || null, branchId: record.branchId, category: record.category || '', unit: record.unit || 'units', sku: record.reference || receiptId, minStock: 1, maxStock: quantity, costPrice: Number(record.unitCost || 0), unitPrice: Number(record.unitCost || 0), createdAt: now } : {}), currentStock: currentStock + quantity, stockStatus: 'In Stock', updatedAt: now }, { merge: true })
    tx.set(db.collection('inventoryMovements').doc(receiptId), { branchId: record.branchId, inventoryItemId: inventoryRef.id, purchaseRequestId: ref.id, quantity, type: 'purchase_receipt', createdBy: uid, createdAt: now })
    tx.update(ref, { inventoryReceiptId: receiptId, inventoryItemId: inventoryRef.id, status: 'Delivered', logisticsStatus: 'Received', purchaseOrderStatus: 'Received', procurementStatus: 'Received', workflowStage: 'Delivered - Awaiting Finance Settlement', deliveredAt: now, receivedAt: now, updatedAt: now })
    for (const recipientUserId of new Set(recipients.filter(Boolean))) tx.set(db.collection('notifications').doc(), { recipientUserId, branchId: record.branchId, title: 'Purchase received', message: `${record.requestNumber || record.reference || 'Purchase'}: stock received; ready for Finance settlement.`, link: '/finance/accounts-payable', read: false, deleted: false, createdAt: now })
    return { id: ref.id, status: 'Received' }
  }
  const route = (path, handler) => app.post(path, requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      const data = await db.runTransaction((tx) => handler(tx, req, context))
      res.json({ success: true, data })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  route('/procurement/:collection/:id/transition', async (tx, req, context) => {
    const name = req.params.collection
    check(['supplierQuotes', 'purchaseRequests', 'purchaseOrders'].includes(name), 'Invalid procurement collection.', 400)
    const ref = db.collection(name).doc(req.params.id), record = (await tx.get(ref)).data()
    check(record, 'Record not found.', 404)
    const clinic = await scope(tx, context, record.branchId)
    if (name === 'supplierQuotes') {
      check(procurementPermission(context, 'accept'), 'Procurement review permission required.', 403)
      check(record.status === 'Submitted' && record.purchaseRequestId, 'Only submitted quotes linked to a request can be accepted.')
      const requestRef = db.collection('purchaseRequests').doc(record.purchaseRequestId), request = (await tx.get(requestRef)).data()
      check(request && request.branchId === record.branchId && request.supplierId === record.supplierId, 'Quote and purchase request do not match.')
      check(!request.supplierQuoteId && !request.inventoryReceiptId && !['Cancelled', 'Delivered'].includes(request.status) && !Number(request.amountPaid), 'This request already has an accepted quote or has progressed.')
      const terms = acceptedQuoteFields(request, record), now = timestamp()
      tx.update(requestRef, { ...terms, status: 'Approved', supplierQuoteId: ref.id, supplierQuoteStatus: 'Accepted', supplierQuoteReference: record.reference, quotedSupplier: record.supplierName || '', budgetStatus: 'Requested', budgetRequestedAmount: terms.totalCost, approvedBudgetAmount: 0, purchaseOrderStatus: 'Pending Finance', procurementStatus: 'Pending Finance', workflowStage: 'Pending Finance Approval', updatedAt: now })
      tx.update(ref, { status: 'Accepted', updatedAt: now, updatedBy: req.user.uid })
      for (const recipientUserId of clinic.financeIds) tx.set(db.collection('notifications').doc(), { recipientUserId, branchId: record.branchId, title: 'Purchase budget review', message: (request.requestNumber || request.reference || 'Purchase request') + ': supplier quote accepted; Finance review required.', link: '/finance/accounts-payable', read: false, deleted: false, createdAt: now })
      return { id: ref.id, status: 'Accepted' }
    }
    check(name === 'purchaseRequests', 'Legacy purchase orders must be linked to a purchase request before progressing.')
    const current = record.purchaseOrderStatus === 'Draft' || !record.purchaseOrderStatus ? 'Pending Finance' : record.purchaseOrderStatus
    const next = { 'Pending Finance': 'Approved', Approved: 'Issued', Issued: 'Shipped', Shipped: 'Received' }[current]
    if (record.inventoryReceiptId) return { id: ref.id, status: 'Received', alreadyRecorded: true }
    check(next, 'This purchase order cannot advance.')
    check(procurementPermission(context, next === 'Approved' ? 'approve' : 'advance'), 'You do not have permission for this purchase stage.', 403)
    if (next === 'Received') return receive(tx, ref, record, req.user.uid, [...clinic.financeIds, clinic.ownerId])
    const now = timestamp()
    check(!['Cancelled', 'Rejected', 'Delivered'].includes(record.status), 'This purchase request is closed.')
    if (next !== 'Approved') check(record.budgetStatus === 'Approved' && Number(record.approvedBudgetAmount) >= Number(record.totalCost), 'Finance must approve the purchase budget first.')
    tx.update(ref, { purchaseOrderStatus: next, procurementStatus: next, workflowStage: `${next} Purchase Order`, updatedAt: now, ...(next === 'Approved' ? { status: 'Approved', budgetStatus: 'Approved', approvedBudgetAmount: Number(record.totalCost), financeApprovedAt: now, financeApprovedBy: req.user.uid, logisticsStatus: 'Ready for Claim' } : {}), ...(next === 'Shipped' ? { logisticsStatus: 'Shipped', shippedAt: now } : {}) })
    if (clinic.ownerId) tx.set(db.collection('notifications').doc(), { recipientUserId: clinic.ownerId, branchId: record.branchId, title: 'Purchase order updated', message: `${record.reference || 'Purchase order'}: ${next}`, link: '/manager/purchase-requests', read: false, deleted: false, createdAt: now })
    return { id: ref.id, status: next }
  })
  route('/logistics/purchase-requests/:id/transition', async (tx, req, context) => {
    const ref = db.collection('purchaseRequests').doc(req.params.id), record = (await tx.get(ref)).data()
    check(record, 'Purchase request not found.', 404)
    const clinic = await scope(tx, context, record.branchId)
    check(procurementPermission(context, 'advance'), 'Logistics update permission required.', 403)
    const next = req.body?.nextStatus
    if (next === 'Received') return receive(tx, ref, record, req.user.uid, [...clinic.financeIds, clinic.ownerId])
    check(record.status === 'Approved' && record.budgetStatus === 'Approved', 'An approved purchase and Finance budget are required.')
    const current = normalizedLogisticsStatus(record)
    check(({ 'Ready for Claim': ['Claimed'], Claimed: ['Shipped', 'In Transit'], Shipped: ['In Transit'] })[current]?.includes(next), 'Invalid logistics transition.')
    const now = timestamp()
    tx.update(ref, { logisticsStatus: next, ...(next === 'Claimed' ? { logisticsClaimedBy: req.user.uid, logisticsClaimedAt: now } : { purchaseOrderStatus: 'Shipped' }), workflowStage: `Logistics: ${next}`, updatedAt: now })
    if (clinic.ownerId) tx.set(db.collection('notifications').doc(), { recipientUserId: clinic.ownerId, branchId: record.branchId, title: 'Delivery updated', message: `${record.reference || 'Purchase'}: ${next}`, link: '/manager/logistics', read: false, deleted: false, createdAt: now })
    return { id: ref.id, status: next }
  })
  route('/procurement/purchase-requests/:id/request-budget', async (tx, req, context) => {
    const ref = db.collection('purchaseRequests').doc(req.params.id), record = (await tx.get(ref)).data()
    check(record, 'Purchase request not found.', 404)
    const clinic = await scope(tx, context, record.branchId)
    check(procurementPermission(context, 'advance'), 'Procurement permission required.', 403)
    check(record.status === 'Approved' && record.budgetStatus === 'Not Requested', 'Approve this purchase request before requesting its budget.')
    const amount = Number(record.totalCost || Number(record.quantity) * Number(record.unitCost)), now = timestamp()
    check(Number.isFinite(amount) && amount > 0, 'Set a valid purchase total.')
    tx.update(ref, { budgetStatus: 'Requested', budgetRequestedAmount: amount, budgetRequestedAt: now, workflowStage: 'Budget Requested from Finance', updatedAt: now })
    for (const recipientUserId of clinic.financeIds) tx.set(db.collection('notifications').doc(), { recipientUserId, branchId: record.branchId, title: 'Purchase budget requested', message: `${record.requestNumber || 'Purchase'} needs Finance review.`, link: '/finance/accounts-payable', read: false, deleted: false, createdAt: now })
    return { budgetStatus: 'Requested' }
  })
  route('/finance/purchase-requests/:id/approve-budget', async (tx, req, context) => {
    const ref = db.collection('purchaseRequests').doc(req.params.id), record = (await tx.get(ref)).data()
    check(record, 'Purchase request not found.', 404)
    const clinic = await scope(tx, context, record.branchId)
    check(procurementPermission(context, 'approve'), 'Finance budget approval permission required.', 403)
    check(record.status === 'Approved' && record.budgetStatus === 'Requested', 'Procurement must approve and request the budget first.')
    const amount = Number(record.totalCost || Number(record.quantity) * Number(record.unitCost))
    check(Number.isFinite(amount) && amount > 0, 'Invalid purchase amount.')
    const now = timestamp()
    tx.update(ref, { budgetStatus: 'Approved', approvedBudgetAmount: amount, totalCost: amount, budgetApprovedAt: now, financeApprovedBy: req.user.uid, purchaseOrderStatus: 'Approved', logisticsStatus: 'Ready for Claim', workflowStage: 'Budget Approved', updatedAt: now })
    for (const recipientUserId of new Set([record.createdBy, clinic.ownerId].filter(Boolean))) tx.set(db.collection('notifications').doc(), { recipientUserId, branchId: record.branchId, title: 'Purchase budget approved', message: `${record.reference || 'Purchase'} is ready for Logistics.`, link: '/manager/purchase-requests', read: false, deleted: false, createdAt: now })
    return { status: 'Approved', approvedBudgetAmount: amount }
  })
  route('/finance/purchase-requests/:id/settle', async (tx, req, context) => {
    const ref = db.collection('purchaseRequests').doc(req.params.id), record = (await tx.get(ref)).data()
    check(record, 'Purchase request not found.', 404)
    await scope(tx, context, record.branchId)
    check(procurementPermission(context, 'settle'), 'Finance settlement permission required.', 403)
    check(record.inventoryReceiptId && record.status === 'Delivered', 'Receive the goods before final settlement.')
    check(req.body?.paid === true, 'Recorded payments cannot be undone here. Use an audited adjustment.')
    check(record.receiptUrl, 'Upload payment evidence before Finance confirms settlement.')
    if (record.paymentStatus === 'Paid') return { id: ref.id, alreadyRecorded: true, paymentStatus: 'Paid' }
    const total = Number(record.totalCost), now = timestamp()
    check(Number.isFinite(total) && total > 0, 'Invalid purchase total.')
    tx.update(ref, { paymentStatus: 'Paid', amountPaid: total, balance: 0, paidAt: now, paidBy: req.user.uid, workflowStage: 'Budget Settled', budgetSettlementStatus: 'Settled', updatedAt: now })
    tx.set(db.collection('purchasePayments').doc(ref.id), { purchaseRequestId: ref.id, branchId: record.branchId, supplierId: record.supplierId || null, amount: total, receiptUrl: record.receiptUrl, approvedBy: req.user.uid, createdAt: now })
    return { id: ref.id, paymentStatus: 'Paid', amountPaid: total, balance: 0 }
  })
}
