import { practitionerTypes, normalizePractitionerProfile, normalizeStaffing, rateFor, teamMeetsRequirements, appointmentStaffIds, appointmentServiceId, sessionEarningBase, calculateStaffEarnings } from '../../shared/practitionerTeam.js'
const check = (ok, message, status = 409) => { if (!ok) throw Object.assign(new Error(message), { status }) }
const closed = row => ['completed', 'cancelled', 'rejected', 'expired', 'no-show', 'incomplete', 'forfeited'].includes(String(row.status || '').toLowerCase())
const serviceIdFor = appointmentServiceId
const nameFor = user => user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Practitioner'

export const prepareTeamStart = async (tx, db, appointment, id) => {
  const leadId = appointment.assignedPractitionerId || appointment.practitionerId
  const team = appointment.treatmentTeam?.length ? appointment.treatmentTeam : [{ employeeId: leadId, responsibility: 'lead' }]
  const requirements = normalizeStaffing(appointment.staffingRequirements)
  const members = [], terms = []
  for (const member of team) {
    const user = (await tx.get(db.collection('users').doc(member.employeeId))).data()
    const profile = (await tx.get(db.collection('practitionerProfiles').doc(member.employeeId))).data()
    check(user && !user.archived && String(user.status).toLowerCase() === 'active' && [user.branchId, ...(user.branchIds || [])].includes(appointment.branchId), 'A team member is inactive or no longer assigned to this branch.')
    if (requirements.length) check(profile && profile.approvedServiceIds.includes(serviceIdFor(appointment)) && (!['Doctor', 'Registered Nurse'].includes(profile.type) || profile.credentialsVerified), 'Configure verified credentials and approved services for every required team member.')
    const entry = { employeeId: member.employeeId, name: nameFor(user), type: profile?.type || 'Other', responsibility: member.responsibility, participationConfirmed: member.responsibility === 'lead' }
    members.push(entry)
    const rateSnapshot = rateFor(profile, serviceIdFor(appointment), member.responsibility, appointment.date)
    if (profile || requirements.length) check(rateSnapshot, 'Configure an effective compensation agreement for every team member before treatment starts (use zero for unpaid assistance).')
    terms.push({ ...entry, rateSnapshot })
  }
  check(teamMeetsRequirements(members, requirements), 'Assign the full required treatment team before starting.')
  if (terms.every(member => member.rateSnapshot)) {
    const plan = appointment.treatmentPlanAppointmentId ? (await tx.get(db.collection('appointments').doc(appointment.treatmentPlanAppointmentId))).data() : appointment
    check(plan, 'The original treatment plan is missing.')
    const base = sessionEarningBase(appointment, plan)
    const forecast = calculateStaffEarnings(terms.map(member => ({ ...member, participationConfirmed: true })), base)
    check(forecast.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) <= Math.round(base * 100), 'The configured team earnings exceed this session’s allocated service price. Correct the agreements before starting.')
  }
  return { members, termsRef: db.collection('appointmentStaffTerms').doc(id), terms: { branchId: appointment.branchId, appointmentId: id, members: terms } }
}

export const registerPractitionerTeams = (app, { admin, requireAuth, loadUserContext, authorizeClinicAction, getBookingRange, rangesOverlap }) => {
  const db = admin.firestore(), now = () => admin.firestore.FieldValue.serverTimestamp()
  const route = (method, path, fn) => app[method](path, requireAuth, async (req, res) => {
    try { const context = await loadUserContext(req.user.uid); res.json({ success: true, data: await fn(req, context) }) }
    catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  const owner = async (uid, branchId) => {
    const clinic = (await db.collection('clinics').doc(branchId).get()).data()
    check(clinic?.ownerId === uid || clinic?.organizationOwnerId === uid, 'Only the clinic owner can change practitioner credentials and compensation.', 403)
  }
  route('get', '/staff/:id/practitioner-details', async req => {
    const user = (await db.collection('users').doc(req.params.id).get()).data()
    check(user, 'Employee not found.', 404)
    await authorizeClinicAction(req.user.uid, user.branchId, 'staff:view')
    const profile = (await db.collection('practitionerProfiles').doc(req.params.id).get()).data()
    return { type: profile?.type || user.practitionerType || '', credentialNumber: profile?.credentialNumber || '' }
  })
  route('post', '/staff/:id/practitioner-details', async req => {
    const type = String(req.body?.type || '').trim()
    const credentialNumber = String(req.body?.credentialNumber || '').trim()
    check((!type || practitionerTypes.includes(type)) && credentialNumber.length <= 100, 'Choose a supported specialty and a license number of up to 100 characters.', 400)
    return db.runTransaction(async tx => {
      const userRef = db.collection('users').doc(req.params.id), profileRef = db.collection('practitionerProfiles').doc(req.params.id)
      const user = (await tx.get(userRef)).data()
      check(user, 'Employee not found.', 404)
      await authorizeClinicAction(req.user.uid, user.branchId, 'staff:update')
      const profile = (await tx.get(profileRef)).data()
      const changed = type !== (profile?.type || user.practitionerType || '') || credentialNumber !== (profile?.credentialNumber || '')
      if (type || profile) tx.set(profileRef, { ...(profile || { approvedServiceIds: [], rates: [] }), type, credentialNumber, credentialsVerified: changed ? false : profile?.credentialsVerified === true, branchId: user.branchId, updatedBy: req.user.uid, updatedAt: now() })
      tx.update(userRef, { practitionerType: type || null })
      if (changed) tx.set(db.collection('practitionerProfileAudit').doc(), { employeeId: req.params.id, branchId: user.branchId, actorId: req.user.uid, action: 'updated_specialty_and_license', type, credentialNumber, createdAt: now() })
      return { type, credentialNumber }
    })
  })
  route('get', '/practitioner-profiles/:id', async (req) => {
    const user = (await db.collection('users').doc(req.params.id).get()).data()
    check(user, 'Employee not found.', 404)
    await owner(req.user.uid, user.branchId)
    return (await db.collection('practitionerProfiles').doc(req.params.id).get()).data() || null
  })
  route('post', '/practitioner-profiles/:id', async (req) => {
    const user = (await db.collection('users').doc(req.params.id).get()).data()
    check(user, 'Employee not found.', 404)
    await owner(req.user.uid, user.branchId)
    const profile = normalizePractitionerProfile(req.body || {})
    if (['Doctor', 'Registered Nurse'].includes(profile.type) && profile.credentialsVerified) check(profile.credentialNumber, 'Enter the professional credential number before verifying it.', 400)
    for (const id of [...new Set([...profile.approvedServiceIds, ...profile.rates.map(rate => rate.serviceId).filter(Boolean)])]) {
      const listing = (await db.collection('productServicePosts').doc(id).get()).data()
      check(listing && [user.branchId, ...(user.branchIds || [])].includes(listing.branchId) && listing.postType !== 'Product', 'Choose a service from the employee’s assigned branches.', 400)
    }
    const batch = db.batch()
    batch.set(db.collection('practitionerProfiles').doc(req.params.id), { ...profile, branchId: user.branchId, updatedBy: req.user.uid, updatedAt: now() })
    batch.update(db.collection('users').doc(req.params.id), { practitionerType: profile.type })
    batch.set(db.collection('practitionerProfileAudit').doc(), { employeeId: req.params.id, branchId: user.branchId, actorId: req.user.uid, profile, createdAt: now() })
    await batch.commit()
    return profile
  })
  route('get', '/appointments/:id/team', async req => {
    const appointment = (await db.collection('appointments').doc(req.params.id).get()).data()
    check(appointment, 'Appointment not found.', 404)
    await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:view')
    const [primary, additional] = await Promise.all([db.collection('users').where('branchId', '==', appointment.branchId).get(), db.collection('users').where('branchIds', 'array-contains', appointment.branchId).get()])
    const staff = [...new Map([...primary.docs, ...additional.docs].map(doc => [doc.id, doc])).values()]
    const people = []
    for (const doc of staff.filter(doc => !doc.data().archived && String(doc.data().status).toLowerCase() === 'active')) {
      const profile = (await db.collection('practitionerProfiles').doc(doc.id).get()).data()
      if (profile) people.push({ id: doc.id, name: nameFor(doc.data()), type: profile.type, approvedServiceIds: profile.approvedServiceIds, credentialsVerified: profile.credentialsVerified })
    }
    return { appointment, people }
  })
  route('post', '/appointments/:id/team', async req => db.runTransaction(async tx => {
    const ref = db.collection('appointments').doc(req.params.id), appointment = (await tx.get(ref)).data()
    check(appointment, 'Appointment not found.', 404)
    await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:update')
    check(!appointment.startedAt && !closed(appointment) && !appointment.isGroupParent && !appointment.isBookingOrderParent, 'Team assignments are locked once the service starts or closes.')
    const requested = req.body?.members
    check(Array.isArray(requested) && requested.length >= 1 && requested.length <= 8 && new Set(requested.map(row => row.employeeId)).size === requested.length, 'Choose one to eight different team members.', 400)
    check(requested.filter(row => row.responsibility === 'lead').length === 1 && requested.find(row => row.responsibility === 'lead').employeeId === (appointment.assignedPractitionerId || appointment.practitionerId), 'Keep the booked practitioner as the lead.', 400)
    const range = getBookingRange(appointment)
    check(range, 'The appointment needs a valid schedule.')
    const lock = db.collection('bookingResourceLocks').doc(appointment.branchId)
    await tx.get(lock)
    const appointments = (await tx.get(db.collection('appointments').where('branchId', '==', appointment.branchId))).docs
    const held = (await tx.get(db.collection('bookingReservations').where('branchId', '==', appointment.branchId))).docs
    const members = []
    for (const row of requested) {
      check(['lead', 'assistant'].includes(row.responsibility), 'Invalid team responsibility.', 400)
      const user = (await tx.get(db.collection('users').doc(String(row.employeeId)))).data()
      const profile = (await tx.get(db.collection('practitionerProfiles').doc(row.employeeId))).data()
      check(user && profile && !user.archived && String(user.status).toLowerCase() === 'active' && [user.branchId, ...(user.branchIds || [])].includes(appointment.branchId), 'Choose active practitioners from this branch.')
      check(profile.approvedServiceIds.includes(serviceIdFor(appointment)) && (!['Doctor', 'Registered Nurse'].includes(profile.type) || profile.credentialsVerified), 'A member is not credentialed and approved for this service.')
      const schedule = (await tx.get(db.collection('users').doc(row.employeeId).collection('schedules'))).docs.map(doc => ({ ...doc.data(), id: doc.id }))
      const day = new Date(appointment.date + 'T00:00:00Z'), week = new Date(day)
      week.setUTCDate(week.getUTCDate() - (week.getUTCDay() + 6) % 7)
      const selected = schedule.find(item => (item.weekStart || item.id) === week.toISOString().slice(0, 10)) || schedule.find(item => item.id === 'recurring' || item.recurring || item.type === 'recurring') || {}
      const weekday = day.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
      const availability = selected.availability?.[weekday], assignment = selected.assignments?.[weekday]
      const shifts = (await tx.get(db.collection('shifts').where('branchId', '==', appointment.branchId))).docs.map(doc => ({ ...doc.data(), id: doc.id }))
      const shift = shifts.find(item => item.id === assignment)
      const label = String(selected.assignmentLabels?.[weekday] || assignment || '').split('||').pop().trim().split(' - ')
      const working = availability?.enabled !== false && availability?.start && availability?.end ? getBookingRange({ time: availability.start, endTime: availability.end }) : shift ? getBookingRange({ time: shift.start, endTime: shift.end }) : label.length === 2 ? getBookingRange({ time: label[0], endTime: label[1] }) : null
      check(working && range.start >= working.start && range.end <= working.end, 'A team member is outside their published availability.')
      const leave = await tx.get(db.collection('leaveRequests').where('requesterId', '==', row.employeeId))
      check(!leave.docs.some(doc => { const data = doc.data(); return String(data.status).toLowerCase() === 'approved' && (data.startDate || data.date) <= appointment.date && (data.endDate || data.date || data.startDate) >= appointment.date }), 'A team member is on approved leave.')
      check(!appointments.some(doc => { const data = doc.data(), other = getBookingRange(data); return doc.id !== ref.id && !data.isGroupParent && !data.isBookingOrderParent && !closed(data) && data.date === appointment.date && appointmentStaffIds(data).includes(row.employeeId) && other && rangesOverlap(range.start, range.end, other.start, other.end) }), 'A team member already has an overlapping appointment.')
      check(!held.some(doc => { const data = doc.data(), other = getBookingRange(data); const expires = data.expiresAt?.toDate?.() || new Date(data.expiresAt); return data.status === 'held' && expires > new Date() && data.date === appointment.date && data.practitionerId === row.employeeId && other && rangesOverlap(range.start, range.end, other.start, other.end) }), 'A team member has an active booking reservation at this time.')
      members.push({ employeeId: row.employeeId, name: nameFor(user), type: profile.type, responsibility: row.responsibility, participationConfirmed: false })
    }
    check(teamMeetsRequirements(members, appointment.staffingRequirements), 'The selected team does not meet this service’s staffing requirements.')
    tx.update(ref, { treatmentTeam: members, teamAssignedBy: req.user.uid, updatedAt: now() })
    tx.set(lock, { updatedAt: now() }, { merge: true })
    tx.set(db.collection('appointmentAudit').doc(), { appointmentId: ref.id, branchId: appointment.branchId, actorId: req.user.uid, action: 'team_assigned', members, createdAt: now() })
    return members
  }))
  route('post', '/appointments/:id/team/participation', async req => db.runTransaction(async tx => {
    const ref = db.collection('appointments').doc(req.params.id), appointment = (await tx.get(ref)).data()
    check(appointment?.status === 'Ongoing', 'Confirm participation while the service is ongoing.')
    check(appointment.treatmentTeam?.some(member => member.employeeId === req.user.uid), 'Only an assigned team member can confirm their own participation.', 403)
    const members = appointment.treatmentTeam.map(member => member.employeeId === req.user.uid ? { ...member, participationConfirmed: true, participationConfirmedAt: new Date().toISOString() } : member)
    tx.update(ref, { treatmentTeam: members, updatedAt: now() })
    return members
  }))
  route('get', '/staff-earnings', async (req, context) => {
    const branchId = String(req.query.branchId || '')
    await authorizeClinicAction(req.user.uid, branchId, context.permissions.has('payroll:update') ? 'payroll:update' : 'payroll:view')
    return (await db.collection('staffEarnings').where('branchId', '==', branchId).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }))
  })
  route('get', '/staff-earnings/appointments', async req => {
    const branchId = String(req.query.branchId || '')
    await authorizeClinicAction(req.user.uid, branchId, 'payroll:view')
    const records = await db.collection('appointments').where('branchId', '==', branchId).get()
    const fields = ['branchId', 'customerName', 'clientName', 'service', 'date', 'time', 'completedAt', 'treatmentTeam', 'staffEarningsStatus', 'consultationNeedsReview', 'consultationActualDurationSeconds']
    return records.docs.filter(doc => doc.data().status === 'Completed' && !doc.data().isGroupParent && !doc.data().isBookingOrderParent).map(doc => ({ id: doc.id, ...Object.fromEntries(fields.map(key => [key, doc.data()[key] ?? null])) }))
  })
  route('get', '/appointments/:id/staff-earnings', async req => {
    const appointment = (await db.collection('appointments').doc(req.params.id).get()).data()
    if (appointment?.type === 'Consultation' && appointment.consultationMode === 'online') check(String(appointment.treatmentNotes || '').trim().length >= 10, 'Save consultation documentation before approving earnings.')
    check(appointment?.consultationDispute?.status !== 'Open', 'Resolve the customer consultation report before approving earnings.')
    check(appointment?.status === 'Completed', 'Choose a completed appointment.')
    await authorizeClinicAction(req.user.uid, appointment.branchId, 'payroll:view')
    const terms = (await db.collection('appointmentStaffTerms').doc(req.params.id).get()).data()
    check(terms?.members?.length, 'No staff agreements were saved when this appointment started. Configure agreements before starting new appointments.')
    const plan = appointment.treatmentPlanAppointmentId ? (await db.collection('appointments').doc(appointment.treatmentPlanAppointmentId).get()).data() : appointment
    return calculateStaffEarnings(terms.members.map(member => ({ ...member, participationConfirmed: appointment.treatmentTeam?.find(row => row.employeeId === member.employeeId)?.participationConfirmed === true })), sessionEarningBase(appointment, plan))
  })
  route('post', '/staff-earnings/:id/reverse', async (req, context) => db.runTransaction(async tx => {
    const ref = db.collection('staffEarnings').doc(req.params.id), earning = (await tx.get(ref)).data()
    check(earning && !earning.adjustmentOf, 'Choose an original staff earning to reverse.')
    await authorizeClinicAction(req.user.uid, earning.branchId, 'payroll:view')
    check((context.permissions.has('payroll:approve') || context.permissions.has('administrator:full_access')) && earning.employeeId !== req.user.uid, 'An independent owner or Finance reviewer is required.', 403)
    const amount = Number(req.body?.amount), reason = String(req.body?.reason || '').trim(), monthKey = String(req.body?.monthKey || '')
    const requestId = String(req.body?.requestId || '')
    check(/^[a-f0-9-]{36}$/i.test(requestId), 'A reversal request ID is required.', 400)
    const adjustment = db.collection('staffEarnings').doc(ref.id + '_reversal_' + requestId)
    const previous = (await tx.get(adjustment)).data()
    if (previous) {
      check(previous.amount === -Math.round(amount * 100) / 100 && previous.monthKey === monthKey && previous.reason === reason, 'This reversal request was already used with different details.')
      return { id: adjustment.id, alreadyRecorded: true }
    }
    check(Number.isFinite(amount) && amount > 0 && Math.round((amount + Number(earning.reversedAmount || 0)) * 100) <= Math.round(earning.amount * 100), 'The reversal cannot exceed the unreversed staff earning.', 400)
    check(reason.length >= 10 && reason.length <= 1000 && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) && monthKey >= earning.monthKey, 'Enter a reason and an open payroll month on or after the original period.', 400)
    const summary = (await tx.get(db.collection('payrollSummaries').doc(earning.branchId + '_' + monthKey))).data()
    check(summary?.status !== 'approved', 'Choose an open payroll period; approved payroll cannot be changed.')
    tx.set(adjustment, { employeeId: earning.employeeId, employeeName: earning.employeeName, branchId: earning.branchId, appointmentId: earning.appointmentId, service: earning.service, responsibility: earning.responsibility, monthKey, amount: -Math.round(amount * 100) / 100, status: 'Approved', adjustmentOf: ref.id, reason, approvedBy: req.user.uid, createdAt: now(), approvedAt: now(), payrollSummaryId: null })
    tx.update(ref, { reversedAmount: Math.round((amount + Number(earning.reversedAmount || 0)) * 100) / 100 })
    return { id: adjustment.id }
  }))
  route('post', '/appointments/:id/staff-earnings/approve', async (req, context) => db.runTransaction(async tx => {
    const ref = db.collection('appointments').doc(req.params.id), appointment = (await tx.get(ref)).data()
    check(appointment?.status === 'Completed', 'Staff earnings require a completed appointment.')
    await authorizeClinicAction(req.user.uid, appointment.branchId, 'payroll:view')
    check((context.permissions.has('payroll:approve') || context.permissions.has('administrator:full_access')) && !appointmentStaffIds(appointment).includes(req.user.uid), 'An independent owner or Finance reviewer must approve staff earnings.', 403)
    check(appointment.staffEarningsStatus !== 'Approved', 'Staff earnings are already approved.')
    const reviewNote = String(req.body?.reviewNote || '').trim().slice(0, 1000)
    if (appointment.consultationNeedsReview) check(reviewNote.length >= 10, 'Review the flagged consultation and explain why these earnings should be approved.', 400)
    const terms = (await tx.get(db.collection('appointmentStaffTerms').doc(ref.id))).data()
    check(terms?.members?.length, 'This appointment has no saved staff compensation. Configure agreements before starting new appointments.')
    const plan = appointment.treatmentPlanAppointmentId ? (await tx.get(db.collection('appointments').doc(appointment.treatmentPlanAppointmentId))).data() : appointment
    const base = sessionEarningBase(appointment, plan)
    const earned = calculateStaffEarnings(terms.members.map(member => ({ ...member, participationConfirmed: appointment.treatmentTeam?.find(row => row.employeeId === member.employeeId)?.participationConfirmed === true })), base)
    check(earned.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) <= Math.round(base * 100), 'Total staff service earnings exceed the allocated session revenue. Review the compensation agreements.')
    const completed = appointment.completedAt?.toDate?.() || new Date(appointment.completedAt || Date.now())
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(completed)
    const completionMonthKey = parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value
    const monthKey = String(req.body?.payrollMonth || completionMonthKey)
    check(/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) && monthKey >= completionMonthKey, 'Choose a payroll period on or after the completion month.', 400)
    const summary = (await tx.get(db.collection('payrollSummaries').doc(appointment.branchId + '_' + monthKey))).data()
    check(summary?.status !== 'approved', 'This payroll period is locked. Staff earnings must be reviewed before payroll approval.')
    for (const row of earned) tx.set(db.collection('staffEarnings').doc(ref.id + '_' + row.employeeId), { ...row, appointmentId: ref.id, branchId: appointment.branchId, service: appointment.service || '', monthKey, completionMonthKey, status: 'Approved', approvedBy: req.user.uid, approvedAt: now(), createdAt: now(), payrollSummaryId: null })
    tx.update(ref, { staffEarningsStatus: 'Approved', staffEarningsApprovedBy: req.user.uid, staffEarningsReviewNote: reviewNote, updatedAt: now() })
    return earned
  }))
}
