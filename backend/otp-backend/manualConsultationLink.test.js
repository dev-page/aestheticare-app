import test from 'node:test'
import assert from 'node:assert/strict'
import { registerGoogleConsultations } from './googleConsultations.js'
import { transactionDb } from './testTransactionDb.js'

function fixture() {
  const h = transactionDb(), routes = new Map(), emails = []
  h.seed('appointments', 'a', { branchId: 'clinic', customerId: 'customer', customerEmail: 'customer@example.test', practitionerId: 'doctor', type: 'Consultation', consultationMode: 'online', date: '2099-01-01', time: '09:00', status: 'Paid', approvalStatus: 'Approved', contract: { status: 'signed' }, amount: 100, amountPaid: 100, serviceKey: '123456' })
  const app = { get(path, ...handlers) { routes.set(path, handlers.at(-1)) }, post(path, ...handlers) { routes.set(path, handlers.at(-1)) } }
  registerGoogleConsultations(app, { admin: h.admin, google: {}, config: {}, requireAuth() {}, loadUserContext: async () => ({}), authorizeClinicAction: async (uid) => { if (uid !== 'doctor') throw Object.assign(new Error('Forbidden'), { status: 403 }) }, sendEmail: async email => { emails.push(email); return { statusCode: 200 } } })
  const call = async (path, uid, body = {}) => {
    const result = { code: 200 }
    await routes.get(path)({ user: { uid }, params: { id: 'a' }, body }, { status(code) { result.code = code; return this }, json(body) { result.body = body } })
    return result
  }
  return { ...h, call, emails }
}

test('clinic can prepare a link before check-in and the booked customer reveals it with the code', async () => {
  const h = fixture(), link = 'https://meet.google.com/abc-defg-hij'
  const original = structuredClone(h.records.get('appointments/a'))
  assert.equal((await h.call('/appointments/:id/attach-meet-link', 'stranger', { meetLink: link })).code, 403)
  const saved = await h.call('/appointments/:id/attach-meet-link', 'doctor', { meetLink: link })
  assert.equal(saved.code, 200)
  // The lightweight adapter's direct set() replaces the document even when
  // Firestore would merge the email status update.
  h.records.set('appointments/a', { ...original, ...h.records.get('appointments/a') })
  assert.equal(h.records.get('appointments/a').consultationCodeVerifiedAt, undefined)
  assert.doesNotMatch(JSON.stringify(h.emails), /meet\.google\.com\/abc-defg-hij/)
  assert.equal((await h.call('/appointments/:id/consultation-access', 'stranger', { serviceKey: '123456' })).code, 403)
  assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '000000' })).code, 400)
  const access = await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })
  assert.equal(access.code, 200)
  assert.equal(access.body.data.meetLink, link)
  assert.equal(h.records.get('appointments/a').consultationCodeVerifiedBy, 'customer')
})

test('verification before a link is added succeeds and never returns a link for a different schedule', async () => {
  const h = fixture()
  let access = await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })
  assert.equal(access.code, 200)
  assert.equal(access.body.data.meetLink, '')
  h.seed('appointmentMeetings', 'a', { meetingProvider: 'google-meet-manual', meetLink: 'https://meet.google.com/abc-defg-hij', customerId: 'customer', practitionerId: 'doctor', scheduledStartAt: '2098-01-01T01:00:00.000Z' })
  access = await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })
  assert.equal(access.body.data.meetLink, '')
})

test('service code does not reveal a link before approval, agreement and payment', async () => {
  for (const change of [{ approvalStatus: 'Pending' }, { contract: { status: 'pending' } }, { amountPaid: 0 }]) {
    const h = fixture()
    Object.assign(h.records.get('appointments/a'), change)
    const access = await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })
    assert.equal(access.code, 409)
    assert.equal(h.records.get('appointments/a').consultationCodeVerifiedAt, undefined)
  }
})
