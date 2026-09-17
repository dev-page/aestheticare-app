const check = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
export const stockPlan = async (tx, db, items) => {
  const quantities = new Map()
  for (const item of items) quantities.set(item.inventoryItemId, (quantities.get(item.inventoryItemId) || 0) + item.quantity)
  const plan = []
  const appointments = []
  for (const branchId of new Set(items.map((item) => item.branchId))) {
    const snapshot = await tx.get(db.collection('appointments').where('branchId', '==', branchId))
    appointments.push(...snapshot.docs.map((s) => s.data()).filter((a) => !a.materialsConsumed && !['cancelled', 'rejected', 'expired', 'completed'].includes(String(a.status || '').toLowerCase())))
  }
  for (const [id, quantity] of quantities) {
    const ref = db.collection('inventoryItems').doc(id), snap = await tx.get(ref)
    const current = Number(snap.data()?.currentStock || 0)
    check(snap.exists && items.filter((i) => i.inventoryItemId === id).every((i) => i.branchId === snap.data().branchId), 'Product inventory is unavailable.')
    const reserved = appointments.reduce((sum, a) => sum + (a.resources || []).filter((r) => r.kind === 'material' && r.id === id).reduce((count, r) => count + Number(r.quantity || 0), 0), 0)
    plan.push({ ref, quantity, current, available: current - reserved })
  }
  return plan
}
export const prepareOrderSnapshot = async (db, items, customerId, delivery, referenceNumber) => {
  check(delivery && String(delivery.fullName || '').trim() && String(delivery.phone || '').trim(), 'Pickup contact details are required.', 400)
  const normalized = []
  for (const item of items) {
    const post = (await db.collection('productServicePosts').doc(item.id).get()).data()
    check(post?.isPublished && post.financeStatus === 'approved' && post.postType === 'Product', 'Product is no longer available.')
    let inventoryItemId = post.inventoryItemId
    if (!inventoryItemId) {
      const matches = (await db.collection('inventoryItems').where('branchId', '==', post.branchId).get()).docs.filter((s) => s.data().name === post.productName)
      check(matches.length === 1, 'The clinic must link this product to one inventory item.')
      inventoryItemId = matches[0].id
    }
    check(Number.isInteger(item.quantity) && item.quantity > 0 && Number(item.price) === Number(post.price), 'Product quantity or price changed.')
    normalized.push({ id: item.id, inventoryItemId, branchId: post.branchId, name: post.title || post.productName, price: Number(post.price), quantity: item.quantity, imageUrl: post.imageUrl || '' })
  }
  check(new Set(normalized.map((i) => i.branchId)).size === 1, 'Checkout one clinic at a time.')
  check(delivery.pickupBranchId === normalized[0].branchId, 'Choose the clinic supplying these products for pickup.')
  await db.runTransaction(async (tx) => {
    const plan = await stockPlan(tx, db, normalized)
    check(plan.every((p) => Number.isFinite(p.available) && p.available >= p.quantity), 'Some products are out of stock or reserved for services. Refresh your cart.')
  })
  return { customerId, branchId: normalized[0].branchId, items: normalized, total: normalized.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100, delivery: { fullName: String(delivery.fullName), phone: String(delivery.phone), pickupBranchId: normalized[0].branchId, fulfillmentType: 'pickup' }, referenceNumber, createdAt: new Date() }
}
export const recordVerifiedOrder = async ({ db, timestamp, sessionId, customerId, attributes }) => {
  const payment = attributes.payments?.find((p) => p.attributes?.status === 'paid')
  check(payment && attributes.metadata?.customerId === customerId && attributes.metadata?.module === 'customer_order', 'Payment is not confirmed for this customer.', 403)
  return db.runTransaction(async (tx) => {
    const snapshot = (await tx.get(db.collection('orderCheckouts').doc(sessionId))).data()
    check(snapshot && snapshot.customerId === customerId, 'No matching order checkout found.', 404)
    const orderRef = db.collection('customerOrders').doc(sessionId), existing = await tx.get(orderRef)
    if (existing.exists) return { orderId: orderRef.id, alreadyRecorded: true }
    check(Math.round(snapshot.total * 100) === Number(payment.attributes.amount), 'Verified payment does not match the checkout total.')
    const plan = await stockPlan(tx, db, snapshot.items)
    const available = plan.every((p) => Number.isFinite(p.available) && p.available >= p.quantity)
    const clinic = (await tx.get(db.collection('clinics').doc(snapshot.branchId))).data() || {}
    const now = timestamp()
    if (available) for (const p of plan) tx.update(p.ref, { currentStock: p.current - p.quantity, updatedAt: now })
    tx.set(orderRef, { ...snapshot, customerName: snapshot.delivery.fullName, pickupBranchId: snapshot.branchId, fulfillmentType: 'pickup', orderNumber: snapshot.referenceNumber, paymentStatus: 'Paid', amountPaid: snapshot.total, status: available ? 'Preparing' : 'Awaiting Stock', inventoryDeducted: available, source: 'paymongo_checkout', paymongoCheckoutSessionId: sessionId, paymongoPaymentId: payment.id, createdAt: now, updatedAt: now })
    tx.set(db.collection('transactions').doc(`order-${sessionId}`), { branchId: snapshot.branchId, customerId, orderId: orderRef.id, items: snapshot.items, amount: snapshot.total, total: snapshot.total, type: 'product_sale', method: payment.attributes.source?.type || 'Online', status: 'Paid', createdAt: now })
    if (available) tx.set(db.collection('inventoryMovements').doc(`order-${sessionId}`), { branchId: snapshot.branchId, orderId: orderRef.id, items: snapshot.items, type: 'product_sale', createdAt: now })
    for (const recipientUserId of new Set([customerId, clinic.ownerId].filter(Boolean))) tx.set(db.collection('notifications').doc(), { recipientUserId, branchId: snapshot.branchId, title: available ? 'Order paid' : 'Paid order needs stock', message: available ? 'Payment confirmed. Your pickup order is being prepared.' : 'Payment confirmed, but stock changed during checkout. The clinic must replenish stock before preparing this order.', link: recipientUserId === customerId ? '/customer/orders' : '/manager/logistics', read: false, deleted: false, createdAt: now })
    return { orderId: orderRef.id, status: available ? 'Preparing' : 'Awaiting Stock' }
  })
}
export const lockOrderCancellation = async (db, orderId, customerId) => db.runTransaction(async (tx) => {
  const ref = db.collection('customerOrders').doc(orderId), order = (await tx.get(ref)).data()
  check(order?.customerId === customerId, 'Order belongs to another customer.', 403)
  check(!order.cancellationInProgress, 'Cancellation is already being processed.')
  check(['Pending', 'Confirmed', 'Preparing', 'Packed', 'Awaiting Stock'].includes(order.status), 'This order can no longer be cancelled.')
  tx.update(ref, { cancellationInProgress: true })
})
export const finalizeCancelledOrder = async ({ db, timestamp, orderId, update }) => db.runTransaction(async (tx) => {
  const ref = db.collection('customerOrders').doc(orderId), order = (await tx.get(ref)).data()
  check(order, 'Order not found.', 404)
  if (order.status === 'Cancelled') return { alreadyRecorded: true }
  const plan = order.inventoryDeducted && !order.inventoryRestored ? await stockPlan(tx, db, order.items) : []
  const now = timestamp()
  for (const p of plan) tx.update(p.ref, { currentStock: p.current + p.quantity, updatedAt: now })
  if (plan.length) tx.set(db.collection('inventoryMovements').doc(`cancel-${orderId}`), { branchId: order.branchId, orderId, type: 'cancelled_sale_return', items: order.items, createdAt: now })
  tx.update(ref, { ...update, inventoryRestored: Boolean(order.inventoryDeducted), cancellationInProgress: false, updatedAt: now })
  if (update.refundAmount) tx.set(db.collection('transactions').doc(`refund-${orderId}`), { branchId: order.branchId, customerId: order.customerId, orderId, amount: -Math.abs(update.refundAmount), type: 'customer_order_refund', method: 'PayMongo', status: 'Refunded', paymongoRefundId: update.paymongoRefundId || null, createdAt: now })
  return { status: 'Cancelled' }
})
export const registerOrderWorkflow = (app, { admin, requireAuth, loadUserContext, buildPayMongoHeaders }) => {
  const db = admin.firestore(), timestamp = () => admin.firestore.FieldValue.serverTimestamp()
  app.post('/customer/orders/record-payment', requireAuth, async (req, res) => {
    try {
      const sessionId = String(req.body?.checkoutSessionId || '')
      check(/^cs_[A-Za-z0-9]+$/.test(sessionId), 'Invalid checkout session.', 400)
      const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, { headers: buildPayMongoHeaders() })
      const payload = await response.json()
      check(response.ok, 'Payment verification failed.')
      const data = await recordVerifiedOrder({ db, timestamp, sessionId, customerId: req.user.uid, attributes: payload.data?.attributes || {} })
      res.json({ success: true, data })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  app.post('/logistics/customer-orders/:id/transition', requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid), next = req.body?.nextStatus
      check(context.permissions.has('orders:update'), 'Order update permission required.', 403)
      await db.runTransaction(async (tx) => {
        const ref = db.collection('customerOrders').doc(req.params.id), order = (await tx.get(ref)).data()
        check(order && context.userData.branchId === order.branchId, 'Order belongs to another clinic.', 403)
        check(!order.cancellationInProgress, 'A cancellation is being processed. Wait for its result.')
        check(({ 'Awaiting Stock': ['Preparing'], Preparing: ['Packed', 'Ready for Pickup'], Packed: ['Shipped', 'Ready for Pickup'], Shipped: ['Out for Delivery', 'Delivered'], 'Out for Delivery': ['Delivered'], 'Ready for Pickup': ['Delivered', 'Received'] })[order.status]?.includes(next), 'Invalid order transition.')
        check(order.paymentStatus === 'Paid', 'Confirm payment before fulfilling this order.')
        let plan = []
        if (order.inventoryDeducted !== true) {
          plan = await stockPlan(tx, db, order.items)
          check(plan.every((p) => Number.isFinite(p.available) && p.available >= p.quantity), 'Replenish unreserved inventory before preparing this order.')
        }
        const now = timestamp()
        for (const p of plan) tx.update(p.ref, { currentStock: p.current - p.quantity, updatedAt: now })
        if (plan.length) tx.set(db.collection('inventoryMovements').doc(`order-${ref.id}`), { branchId: order.branchId, orderId: ref.id, items: order.items, type: 'product_sale', createdAt: now })
        tx.update(ref, { status: next, logisticsStatus: next, inventoryDeducted: true, updatedAt: now })
        tx.set(db.collection('notifications').doc(), { recipientUserId: order.customerId, branchId: order.branchId, title: 'Order updated', message: `${order.referenceNumber || 'Order'}: ${next}`, link: '/customer/orders', read: false, deleted: false, createdAt: now })
      })
      res.json({ success: true, data: { status: next } })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
