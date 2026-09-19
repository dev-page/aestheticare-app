import crypto from 'node:crypto'

const fail = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
const money = value => { const amount = Math.round(Number(value) * 100); fail(Number.isFinite(amount) && amount >= 0, 'Enter a valid non-negative PHP amount.', 400); return amount }
const clean = value => String(value || '').trim()

// Financial records are written only by trusted workflows. Amounts are centavos.
export const registerFinanceWorkflow = (app, { admin, requireAuth, loadUserContext }) => {
  const db = admin.firestore(), now = () => admin.firestore.FieldValue.serverTimestamp()
  const contextFor = async req => loadUserContext(req.user.uid)
  const has = (context, permission) => context.permissions.has(permission) || context.permissions.has('administrator:full_access')
  const access = async (context, branchId) => {
    const clinic = (await db.collection('clinics').doc(branchId).get()).data()
    const assigned = new Set([context.userData?.branchId, ...(context.userData?.branchIds || [])].filter(Boolean))
    return Boolean(clinic && (assigned.has(branchId) || clinic.ownerId === context.uid || clinic.branchAdminId === context.uid))
  }
  const audit = (tx, record, context, action, remarks = '') => tx.set(db.collection('financeAudit').doc(), { recordId: record.id, branchId: record.branchId, action, previousStatus: record.status || '', newStatus: record.status || '', actorId: context.uid, remarks: clean(remarks).slice(0, 2000), createdAt: now() })
  const reply = fn => async (req, res) => { try { res.json({ success: true, data: await fn(req, await contextFor(req)) }) } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message || 'Finance operation failed.' }) } }

  app.get('/finance/records', requireAuth, reply(async (req, context) => {
    fail(has(context, 'finance:payables:view') || has(context, 'finance:reports:view'), 'Finance access is required.', 403)
    const requested = clean(req.query.branchId), assigned = new Set([context.userData?.branchId, ...(context.userData?.branchIds || [])].filter(Boolean))
    for (const field of ['ownerId', 'branchAdminId']) (await db.collection('clinics').where(field, '==', context.uid).get()).docs.forEach(doc => assigned.add(doc.id))
    const accessible = [...assigned], branchIds = requested === 'all' ? accessible : [requested || accessible[0]]
    fail(branchIds.length > 0 && (await Promise.all(branchIds.map(id => access(context, id)))).every(Boolean), 'Branch access is not allowed.', 403)
    const snapshots = await Promise.all(branchIds.map(branchId => db.collection('financialRecords').where('branchId', '==', branchId).get()))
    return snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  }))

  app.post('/finance/expenses', requireAuth, reply(async (req, context) => {
    fail(has(context, 'finance:payables:approve'), 'Finance expense approval permission is required.', 403)
    const input = req.body || {}, branchId = clean(input.branchId)
    fail(await access(context, branchId), 'Branch access is not allowed.', 403)
    const amount = money(input.amount), status = input.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid', paidAmount = status === 'Paid' ? amount : 0
    const record = { id: crypto.randomUUID(), branchId, kind: 'operatingExpense', category: clean(input.category), description: clean(input.description), payee: clean(input.payee), amount, paidAmount, outstandingAmount: amount - paidAmount, expenseDate: clean(input.expenseDate), dueDate: clean(input.dueDate), paymentMethod: status === 'Paid' ? clean(input.paymentMethod) : '', paymentReference: status === 'Paid' ? clean(input.paymentReference) : '', notes: clean(input.notes), status, createdBy: context.uid, createdAt: now(), updatedAt: now() }
    fail(record.category && record.description && record.expenseDate, 'Category, description, and expense date are required.', 400)
    await db.runTransaction(async tx => { tx.set(db.collection('financialRecords').doc(record.id), record); audit(tx, record, context, 'expense-created', record.notes) })
    return { id: record.id }
  }))

  app.post('/finance/expenses/:id/payments', requireAuth, reply(async (req, context) => {
    fail(has(context, 'finance:payables:settle'), 'Finance payment settlement permission is required.', 403)
    const ref = db.collection('financialRecords').doc(clean(req.params.id)), input = req.body || {}, paymentReference = clean(input.paymentReference)
    const preview = (await ref.get()).data(); fail(preview?.kind === 'operatingExpense' && await access(context, preview.branchId), 'Expense is unavailable.', 404)
    fail(paymentReference, 'A payment reference is required.', 400)
    const paymentId = `expense-${ref.id}-${crypto.createHash('sha256').update(paymentReference).digest('hex').slice(0, 24)}`, paymentRef = db.collection('financialPayments').doc(paymentId)
    return db.runTransaction(async tx => {
      const [snap, paymentSnap] = await Promise.all([tx.get(ref), tx.get(paymentRef)]), record = snap.data(); fail(record?.kind === 'operatingExpense' && record.branchId === preview.branchId, 'Expense is unavailable.', 404)
      if (paymentSnap.exists) return { id: ref.id, status: record.status, alreadyRecorded: true }
      const amount = money(input.amount), outstanding = Number(record.outstandingAmount || 0); fail(amount > 0 && amount <= outstanding, 'Payment must not exceed the outstanding balance.', 400)
      const paidAmount = Number(record.paidAmount || 0) + amount, next = { ...record, id: ref.id, paidAmount, outstandingAmount: outstanding - amount, status: paidAmount === Number(record.amount) ? 'Paid' : 'Partially Paid', paymentMethod: clean(input.paymentMethod), paymentReference, paidAt: now(), updatedAt: now() }
      tx.update(ref, { paidAmount: next.paidAmount, outstandingAmount: next.outstandingAmount, status: next.status, paymentMethod: next.paymentMethod, paymentReference: next.paymentReference, paidAt: next.paidAt, updatedAt: next.updatedAt }); tx.set(paymentRef, { branchId: record.branchId, expenseId: ref.id, amount, paymentMethod: next.paymentMethod, paymentReference, recordedBy: context.uid, createdAt: now() }); audit(tx, next, context, 'expense-payment-recorded', paymentReference); return { id: ref.id, status: next.status }
    })
  }))
}
