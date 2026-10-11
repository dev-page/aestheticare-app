import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStaffing, normalizePractitionerProfile, rateFor, calculateStaffEarnings, sessionEarningBase, basePayForPeriod } from '../../shared/practitionerTeam.js'
import { prepareTeamStart, registerPractitionerTeams } from './practitionerTeams.js'
import { validatePayrollStaffEarnings } from './payrollWorkflow.js'
import { transactionDb } from './testTransactionDb.js'
import { prepareBooking } from './bookingResources.js'
const rate = { serviceId: 'facial', responsibility: 'lead', model: 'percent', amount: 30, effectiveFrom: '2026-01-01', effectiveUntil: '' }
const profile = { type: 'Doctor', credentialNumber: '123', credentialsVerified: true, approvedServiceIds: ['facial'], rates: [rate] }
const requirements = [{ type: 'Doctor', responsibility: 'lead', count: 1 }, { type: 'Registered Nurse', responsibility: 'assistant', count: 1 }]
test('Staffing requires one lead, valid specialties, bounded counts and no duplicate slots', () => {
  assert.deepEqual(normalizeStaffing(requirements), requirements)
  assert.throws(() => normalizeStaffing([{ type: 'Doctor', responsibility: 'assistant', count: 1 }]), /one lead/)
  assert.throws(() => normalizeStaffing([{ type: 'Doctor', responsibility: 'lead', count: 2 }]), /one lead/)
  assert.throws(() => normalizeStaffing([...requirements, requirements[1]]), /duplicate/)
})
test('Compensation rejects negative or excessive rates and overlapping agreements', () => {
  assert.equal(normalizePractitionerProfile(profile).rates[0].amount, 30)
  assert.throws(() => normalizePractitionerProfile({ ...profile, rates: [{ ...rate, amount: -1 }] }), /nonnegative/)
  assert.throws(() => normalizePractitionerProfile({ ...profile, rates: [{ ...rate, amount: 101 }] }), /100/)
  assert.throws(() => normalizePractitionerProfile({ ...profile, rates: [rate, { ...rate, effectiveFrom: '2026-09-01' }] }), /overlap/)
  assert.equal(rateFor({ rates: [{ ...rate, serviceId: '' }, { ...rate, amount: 40 }] }, 'facial', 'lead', '2026-10-01').amount, 40)
  assert.equal(rateFor(profile, 'facial', 'assistant', '2026-10-01'), null)
})
test('A team earns individual percentages and fixed fees; unconfirmed work cannot earn', () => {
  const team = [{ employeeId: 'doctor', participationConfirmed: true, rateSnapshot: rate }, { employeeId: 'nurse', participationConfirmed: true, rateSnapshot: { ...rate, amount: 8 } }, { employeeId: 'aesthetician', participationConfirmed: true, rateSnapshot: { model: 'fixed', amount: 150 } }]
  assert.deepEqual(calculateStaffEarnings(team, 10000).map(row => row.amount), [3000, 800, 150])
  assert.throws(() => calculateStaffEarnings([{ ...team[1], participationConfirmed: false }], 10000), /participation/)
  assert.throws(() => calculateStaffEarnings([{ ...team[0], rateSnapshot: null }], 10000), /agreement/)
})
test('Session revenue allocation sums to exactly the plan total, including prepaid zero-price follow-ups', () => {
  const plan = { totalAmount: 1000.01, treatmentPlan: { totalSessions: 3 } }
  const bases = [1, 2, 3].map(sessionNumber => sessionEarningBase({ amount: 0, sessionNumber }, plan))
  assert.deepEqual(bases, [333.34, 333.34, 333.33])
  assert.equal(bases.reduce((sum, value) => sum + Math.round(value * 100), 0), 100001)
})
test('Base pay supports hourly professional fees, daily work and fixed monthly retainers', () => {
  assert.equal(basePayForPeriod({ rate: 500, hours: 8 }).amount, 4000)
  assert.deepEqual(basePayForPeriod({ model: 'daily', rate: 800, days: 20 }), { amount: 16000, hourlyEquivalent: 100 })
  assert.equal(basePayForPeriod({ model: 'monthly-retainer', rate: 22000, hours: 120, monthlyHours: 176 }).amount, 22000)
})
const fixture = () => {
  const h = transactionDb()
  h.seed('users', 'doctor', { branchId: 'clinic', status: 'Active', fullName: 'Doctor' })
  h.seed('users', 'nurse', { branchId: 'clinic', status: 'Active', fullName: 'Nurse' })
  h.seed('practitionerProfiles', 'doctor', profile)
  h.seed('practitionerProfiles', 'nurse', { ...profile, type: 'Registered Nurse', rates: [{ ...rate, responsibility: 'assistant', amount: 8 }] })
  const appointment = { branchId: 'clinic', practitionerId: 'doctor', selectedServiceIds: ['facial'], staffingRequirements: requirements, date: '2026-10-11', time: '10:00', endTime: '11:00', totalAmount: 10000, status: 'Completed', completedAt: new Date('2026-10-11T02:00:00Z'), treatmentTeam: [{ employeeId: 'doctor', responsibility: 'lead', participationConfirmed: true }, { employeeId: 'nurse', responsibility: 'assistant', participationConfirmed: true }] }
  h.seed('appointments', 'visit', appointment)
  return { ...h, appointment }
}
test('Start checks specialty, active branch assignment, credentials and captures immutable agreements', async () => {
  const h = fixture()
  const captured = await h.db.runTransaction(tx => prepareTeamStart(tx, h.db, h.appointment, 'visit'))
  assert.equal(captured.terms.members[0].rateSnapshot.amount, 30)
  assert.equal(captured.members[0].participationConfirmed, true)
  assert.equal(captured.members[1].participationConfirmed, false)
  assert.equal('rateSnapshot' in captured.members[0], false)
  h.records.get('practitionerProfiles/doctor').rates[0].amount = 50
  assert.equal(captured.terms.members[0].rateSnapshot.amount, 30)
  h.records.get('practitionerProfiles/nurse').credentialsVerified = false
  await assert.rejects(h.db.runTransaction(tx => prepareTeamStart(tx, h.db, h.appointment, 'visit')), /verified/)
})
const harness = async () => {
  const h = fixture(), handlers = new Map()
  const capture = await h.db.runTransaction(tx => prepareTeamStart(tx, h.db, h.appointment, 'visit'))
  h.seed('appointmentStaffTerms', 'visit', capture.terms)
  const range = row => { const minutes = time => Number(time?.slice(0, 2)) * 60 + Number(time?.slice(3)); return { start: minutes(row.time), end: minutes(row.endTime) } }
  registerPractitionerTeams({ get: (path, auth, fn) => handlers.set(path, fn), post: (path, auth, fn) => handlers.set(path, fn) }, { admin: h.admin, requireAuth() {}, getBookingRange: range, rangesOverlap: (a, b, c, d) => a < d && c < b, loadUserContext: async uid => ({ roleKey: uid === 'finance' ? 'Finance' : 'Practitioner', permissions: new Set(uid === 'finance' ? ['payroll:view', 'payroll:approve'] : ['payroll:view']) }), authorizeClinicAction: async uid => { if (!['finance', 'doctor', 'nurse'].includes(uid)) throw Object.assign(Error('Forbidden'), { status: 403 }) } })
  const call = async (path, uid, body = {}, id = 'visit') => { const result = { code: 200 }; await handlers.get(path)({ user: { uid }, params: { id }, body, query: { branchId: 'clinic' } }, { status(code) { result.code = code; return this }, json(value) { result.body = value } }); return result }
  return { ...h, call }
}
test('Only independent Finance approves completed, confirmed work; approval is idempotent and uses frozen rates', async () => {
  const h = await harness(), path = '/appointments/:id/staff-earnings/approve'
  assert.equal((await h.call(path, 'doctor')).code, 403)
  h.records.get('practitionerProfiles/doctor').rates[0].amount = 50
  assert.equal((await h.call(path, 'finance')).code, 200)
  assert.equal(h.records.get('staffEarnings/visit_doctor').amount, 3000)
  assert.equal(h.records.get('staffEarnings/visit_nurse').amount, 800)
  assert.equal((await h.call(path, 'finance')).code, 409)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('staffEarnings/')).length, 2)
})
test('Missing participation and locked payroll prevent earnings approval', async () => {
  const h = await harness(), path = '/appointments/:id/staff-earnings/approve'
  h.records.get('appointments/visit').treatmentTeam[1].participationConfirmed = false
  assert.equal((await h.call(path, 'finance')).code, 400)
  h.records.get('appointments/visit').treatmentTeam[1].participationConfirmed = true
  h.seed('payrollSummaries', 'clinic_2026-10', { status: 'approved' })
  assert.equal((await h.call(path, 'finance')).code, 409)
})
test('An assistant confirms only their own participation during ongoing treatment', async () => {
  const h = await harness(), path = '/appointments/:id/team/participation'
  h.records.get('appointments/visit').status = 'Ongoing'
  h.records.get('appointments/visit').treatmentTeam[1].participationConfirmed = false
  assert.equal((await h.call(path, 'stranger')).code, 403)
  assert.equal((await h.call(path, 'nurse')).code, 200)
  assert.equal(h.records.get('appointments/visit').treatmentTeam[1].participationConfirmed, true)
})
test('Payroll rejects revenue-as-commission, duplicate claims and cross-employee earning IDs', () => {
  const entry = { employeeId: 'doctor', branchId: 'clinic', payPeriodMonthKey: '2026-10', commission: 3000, staffEarningIds: ['earning'] }
  const earning = { employeeId: 'doctor', branchId: 'clinic', monthKey: '2026-10', amount: 3000, status: 'Approved', payrollSummaryId: null }
  const rows = [ { id: 'earning', data: () => earning } ]
  assert.deepEqual(validatePayrollStaffEarnings([{ data: () => entry }], rows, 'clinic_2026-10'), ['earning'])
  assert.throws(() => validatePayrollStaffEarnings([{ data: () => ({ ...entry, commission: 10000 }) }], rows, 'clinic_2026-10'), /commission/)
  earning.payrollSummaryId = 'clinic_2026-09'
  assert.throws(() => validatePayrollStaffEarnings([{ data: () => entry }], rows, 'clinic_2026-10'), /claimed|changed/)
  earning.payrollSummaryId = null; earning.employeeId = 'nurse'
  assert.throws(() => validatePayrollStaffEarnings([{ data: () => entry }], rows, 'clinic_2026-10'), /another employee|changed/)
})
test('Refund reversals retain original earnings and cannot exceed the original amount', async () => {
  const h = await harness()
  await h.call('/appointments/:id/staff-earnings/approve', 'finance')
  const path = '/staff-earnings/:id/reverse', body = { requestId: '12345678-1234-1234-1234-123456789abc', amount: 1000, monthKey: '2026-10', reason: 'Partial refund after Finance review.' }
  assert.equal((await h.call(path, 'finance', body, 'visit_doctor')).code, 200)
  assert.equal(h.records.get('staffEarnings/visit_doctor').amount, 3000)
  assert.equal(h.records.get('staffEarnings/visit_doctor').reversedAmount, 1000)
  assert.equal((await h.call(path, 'finance', body, 'visit_doctor')).body.data.alreadyRecorded, true)
  assert.equal(h.records.get('staffEarnings/visit_doctor').reversedAmount, 1000)
  assert.equal((await h.call(path, 'finance', { ...body, requestId: '12345678-1234-1234-1234-123456789abd', amount: 2500 }, 'visit_doctor')).code, 400)
})
test('Team assignment reserves every member and rejects overlaps, approved leave, held bookings and cross-branch staff', async () => {
  const h = await harness(), path = '/appointments/:id/team', members = [{ employeeId: 'doctor', responsibility: 'lead' }, { employeeId: 'nurse', responsibility: 'assistant' }]
  h.records.get('appointments/visit').status = 'Scheduled'
  const availability = Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { enabled: true, start: '08:00', end: '18:00' }]))
  for (const id of ['doctor', 'nurse']) h.seed('users/' + id + '/schedules', 'recurring', { availability })
  assert.equal((await h.call(path, 'finance', { members })).code, 200)
  h.seed('appointments', 'overlap', { branchId: 'clinic', date: '2026-10-11', time: '10:30', endTime: '11:30', status: 'Scheduled', practitionerId: 'other', treatmentTeam: [{ employeeId: 'nurse' }] })
  assert.equal((await h.call(path, 'finance', { members })).code, 409)
  h.records.delete('appointments/overlap')
  h.seed('leaveRequests', 'leave', { requesterId: 'nurse', startDate: '2026-10-11', endDate: '2026-10-11', status: 'Approved' })
  assert.equal((await h.call(path, 'finance', { members })).code, 409)
  h.records.delete('leaveRequests/leave')
  h.seed('bookingReservations', 'held', { branchId: 'clinic', practitionerId: 'nurse', date: '2026-10-11', time: '10:30', endTime: '11:30', status: 'held', expiresAt: new Date(Date.now() + 60000) })
  assert.equal((await h.call(path, 'finance', { members })).code, 409)
  h.records.delete('bookingReservations/held')
  h.records.get('users/nurse').branchId = 'other-clinic'
  assert.equal((await h.call(path, 'finance', { members })).code, 409)
  h.records.get('users/nurse').branchId = 'clinic'
  h.records.get('appointments/visit').startedAt = new Date()
  assert.equal((await h.call(path, 'finance', { members })).code, 409)
})
test('Finance earnings review uses payroll access and omits contracts, email and clinical notes', async () => {
  const h = await harness()
  Object.assign(h.records.get('appointments/visit'), { customerEmail: 'private@test.invalid', treatmentNotes: 'Clinical information', contract: { signatures: 'private' } })
  const result = await h.call('/staff-earnings/appointments', 'finance')
  assert.equal(result.code, 200)
  assert.equal(result.body.data[0].id, 'visit')
  for (const key of ['customerEmail', 'treatmentNotes', 'contract']) assert.equal(key in result.body.data[0], false)
  assert.equal((await h.call('/staff-earnings/appointments', 'stranger')).code, 403)
})
test('Excessive team compensation is blocked before treatment begins', async () => {
  const h = fixture()
  h.records.get('practitionerProfiles/doctor').rates[0].amount = 100
  await assert.rejects(h.db.runTransaction(tx => prepareTeamStart(tx, h.db, h.appointment, 'visit')), /exceed/)
})
test('Flagged consultations require independent review notes; late earnings can enter a later open period', async () => {
  const h = await harness(), path = '/appointments/:id/staff-earnings/approve'
  h.records.get('appointments/visit').consultationNeedsReview = true
  assert.equal((await h.call(path, 'finance')).code, 400)
  h.seed('payrollSummaries', 'clinic_2026-10', { status: 'approved' })
  assert.equal((await h.call(path, 'finance', { reviewNote: 'Reviewed treatment evidence and confirmed delivery.' })).code, 409)
  assert.equal((await h.call(path, 'finance', { payrollMonth: '2026-11', reviewNote: 'Reviewed treatment evidence and confirmed delivery.' })).code, 200)
  assert.equal(h.records.get('staffEarnings/visit_doctor').monthKey, '2026-11')
  assert.equal(h.records.get('staffEarnings/visit_doctor').completionMonthKey, '2026-10')
})
test('Package components can require different leads and reject an ineligible practitioner for the next service', async () => {
  const h = fixture(), date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  h.seed('clinics', 'clinic', { ownerId: 'owner' })
  for (const id of ['doctor', 'nurse']) {
    h.records.get('users/' + id).role = 'Practitioner'
    h.seed('users/' + id + '/schedules', 'recurring', { availability: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { enabled: true, start: '08:00', end: '18:00' }])) })
  }
  h.records.get('practitionerProfiles/doctor').approvedServiceIds.push('assessment')
  const published = { branchId: 'clinic', isPublished: true, financeStatus: 'approved', durationMinutes: 30, price: 1000, termsAndConditions: 'Clinic treatment terms' }
  h.seed('productServicePosts', 'assessment', { ...published, postType: 'Consultation', staffingRequirements: [requirements[0]] })
  h.seed('productServicePosts', 'facial', { ...published, postType: 'Service', staffingRequirements: [{ type: 'Registered Nurse', responsibility: 'lead', count: 1 }] })
  h.seed('productServicePosts', 'package', { ...published, postType: 'Package', packageServiceIds: ['assessment', 'facial'] })
  const range = row => { const start = Number(row.time.slice(0, 2)) * 60 + Number(row.time.slice(3)); return { start, end: row.endTime ? Number(row.endTime.slice(0, 2)) * 60 + Number(row.endTime.slice(3)) : start + Number(row.totalServiceDurationMinutes || 30) } }
  const book = (serviceId, worker) => h.db.runTransaction(tx => prepareBooking({ tx, db: h.db, reservation: { branchId: 'clinic', selectedServiceIds: [serviceId], practitionerId: worker, customerId: 'customer', date, time: '10:00' }, getBookingRange: range, rangesOverlap: (a, b, c, d) => a < d && c < b }))
  const first = await book('package', 'doctor')
  assert.equal(first.data.staffingRequirements[0].type, 'Doctor')
  assert.equal(first.data.serviceDetails[0].id, 'assessment')
  await assert.rejects(book('facial', 'doctor'), /credentialed lead/)
  const second = await book('facial', 'nurse')
  assert.equal(second.data.staffingRequirements[0].type, 'Registered Nurse')
})
