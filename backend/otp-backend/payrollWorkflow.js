const check = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
export const payrollMonth = (entry) => {
  if (entry.payPeriodMonthKey) return entry.payPeriodMonthKey
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(entry.createdAt?.toDate?.() || new Date(entry.createdAt))
  return parts.find((p) => p.type === 'year').value + '-' + parts.find((p) => p.type === 'month').value
}
export const registerPayrollWorkflow = (app, { admin, requireAuth, loadUserContext }) => {
  const db = admin.firestore(), timestamp = () => admin.firestore.FieldValue.serverTimestamp()
  const assignedToBranch = (context, branchId) => {
    const assigned = new Set([context.userData?.branchId, ...(Array.isArray(context.userData?.branchIds) ? context.userData.branchIds : [])].filter(Boolean))
    return assigned.has(branchId)
  }
  const route = (path, fn) => app.post(path, requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      const data = await db.runTransaction((tx) => fn(tx, req, context))
      res.json({ success: true, data })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  route('/payroll/summaries/:id/submit', async (tx, req, context) => {
    const { branchId, monthKey, payrollEntryIds } = req.body || {}
    check(assignedToBranch(context, branchId) && context.permissions.has('payroll:update'), 'HR payroll permission required for this branch.', 403)
    check(/^\d{4}-\d{2}$/.test(monthKey || '') && req.params.id === `${branchId}_${monthKey}`, 'Invalid payroll month.', 400)
    const ref = db.collection('payrollSummaries').doc(req.params.id), previous = (await tx.get(ref)).data()
    check(previous?.status !== 'approved' && !previous?.releasedCount, 'Approved or released payroll is locked.')
    check(Array.isArray(payrollEntryIds) && payrollEntryIds.length > 0 && payrollEntryIds.length <= 400, 'Select the payroll entries for this month.')
    const snapshots = await tx.get(db.collection('payrolls').where('branchId', '==', branchId))
    const entries = snapshots.docs.filter((d) => payrollEntryIds.includes(d.id) && payrollMonth(d.data()) === monthKey)
    check(entries.length === new Set(payrollEntryIds).size && new Set(entries.map((d) => d.data().employeeId)).size === entries.length, 'Payroll entries are missing, duplicated or belong to another month.')
    const staff = await tx.get(db.collection('users').where('branchId', '==', branchId))
    const staffById = new Map(staff.docs.map((snapshot) => [snapshot.id, snapshot.data() || {}]))
    const totals = { totalPayroll: 0, totalNetPay: 0, totalDeductions: 0 }
    for (const d of entries) {
      totals.totalPayroll += Number(d.data().totalPay)
      totals.totalNetPay += Number(d.data().netPay)
      totals.totalDeductions += Number(d.data().totalDeductions)
    }
    check(Object.values(totals).every(Number.isFinite), 'Payroll amounts are invalid.')
    for (const entry of entries) {
      const data = entry.data() || {}
      const employee = staffById.get(data.employeeId)
      check(employee && !employee.archived, 'Every payroll entry must belong to an active employee in this branch.')
      check(Math.round(Number(employee.basePay || 0) * 100) === Math.round(Number(data.hourlyRate || 0) * 100), `Base pay changed for ${data.employeeName || 'an employee'}. Regenerate payroll before submission.`)
      check(Math.abs(Number(data.totalPay || 0) - Number(data.totalDeductions || 0) - Number(data.netPay || 0)) < 0.011, 'Payroll earnings, deductions, and net pay do not agree.')
    }
    const now = timestamp()
    tx.set(ref, { branchId, monthKey, monthLabel: monthKey, payrollEntryIds: entries.map((d) => d.id), ...totals, totalEntries: entries.length, totalEmployees: entries.length, status: 'pending', approvedBy: null, approvedAt: null, updatedBy: req.user.uid, updatedAt: now })
    for (const user of staff.docs.filter((d) => String(d.data().role || '').toLowerCase() === 'finance')) tx.set(db.collection('notifications').doc(), { recipientUserId: user.id, branchId, title: 'Payroll awaiting approval', message: `HR submitted payroll for ${monthKey}.`, link: '/finance/payroll-approval', read: false, deleted: false, createdAt: now })
    return { status: 'pending' }
  })
  route('/finance/payroll/:id/reject', async (tx, req, context) => {
    const ref = db.collection('payrollSummaries').doc(req.params.id), summary = (await tx.get(ref)).data()
    check(summary && assignedToBranch(context, summary.branchId) && context.permissions.has('payroll:approve'), 'Finance payroll approval permission required for this branch.', 403)
    check(summary.status === 'pending' || (summary.status === 'approved' && !summary.approvedEntries && !summary.releasedCount), 'Only pending or unconfirmed legacy payroll can be returned to HR.')
    const reason = String(req.body?.reason || '').trim()
    check(reason.length > 0 && reason.length <= 2000, 'Provide a rejection reason.', 400)
    const now = timestamp()
    tx.update(ref, { status: 'rejected', rejectionReason: reason, approvedBy: req.user.uid, approvedAt: null, updatedAt: now })
    if (summary.updatedBy) tx.set(db.collection('notifications').doc(), { recipientUserId: summary.updatedBy, branchId: summary.branchId, title: 'Payroll changes requested', message: reason, link: '/hr/payroll', read: false, deleted: false, createdAt: now })
    return { status: 'rejected' }
  })
  route('/finance/payroll/:id/approve', async (tx, req, context) => {
    const ref = db.collection('payrollSummaries').doc(req.params.id), summary = (await tx.get(ref)).data()
    check(summary && assignedToBranch(context, summary.branchId) && context.permissions.has('payroll:approve'), 'Finance payroll approval permission required for this branch.', 403)
    check(summary.status === 'pending' || (summary.status === 'approved' && !summary.approvedEntries), 'This payroll summary is no longer awaiting approval.')
    const records = await tx.get(db.collection('payrolls').where('branchId', '==', summary.branchId))
    const entries = records.docs.filter((d) => payrollMonth(d.data()) === summary.monthKey && (!Array.isArray(summary.payrollEntryIds) || summary.payrollEntryIds.includes(d.id)))
    if (Array.isArray(summary.payrollEntryIds)) check(entries.length === new Set(summary.payrollEntryIds).size, 'Some payroll entries are missing or belong to another month.')
    check(entries.length > 0 && entries.length <= 400, 'Payroll must contain between 1 and 400 entries.')
    check(new Set(entries.map((d) => d.data().employeeId)).size === entries.length, 'Resolve duplicate employee payroll entries before approval.')
    const approvedEntries = Object.fromEntries(entries.map((d) => [d.id, d.data()]))
    const totalNetPay = entries.reduce((sum, d) => sum + Number(d.data().netPay), 0)
    check(entries.every((d) => Number.isFinite(Number(d.data().totalPay)) && Number.isFinite(Number(d.data().totalDeductions)) && Math.abs(Number(d.data().totalPay) - Number(d.data().totalDeductions) - Number(d.data().netPay)) < 0.011), 'Payroll earnings, deductions and net pay do not agree.')
    check(Number.isFinite(totalNetPay) && entries.every((d) => Number(d.data().netPay) >= 0), 'Payroll amounts are invalid.')
    check(Math.round(totalNetPay * 100) === Math.round(Number(summary.totalNetPay) * 100), 'Payroll changed. HR must regenerate the summary before approval.')
    const approvedAt = timestamp()
    // A deterministic source reference makes payroll expense synchronization
    // idempotent even if the approval request is retried.
    const expenseRef = db.collection('financialRecords').doc(`payroll-${ref.id}`)
    const existingExpense = await tx.get(expenseRef)
    tx.update(ref, { status: 'approved', approvedEntries, approvedBy: req.user.uid, approvedByName: context.userData.fullName || 'Finance', approvedAt, updatedAt: timestamp() })
    if (!existingExpense.exists) tx.set(expenseRef, { branchId: summary.branchId, kind: 'payrollExpense', sourceId: ref.id, category: 'Payroll', description: `Payroll ${summary.monthKey}`, amount: Math.round(totalNetPay * 100), paidAmount: 0, outstandingAmount: Math.round(totalNetPay * 100), status: 'Unpaid', payrollPeriod: summary.monthKey, createdBy: req.user.uid, createdAt: approvedAt, updatedAt: timestamp() })
    if (summary.updatedBy) tx.set(db.collection('notifications').doc(), { recipientUserId: summary.updatedBy, branchId: summary.branchId, title: 'Payroll approved', message: `Payroll for ${summary.monthKey} is ready for payslip release.`, link: '/hr/payroll', read: false, deleted: false, createdAt: timestamp() })
    return { status: 'approved' }
  })
  route('/payroll/:id/release', async (tx, req, context) => {
    const entryRef = db.collection('payrolls').doc(req.params.id), entry = (await tx.get(entryRef)).data()
    check(entry && assignedToBranch(context, entry.branchId) && context.permissions.has('payroll:update'), 'HR payroll permission required for this branch.', 403)
    const month = payrollMonth(entry), summaryRef = db.collection('payrollSummaries').doc(`${entry.branchId}_${month}`)
    const summary = (await tx.get(summaryRef)).data()
    check(summary?.status === 'approved' && summary.approvedEntries?.[entryRef.id], 'Finance must approve this exact payroll entry before release. Regenerate and review older summaries.')
    const approved = summary.approvedEntries[entryRef.id]
    const slipRef = db.collection('payslips').doc(entryRef.id), slip = await tx.get(slipRef)
    if (slip.exists) return { id: entryRef.id, alreadyRecorded: true }
    const now = timestamp()
    const payload = { employeeId: approved.employeeId, employeeName: approved.employeeName || '', branchId: approved.branchId, payrollEntryId: entryRef.id, payPeriodMonthKey: month, payPeriod: month, earnings: { hoursWorked: Number(approved.hoursWorked || 0), hourlyRate: Number(approved.hourlyRate || 0), overtimePay: Number(approved.overtimePay || 0), commission: Number(approved.commission || 0), total: Number(approved.totalPay || 0) }, deductions: approved.deductions || {}, totalEarnings: Number(approved.totalPay || 0), totalDeductions: Number(approved.totalDeductions || 0), netPay: Number(approved.netPay || 0), createdBy: req.user.uid, createdAt: now, dateGenerated: now, paymentStatus: 'Unpaid' }
    tx.set(slipRef, payload)
    tx.set(db.collection('users').doc(approved.employeeId).collection('payslips').doc(entryRef.id), payload)
    tx.update(entryRef, { payslipReleasedAt: now })
    tx.update(summaryRef, { releasedCount: Number(summary.releasedCount || 0) + 1 })
    tx.set(db.collection('notifications').doc(), { recipientUserId: approved.employeeId, branchId: approved.branchId, title: 'Payslip available', message: `Your approved payslip for ${month} is available.`, link: '/hr/my-payslips', read: false, deleted: false, createdAt: now })
    return { id: entryRef.id }
  })
  route('/finance/payroll/:id/record-payment', async (tx, req, context) => {
    const summaryRef = db.collection('payrollSummaries').doc(req.params.id)
    const summary = (await tx.get(summaryRef)).data()
    check(summary && assignedToBranch(context, summary.branchId) && context.permissions.has('payroll:approve'), 'Finance payroll approval permission required for this branch.', 403)
    check(summary.status === 'approved' && summary.approvedEntries, 'Only an approved payroll can be recorded as paid.')
    if (summary.paymentStatus === 'Paid') return { alreadyRecorded: true }

    const paymentReference = String(req.body?.paymentReference || '').trim()
    const paymentMethod = String(req.body?.paymentMethod || 'Bank transfer').trim()
    check(paymentReference.length >= 3 && paymentReference.length <= 200, 'Enter a valid payment reference.', 400)
    check(paymentMethod.length > 0 && paymentMethod.length <= 80, 'Enter a valid payment method.', 400)

    const entryIds = Object.keys(summary.approvedEntries || {})
    check(entryIds.length > 0, 'This payroll has no approved entries.')
    const slipRefs = entryIds.map((id) => db.collection('payslips').doc(id))
    const slips = await Promise.all(slipRefs.map((ref) => tx.get(ref)))
    check(slips.every((slip) => slip.exists), 'HR must release every approved payslip before Finance records payroll payment.')

    const now = timestamp()
    let paidAmount = 0
    for (let index = 0; index < slips.length; index += 1) {
      const slipData = slips[index].data() || {}
      const amount = Number(slipData.netPay || 0)
      check(Number.isFinite(amount) && amount >= 0, 'A payslip has an invalid net pay.')
      paidAmount += amount
      const paymentUpdate = { paymentStatus: 'Paid', paymentMethod, paymentReference, paidAt: now, paidBy: req.user.uid, updatedAt: now }
      tx.update(slipRefs[index], paymentUpdate)
      tx.update(db.collection('users').doc(slipData.employeeId).collection('payslips').doc(entryIds[index]), paymentUpdate)
      tx.update(db.collection('payrolls').doc(entryIds[index]), { paymentStatus: 'Paid', paidAt: now, paidBy: req.user.uid, paymentReference, updatedAt: now })
    }
    const expenseRef = db.collection('financialRecords').doc(`payroll-${summaryRef.id}`)
    const expenseSnap = await tx.get(expenseRef)
    if (expenseSnap.exists) tx.update(expenseRef, { paidAmount: Math.round(paidAmount * 100), outstandingAmount: 0, status: 'Paid', paidAt: now, paymentReference, paymentMethod, updatedAt: now })
    tx.update(summaryRef, { paymentStatus: 'Paid', paymentMethod, paymentReference, paidAt: now, paidBy: req.user.uid, updatedAt: now })
    return { paymentStatus: 'Paid', paidAmount }
  })
}
