import { basePayForPeriod } from '../../shared/practitionerTeam.js'
import { calculatePhilippineOvertime } from '../../shared/philippineOvertime.js'
import { calculatePayrollLeaveAdjustments } from '../../shared/employeeLeave.js'
import { DEFAULT_PAYROLL_DEDUCTION_SETTINGS, normalizePayrollDeductionSettings, payrollDeductionsMatch } from '../../shared/payrollDeductions.js'
const check = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
export const validatePayrollStaffEarnings = (entries, earnings, summaryId) => {
  const used = new Set()
  for (const snapshot of entries) {
    const entry = snapshot.data(), ids = entry.staffEarningIds || []
    check(Array.isArray(ids) && new Set(ids).size === ids.length, 'Duplicate staff earnings in payroll.')
    const available = earnings.filter(row => { const item = row.data(); return item.employeeId === entry.employeeId && item.branchId === entry.branchId && item.monthKey === payrollMonth(entry) && item.status === 'Approved' && (!item.payrollSummaryId || item.payrollSummaryId === summaryId) }).map(row => row.id)
    check(available.length === ids.length && available.every(id => ids.includes(id)), 'Staff earnings changed or an adjustment was omitted. Regenerate payroll before approval.')
    let cents = 0
    for (const id of ids) {
      const earning = earnings.find(row => row.id === id)?.data()
      check(!used.has(id) && earning && earning.employeeId === entry.employeeId && earning.branchId === entry.branchId && earning.monthKey === payrollMonth(entry) && earning.status === 'Approved' && (!earning.payrollSummaryId || earning.payrollSummaryId === summaryId), 'A staff earning is missing, already claimed, or belongs to another employee or period.')
      used.add(id); cents += Math.round(Number(earning.amount) * 100)
    }
    check(cents === Math.round(Number(entry.commission || 0) * 100), 'Payroll commission must equal the selected Finance-approved staff earnings. Regenerate payroll.')
  }
  return [...used]
}
export const payrollMonth = (entry) => {
  if (entry.payPeriodMonthKey) return entry.payPeriodMonthKey
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(entry.createdAt?.toDate?.() || new Date(entry.createdAt))
  return parts.find((p) => p.type === 'year').value + '-' + parts.find((p) => p.type === 'month').value
}
export const registerPayrollWorkflow = (app, { admin, requireAuth, loadUserContext, assertPlanFeature }) => {
  const db = admin.firestore(), timestamp = () => admin.firestore.FieldValue.serverTimestamp()
  const assignedToBranch = (context, branchId) => {
    const assigned = new Set([context.userData?.branchId, ...(Array.isArray(context.userData?.branchIds) ? context.userData.branchIds : [])].filter(Boolean))
    return assigned.has(branchId)
  }
  const requirePayrollPlan = async (branchId) => assertPlanFeature(db, branchId, 'payroll')
  const can = (context, permission) => context.permissions.has(permission) || context.permissions.has('administrator:full_access')
  app.get('/payroll/settings', requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      const branchId = String(req.query.branchId || '')
      check(branchId, 'Choose a clinic branch.', 400)
      await requirePayrollPlan(branchId)
      check(assignedToBranch(context, branchId) && (can(context, 'payroll:view') || can(context, 'payroll:update')), 'Payroll view permission required for this branch.', 403)
      const snapshot = await db.collection('payrollSettings').doc(branchId).get()
      res.json({ success: true, data: normalizePayrollDeductionSettings(snapshot.data() || DEFAULT_PAYROLL_DEDUCTION_SETTINGS) })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  app.post('/payroll/settings', requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      const branchId = String(req.body?.branchId || '')
      check(branchId, 'Choose a clinic branch.', 400)
      await requirePayrollPlan(branchId)
      check(assignedToBranch(context, branchId) && can(context, 'payroll:update'), 'Payroll update permission required for this branch.', 403)
      const settings = normalizePayrollDeductionSettings(req.body)
      const ref = db.collection('payrollSettings').doc(branchId), auditRef = db.collection('payrollSettingsAudit').doc()
      await db.runTransaction(async tx => {
        const current = await tx.get(ref)
        const updatedAt = timestamp()
        tx.set(ref, { branchId, ...settings, updatedBy: req.user.uid, updatedAt })
        tx.set(auditRef, { branchId, ...settings, updatedBy: req.user.uid, updatedAt, previousSettings: current.exists ? normalizePayrollDeductionSettings(current.data()) : null })
      })
      res.json({ success: true, data: settings })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  const route = (path, fn) => app.post(path, requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      const data = await db.runTransaction((tx) => fn(tx, req, context))
      res.json({ success: true, data })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  route('/payroll/summaries/:id/submit', async (tx, req, context) => {
    const { branchId, monthKey, payrollEntryIds } = req.body || {}
    await requirePayrollPlan(branchId)
    check(assignedToBranch(context, branchId) && context.permissions.has('payroll:update'), 'HR payroll permission required for this branch.', 403)
    check(/^\d{4}-\d{2}$/.test(monthKey || '') && req.params.id === `${branchId}_${monthKey}`, 'Invalid payroll month.', 400)
    const ref = db.collection('payrollSummaries').doc(req.params.id), previous = (await tx.get(ref)).data()
    check(previous?.status !== 'approved' && !previous?.releasedCount, 'Approved or released payroll is locked.')
    check(Array.isArray(payrollEntryIds) && payrollEntryIds.length > 0 && payrollEntryIds.length <= 400, 'Select the payroll entries for this month.')
    const snapshots = await tx.get(db.collection('payrolls').where('branchId', '==', branchId))
    const entries = snapshots.docs.filter((d) => payrollEntryIds.includes(d.id) && payrollMonth(d.data()) === monthKey)
    check(entries.length === new Set(payrollEntryIds).size && new Set(entries.map((d) => d.data().employeeId)).size === entries.length, 'Payroll entries are missing, duplicated or belong to another month.')
    const staff = await tx.get(db.collection('users').where('branchId', '==', branchId))
    const earnings = await tx.get(db.collection('staffEarnings').where('branchId', '==', branchId))
    const [attendance, overtimeRequests, leaveRequests, shifts] = await Promise.all([
      tx.get(db.collection('attendance').where('branchId', '==', branchId)),
      tx.get(db.collection('overtimeRequests').where('branchId', '==', branchId)),
      tx.get(db.collection('leaveRequests').where('branchId', '==', branchId).where('status', '==', 'Approved')),
      tx.get(db.collection('shifts').where('branchId', '==', branchId)),
    ])
    const schedules = Object.fromEntries(await Promise.all(entries.map(async entry => {
      const schedule = await tx.get(db.collection('users').doc(entry.data().employeeId).collection('schedules').doc('recurring'))
      return [entry.data().employeeId, schedule.data() || {}]
    })))
    const payrollSettingsSnapshot = await tx.get(db.collection('payrollSettings').doc(branchId))
    const payrollSettings = normalizePayrollDeductionSettings(payrollSettingsSnapshot.data() || DEFAULT_PAYROLL_DEDUCTION_SETTINGS)
    validatePayrollStaffEarnings(entries, earnings.docs, ref.id)
    const staffById = new Map(staff.docs.map((snapshot) => [snapshot.id, snapshot.data() || {}]))
    const attendanceRows = attendance.docs.map(snapshot => ({ id: snapshot.id, ...(snapshot.data() || {}) }))
    const overtimeRows = overtimeRequests.docs.map(snapshot => ({ id: snapshot.id, ...(snapshot.data() || {}) }))
    const payrollEmployeeIds = new Set(entries.map(entry => entry.data().employeeId))
    check(!overtimeRows.some(row => payrollEmployeeIds.has(row.requesterId) && row.status === 'Pending' && String(row.date || '').startsWith(`${monthKey}-`)), 'Resolve pending overtime requests before submitting this payroll month.')
    const leaveAdjustments = calculatePayrollLeaveAdjustments({
      leaveRequests: leaveRequests.docs.map(snapshot => snapshot.data() || {}),
      attendanceRecords: attendanceRows,
      schedules,
      shifts: shifts.docs.map(snapshot => ({ id: snapshot.id, ...(snapshot.data() || {}) })),
      monthKey,
    })
    const leaveByEmployee = new Map(leaveAdjustments.map(row => [row.employeeId, row]))
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
      check(employee && employee.branchId === branchId, 'The payroll employee is missing from this branch. Correct the employee assignment before submission.', 409)
      // A generated payroll remains reviewable even if an employee profile was
      // archived after the period closed. When the profile still exists, its
      // current base pay must match the generated payroll snapshot.
      check(!employee.archived, 'An archived employee payroll entry must be corrected before submission.')
      const model = data.basePayModel || 'hourly'
      const rate = Number(employee?.basePay ?? data.baseRate ?? data.hourlyRate ?? 0)
      const monthlyHours = Number(employee?.monthlyBaseHours || 176)
      const monthAttendance = attendanceRows.filter(row => row.employeeId === data.employeeId && String(row.date || '').startsWith(`${monthKey}-`) && row.timeIn && row.timeOut)
      let workedMinutes = 0
      const workedDateKeys = new Set()
      const attendanceByDate = new Map()
      for (const record of monthAttendance) {
        const calculation = calculatePhilippineOvertime(record, employee || {})
        if (calculation.workedMinutes > 0) {
          workedMinutes += calculation.workedMinutes
          workedDateKeys.add(String(record.date))
          attendanceByDate.set(String(record.date), record)
        }
      }
      const workedHours = Math.round((workedMinutes / 60) * 4) / 4
      const approvedOvertime = overtimeRows.filter(row => row.requesterId === data.employeeId && row.status === 'Approved' && String(row.date || '').startsWith(`${monthKey}-`))
      check(new Set(approvedOvertime.map(row => row.date)).size === approvedOvertime.length, 'Duplicate approved overtime requests exist for an employee and date. Resolve them before submitting payroll.')
      let overtimeMinutes = 0, overtimeBasePay = 0, nightDifferential = 0
      const rateBasis = basePayForPeriod({ model, rate, hours: 0, days: 0, monthlyHours })
      for (const request of approvedOvertime) {
        const record = attendanceRows.find(row => row.id === request.attendanceRecordId)
          || attendanceByDate.get(String(request.date))
        check(record && record.employeeId === data.employeeId && record.date === request.date, 'An approved overtime request has no matching attendance evidence. Regenerate payroll after HR resolves it.')
        const calculation = calculatePhilippineOvertime({
          ...record,
          shiftStart: record.shiftStart || request.scheduledStart,
          shiftEnd: record.shiftEnd || request.scheduledEnd,
        }, employee || {})
        check(calculation.overtimeMinutes > 0 && Number(request.calculatedOvertimeMinutes) === calculation.overtimeMinutes, 'An approved overtime amount does not match its attendance evidence. Regenerate payroll after HR reviews it.')
        overtimeMinutes += calculation.overtimeMinutes
        overtimeBasePay += (calculation.overtimeMinutes / 60) * rateBasis.hourlyEquivalent * calculation.multiplier
        nightDifferential += (calculation.nightMinutes / 60) * rateBasis.hourlyEquivalent * 0.1
      }
      const expectedOvertimeHours = Math.round((overtimeMinutes / 60) * 4) / 4
      const expectedRegularHours = Math.round(Math.max(0, workedHours - expectedOvertimeHours) * 4) / 4
      const expectedLeave = leaveByEmployee.get(data.employeeId) || { paidLeaveDays: 0, paidLeaveHours: 0, unpaidLeaveDays: 0, unpaidLeaveHours: 0 }
      const near = (left, right) => Math.abs(Number(left || 0) - Number(right || 0)) < 0.011
      check(near(data.hoursWorked, workedHours) && Number(data.workedDays || 0) === workedDateKeys.size && near(data.regularHours, expectedRegularHours), 'Attendance hours or regular hours changed. Regenerate payroll from the recorded shifts.')
      check(near(data.overtimeHours, expectedOvertimeHours) && near(data.overtimePay, overtimeBasePay + nightDifferential) && near(data.nightDifferential, nightDifferential), 'Overtime pay must match approved requests and recorded attendance.')
      check(Number(data.paidLeaveDays || 0) === expectedLeave.paidLeaveDays && near(data.paidLeaveHours, expectedLeave.paidLeaveHours)
        && Number(data.unpaidLeaveDays || 0) === expectedLeave.unpaidLeaveDays && near(data.unpaidLeaveHours, expectedLeave.unpaidLeaveHours), 'Approved leave changed. Regenerate payroll to include leave adjustments.')
      {
        check(Math.round(Number(employee.basePay || 0) * 100) === Math.round(Number(data.baseRate ?? data.hourlyRate ?? 0) * 100) && (employee.basePayModel || 'hourly') === (data.basePayModel || 'hourly'), `Base pay changed for ${data.employeeName || 'an employee'}. Regenerate payroll before submission.`)
        if (data.basePayModel === 'monthly-retainer') check(Number(employee.monthlyBaseHours || 176) === Number(data.monthlyBaseHours), 'The monthly hourly-equivalent divisor changed. Regenerate payroll.')
        const base = basePayForPeriod({
          model,
          rate: Number(employee.basePay || 0),
          hours: model === 'hourly' ? expectedRegularHours + expectedLeave.paidLeaveHours : workedHours,
          days: workedDateKeys.size + expectedLeave.paidLeaveDays,
          monthlyHours,
        })
        const unpaidLeaveDeduction = model === 'monthly-retainer'
          ? Math.round(Math.min(base.amount, expectedLeave.unpaidLeaveHours * base.hourlyEquivalent) * 100) / 100
          : 0
        check(near(data.unpaidLeaveDeduction, unpaidLeaveDeduction)
          && near(data.deductions?.unpaidLeave?.amount, unpaidLeaveDeduction)
          && near(data.basePayAmount, base.amount)
          && near(data.totalPay, base.amount + overtimeBasePay + nightDifferential + Number(data.commission || 0)), 'Payroll base pay, leave deductions, overtime, or earnings do not match the saved pay model.')
      }
      check(Math.abs(Number(data.totalPay || 0) - Number(data.totalDeductions || 0) - Number(data.netPay || 0)) < 0.011, 'Payroll earnings, deductions, and net pay do not agree.')
      check(payrollDeductionsMatch({ grossPay: data.totalPay, settings: payrollSettings, settingsSnapshot: data.deductionSettingsSnapshot, deductions: data.deductions, totalDeductions: data.totalDeductions, netPay: data.netPay }), 'Payroll deductions do not match the saved branch settings. Save the current settings and regenerate payroll before submission.')
    }
    const now = timestamp()
    const preparerIds = [...new Set([req.user.uid, ...entries.flatMap(entry => [entry.data().createdBy, entry.data().updatedBy])].filter(Boolean))]
    tx.set(ref, { branchId, monthKey, monthLabel: monthKey, payrollEntryIds: entries.map((d) => d.id), ...totals, totalEntries: entries.length, totalEmployees: entries.length, status: 'pending', submittedBy: req.user.uid, preparerIds, approvedBy: null, approvedAt: null, updatedBy: req.user.uid, updatedAt: now })
    for (const user of staff.docs.filter((d) => String(d.data().role || '').toLowerCase() === 'finance')) tx.set(db.collection('notifications').doc(), { recipientUserId: user.id, branchId, title: 'Payroll awaiting approval', message: `Payroll submitted for ${monthKey}. An independent approver must review it.`, link: '/finance/payroll-approval', read: false, deleted: false, createdAt: now })
    return { status: 'pending' }
  })
  route('/finance/payroll/:id/reject', async (tx, req, context) => {
    const ref = db.collection('payrollSummaries').doc(req.params.id), summary = (await tx.get(ref)).data()
    await requirePayrollPlan(summary?.branchId)
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
    await requirePayrollPlan(summary?.branchId)
    check(summary && assignedToBranch(context, summary.branchId) && context.permissions.has('payroll:approve'), 'Finance payroll approval permission required for this branch.', 403)
    check(summary.status === 'pending' || (summary.status === 'approved' && !summary.approvedEntries), 'This payroll summary is no longer awaiting approval.')
    check(![summary.submittedBy, summary.updatedBy, ...(summary.preparerIds || [])].includes(req.user.uid), 'You cannot approve payroll that you prepared or submitted. A different authorized approver must review it.', 403)
    const records = await tx.get(db.collection('payrolls').where('branchId', '==', summary.branchId))
    const entries = records.docs.filter((d) => payrollMonth(d.data()) === summary.monthKey && (!Array.isArray(summary.payrollEntryIds) || summary.payrollEntryIds.includes(d.id)))
    if (Array.isArray(summary.payrollEntryIds)) check(entries.length === new Set(summary.payrollEntryIds).size, 'Some payroll entries are missing or belong to another month.')
    check(entries.length > 0 && entries.length <= 400, 'Payroll must contain between 1 and 400 entries.')
    check(!entries.some(entry => [entry.data().createdBy, entry.data().updatedBy].includes(req.user.uid)), 'You cannot approve payroll entries that you prepared. A different authorized approver must review them.', 403)
    check(new Set(entries.map((d) => d.data().employeeId)).size === entries.length, 'Resolve duplicate employee payroll entries before approval.')
    const approvedEntries = Object.fromEntries(entries.map((d) => [d.id, d.data()]))
    const [earnings, activeSettingsSnapshot] = await Promise.all([
      tx.get(db.collection('staffEarnings').where('branchId', '==', summary.branchId)),
      tx.get(db.collection('payrollSettings').doc(summary.branchId)),
    ])
    const activeSettings = normalizePayrollDeductionSettings(activeSettingsSnapshot.data() || DEFAULT_PAYROLL_DEDUCTION_SETTINGS)
    const claimedEarnings = validatePayrollStaffEarnings(entries, earnings.docs, ref.id)
    const totalNetPay = entries.reduce((sum, d) => sum + Number(d.data().netPay), 0)
    check(entries.every((d) => Number.isFinite(Number(d.data().totalPay)) && Number.isFinite(Number(d.data().totalDeductions)) && Math.abs(Number(d.data().totalPay) - Number(d.data().totalDeductions) - Number(d.data().netPay)) < 0.011), 'Payroll earnings, deductions and net pay do not agree.')
    check(entries.every(d => payrollDeductionsMatch({ grossPay: d.data().totalPay, settings: activeSettings, settingsSnapshot: d.data().deductionSettingsSnapshot, deductions: d.data().deductions, totalDeductions: d.data().totalDeductions, netPay: d.data().netPay })), 'Payroll deductions no longer match the saved branch settings. Return payroll to HR for regeneration.')
    check(Number.isFinite(totalNetPay) && entries.every((d) => Number(d.data().netPay) >= 0), 'Payroll amounts are invalid.')
    check(Math.round(totalNetPay * 100) === Math.round(Number(summary.totalNetPay) * 100), 'Payroll changed. HR must regenerate the summary before approval.')
    const approvedAt = timestamp()
    // A deterministic source reference makes payroll expense synchronization
    // idempotent even if the approval request is retried.
    const expenseRef = db.collection('financialRecords').doc(`payroll-${ref.id}`)
    const existingExpense = await tx.get(expenseRef)
    tx.update(ref, { status: 'approved', approvedEntries, approvedBy: req.user.uid, approvedByName: context.userData.fullName || 'Finance', approvedAt, updatedAt: timestamp() })
    for (const id of claimedEarnings) tx.update(db.collection('staffEarnings').doc(id), { payrollSummaryId: ref.id, payrollApprovedAt: approvedAt })
    if (!existingExpense.exists) tx.set(expenseRef, { branchId: summary.branchId, kind: 'payrollExpense', sourceId: ref.id, category: 'Payroll', description: `Payroll ${summary.monthKey}`, amount: Math.round(totalNetPay * 100), paidAmount: 0, outstandingAmount: Math.round(totalNetPay * 100), status: 'Unpaid', payrollPeriod: summary.monthKey, createdBy: req.user.uid, createdAt: approvedAt, updatedAt: timestamp() })
    if (summary.updatedBy) tx.set(db.collection('notifications').doc(), { recipientUserId: summary.updatedBy, branchId: summary.branchId, title: 'Payroll approved', message: `Payroll for ${summary.monthKey} is ready for payslip release.`, link: '/hr/payroll', read: false, deleted: false, createdAt: timestamp() })
    return { status: 'approved' }
  })
  route('/payroll/:id/release', async (tx, req, context) => {
    const entryRef = db.collection('payrolls').doc(req.params.id), entry = (await tx.get(entryRef)).data()
    await requirePayrollPlan(entry?.branchId)
    check(entry && assignedToBranch(context, entry.branchId) && context.permissions.has('payroll:update'), 'HR payroll permission required for this branch.', 403)
    const month = payrollMonth(entry), summaryRef = db.collection('payrollSummaries').doc(`${entry.branchId}_${month}`)
    const summary = (await tx.get(summaryRef)).data()
    check(summary?.status === 'approved' && summary.approvedEntries?.[entryRef.id], 'Finance must approve this exact payroll entry before release. Regenerate and review older summaries.')
    const approved = summary.approvedEntries[entryRef.id]
    const slipRef = db.collection('payslips').doc(entryRef.id), slip = await tx.get(slipRef)
    if (slip.exists) return { id: entryRef.id, alreadyRecorded: true }
    const now = timestamp()
    const payload = { employeeId: approved.employeeId, employeeName: approved.employeeName || '', branchId: approved.branchId, payrollEntryId: entryRef.id, payPeriodMonthKey: month, payPeriod: month, earnings: { hoursWorked: Number(approved.hoursWorked || 0), regularHours: Number(approved.regularHours || 0), overtimeHours: Number(approved.overtimeHours || 0), paidLeaveDays: Number(approved.paidLeaveDays || 0), paidLeaveHours: Number(approved.paidLeaveHours || 0), unpaidLeaveDays: Number(approved.unpaidLeaveDays || 0), unpaidLeaveHours: Number(approved.unpaidLeaveHours || 0), hourlyRate: Number(approved.hourlyRate || 0), basePayModel: approved.basePayModel || 'hourly', baseRate: Number(approved.baseRate ?? approved.hourlyRate ?? 0), basePayAmount: approved.basePayAmount ?? null, workedDays: approved.workedDays ?? null, overtimePay: Number(approved.overtimePay || 0), commission: Number(approved.commission || 0), total: Number(approved.totalPay || 0) }, deductions: approved.deductions || {}, totalEarnings: Number(approved.totalPay || 0), totalDeductions: Number(approved.totalDeductions || 0), netPay: Number(approved.netPay || 0), createdBy: req.user.uid, createdAt: now, dateGenerated: now, paymentStatus: 'Unpaid' }
    tx.set(slipRef, payload)
    tx.set(db.collection('users').doc(approved.employeeId).collection('payslips').doc(entryRef.id), payload)
    const releasedCount = Number(summary.releasedCount || 0) + 1
    const totalEntries = Object.keys(summary.approvedEntries || {}).length
    tx.update(entryRef, { payslipReleasedAt: now })
    tx.update(summaryRef, {
      releasedCount,
      payslipStatus: releasedCount >= totalEntries ? 'Released' : 'Partially Released',
      payslipsReleasedAt: releasedCount >= totalEntries ? now : null,
      updatedAt: now,
    })
    tx.set(db.collection('notifications').doc(), { recipientUserId: approved.employeeId, branchId: approved.branchId, title: 'Payslip available', message: `Your approved payslip for ${month} is available.`, link: '/hr/my-payslips', read: false, deleted: false, createdAt: now })
    return { id: entryRef.id }
  })
  route('/finance/payroll/:id/record-payment', async (tx, req, context) => {
    const summaryRef = db.collection('payrollSummaries').doc(req.params.id)
    const summary = (await tx.get(summaryRef)).data()
    await requirePayrollPlan(summary?.branchId)
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
      for (const earningId of summary.approvedEntries[entryIds[index]].staffEarningIds || []) tx.update(db.collection('staffEarnings').doc(earningId), { payrollPaidAt: now, payrollPaymentReference: paymentReference })
    }
    const expenseRef = db.collection('financialRecords').doc(`payroll-${summaryRef.id}`)
    const expenseSnap = await tx.get(expenseRef)
    if (expenseSnap.exists) tx.update(expenseRef, { paidAmount: Math.round(paidAmount * 100), outstandingAmount: 0, status: 'Paid', paidAt: now, paymentReference, paymentMethod, updatedAt: now })
    tx.update(summaryRef, { paymentStatus: 'Paid', paymentMethod, paymentReference, paidAt: now, paidBy: req.user.uid, updatedAt: now })
    return { paymentStatus: 'Paid', paidAmount }
  })
}
