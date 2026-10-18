import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerConsultationEvents } from './consultationEvents.js'
import { registerBookingMilestones } from './bookingMilestones.js'
import { closeExpiredConsultations } from './consultationWindows.js'
import { onlineWindow, onlineAccessOpen, onlinePolicy } from '../../shared/onlineConsultation.js'

test.beforeEach(t => t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-12T02:00:00Z') }))

const schedule = milliseconds => {
  const local = new Date(milliseconds + 8 * 3600000).toISOString()
  return { date: local.slice(0, 10), time: local.slice(11, 16) }
}
const base = overrides => ({ ...schedule(Date.now()), type: 'Consultation', consultationMode: 'online', customerId: 'customer', practitionerId: 'worker', assignedPractitionerId: 'worker', branchId: 'clinic', status: 'Paid', approvalStatus: 'Approved', contract: { status: 'signed' }, totalAmount: 1000, amountPaid: 1000, consultationDurationMinutes: 30, consultationPolicy: onlinePolicy(), consultationCodeVerifiedAt: new Date(), consultationCodeVerifiedBy: 'customer', clientJoinedAt: new Date(), practitionerJoinedAt: new Date(), resources: [], ...overrides })
const harness = appointment => {
  const h = transactionDb(), routes = new Map()
  h.seed('appointments', 'a', appointment)
  h.seed('users', 'worker', { status: 'Active', role: 'Practitioner', branchId: 'clinic' })
  h.seed('appointmentMeetings', 'a', { hostVerified: true, practitionerId: 'worker', customerId: 'customer', meetLink: 'https://meet.google.com/abc-defg-hij', scheduledStartAt: onlineWindow(appointment).start.toISOString() })
  const deps = { admin: h.admin, requireAuth() {}, authorizeClinicAction: async uid => { if (!['reviewer', 'worker', 'customer'].includes(uid)) throw Object.assign(Error('Forbidden'), { status: 403 }) } }
  const app = { post: (path, auth, handler) => routes.set(path, handler) }
  registerConsultationEvents(app, deps); registerBookingMilestones(app, deps)
  const call = async (uid, action, extra = {}, lifecycle = false) => {
    const result = { code: 200 }
    await routes.get(`/appointments/:id/${lifecycle ? 'transition' : 'consultation-events'}`)({ params: { id: 'a' }, user: { uid }, body: { action, ...extra } }, { status(code) { result.code = code; return this }, json(body) { result.body = body } })
    return result
  }
  return { ...h, call, current: () => h.records.get('appointments/a') }
}

test('Start requires witnessed presence and gives the full duration after a late arrival', async () => {
  const h = harness(base(schedule(Date.now() - 5 * 60000)))
  assert.equal((await h.call('worker', 'start', {}, true)).code, 400)
  assert.equal((await h.call('worker', 'start', { participantVerified: true }, true)).code, 200)
  assert.equal(new Date(h.current().consultationWindowEndAt) - h.current().startedAt >= 30 * 60000 - 1000, true)
  assert.equal(h.current().consultationPresenceVerifiedBy, 'worker')
})

test('Late start rejects expiry and overlapping appointments for every assigned team member', async () => {
  const expired = harness(base(schedule(Date.now() - 11 * 60000)))
  assert.equal((await expired.call('worker', 'start', { participantVerified: true }, true)).code, 409)
  const h = harness(base(schedule(Date.now() - 5 * 60000)))
  h.seed('appointments', 'next', { ...base(schedule(Date.now() + 26 * 60000)), customerId: 'other' })
  assert.equal((await h.call('worker', 'start', { participantVerified: true }, true)).code, 409)
  assert.equal(h.current().startedAt, undefined)
})

test('Arrival grace expiry never automatically blames the customer', async () => {
  for (const entries of [{}, { clientJoinedAt: null }, { practitionerJoinedAt: null }]) {
    const h = harness(base({ ...schedule(Date.now() - 11 * 60000), ...entries }))
    await closeExpiredConsultations(h.admin)
    assert.equal(h.current().status, 'Consultation Review')
    assert.equal(h.current().workerCompleted, undefined)
    assert.equal(h.current().consultationNeedsReview, true)
    assert.equal(onlineAccessOpen(h.current()), false)
    const count = h.records.size
    await closeExpiredConsultations(h.admin)
    assert.equal(h.records.size, count)
  }
})

test('Expiry uses the actual start/end and preserves a later full consultation window', async () => {
  const h = harness(base({ ...schedule(Date.now() - 31 * 60000), status: 'Ongoing', startedAt: new Date(Date.now() - 25 * 60000), consultationWindowEndAt: new Date(Date.now() + 5 * 60000).toISOString() }))
  await closeExpiredConsultations(h.admin)
  assert.equal(h.current().status, 'Ongoing')
  h.current().consultationWindowEndAt = new Date(Date.now() - 1000).toISOString()
  await closeExpiredConsultations(h.admin)
  assert.equal(h.current().status, 'Awaiting Customer Confirmation')
  assert.equal(h.current().customerCompleted, undefined)
})

test('Interrupted consultations require practitioner reconnection and cap restored time', async () => {
  const h = harness(base({ status: 'Ongoing', startedAt: new Date(Date.now() - 60000), consultationWindowEndAt: new Date(Date.now() + 29 * 60000).toISOString() }))
  assert.equal((await h.call('stranger', 'report_interruption', { note: 'My connection dropped.' })).code, 403)
  assert.equal((await h.call('customer', 'report_interruption', { note: 'My connection dropped.' })).code, 200)
  assert.equal((await h.call('customer', 'resume', { participantVerified: true })).code, 403)
  assert.equal((await h.call('worker', 'resume', {})).code, 400)
  h.current().consultationInterruption.startedAt = new Date(Date.now() - 10 * 60000).toISOString()
  assert.equal((await h.call('worker', 'resume', { participantVerified: true })).code, 200)
  assert.equal(h.current().consultationExtensionSeconds, 300)
  assert.equal(h.current().consultationInterruptions.length, 1)
  assert.equal(h.current().consultationNeedsReview, true)
})

test('A reported delivery problem blocks confirmation and requires an independent review', async () => {
  const h = harness(base({ status: 'Awaiting Customer Confirmation', startedAt: new Date(Date.now() - 31 * 60000), workerCompleted: true, workerCompletedAt: new Date(), treatmentNotes: 'Consultation recommendations.', treatmentTeam: [] }))
  assert.equal((await h.call('worker', 'report_problem', { note: 'The service was not delivered.' })).code, 403)
  assert.equal((await h.call('customer', 'report_problem', { note: 'The service was not delivered.' })).code, 200)
  assert.equal((await h.call('customer', 'customer_complete', {}, true)).code, 409)
  assert.equal((await h.call('worker', 'review', { outcome: 'received', note: 'I performed this myself.' })).code, 403)
  assert.equal((await h.call('reviewer', 'review', { outcome: 'received', note: 'Reviewed both participant accounts and documented the resolution.' })).code, 200)
  assert.equal(h.current().status, 'Completed')
  assert.equal(h.current().customerCompleted, undefined)
  assert.equal(h.current().consultationAdjudicated, true)
})

test('Review can route a failed session to rescheduling without retaining service access', async () => {
  const h = harness(base({ status: 'Consultation Review', consultationNeedsReview: true, startedAt: new Date(), workerCompleted: true, treatmentNotes: 'Original attempt notes.' }))
  const result = await h.call('reviewer', 'review', { outcome: 'reschedule', note: 'Practitioner connection failed; agreed to reschedule.', ...schedule(Date.now() + 86400000) })
  assert.equal(result.code, 200)
  assert.equal(h.current().status, 'Reschedule Requested')
  assert.equal(h.current().startedAt, null)
  assert.equal(h.current().consultationCodeVerifiedAt, null)
  assert.equal(h.current().consultationPreviousAttempts[0].notes, 'Original attempt notes.')
})

test('Confirmation reminds once then enters review without fabricating receipt', async () => {
  const h = harness(base({ status: 'Awaiting Customer Confirmation', workerCompletedAt: new Date(Date.now() - 25 * 3600000) }))
  await closeExpiredConsultations(h.admin)
  assert.ok(h.current().consultationConfirmationReminderAt)
  const count = h.records.size
  await closeExpiredConsultations(h.admin)
  assert.equal(h.records.size, count)
  h.current().workerCompletedAt = new Date(Date.now() - 49 * 3600000)
  await closeExpiredConsultations(h.admin)
  assert.equal(h.current().status, 'Consultation Review')
  assert.equal(h.current().customerCompleted, undefined)
})

test('Completion requires notes; closed appointments cannot rejoin', async () => {
  const h = harness(base({ status: 'Ongoing', startedAt: new Date(Date.now() - 120000) }))
  assert.equal((await h.call('worker', 'worker_complete', {}, true)).code, 400)
  assert.equal((await h.call('worker', 'worker_complete', { treatmentNotes: 'Documented consultation advice.' }, true)).code, 200)
  assert.equal(onlineAccessOpen(h.current()), false)
  assert.equal((await h.call('customer', 'join_consultation', {}, true)).code, 409)
})

test('Timer expiry cannot bypass clinical documentation or individual team confirmations', async () => {
  const h = harness(base({ status: 'Ongoing', startedAt: new Date(Date.now() - 31 * 60000), consultationWindowEndAt: new Date(Date.now() - 60000).toISOString(), treatmentTeam: [{ employeeId: 'worker', participationConfirmed: false }] }))
  await closeExpiredConsultations(h.admin)
  assert.equal((await h.call('customer', 'customer_complete', {}, true)).code, 409)
  assert.equal(h.current().customerCompleted, undefined)
  assert.equal((await h.call('worker', 'save_notes', { note: 'Reviewed symptoms and documented recommendations.' })).code, 200)
  assert.equal((await h.call('customer', 'customer_complete', {}, true)).code, 409)
  h.current().treatmentTeam[0].participationConfirmed = true
  assert.equal((await h.call('customer', 'customer_complete', {}, true)).code, 200)
  assert.equal(h.current().consultationNeedsReview, true)
})

test('A clinic reviewer cannot adjudicate their own consultation as the customer', async () => {
  const h = harness(base({ status: 'Consultation Review', consultationNeedsReview: true, startedAt: new Date(), workerCompleted: true, treatmentNotes: 'Documented consultation recommendations.', treatmentTeam: [] }))
  assert.equal((await h.call('customer', 'review', { outcome: 'received', note: 'I also have clinic review permissions.' })).code, 403)
  assert.equal(h.current().status, 'Consultation Review')
  assert.equal((await h.call('reviewer', 'review', { outcome: 'received', note: 'Independent review of both participant accounts.' })).code, 200)
})

test('Late manual completion cannot inflate consultation duration beyond the official window', async () => {
  const h = harness(base({ status: 'Ongoing', startedAt: new Date(Date.now() - 60 * 60000), consultationWindowEndAt: new Date(Date.now() - 30 * 60000).toISOString(), treatmentTeam: [] }))
  assert.equal((await h.call('worker', 'worker_complete', { treatmentNotes: 'Documented consultation advice.' }, true)).code, 200)
  assert.equal(h.current().consultationActualDurationSeconds, 30 * 60)
})
