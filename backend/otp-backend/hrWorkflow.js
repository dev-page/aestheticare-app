import crypto from 'node:crypto'
import { calculatePhilippineOvertime } from '../../shared/philippineOvertime.js'
import { calculatePayrollLeaveAdjustments, scheduledWorkDates, scheduledWorkDatesForYear } from '../../shared/employeeLeave.js'
import { DEFAULT_LEAVE_POLICY, isEligibleForPaidLeave, normalizeLeavePolicy } from '../../shared/leavePolicy.js'

const check = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
const clean = value => String(value ?? '').trim()
const validDate = value => {
  const date = clean(value)
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null
  check(parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date, 'Choose valid dates.', 400)
  return date
}
const manilaDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const value = type => parts.find(part => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export const registerHrWorkflow = (app, { admin, requireAuth, loadUserContext, assertPlanFeature, loadAttendanceSchedule }) => {
  const db = admin.firestore(), now = () => admin.firestore.FieldValue.serverTimestamp()
  const has = (context, permission) => {
    if (context.permissions.has(permission) || context.permissions.has('administrator:full_access')) return true
    // Preserve the employee self-service rights previously granted by the
    // Firestore rules. These exceptions are only used by the self-submit and
    // self-cancel routes below; review routes still require explicit reviewer
    // permissions and reject self-approval.
    const accountTypes = [context.userData?.userType, context.userData?.role, context.roleKey].map(value => clean(value).toLowerCase())
    return accountTypes.some(value => ['staff', 'employee'].includes(value)) && ['leave:create', 'overtime:create'].includes(permission)
  }
  const contextFor = async req => loadUserContext(req.user.uid)
  const branchAccess = async (context, branchId) => {
    const branch = (await db.collection('clinics').doc(branchId).get()).data()
    if (!branch) return null
    const assigned = new Set([context.userData?.branchId, ...(context.userData?.branchIds || [])].filter(Boolean))
    return assigned.has(branchId) || branch.ownerId === context.uid || branch.branchAdminId === context.uid ? branch : null
  }
  const response = fn => async (req, res) => {
    try { res.json({ success: true, data: await fn(req, await contextFor(req)) }) }
    catch (error) { res.status(error.status || 500).json({ success: false, error: error.message || 'HR request failed.' }) }
  }
  const requireBranch = async (context, branchId, permission, feature = 'hr') => {
    check(await branchAccess(context, branchId), 'Branch access is not allowed.', 403)
    check(has(context, permission), `The ${permission.split(':')[0]} permission is required.`, 403)
    await assertPlanFeature(db, branchId, feature)
  }

  app.get('/hr/leave-policy', requireAuth, response(async (req, context) => {
    const branchId = clean(req.query.branchId)
    check(branchId, 'Choose a clinic branch.', 400)
    await requireBranch(context, branchId, 'leave:create')
    const snapshot = await db.collection('leavePolicySettings').doc(branchId).get()
    return normalizeLeavePolicy(snapshot.data() || DEFAULT_LEAVE_POLICY)
  }))

  app.post('/hr/leave-policy', requireAuth, response(async (req, context) => {
    const branchId = clean(req.body?.branchId)
    check(branchId, 'Choose a clinic branch.', 400)
    await requireBranch(context, branchId, 'leave:review')
    const policy = normalizeLeavePolicy(req.body)
    const ref = db.collection('leavePolicySettings').doc(branchId)
    const auditRef = db.collection('leavePolicyAudit').doc()
    await db.runTransaction(async tx => {
      const previous = await tx.get(ref)
      const updatedAt = now()
      tx.set(ref, { branchId, ...policy, updatedBy: context.uid, updatedAt })
      tx.set(auditRef, { branchId, ...policy, previousPolicy: previous.exists ? normalizeLeavePolicy(previous.data()) : null, updatedBy: context.uid, updatedAt })
    })
    return policy
  }))

  app.get('/hr/payroll-leave-adjustments', requireAuth, response(async (req, context) => {
    const branchId = clean(req.query.branchId), monthKey = clean(req.query.monthKey)
    check(/^\d{4}-\d{2}$/.test(monthKey), 'Choose a valid payroll month.', 400)
    check(await branchAccess(context, branchId), 'Branch access is not allowed.', 403)
    check(has(context, 'payroll:view') || has(context, 'payroll:update'), 'Payroll access is required.', 403)
    await assertPlanFeature(db, branchId, 'payroll')
    const [leaveSnap, attendanceSnap, shiftSnap] = await Promise.all([
      db.collection('leaveRequests').where('branchId', '==', branchId).where('status', '==', 'Approved').get(),
      db.collection('attendance').where('branchId', '==', branchId).get(),
      db.collection('shifts').where('branchId', '==', branchId).get(),
    ])
    const leaves = leaveSnap.docs.map(doc => doc.data() || {})
    const employeeIds = [...new Set(leaves.map(row => clean(row.requesterId)).filter(Boolean))]
    const scheduleSnaps = await Promise.all(employeeIds.map(id => db.collection('users').doc(id).collection('schedules').doc('recurring').get()))
    const schedules = Object.fromEntries(scheduleSnaps.map((snap, index) => [employeeIds[index], snap.data() || {}]))
    const adjustments = calculatePayrollLeaveAdjustments({
      leaveRequests: leaves,
      attendanceRecords: attendanceSnap.docs.map(doc => doc.data() || {}),
      schedules,
      shifts: shiftSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })),
      monthKey,
    })
    return adjustments
  }))

  app.get('/hr/overtime-requests', requireAuth, response(async (req, context) => {
    const branchId = clean(req.query.branchId)
    check(branchId, 'Choose a clinic branch.', 400)
    await requireBranch(context, branchId, 'overtime:view')
    const snapshot = await db.collection('overtimeRequests').where('branchId', '==', branchId).get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
  }))

  app.post('/hr/overtime-requests', requireAuth, response(async (req, context) => {
    const input = req.body || {}, employeeId = req.user.uid
    const branchId = clean(input.branchId), date = validDate(input.date), reason = clean(input.reason)
    check(branchId && reason.length >= 10 && reason.length <= 500, 'Choose a branch and enter an overtime reason of 10 to 500 characters.', 400)
    check(date >= manilaDateKey(), 'Overtime date cannot be in the past.', 400)
    await requireBranch(context, branchId, 'overtime:create')
    const employeeSnap = await db.collection('users').doc(employeeId).get()
    const employee = employeeSnap.data() || {}
    check(employeeSnap.exists && (employee.branchId === branchId || (employee.branchIds || []).includes(branchId)), 'Your employee account is not assigned to this branch.', 403)
    check(employee.engagementType !== 'student_intern', 'Student interns / OJT do not submit employee overtime requests.')
    const [schedule, clinic] = await Promise.all([
      loadAttendanceSchedule(employeeId, date),
      branchAccess(context, branchId),
    ])
    const id = `ot-${employeeId}-${date}`
    const ref = db.collection('overtimeRequests').doc(id)
    const record = {
      requestId: id, requesterId: employeeId,
      requesterName: clean(employee.fullName) || `${clean(employee.firstName)} ${clean(employee.lastName)}`.trim() || clean(employee.email) || 'Employee',
      ownerId: clean(clinic?.ownerId), branchId, date, requestType: 'advance',
      shiftLabel: clean(schedule?.shiftLabel),
      scheduledStart: clean(schedule?.shiftStart),
      scheduledEnd: clean(schedule?.shiftEnd),
      reason, status: 'Pending', createdAt: now(), updatedAt: now(),
    }
    await db.runTransaction(async tx => {
      const [sameDayRequests, prior] = await Promise.all([
        tx.get(db.collection('overtimeRequests').where('branchId', '==', branchId).where('requesterId', '==', employeeId).where('date', '==', date)),
        tx.get(ref),
      ])
      check(!sameDayRequests.docs.some(doc => ['pending', 'approved'].includes(clean(doc.data()?.status).toLowerCase())), 'A pending or approved overtime request already exists for this date.')
      const previous = prior.data() || {}
      const previousReviews = Array.isArray(previous.previousReviews) ? previous.previousReviews : []
      const reviewHistory = prior.exists && previous.reviewedAt ? [...previousReviews, {
        status: previous.status, reviewedBy: previous.reviewedBy || '', reviewedById: previous.reviewedById || '',
        reviewRemarks: previous.reviewRemarks || '', reviewedAt: previous.reviewedAt,
      }] : previousReviews
      tx.set(ref, { ...record, attemptCount: Number(previous.attemptCount || 0) + 1, previousReviews: reviewHistory })
    })
    return { id, status: record.status, date: record.date }
  }))

  app.post('/hr/overtime-requests/:id/review', requireAuth, response(async (req, context) => {
    const ref = db.collection('overtimeRequests').doc(clean(req.params.id))
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(ref), request = snapshot.data() || {}, status = clean(req.body?.status)
      check(snapshot.exists && ['Approved', 'Rejected'].includes(status), 'Overtime request is unavailable or the decision is invalid.', 400)
      await requireBranch(context, request.branchId, 'overtime:review')
      check(request.requesterId !== req.user.uid, 'You cannot review your own overtime request.', 403)
      check(request.status === 'Pending', 'This overtime request has already been reviewed.')
      const remarks = clean(req.body?.reviewRemarks)
      check(status !== 'Rejected' || (remarks && remarks.length <= 2000), 'A rejection reason is required.', 400)
      const isAdvanceRequest = request.requestType === 'advance'
      if (isAdvanceRequest && status === 'Approved') {
        check(String(request.date || '') >= manilaDateKey(), 'Advance overtime must be approved on or before its requested date.', 409)
      }
      const attendanceRef = !isAdvanceRequest && request.attendanceRecordId
        ? db.collection('attendance').doc(clean(request.attendanceRecordId))
        : null
      const attendanceSnap = attendanceRef ? await tx.get(attendanceRef) : null
      let attendance = attendanceSnap?.data() || null
      let attendanceRecordId = attendanceSnap?.exists ? attendanceSnap.id : ''
      if (!isAdvanceRequest && (!attendance || attendance.employeeId !== request.requesterId || attendance.branchId !== request.branchId || attendance.date !== request.date)) {
        const matching = await tx.get(db.collection('attendance')
          .where('branchId', '==', request.branchId)
          .where('employeeId', '==', request.requesterId)
          .where('date', '==', request.date).limit(2))
        if (matching.size === 1) {
          attendanceRecordId = matching.docs[0].id
          attendance = matching.docs[0].data() || {}
        } else {
          attendance = null
          attendanceRecordId = ''
        }
      }
      const employee = (await tx.get(db.collection('users').doc(request.requesterId))).data() || {}
      let calculation = null
      let schedule = null
      if (!isAdvanceRequest) {
        schedule = await loadAttendanceSchedule(request.requesterId, request.date)
        calculation = attendance ? calculatePhilippineOvertime({
          ...attendance,
          shiftStart: attendance.shiftStart || schedule?.shiftStart,
          shiftEnd: attendance.shiftEnd || schedule?.shiftEnd,
          unpaidMealBreakMinutes: attendance.unpaidMealBreakMinutes ?? schedule?.unpaidMealBreakMinutes,
        }, employee) : null
      }
      const hasValidEvidence = Boolean(attendance?.branchId === request.branchId && attendance?.timeIn && attendance?.timeOut && calculation?.overtimeMinutes > 0)
      if (status === 'Approved') check(employee.engagementType !== 'student_intern', 'Student intern / OJT overtime cannot be approved through employee payroll.')
      if (status === 'Approved' && !isAdvanceRequest) check(hasValidEvidence, 'A complete attendance record with overtime is required to approve this request.')
      const actor = context.userData || {}
      const reviewedBy = clean(actor.fullName) || `${clean(actor.firstName)} ${clean(actor.lastName)}`.trim() || clean(actor.email) || 'Reviewer'
      tx.update(ref, {
        ...(hasValidEvidence ? {
          attendanceRecordId,
          calculatedOvertimeMinutes: calculation.overtimeMinutes,
          nightDifferentialMinutes: calculation.nightMinutes,
          dayClassification: calculation.dayClassification,
          overtimeRateMultiplier: calculation.multiplier,
          unpaidMealBreakMinutes: calculation.mealBreakMinutes,
          actualTimeIn: clean(attendance.timeIn), actualTimeOut: clean(attendance.timeOut),
          scheduledStart: clean(attendance.shiftStart || schedule?.shiftStart),
          scheduledEnd: clean(attendance.shiftEnd || schedule?.shiftEnd),
        } : {}),
        status, reviewRemarks: remarks, reviewedBy, reviewedById: req.user.uid, reviewedAt: now(), updatedAt: now()
      })
      return { id: snapshot.id, status }
    })
  }))

  const normalizeLeaveInput = (input, previous = {}, today = manilaDateKey()) => {
    const startDate = validDate(input.startDate), endDate = validDate(input.endDate)
    check(startDate >= today, 'Leave start date cannot be in the past.', 400)
    check(endDate >= today, 'Leave end date cannot be in the past.', 400)
    check(endDate >= startDate, 'End date must be on or after the start date.', 400)
    const paymentType = clean(input.paymentType), leaveType = clean(input.leaveType), reason = clean(input.reason)
    const allowedTypes = ['Vacation Leave', 'Sick Leave', 'Emergency Leave', 'Maternity Leave', 'Paternity Leave', 'Bereavement Leave', 'Personal Leave']
    check(['Paid Leave', 'Unpaid Leave'].includes(paymentType) && allowedTypes.includes(leaveType), 'Choose a valid leave type and payment type.', 400)
    check(reason.length >= 10 && reason.length <= 200, 'Leave reason must contain 10 to 200 characters.', 400)
    const attachmentUrl = clean(input.attachmentUrl || previous.attachmentUrl)
    const attachmentFileName = clean(input.attachmentFileName || previous.attachmentFileName)
    const attachmentMimeType = clean(input.attachmentMimeType || previous.attachmentMimeType)
    check(attachmentUrl.length <= 3000 && attachmentFileName.length <= 240 && attachmentMimeType.length <= 120, 'Leave attachment details are invalid.', 400)
    return { paymentType, leaveType, startDate, endDate, reason, attachmentUrl, attachmentFileName, attachmentMimeType }
  }

  const saveLeave = async (req, context, existingId = '') => {
    const employeeId = req.user.uid
    const profileSnap = await db.collection('users').doc(employeeId).get(), profile = profileSnap.data() || {}
    const branchId = clean(existingId ? req.body?.branchId || profile.branchId : profile.branchId)
    check(profileSnap.exists && branchId && (profile.branchId === branchId || (profile.branchIds || []).includes(branchId)), 'Your employee account has no matching clinic branch.', 403)
    await requireBranch(context, branchId, 'leave:create')
    const clinic = await branchAccess(context, branchId)
    const ref = existingId ? db.collection('leaveRequests').doc(existingId) : db.collection('leaveRequests').doc(`leave-${crypto.randomUUID()}`)
    const input = req.body || {}
    return db.runTransaction(async tx => {
      const [priorSnap, requestsSnap, policySnap] = await Promise.all([
        existingId ? tx.get(ref) : Promise.resolve(null),
        tx.get(db.collection('leaveRequests').where('requesterId', '==', employeeId).where('branchId', '==', branchId)),
        tx.get(db.collection('leavePolicySettings').doc(branchId)),
      ])
      const policy = normalizeLeavePolicy(policySnap.data() || DEFAULT_LEAVE_POLICY)
      const previous = priorSnap?.data() || {}
      if (existingId) check(priorSnap?.exists && previous.requesterId === employeeId && previous.branchId === branchId && previous.status === 'Pending', 'Only your pending leave request in this branch can be edited.', 403)
      const normalized = normalizeLeaveInput(input, previous, manilaDateKey())
      const activeRequests = requestsSnap.docs.filter(doc => doc.id !== existingId && ['pending', 'approved'].includes(clean(doc.data()?.status).toLowerCase()))
      check(!activeRequests.some(doc => {
        const row = doc.data() || {}
        return normalized.startDate <= clean(row.endDate) && normalized.endDate >= clean(row.startDate)
      }), 'This date range overlaps another pending or approved leave request.', 409)
      const scheduleSnap = await tx.get(db.collection('users').doc(employeeId).collection('schedules').doc('recurring'))
      const schedule = scheduleSnap.data() || {}
      const year = Number(normalized.startDate.slice(0, 4))
      const requestedDates = scheduledWorkDates(normalized.startDate, normalized.endDate, schedule)
      const requestedDays = requestedDates.length
      check(requestedDays > 0, 'The selected dates do not include a scheduled workday.', 400)
      if (normalized.paymentType === 'Paid Leave' && !['Maternity Leave', 'Paternity Leave'].includes(normalized.leaveType)) {
        check(isEligibleForPaidLeave(profile.employmentStartDate, normalized.startDate, policy.eligibilityMonths), profile.employmentStartDate ? `Paid leave requires ${policy.eligibilityMonths} month(s) of service before the requested start date.` : 'Your employment start date is missing. Ask HR to add it before requesting paid leave.', 400)
        const requestYears = [...new Set(requestedDates.map(date => Number(date.slice(0, 4))))]
        for (const requestYear of requestYears) {
          const used = new Set()
          for (const doc of requestsSnap.docs) {
            const row = doc.data() || {}
            if (doc.id === existingId || !['pending', 'approved'].includes(clean(row.status).toLowerCase()) || row.paymentType !== 'Paid Leave' || ['Maternity Leave', 'Paternity Leave'].includes(row.leaveType)) continue
            for (const date of scheduledWorkDatesForYear(clean(row.startDate), clean(row.endDate), requestYear, schedule)) used.add(date)
          }
          const requestedYearDays = scheduledWorkDatesForYear(normalized.startDate, normalized.endDate, requestYear, schedule).length
          for (const date of scheduledWorkDatesForYear(normalized.startDate, normalized.endDate, requestYear, schedule)) used.add(date)
          check(used.size <= policy.annualPaidDays, `This request exceeds the ${policy.annualPaidDays} scheduled workday paid-leave allowance for ${requestYear}. ${Math.max(0, policy.annualPaidDays - (used.size - requestedYearDays))} day(s) remain.`, 400)
        }
      }
      const name = clean(profile.fullName) || `${clean(profile.firstName)} ${clean(profile.lastName)}`.trim() || clean(profile.email) || 'Employee'
      const daysByYear = Object.fromEntries([...new Set(requestedDates.map(date => date.slice(0, 4)))].map(requestYear => [requestYear, requestedDates.filter(date => date.startsWith(`${requestYear}-`)).length]))
      const record = {
        requesterId: employeeId, requesterName: name,
        requesterRole: clean(profile.customRoleName || profile.role || 'Staff'), employmentType: clean(profile.employmentType),
        ownerId: clean(clinic?.ownerId), branchId, branchName: clean(clinic?.clinicBranch || clinic?.clinicName || 'Clinic'),
        ...normalized, daysRequested: requestedDays, daysByYear, year,
        leavePolicySnapshot: policy,
        ...(existingId ? { updatedAt: now() } : { status: 'Pending', reviewedBy: '', reviewedAt: null, reviewRemarks: '', createdAt: now(), updatedAt: now() }),
      }
      tx.set(ref, record, { merge: Boolean(existingId) })
      return { id: ref.id, status: record.status || 'Pending', daysRequested: record.daysRequested }
    })
  }

  app.post('/hr/leave-requests', requireAuth, response(async (req, context) => saveLeave(req, context)))
  app.post('/hr/leave-requests/:id/update', requireAuth, response(async (req, context) => saveLeave(req, context, clean(req.params.id))))
  app.post('/hr/leave-requests/:id/cancel', requireAuth, response(async (req, context) => {
    const ref = db.collection('leaveRequests').doc(clean(req.params.id))
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref), request = snap.data() || {}
      check(snap.exists && request.requesterId === req.user.uid && request.status === 'Pending', 'Only your pending leave request can be cancelled.', 403)
      await requireBranch(context, request.branchId, 'leave:create')
      tx.update(ref, { status: 'Cancelled', updatedAt: now() })
      return { id: snap.id, status: 'Cancelled' }
    })
  }))
  app.post('/hr/leave-requests/:id/review', requireAuth, response(async (req, context) => {
    const ref = db.collection('leaveRequests').doc(clean(req.params.id))
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref), request = snap.data() || {}, status = clean(req.body?.status)
      check(snap.exists && ['Approved', 'Rejected'].includes(status), 'Leave request is unavailable or the decision is invalid.', 400)
      await requireBranch(context, request.branchId, 'leave:review')
      check(request.requesterId !== req.user.uid, 'You cannot review your own leave request.', 403)
      check(request.status === 'Pending', 'This leave request has already been reviewed.')
      const reviewRemarks = clean(req.body?.reviewRemarks)
      check(status !== 'Rejected' || (reviewRemarks && reviewRemarks.length <= 2000), 'A rejection reason is required.', 400)
      const actor = context.userData || {}
      const reviewedBy = clean(actor.fullName) || `${clean(actor.firstName)} ${clean(actor.lastName)}`.trim() || clean(actor.email) || 'Reviewer'
      tx.update(ref, { status, reviewRemarks, reviewedBy, reviewedById: req.user.uid, reviewedAt: now(), updatedAt: now() })
      return { id: snap.id, status }
    })
  }))
}
