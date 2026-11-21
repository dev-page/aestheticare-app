import crypto from 'node:crypto'

const fail = (condition, message, status = 409) => {
  if (!condition) throw Object.assign(new Error(message), { status })
}
const clean = value => String(value ?? '').trim()
const cents = (value, message = 'Enter a valid refund amount.') => {
  const amount = Number(value)
  fail(Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(Math.round(amount * 100)), message, 400)
  return Math.round(amount * 100)
}
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 40)
const entityCollection = type => type === 'appointment' ? 'appointments' : 'customerOrders'
const stateForProvider = status => {
  const value = clean(status).toLowerCase()
  if (value === 'succeeded') return 'Refunded'
  if (value === 'failed') return 'Requested'
  return 'Processing'
}

export const registerRefundWorkflow = (app, {
  admin,
  requireAuth,
  loadUserContext,
  getClinicPoliciesForBranch,
  buildPayMongoHeaders,
  finalizeCancelledOrder,
  sendAppointmentRefundEmail = async () => {},
}) => {
  const db = admin.firestore()
  const stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const permission = context => context.permissions.has('finance:refunds:manage') || context.permissions.has('administrator:full_access')
  const contextFor = req => loadUserContext(req.user.uid)

  const hasBranchAccess = async (context, branchId) => {
    if (['Superadmin', 'SuperAdmin'].includes(String(context.roleKey || '').trim())) return true
    const clinicSnap = await db.collection('clinics').doc(branchId).get()
    if (!clinicSnap.exists) return false
    const clinic = clinicSnap.data() || {}
    const assigned = new Set([context.userData?.branchId, ...(context.userData?.branchIds || [])].filter(Boolean))
    return assigned.has(branchId) || clinic.ownerId === context.uid || clinic.branchAdminId === context.uid
  }

  const notify = async ({ customerId, branchId, title, message, link = '/customer/orders', id }) => {
    const time = stamp()
    const targets = new Set([customerId].filter(Boolean))
    if (branchId) {
      const clinic = (await db.collection('clinics').doc(branchId).get()).data() || {}
      for (const uid of [clinic.ownerId, clinic.branchAdminId]) if (uid) targets.add(uid)
    }
    await Promise.all([...targets].map(uid => db.collection('notifications').doc(`${id}-${uid}`).set({
      recipientUserId: uid, branchId: branchId || '', title, message,
      link: uid === customerId ? link : '/crm/appointments', read: false, deleted: false, createdAt: time,
    }, { merge: true })))
  }

  const getRefs = ({ entityType, recordId, requestId }) => ({
    recordRef: db.collection(entityCollection(entityType)).doc(recordId),
    requestRef: entityType === 'order' && requestId ? db.collection('refundRequests').doc(requestId) : null,
  })

  const reconcileOperation = async (operationId, resource = {}) => {
    const opRef = db.collection('refundOperations').doc(operationId)
    const initial = (await opRef.get()).data()
    if (!initial) return { ignored: true }
    const attributes = resource.attributes || {}
    const refundId = clean(resource.id || attributes.id || initial.paymongoRefundId)
    const paymentId = clean(attributes.payment_id || initial.paymentId)
    const rawStatus = clean(attributes.status || resource.status || initial.providerStatus).toLowerCase()
    if (!['pending', 'processing', 'succeeded', 'failed'].includes(rawStatus)) return { ignored: true }
    if (initial.paymongoRefundId && refundId && initial.paymongoRefundId !== refundId) return { ignored: true }
    if (initial.paymentId && paymentId && initial.paymentId !== paymentId) return { ignored: true }

    const nextState = stateForProvider(rawStatus)
    const { recordRef, requestRef } = getRefs(initial)
    const transactionRef = db.collection('transactions').doc(`refund-${operationId}`)
    const auditRef = db.collection('financeAudit').doc(`refund-${operationId}-${rawStatus}`)
    let result = { status: nextState, paymongoRefundId: refundId || null, providerStatus: rawStatus }

    await db.runTransaction(async tx => {
      const reads = [tx.get(opRef), tx.get(recordRef)]
      if (requestRef) reads.push(tx.get(requestRef))
      const [opSnap, recordSnap, requestSnap] = await Promise.all(reads)
      if (!opSnap.exists || !recordSnap.exists) return
      const op = opSnap.data() || {}, record = recordSnap.data() || {}, request = requestSnap?.data() || {}
      if (op.paymongoRefundId && refundId && op.paymongoRefundId !== refundId) return
      if (op.paymentId && paymentId && op.paymentId !== paymentId) return
      const currentRank = { Submitting: 0, Processing: 1, Requested: 2, Refunded: 2 }
      const current = currentRank[op.status] || 0
      const incoming = rawStatus === 'succeeded' || rawStatus === 'failed' ? 2 : 1
      if (current >= 2 && incoming < 2) return
      if (op.status === 'Refunded') return

      const time = stamp()
      const amount = Number(op.amountCents || 0) / 100
      const originalPaidCents = Number(op.originalPaidCents || op.paidCents || 0)
      const alreadyRefundedCents = Math.round(Number(record.refundedAmountTotal || 0) * 100)
      const nextRefundedCents = rawStatus === 'succeeded' ? alreadyRefundedCents + Number(op.amountCents || 0) : alreadyRefundedCents
      const paymentStatus = rawStatus === 'succeeded'
        ? nextRefundedCents >= originalPaidCents ? 'Refunded' : 'Partially Refunded'
        : String(record.paymentStatus || record.paymentStatusAtRequest || 'Paid')
      tx.set(opRef, {
        status: nextState,
        providerStatus: rawStatus,
        paymongoRefundId: refundId || op.paymongoRefundId || null,
        updatedAt: time,
        ...(rawStatus === 'succeeded' ? { completedAt: time } : {}),
        ...(rawStatus === 'failed' ? { failedAt: time } : {}),
      }, { merge: true })
      tx.set(recordRef, {
        refundStatus: nextState,
        refundRequestStatus: nextState,
        refundType: 'PayMongo',
        refundAmount: amount,
        ...(rawStatus === 'succeeded' ? { refundedAmountTotal: nextRefundedCents / 100 } : {}),
        refundOperationId: operationId,
        paymongoRefundId: refundId || op.paymongoRefundId || null,
        paymongoRefundStatus: rawStatus,
        paymentStatus,
        ...(rawStatus === 'succeeded' ? { refundedAt: time } : {}),
        ...(rawStatus === 'failed' ? { refundFailure: 'PayMongo could not process this refund. Review the payment and try again.' } : { refundFailure: '' }),
        updatedAt: time,
      }, { merge: true })
      if (requestRef && requestSnap?.exists) tx.set(requestRef, {
        status: nextState,
        refundMethod: 'PayMongo',
        amount,
        refundOperationId: operationId,
        paymongoRefundId: refundId || op.paymongoRefundId || null,
        paymongoRefundStatus: rawStatus,
        ...(rawStatus === 'succeeded' ? { refundedAt: time } : {}),
        ...(rawStatus === 'failed' ? { failureMessage: 'PayMongo could not process this refund. Review the payment and try again.' } : {}),
        updatedAt: time,
      }, { merge: true })
      tx.set(transactionRef, {
        branchId: op.branchId,
        amount: -amount,
        method: 'PayMongo',
        status: nextState,
        type: op.entityType === 'appointment' ? 'appointment_refund' : 'customer_order_refund',
        orderId: op.entityType === 'order' ? op.recordId : '',
        appointmentId: op.entityType === 'appointment' ? op.recordId : '',
        customerId: op.customerId || '',
        clientName: op.customerName || 'Customer',
        service: op.description || 'Customer refund',
        paymongoPaymentId: op.paymentId,
        paymongoRefundId: refundId || op.paymongoRefundId || null,
        refundOperationId: operationId,
        createdAt: op.createdAt || time,
        updatedAt: time,
      }, { merge: true })
      tx.set(auditRef, {
        recordId: op.recordId, branchId: op.branchId, action: `refund-paymongo-${rawStatus}`,
        previousStatus: op.status || '', newStatus: nextState,
        actorId: op.actorId || 'paymongo-webhook', remarks: `PayMongo refund ${refundId || operationId}`,
        createdAt: time,
      }, { merge: true })
      result = { status: nextState, paymongoRefundId: refundId || op.paymongoRefundId || null, providerStatus: rawStatus, requestId: op.requestId || '' }
      void request
    })

    if (result.status === 'Refunded' || result.providerStatus === 'failed') {
      const record = (await recordRef.get()).data() || {}
      if (initial.entityType === 'appointment') {
        try {
          let customerEmail = String(record.customerEmail || '').trim().toLowerCase()
          let customerName = String(record.customerName || record.clientName || initial.customerName || 'Customer').trim()
          if (!customerEmail && initial.customerId) {
            const customerSnap = await db.collection('users').doc(String(initial.customerId)).get()
            const customer = customerSnap.exists ? customerSnap.data() || {} : {}
            customerEmail = String(customer.email || '').trim().toLowerCase()
            customerName = String(record.customerName || customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer').trim()
          }
          if (customerEmail) await sendAppointmentRefundEmail({
            email: customerEmail,
            customerName,
            service: record.service || initial.description || 'Appointment',
            date: record.date || '',
            time: record.time || '',
            amount: Number(initial.amountCents || 0) / 100,
            status: result.status,
            serviceKey: record.serviceKey || '',
          })
        } catch (emailError) {
          console.warn('Appointment refund status email failed:', emailError?.message || emailError)
        }
      }
      await notify({
        customerId: initial.customerId,
        branchId: initial.branchId,
        title: result.status === 'Refunded' ? 'Refund completed' : 'Refund needs attention',
        message: result.status === 'Refunded'
          ? `A refund of PHP ${Number(initial.amountCents || 0) / 100} for ${initial.description || 'your purchase'} has been confirmed.`
          : `We could not complete the refund for ${initial.description || 'your purchase'}. The clinic will review it.`,
        link: initial.entityType === 'appointment' ? '/customer/appointments' : '/customer/orders',
        id: `refund-${operationId}-${result.status}`,
      }).catch(() => {})
      void record
    }
    return result
  }

  const startPayMongoRefund = async ({ entityType, recordId, branchId, customerId, customerName, paymentId, amount, paidAmount, requestId, actorId, description, reason }) => {
    fail(['order', 'appointment'].includes(entityType), 'Refund record type is invalid.', 400)
    fail(paymentId && requestId, 'A verified payment and refund request are required.', 409)
    const amountCents = cents(amount)
    const paidCents = cents(paidAmount)
    fail(amountCents > 0 && amountCents <= paidCents, 'Refund amount exceeds the recorded paid amount.', 400)
    const { recordRef, requestRef } = getRefs({ entityType, recordId, requestId })
    const candidateId = `refund-${sha(`${entityType}|${recordId}|${requestId}|${crypto.randomUUID()}`)}`
    const candidateKey = crypto.randomUUID()
    let operationId = candidateId
    let shouldSubmit = true
    let operationResult = null

    await db.runTransaction(async tx => {
      const preview = await tx.get(recordRef)
      fail(preview.exists && String(preview.data()?.branchId || '') === branchId, 'Refund record is unavailable.', 404)
      const record = preview.data() || {}
      let currentOp = null
      if (record.refundOperationId) {
        const currentSnap = await tx.get(db.collection('refundOperations').doc(String(record.refundOperationId)))
        if (currentSnap.exists) currentOp = { id: currentSnap.id, ...currentSnap.data() }
      }
      let requestSnap = null
      if (requestRef) requestSnap = await tx.get(requestRef)
      let requestOp = null
      const requestOperationId = clean(requestSnap?.data()?.refundOperationId)
      if (requestOperationId) {
        if (currentOp?.id === requestOperationId) requestOp = currentOp
        else {
          const requestOperationSnap = await tx.get(db.collection('refundOperations').doc(requestOperationId))
          if (requestOperationSnap.exists) requestOp = { id: requestOperationSnap.id, ...requestOperationSnap.data() }
        }
      }
      const completedRequestOperation = [requestOp, currentOp].find(operation => operation?.status === 'Refunded' && operation.requestId === requestId)
      if (requestRef) {
        fail(requestSnap.exists && (['Requested', 'Processing', 'Pending'].includes(requestSnap.data()?.status) || Boolean(completedRequestOperation)), 'This refund request is no longer active.', 409)
        fail(requestSnap.data()?.orderId === recordId || entityType === 'appointment', 'Refund request does not match this order.', 409)
      }
      if (completedRequestOperation) {
        operationId = completedRequestOperation.id
        shouldSubmit = false
        operationResult = completedRequestOperation
        return
      }
      if (currentOp && ['Submitting', 'Processing'].includes(currentOp.status)) {
        operationId = currentOp.id
        shouldSubmit = !currentOp.paymongoRefundId
        operationResult = currentOp
        if (!shouldSubmit) return
      } else {
        const alreadyRefundedCents = Math.round(Number(record.refundedAmountTotal || 0) * 100)
        const remainingCents = Math.max(0, paidCents - alreadyRefundedCents)
        fail(amountCents > 0 && amountCents <= remainingCents, 'Refund amount exceeds the remaining paid balance.', 400)
        const newRequestAfterPartialRefund = currentOp?.status === 'Refunded' && currentOp.requestId !== requestId
        fail(!record.paymongoRefundId || record.paymongoRefundStatus === 'failed' || currentOp?.status === 'Failed' || currentOp?.status === 'Requested' || newRequestAfterPartialRefund, 'A PayMongo refund is already active or completed.', 409)
        operationId = candidateId
        const opRef = db.collection('refundOperations').doc(operationId)
        const now = stamp()
        tx.set(opRef, {
          entityType, recordId, branchId, customerId, customerName: customerName || 'Customer',
          requestId, paymentId, amountCents, paidCents: remainingCents, originalPaidCents: paidCents,
          description: clean(description) || 'Customer refund', reason: clean(reason), method: 'PayMongo', status: 'Submitting', idempotencyKey: candidateKey,
          actorId: actorId || '', createdAt: now, updatedAt: now,
        })
        tx.set(recordRef, { refundStatus: 'Processing', refundRequestStatus: 'Processing', refundAmount: amountCents / 100, refundOperationId: operationId, refundMethod: 'PayMongo', paymongoRefundId: null, paymongoRefundStatus: 'processing', updatedAt: now }, { merge: true })
        if (requestRef && requestSnap?.exists) tx.set(requestRef, { status: 'Processing', refundMethod: 'PayMongo', amount: amountCents / 100, refundOperationId: operationId, updatedAt: now }, { merge: true })
      }
    })

    const opRef = db.collection('refundOperations').doc(operationId)
    const operation = (await opRef.get()).data() || {}
    if (!shouldSubmit || operation.paymongoRefundId) return { operationId, status: operation.status || operationResult?.status || 'Processing', paymongoRefundId: operation.paymongoRefundId || operationResult?.paymongoRefundId || null, providerStatus: operation.providerStatus || operationResult?.providerStatus || 'processing', requestId: operation.requestId || requestId }

    let response
    try {
      response = await fetch('https://api.paymongo.com/v1/refunds', {
        method: 'POST',
        headers: { ...buildPayMongoHeaders(), 'Idempotency-Key': operation.idempotencyKey || candidateKey },
        body: JSON.stringify({ data: { attributes: { amount: amountCents, payment_id: paymentId, reason: 'requested_by_customer', notes: clean(reason).slice(0, 255) } } }),
      })
    } catch (error) {
      // Leave the operation in Submitting. A retry reuses the stored idempotency key.
      return { operationId, status: 'Processing', uncertain: true, error: error?.message || 'PayMongo could not be reached.' }
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status >= 500) return { operationId, status: 'Processing', uncertain: true, error: payload?.errors?.[0]?.detail || 'PayMongo is still processing the request.' }
      await reconcileOperation(operationId, { id: operation.paymongoRefundId || '', attributes: { payment_id: paymentId, status: 'failed' } })
      return { operationId, status: 'Requested', error: payload?.errors?.[0]?.detail || 'PayMongo did not accept the refund request.' }
    }
    const refund = payload?.data || {}
    const attributes = refund.attributes || {}
    await opRef.set({ paymongoRefundId: refund.id || null, providerStatus: attributes.status || 'pending', updatedAt: stamp() }, { merge: true })
    const updated = await reconcileOperation(operationId, refund)
    return { operationId, ...updated }
  }

  const recordOfflineRefund = async ({ entityType, recordId, branchId, customerId, customerName, amount, paidAmount, requestId, actorId, description, reason, reference }) => {
    const amountCents = cents(amount), paidCents = cents(paidAmount), refValue = clean(reference).slice(0, 160)
    fail(amountCents > 0 && amountCents <= paidCents, 'Refund amount exceeds the recorded paid amount.', 400)
    fail(refValue.length >= 2, 'Enter the cash or bank refund reference.', 400)
    const { recordRef, requestRef } = getRefs({ entityType, recordId, requestId })
    const opId = `refund-${sha(`${entityType}|${recordId}|${requestId}|offline`)}`
    const opRef = db.collection('refundOperations').doc(opId)
    const transactionRef = db.collection('transactions').doc(opId)
    const auditRef = db.collection('financeAudit').doc(opId)
    let replayedResult = null
    await db.runTransaction(async tx => {
      const reads = [tx.get(recordRef), tx.get(opRef)]
      if (requestRef) reads.push(tx.get(requestRef))
      const [recordSnap, opSnap, requestSnap] = await Promise.all(reads)
      const record = recordSnap.data() || {}
      fail(recordSnap.exists && record.branchId === branchId, 'Refund record is unavailable.', 404)
      if (opSnap.exists && opSnap.data()?.status === 'Refunded') {
        replayedResult = { operationId: opId, status: 'Refunded', amount: Number(opSnap.data()?.amountCents || 0) / 100, reference: opSnap.data()?.offlineReference || refValue, alreadyRecorded: true }
        return
      }
      fail(!opSnap.exists || opSnap.data()?.status === 'Failed', 'This refund has already been recorded or is being processed.', 409)
      if (requestRef) fail(requestSnap?.exists && ['Requested', 'Processing', 'Pending'].includes(requestSnap.data()?.status), 'This refund request is no longer active.', 409)
      const now = stamp(), amount = amountCents / 100
      const alreadyRefundedCents = Math.round(Number(record.refundedAmountTotal || 0) * 100)
      const remainingCents = Math.max(0, paidCents - alreadyRefundedCents)
      fail(amountCents <= remainingCents, 'Refund amount exceeds the remaining paid balance.', 400)
      const nextRefundedCents = alreadyRefundedCents + amountCents
      const paymentStatus = nextRefundedCents >= paidCents ? 'Refunded' : 'Partially Refunded'
      tx.set(opRef, {
        entityType, recordId, branchId, customerId, customerName: customerName || 'Customer', requestId,
        amountCents, paidCents: remainingCents, originalPaidCents: paidCents, description: clean(description) || 'Customer refund', reason: clean(reason),
        method: 'Offline', status: 'Refunded', offlineReference: refValue, actorId,
        createdAt: now, completedAt: now, updatedAt: now,
      })
      tx.set(recordRef, {
        refundStatus: 'Refunded', refundRequestStatus: 'Refunded', refundType: 'Offline', refundMethod: 'Offline',
        refundAmount: amount, refundedAmountTotal: nextRefundedCents / 100, refundOperationId: opId, refundReference: refValue, paymentStatus, refundedAt: now, updatedAt: now,
      }, { merge: true })
      if (requestRef && requestSnap?.exists) tx.set(requestRef, {
        status: 'Refunded', refundMethod: 'Offline', amount, offlineReference: refValue,
        reviewedBy: actorId, refundedAt: now, updatedAt: now,
      }, { merge: true })
      tx.set(transactionRef, {
        branchId, amount: -amount, method: 'Offline', status: 'Refunded', type: entityType === 'appointment' ? 'appointment_refund' : 'customer_order_refund',
        orderId: entityType === 'order' ? recordId : '', appointmentId: entityType === 'appointment' ? recordId : '',
        customerId, clientName: customerName || 'Customer', service: description || 'Customer refund',
        refundOperationId: opId, paymentReference: refValue, createdAt: now, updatedAt: now,
      })
      tx.set(auditRef, { recordId, branchId, action: 'refund-offline-completed', previousStatus: record.refundStatus || record.refundRequestStatus || 'Requested', newStatus: 'Refunded', actorId, remarks: clean(reason) || refValue, createdAt: now })
    })
    if (replayedResult) return replayedResult
    await notify({ customerId, branchId, title: 'Refund completed', message: `A refund of PHP ${amountCents / 100} for ${description || 'your purchase'} has been recorded by the clinic.`, link: entityType === 'appointment' ? '/customer/appointments' : '/customer/orders', id: `refund-${opId}-Refunded` }).catch(() => {})
    if (entityType === 'appointment') {
      try {
        const record = (await recordRef.get()).data() || {}
        let email = String(record.customerEmail || '').trim().toLowerCase()
        let name = String(record.customerName || record.clientName || customerName || 'Customer').trim()
        if (!email && customerId) {
          const customerSnap = await db.collection('users').doc(String(customerId)).get()
          const customer = customerSnap.exists ? customerSnap.data() || {} : {}
          email = String(customer.email || '').trim().toLowerCase()
          name = String(record.customerName || customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer').trim()
        }
        if (email) await sendAppointmentRefundEmail({ email, customerName: name, service: record.service || description || 'Appointment', date: record.date || '', time: record.time || '', amount: amountCents / 100, status: 'Refunded', serviceKey: record.serviceKey || '' })
      } catch (emailError) {
        console.warn('Offline appointment refund status email failed:', emailError?.message || emailError)
      }
    }
    return { operationId: opId, status: 'Refunded', amount: amountCents / 100, reference: refValue }
  }

  const handlePayMongoRefund = async resource => {
    const refundId = clean(resource?.id)
    const paymentId = clean(resource?.attributes?.payment_id)
    let snapshot = refundId
      ? await db.collection('refundOperations').where('paymongoRefundId', '==', refundId).limit(1).get()
      : { empty: true, docs: [] }
    if (snapshot.empty && paymentId) {
      const operationMatches = await db.collection('refundOperations').where('paymentId', '==', paymentId).limit(10).get()
      const candidates = operationMatches.docs.filter(doc => doc.data()?.status === 'Submitting' && !doc.data()?.paymongoRefundId)
      if (candidates.length === 1) {
        const doc = candidates[0]
        await doc.ref.set({ paymongoRefundId: refundId || null, updatedAt: stamp() }, { merge: true })
        snapshot = { empty: false, docs: candidates }
      }
    }
    if (snapshot.empty) return { ignored: true }
    const operation = snapshot.docs[0]
    return reconcileOperation(operation.id, resource)
  }

  app.post('/customer/orders/:id/refund-request', requireAuth, async (req, res) => {
    try {
      const orderId = clean(req.params.id), uid = req.user.uid, body = req.body || {}
      fail(/^[A-Za-z0-9_-]{1,150}$/.test(orderId), 'Order is required.', 400)
      const issueType = clean(body.issueType), reason = clean(body.reason).slice(0, 2000)
      const proofPath = clean(body.proofPath), proofUrl = clean(body.proofUrl)
      fail(['Damaged Item', 'Wrong Item', 'Missing Item', 'Quality Concern', 'Other'].includes(issueType), 'Choose a valid refund reason.', 400)
      fail(reason.length >= 5, 'Describe the issue in at least five characters.', 400)
      fail(new RegExp(`^refund-requests/${orderId}/[A-Za-z0-9._-]{1,180}$`).test(proofPath), 'Upload a valid proof photo for this order.', 400)
      try { const parsed = new URL(proofUrl); fail(parsed.protocol === 'https:' && (parsed.hostname === 'firebasestorage.googleapis.com' || parsed.hostname.endsWith('.firebasestorage.googleapis.com')), 'Upload a valid proof photo for this order.', 400) } catch { fail(false, 'Upload a valid proof photo for this order.', 400) }
      const orderRef = db.collection('customerOrders').doc(orderId), requestRef = db.collection('refundRequests').doc()
      let notificationData = null
      await db.runTransaction(async tx => {
        const orderSnap = await tx.get(orderRef), order = orderSnap.data() || {}
        fail(orderSnap.exists && order.customerId === uid, 'Order not found.', 404)
        fail(['paid', 'completed', 'partially refunded'].includes(clean(order.paymentStatus).toLowerCase()), 'Only successfully paid orders can be submitted for a refund.', 409)
        fail(['Delivered', 'Received', 'Completed', 'Preparing', 'Awaiting Stock'].includes(order.status), 'This order is not eligible for a refund request.', 409)
        if (order.refundRequestId) {
          const previous = await tx.get(db.collection('refundRequests').doc(String(order.refundRequestId)))
          fail(!previous.exists || ['Rejected', 'Cancelled', 'Refunded'].includes(previous.data()?.status), 'This order already has an active refund request.', 409)
        }
        const paidCents = cents(order.amountPaid ?? order.totalPaid ?? order.total ?? 0)
        const remainingCents = Math.max(0, paidCents - Math.round(Number(order.refundedAmountTotal || 0) * 100))
        fail(remainingCents > 0, 'There is no remaining paid balance to refund.', 409)
        const now = stamp(), requestId = requestRef.id
        tx.set(requestRef, {
          orderId, customerId: uid, customerName: clean(order.customerName || order.delivery?.fullName || 'Customer'),
          branchId: order.branchId || order.items?.[0]?.branchId || '', branchName: order.branchName || '',
          amount: remainingCents / 100, issueType, reason, proofUrl, proofPath, requestType: 'refund',
          status: 'Requested', orderStatusAtRequest: order.status || 'Completed', createdAt: now, updatedAt: now,
        })
        tx.update(orderRef, {
          refundRequestId: requestId, refundRequestStatus: 'Requested', refundStatus: 'Requested',
          refundIssueType: issueType, refundReason: reason, refundProofUrl: proofUrl, refundProofPath: proofPath,
          refundRequestedAt: now, updatedAt: now,
        })
        notificationData = { customerId: uid, branchId: order.branchId || order.items?.[0]?.branchId || '', requestId, order }
      })
      await notify({ customerId: uid, branchId: notificationData.branchId, title: 'Refund request received', message: `Your refund request for order ${orderId} was sent to the clinic for review.`, id: `refund-request-${notificationData.requestId}` }).catch(() => {})
      return res.json({ success: true, data: { requestId: notificationData.requestId, status: 'Requested' } })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to submit refund request.' }) }
  })

  app.post('/customer/orders/:id/cancel', requireAuth, async (req, res) => {
    try {
      const orderId = clean(req.params.id), uid = req.user.uid, reasonType = clean(req.body?.reasonType), reasonDetails = clean(req.body?.reasonDetails).slice(0, 1000)
      fail(/^[A-Za-z0-9_-]{1,150}$/.test(orderId), 'Order is required.', 400)
      fail(['Changed my mind', 'Ordered by mistake', 'Wrong delivery details', 'Found a better option', 'Other'].includes(reasonType), 'Choose a valid cancellation reason.', 400)
      fail(reasonType !== 'Other' || reasonDetails.length >= 5, 'Please explain the cancellation reason.', 400)
      const orderRef = db.collection('customerOrders').doc(orderId), preview = (await orderRef.get()).data()
      fail(preview && preview.customerId === uid, 'Order not found.', 404)
      const branchId = String(preview.branchId || preview.items?.[0]?.branchId || '')
      const { policy } = await getClinicPoliciesForBranch(db, branchId)
      fail(policy.productCancellationPolicyEnabled === true && policy.orderCancellationAllowed === true, 'This clinic does not allow product-order cancellations.', 403)
      const createdAt = preview.createdAt?.toDate?.() || new Date(preview.createdAt || 0)
      fail(Number.isFinite(createdAt.getTime()), 'Order creation date is invalid.', 409)
      const windowHours = Math.max(0, Number(policy.orderCancellationWindowHours || 0))
      fail((Date.now() - createdAt.getTime()) / 3600000 <= windowHours, `Orders can only be cancelled within ${windowHours} hour${windowHours === 1 ? '' : 's'} of placement.`, 409)
      const allowedStatuses = ['Pending', 'Confirmed', 'Preparing', 'Packed', 'Awaiting Stock']
      fail(allowedStatuses.includes(String(preview.status || '')), 'This order can no longer be cancelled because it has already been shipped or completed.', 409)
      const requestRef = db.collection('refundRequests').doc()
      const paidCents = cents(preview.amountPaid ?? preview.totalPaid ?? preview.total ?? 0)
      const paid = ['paid', 'completed', 'partially refunded'].includes(clean(preview.paymentStatus).toLowerCase()) && paidCents > 0
      const refundablePercent = policy.orderCancellationNonRefundable === true ? 0 : Math.max(0, Math.min(100, Number(policy.orderCancellationRefundPercentage ?? 100)))
      const remainingCents = Math.max(0, paidCents - Math.round(Number(preview.refundedAmountTotal || 0) * 100))
      const estimatedCents = paid ? Math.round(remainingCents * refundablePercent / 100) : 0
      await db.runTransaction(async tx => {
        const orderSnap = await tx.get(orderRef), order = orderSnap.data() || {}
        fail(orderSnap.exists && order.customerId === uid && order.status === preview.status, 'This order changed. Refresh and try again.', 409)
        if (order.refundRequestId) {
          const previous = await tx.get(db.collection('refundRequests').doc(String(order.refundRequestId)))
          fail(!previous.exists || ['Rejected', 'Cancelled'].includes(previous.data()?.status), 'This order already has an active request.', 409)
        }
        const now = stamp()
        tx.set(requestRef, {
          orderId, customerId: uid, customerName: clean(order.customerName || order.delivery?.fullName || 'Customer'),
          branchId, branchName: order.branchName || '', requestType: 'cancellation',
          issueType: reasonType, reason: reasonType === 'Other' ? reasonDetails : reasonType,
          amount: estimatedCents / 100, estimatedRefundAmount: estimatedCents / 100,
          status: 'Requested', orderStatusAtRequest: order.status, policySnapshot: clean(policy.productOrderCancellationPolicy),
          createdAt: now, updatedAt: now,
        })
        tx.update(orderRef, { refundRequestId: requestRef.id, refundRequestStatus: 'Requested', refundStatus: 'Requested', cancellationRequestStatus: 'Requested', cancelReasonType: reasonType, cancelReasonDetails: reasonType === 'Other' ? reasonDetails : '', refundRequestedAt: now, cancellationInProgress: false, updatedAt: now })
      })
      await notify({ customerId: uid, branchId, title: 'Order cancellation requested', message: `Your cancellation request for order ${orderId} was sent to the clinic for review.`, id: `cancellation-request-${requestRef.id}` }).catch(() => {})
      return res.json({ success: true, data: { orderId, requestId: requestRef.id, status: 'Requested', estimatedRefundAmount: estimatedCents / 100 } })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to request order cancellation.' }) }
  })

  app.post('/finance/refunds/orders/:id/settle', requireAuth, async (req, res) => {
    try {
      const context = await contextFor(req)
      fail(permission(context), 'Refund management permission is required.', 403)
      const orderId = clean(req.params.id), requestId = clean(req.body?.refundRequestId), method = clean(req.body?.method).toLowerCase()
      const reason = clean(req.body?.reason).slice(0, 2000), reference = clean(req.body?.reference).slice(0, 160)
      fail(['original', 'offline'].includes(method), 'Choose the original payment or confirm an offline refund.', 400)
      fail(reason.length >= 3, 'A refund decision note is required.', 400)
      const recordRef = db.collection('customerOrders').doc(orderId), requestRef = db.collection('refundRequests').doc(requestId)
      const [previewSnap, requestPreview] = await Promise.all([recordRef.get(), requestRef.get()])
      const preview = previewSnap.data() || {}, requestData = requestPreview.data() || {}
      fail(previewSnap.exists && requestPreview.exists && requestData.orderId === orderId && requestData.branchId === preview.branchId, 'Refund request is unavailable.', 404)
      fail(await hasBranchAccess(context, String(preview.branchId || '')), 'Branch access is not allowed.', 403)
      const completedOperationId = String(requestData.refundOperationId || (preview.refundRequestId === requestId ? preview.refundOperationId : '') || '')
      if (method === 'original' && requestData.status === 'Refunded' && completedOperationId) {
        const operationSnap = await db.collection('refundOperations').doc(completedOperationId).get()
        const operation = operationSnap.data() || {}
        if (operation.status === 'Refunded' && operation.requestId === requestId && operation.method === 'PayMongo') {
          return res.json({ success: true, data: { operationId: operationSnap.id, status: operation.status, paymongoRefundId: operation.paymongoRefundId || null, providerStatus: operation.providerStatus || 'succeeded', orderId, requestId, method: 'PayMongo' } })
        }
      }
      fail(['Requested', 'Processing', 'Pending'].includes(requestData.status), 'This refund request is no longer awaiting settlement.', 409)
      const paidCents = cents(preview.amountPaid ?? preview.totalPaid ?? preview.total ?? 0)
      const remainingPaidCents = Math.max(0, paidCents - Math.round(Number(preview.refundedAmountTotal || 0) * 100))
      const maxCents = Math.min(remainingPaidCents, cents(requestData.amount ?? requestData.estimatedRefundAmount ?? paidCents / 100))
      const requestedCents = req.body?.amount === undefined ? maxCents : cents(req.body.amount)
      fail(requestedCents <= Math.min(paidCents, maxCents), 'Refund amount must not exceed the eligible paid amount.', 400)
      if (requestedCents === 0) {
        fail(requestData.requestType === 'cancellation', 'Refund amount must be greater than zero.', 400)
        fail(maxCents === 0, 'This cancellation has an eligible refund. Enter a positive amount to process it.', 400)
      }

      if (requestedCents > 0 && method === 'original') fail(String(preview.source || '').toLowerCase() === 'paymongo_checkout' && clean(preview.paymongoPaymentId), 'This order has no verified PayMongo payment. Use the clinic-confirmed offline refund path.', 409)
      if (requestedCents > 0 && method === 'offline') fail(String(preview.source || '').toLowerCase() !== 'paymongo_checkout' && !clean(preview.paymongoPaymentId), 'This order was paid through PayMongo. Refund it to the original payment method.', 409)
      if (requestedCents > 0 && method === 'offline') fail(reference.length >= 2, 'Enter the cash or bank refund reference.', 400)

      // Claim the review before changing fulfillment or contacting PayMongo.
      // This prevents a concurrent rejection from racing a cancellation/refund.
      const claimedAt = stamp()
      await db.runTransaction(async tx => {
        const [orderSnap, requestSnap] = await Promise.all([tx.get(recordRef), tx.get(requestRef)])
        const order = orderSnap.data() || {}, request = requestSnap.data() || {}
        fail(orderSnap.exists && requestSnap.exists && order.refundRequestId === requestId
          && request.orderId === orderId && request.branchId === order.branchId, 'Refund request is unavailable.', 404)
        fail(['Requested', 'Processing', 'Pending'].includes(request.status), 'This refund request is no longer awaiting settlement.', 409)
        const latestPaid = cents(order.amountPaid ?? order.totalPaid ?? order.total ?? 0)
        const latestRemaining = Math.max(0, latestPaid - Math.round(Number(order.refundedAmountTotal || 0) * 100))
        const latestEligible = Math.min(latestRemaining, cents(request.amount ?? request.estimatedRefundAmount ?? latestPaid / 100))
        fail(requestedCents <= latestEligible, 'The eligible refund changed. Refresh the request and review the amount again.', 409)
        tx.update(requestRef, { status: 'Processing', reviewedBy: context.uid, reviewReason: reason, reviewedAt: claimedAt, updatedAt: claimedAt })
        tx.update(recordRef, { refundRequestStatus: 'Processing', updatedAt: claimedAt })
      })

      if (requestData.requestType === 'cancellation') {
        const currentStatus = String(preview.status || '')
        if (currentStatus !== 'Cancelled') {
          await finalizeCancelledOrder({ db, timestamp: stamp, orderId, update: {
            status: 'Cancelled', cancelReasonType: preview.cancelReasonType || '', cancelReasonDetails: preview.cancelReasonDetails || '',
            cancellationRequestStatus: 'Approved', cancellationApprovedAt: stamp(), cancellationApprovedBy: context.uid,
            refundAmount: 0, refundStatus: requestedCents === 0 ? 'Not Applicable' : 'Processing', refundRequestStatus: requestedCents === 0 ? 'Approved' : 'Processing', updatedAt: stamp(),
          } })
        }
      }

      if (requestedCents === 0) {
        const now = stamp()
        await db.runTransaction(async tx => {
          const [orderSnap, requestSnap] = await Promise.all([tx.get(recordRef), tx.get(requestRef)])
          const order = orderSnap.data() || {}, request = requestSnap.data() || {}
          fail(orderSnap.exists && requestSnap.exists && order.refundRequestId === requestId && request.orderId === orderId, 'Refund request is unavailable.', 404)
        fail(request.status === 'Processing', 'This cancellation request is no longer pending.', 409)
          tx.update(recordRef, { status: 'Cancelled', cancellationRequestStatus: 'Approved', refundStatus: 'Not Applicable', refundRequestStatus: 'Approved', refundAmount: 0, cancellationApprovedAt: now, cancellationApprovedBy: context.uid, updatedAt: now })
          tx.update(requestRef, { status: 'Approved', refundMethod: 'None', amount: 0, reviewedBy: context.uid, reviewReason: reason, reviewedAt: now, updatedAt: now })
          if (order.customerId || request.customerId) tx.set(db.collection('notifications').doc(`refund-no-payment-${sha(requestId)}`), { recipientUserId: order.customerId || request.customerId, branchId: order.branchId, title: 'Cancellation approved', message: `Your order ${orderId} was cancelled. No refund was due because no payment was collected.`, link: '/customer/orders', read: false, deleted: false, createdAt: now })
          tx.set(db.collection('financeAudit').doc(`refund-no-payment-${sha(requestId)}`), { recordId: orderId, branchId: order.branchId, action: 'cancellation-approved-no-refund', previousStatus: request.status, newStatus: 'Approved', actorId: context.uid, remarks: reason, createdAt: now })
        })
        return res.json({ success: true, data: { orderId, requestId, status: 'Approved', refundStatus: 'Not Applicable', amount: 0 } })
      }

      if (method === 'original') {
        const result = await startPayMongoRefund({
          entityType: 'order', recordId: orderId, branchId: String(preview.branchId || ''),
          customerId: preview.customerId || requestData.customerId || '', customerName: preview.customerName || requestData.customerName || 'Customer',
          paymentId: clean(preview.paymongoPaymentId), amount: requestedCents / 100, paidAmount: paidCents / 100,
          requestId, actorId: context.uid, description: `Order ${orderId}`, reason,
        })
        return res.json({ success: true, data: { ...result, orderId, requestId, method: 'PayMongo' } })
      }

      const result = await recordOfflineRefund({
        entityType: 'order', recordId: orderId, branchId: String(preview.branchId || ''),
        customerId: preview.customerId || requestData.customerId || '', customerName: preview.customerName || requestData.customerName || 'Customer',
        amount: requestedCents / 100, paidAmount: paidCents / 100, requestId, actorId: context.uid,
        description: `Order ${orderId}`, reason, reference,
      })
      return res.json({ success: true, data: { ...result, orderId, requestId, method: 'Offline' } })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to process refund.' }) }
  })

  app.post('/finance/refunds/orders/:id/reject', requireAuth, async (req, res) => {
    try {
      const context = await contextFor(req)
      fail(permission(context), 'Refund management permission is required.', 403)
      const orderId = clean(req.params.id), requestId = clean(req.body?.refundRequestId), reason = clean(req.body?.reason).slice(0, 2000)
      fail(orderId && requestId && reason.length >= 3, 'Order, refund request, and rejection reason are required.', 400)
      const recordRef = db.collection('customerOrders').doc(orderId), requestRef = db.collection('refundRequests').doc(requestId)
      const preview = (await recordRef.get()).data() || {}
      fail(preview.branchId && await hasBranchAccess(context, String(preview.branchId)), 'Branch access is not allowed.', 403)
      const now = stamp()
      await db.runTransaction(async tx => {
        const recordSnap = await tx.get(recordRef)
        const order = recordSnap.data() || {}
        const requestSnap = await tx.get(requestRef)
        const operationSnap = order.refundOperationId
          ? await tx.get(db.collection('refundOperations').doc(String(order.refundOperationId)))
          : null
        const request = requestSnap.data() || {}, operation = operationSnap?.data() || {}
        fail(recordSnap.exists && requestSnap.exists && order.refundRequestId === requestId && request.orderId === orderId && request.branchId === order.branchId, 'Refund request is unavailable.', 404)
        fail(['Requested', 'Pending'].includes(request.status), 'This refund request is already being reviewed or is no longer pending.', 409)
        fail(request.requestType !== 'cancellation' || (order.status !== 'Cancelled' && order.cancellationRequestStatus !== 'Approved'), 'The cancellation was already approved. Continue refund processing instead of rejecting it.', 409)
        fail(!operationSnap?.exists || (operation.status === 'Requested' && operation.providerStatus === 'failed'), 'A refund is being processed or has already completed.', 409)
        tx.update(requestRef, { status: 'Rejected', reviewedBy: context.uid, reviewReason: reason, reviewedAt: now, updatedAt: now })
        tx.update(recordRef, {
          refundStatus: 'Rejected', refundRequestStatus: 'Rejected', refundRejectionReason: reason,
          ...(request.requestType === 'cancellation' ? { cancellationRequestStatus: 'Rejected', cancellationRejectedAt: now, refundStatus: 'Rejected' } : {}),
          updatedAt: now,
        })
        tx.set(db.collection('financeAudit').doc(`refund-reject-${sha(requestId)}`), { recordId: orderId, branchId: order.branchId, action: 'refund-request-rejected', previousStatus: request.status, newStatus: 'Rejected', actorId: context.uid, remarks: reason, createdAt: now })
        tx.set(db.collection('notifications').doc(`refund-rejected-${sha(requestId)}`), { recipientUserId: order.customerId || request.customerId || '', branchId: order.branchId, title: 'Refund request rejected', message: `The clinic reviewed your request for order ${orderId} and declined the refund. Reason: ${reason}`, link: '/customer/orders', read: false, deleted: false, createdAt: now })
      })
      return res.json({ success: true, data: { orderId, requestId, status: 'Rejected' } })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to reject refund request.' }) }
  })

  app.post('/finance/refunds/appointments/:id/retry', requireAuth, async (req, res) => {
    try {
      const context = await contextFor(req)
      fail(permission(context), 'Refund management permission is required.', 403)
      const appointmentId = clean(req.params.id)
      const appointmentRef = db.collection('appointments').doc(appointmentId)
      const previewSnap = await appointmentRef.get(), preview = previewSnap.data() || {}
      fail(previewSnap.exists && await hasBranchAccess(context, String(preview.branchId || '')), 'Appointment is unavailable for this branch.', 404)
      const requestId = clean(preview.refundRequestId) || (String(preview.approvalStatus || '').toLowerCase() === 'rejected' ? `booking-rejected-${appointmentId}` : `appointment-cancel-${appointmentId}`)
      if (preview.refundOperationId) {
        const operationSnap = await db.collection('refundOperations').doc(String(preview.refundOperationId)).get()
        const operation = operationSnap.data() || {}
        if (operation.status === 'Refunded' && operation.requestId === requestId && operation.method === 'PayMongo') {
          return res.json({ success: true, data: { operationId: operationSnap.id, status: operation.status, paymongoRefundId: operation.paymongoRefundId || null, providerStatus: operation.providerStatus || 'succeeded', requestId, method: 'PayMongo', appointmentId } })
        }
      }
      const refundNeedsRetry = preview.refundStatus === 'Requested'
        || (preview.refundStatus === 'Processing' && !clean(preview.paymongoRefundId))
      fail(['Cancelled', 'Rejected'].includes(String(preview.status || '')) && refundNeedsRetry, 'Only a failed or uncertain refund for a cancelled appointment can be retried.', 409)
      fail(String(preview.source || '').toLowerCase() === 'paymongo_checkout' && clean(preview.paymongoPaymentId), 'This appointment has no verified PayMongo payment to retry.', 409)
      const paidCents = cents(preview.amountPaid || 0)
      const remainingCents = Math.max(0, paidCents - Math.round(Number(preview.refundedAmountTotal || 0) * 100))
      const approvedCents = cents(preview.refundApprovedAmount ?? preview.refundAmount ?? preview.refundRequestedAmount ?? 0)
      const amountCents = Math.min(remainingCents, approvedCents)
      fail(amountCents > 0, 'There is no remaining amount to refund.', 409)
      const result = await startPayMongoRefund({
        entityType: 'appointment', recordId: appointmentId, branchId: String(preview.branchId || ''),
        customerId: preview.customerId || '', customerName: preview.customerName || preview.clientName || 'Customer',
        paymentId: clean(preview.paymongoPaymentId), amount: amountCents / 100, paidAmount: paidCents / 100,
        requestId,
        actorId: context.uid, description: preview.service || 'Appointment refund', reason: 'Refund retry requested by clinic finance',
      })
      return res.json({ success: true, data: { ...result, appointmentId } })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to retry appointment refund.' }) }
  })

  app.post('/finance/refunds/appointments/:id/settle-offline', requireAuth, async (req, res) => {
    try {
      const context = await contextFor(req)
      fail(permission(context), 'Refund management permission is required.', 403)
      const appointmentId = clean(req.params.id)
      const appointmentRef = db.collection('appointments').doc(appointmentId)
      const appointmentSnap = await appointmentRef.get(), appointment = appointmentSnap.data() || {}
      fail(appointmentSnap.exists && await hasBranchAccess(context, String(appointment.branchId || '')), 'Appointment is unavailable for this branch.', 404)
      fail(['Cancelled', 'Rejected'].includes(String(appointment.status || '')) && appointment.refundStatus === 'Requested', 'Only a cancelled appointment with an offline refund awaiting recording can be settled here.', 409)
      fail(String(appointment.source || '').toLowerCase() !== 'paymongo_checkout' && !clean(appointment.paymongoPaymentId), 'This appointment was paid through PayMongo. Use the original-payment refund flow.', 409)
      fail(req.body?.offlineRefundConfirmed === true, 'Confirm that the offline refund has actually been returned to the customer.', 400)
      const reference = clean(req.body?.reference).slice(0, 160)
      const reason = clean(req.body?.reason).slice(0, 2000)
      fail(reference.length >= 2, 'Enter the cash receipt or bank transfer reference.', 400)
      fail(reason.length >= 3, 'Enter a short refund note.', 400)
      const paidAmount = Math.max(0, Number(appointment.amountPaid || 0))
      const remaining = Math.max(0, paidAmount - Number(appointment.refundedAmountTotal || 0))
      const amount = Math.min(remaining, Math.max(0, Number(appointment.refundApprovedAmount ?? appointment.refundAmount ?? appointment.refundRequestedAmount ?? 0)))
      fail(amount > 0, 'There is no remaining approved amount to refund.', 409)
      const requestId = clean(appointment.refundRequestId) || (String(appointment.approvalStatus || '').toLowerCase() === 'rejected' ? `booking-rejected-${appointmentId}` : `appointment-cancel-${appointmentId}`)
      const result = await recordOfflineRefund({
        entityType: 'appointment', recordId: appointmentId, branchId: String(appointment.branchId || ''),
        customerId: appointment.customerId || '', customerName: appointment.customerName || appointment.clientName || 'Customer',
        amount, paidAmount, requestId, actorId: context.uid, description: appointment.service || 'Appointment refund',
        reason, reference,
      })
      return res.json({ success: true, data: { ...result, appointmentId, method: 'Offline' } })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to record offline appointment refund.' }) }
  })

  return { startPayMongoRefund, recordOfflineRefund, reconcileOperation, handlePayMongoRefund }
}
