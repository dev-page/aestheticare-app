const check = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
export const payrollMonth = (entry) => {
  if (entry.payPeriodMonthKey) return entry.payPeriodMonthKey
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(entry.createdAt?.toDate?.() || new Date(entry.createdAt))
  return parts.find((p) => p.type === 'year').value + '-' + parts.find((p) => p.type === 'month').value
}
export const registerPayrollWorkflow = (app, { admin, requireAuth, loadUserContext }) => {
  const db = admin.firestore(), timestamp = () => admin.firestore.FieldValue.serverTimestamp()
  const route = (path, fn) => app.post(path, requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      const data = await db.runTransaction((tx) => fn(tx, req, context))
      res.json({ success: true, data })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  route('/payroll/summaries/:id/submit', async (tx, req, context) => {
    const { branchId, monthKey, payrollEntryIds } = req.body || {}
    check(context.userData.branchId === branchId && context.permissions.has('payroll:update'), 'HR payroll permission required for this branch.', 403)
    check(/^\d{4}-\d{2}$/.test(monthKey || '') && req.params.id === `${branchId}_${monthKey}`, 'Invalid payroll month.', 400)
    const ref = db.collection('payrollSummaries').doc(req.params.id), previous = (await tx.get(ref)).data()
    check(previous?.status !== 'approved' && !previous?.releasedCount, 'Approved or released payroll is locked.')
    check(Array.isArray(payrollEntryIds) && payrollEntryIds.length > 0 && payrollEntryIds.length <= 400, 'Select the payroll entries for this month.')
    const snapshots = await tx.get(db.collection('payrolls').where('branchId', '==', branchId))
    const entries = snapshots.docs.filter((d) => payrollEntryIds.includes(d.id) && payrollMonth(d.data()) === monthKey)
    check(entries.length === new Set(payrollEntryIds).size && new Set(entries.map((d) => d.data().employeeId)).size === entries.length, 'Payroll entries are missing, duplicated or belong to another month.')
    const staff = await tx.get(db.collection('users').where('branchId', '==', branchId))
    const totals = { totalPayroll: 0, totalNetPay: 0, totalDeductions: 0 }
    for (const d of entries) {
      totals.totalPayroll += Number(d.data().totalPay)
      totals.totalNetPay += Number(d.data().netPay)
      totals.totalDeductions += Number(d.data().totalDeductions)
    }
    check(Object.values(totals).every(Number.isFinite), 'Payroll amounts are invalid.')
    const now = timestamp()
    tx.set(ref, { branchId, monthKey, monthLabel: monthKey, payrollEntryIds: entries.map((d) => d.id), ...totals, totalEntries: entries.length, totalEmployees: entries.length, status: 'pending', approvedBy: null, approvedAt: null, updatedBy: req.user.uid, updatedAt: now })
    for (const user of staff.docs.filter((d) => String(d.data().role || '').toLowerCase() === 'finance')) tx.set(db.collection('notifications').doc(), { recipientUserId: user.id, branchId, title: 'Payroll awaiting approval', message: `HR submitted payroll for ${monthKey}.`, link: '/finance/payroll-approval', read: false, deleted: false, createdAt: now })
    return { status: 'pending' }
  })
  route('/finance/payroll/:id/reject', async (tx, req, context) => {
    const ref = db.collection('payrollSummaries').doc(req.params.id), summary = (await tx.get(ref)).data()
    check(summary && context.userData.branchId === summary.branchId && context.permissions.has('payroll:approve'), 'Finance payroll approval permission required for this branch.', 403)
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
    check(summary && context.userData.branchId === summary.branchId && context.permissions.has('payroll:approve'), 'Finance payroll approval permission required for this branch.', 403)
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
    tx.update(ref, { status: 'approved', approvedEntries, approvedBy: req.user.uid, approvedByName: context.userData.fullName || 'Finance', approvedAt: timestamp(), updatedAt: timestamp() })
    if (summary.updatedBy) tx.set(db.collection('notifications').doc(), { recipientUserId: summary.updatedBy, branchId: summary.branchId, title: 'Payroll approved', message: `Payroll for ${summary.monthKey} is ready for payslip release.`, link: '/hr/payroll', read: false, deleted: false, createdAt: timestamp() })
    return { status: 'approved' }
  })
  route('/payroll/:id/release', async (tx, req, context) => {
    const entryRef = db.collection('payrolls').doc(req.params.id), entry = (await tx.get(entryRef)).data()
    check(entry && context.userData.branchId === entry.branchId && context.permissions.has('payroll:update'), 'HR payroll permission required for this branch.', 403)
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
    tx.set(db.collection('notifications').doc(), { recipientUserId: approved.employeeId, branchId: approved.branchId, title: 'Payslip available', message: `Your approved payslip for ${month} is available.`, link: '/employee/payslips', read: false, deleted: false, createdAt: now })
    return { id: entryRef.id }
  })
}
