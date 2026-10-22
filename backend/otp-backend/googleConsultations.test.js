import test from 'node:test'
import assert from 'node:assert/strict'
import { registerGoogleConsultations, googleTokenCipher } from './googleConsultations.js'
import { transactionDb } from './testTransactionDb.js'

const encryptionKey = Buffer.alloc(32, 7).toString('base64')
const fixture = () => {
  const h = transactionDb(), routes = new Map(), events = new Map(), calls = []
  const start = new Date(Date.now() + 5 * 60000)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(start)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(start)
  h.seed('appointments', 'a', { branchId: 'clinic', customerId: 'customer', practitionerId: 'doctor', type: 'Consultation', consultationMode: 'online', date, time, status: 'Paid', approvalStatus: 'Approved', contract: { status: 'signed' }, amount: 1000, amountPaid: 1000, serviceKey: '123456', consultationDurationMinutes: 30 })
  h.seed('googlePractitionerConnections', 'doctor', { active: true, googleSub: 'sub-doctor', email: 'different-google@test.invalid', scopes: ['https://www.googleapis.com/auth/calendar.events.owned', 'https://www.googleapis.com/auth/meetings.space.readonly'], version: 'v1', refreshToken: googleTokenCipher(encryptionKey).encrypt('test-token', 'doctor:sub-doctor') })
  const config = { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://api.test.invalid/google-meet/oauth/callback', encryptionKey, frontendUrl: 'https://app.test.invalid' }
  let oauthState, providerFailure, wrongOrganizer = false
  const google = {
    auth: { OAuth2: class {
      setCredentials(credentials) { assert.equal(credentials.refresh_token, 'test-token') }
      generateAuthUrl(options) { oauthState = options.state; assert.ok(options.scope.includes('https://www.googleapis.com/auth/calendar.events.owned')); assert.ok(options.scope.includes('https://www.googleapis.com/auth/meetings.space.readonly')); return 'https://accounts.google.com/test' }
      async getToken() { return { tokens: { refresh_token: 'test-token', id_token: 'id', scope: 'openid email https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/meetings.space.readonly' } } }
      async verifyIdToken() { return { getPayload: () => ({ sub: 'sub-doctor', email: 'different-google@test.invalid', email_verified: true, nonce: oauthState }) } }
    } },
    calendar: ({ auth }) => ({ events: {
      async insert(options) {
        if (providerFailure) throw providerFailure
        calls.push(options); assert.equal(options.calendarId, 'primary'); assert.equal(options.requestBody.guestsCanModify, false)
        const id = options.requestBody.id
        if (events.has(id)) throw Object.assign(Error('Duplicate'), { code: 409 })
        const data = { id, organizer: { email: wrongOrganizer ? 'platform@test.invalid' : 'different-google@test.invalid' }, hangoutLink: 'https://meet.google.com/abc-defg-hij' }
        events.set(id, data); return { data }
      },
      async get({ eventId }) { return { data: events.get(eventId) } },
    } }),
  }
  const app = { get(path, ...handlers) { routes.set(path, handlers.at(-1)) }, post(path, ...handlers) { routes.set(path, handlers.at(-1)) } }
  const deps = { admin: h.admin, google, config, requireAuth() {}, loadUserContext: async () => ({ userData: { branchId: 'clinic', status: 'Active' } }), authorizeClinicAction: async (uid, branch) => { assert.equal(branch, 'clinic'); if (uid !== 'doctor') throw Object.assign(Error('Forbidden'), { status: 403 }) } }
  registerGoogleConsultations(app, deps)
  const call = async (path, uid = 'customer', body = {}, query = {}) => {
    const result = { code: 200 }
    await routes.get(path)({ user: { uid }, params: { id: 'a' }, body, query }, { status(code) { result.code = code; return this }, json(body) { result.body = body }, type() { return this }, send(body) { result.body = body }, redirect(url) { result.redirect = url } })
    return result
  }
  return { ...h, call, config, calls, events, setFailure: error => { providerFailure = error }, wrongOrganizer: () => { wrongOrganizer = true }, state: () => oauthState }
}

test('customer code creates the meeting in the practitioner primary calendar, not the customer account', async () => {
  const h = fixture(), result = await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })
  assert.equal(result.code, 200)
  assert.equal(result.body.data.queued, true)
  assert.equal(result.body.data.meetLink, undefined)
  const meeting = h.records.get('appointmentMeetings/a')
  assert.equal(meeting.meetCreatedBy, 'doctor'); assert.equal(meeting.practitionerId, 'doctor'); assert.equal(meeting.hostVerified, true)
  assert.equal(meeting.consultationQueueEnabled, true); assert.equal(meeting.meetPresenceTrackingEnabled, true)
  assert.equal(h.records.get('appointments/a').status, 'Paid')
  assert.equal(h.records.get('appointments/a').startedAt, undefined)
  assert.equal(h.records.get('appointments/a').consultationCodeVerifiedBy, 'customer')
  assert.ok(h.records.get('appointments/a').consultationCustomerReadyAt)
  assert.equal(h.records.get('appointments/a').consultationInviteAt, undefined)
  assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })).code, 200)
  assert.equal(h.events.size, 1)
  assert.equal([...h.records.keys()].filter(key => key.startsWith('notifications/')).length, 1)
  assert.equal([...h.records.values()].find(value => value.title === 'Customer is in the virtual waiting room').recipientUserId, 'doctor')
  const invitation = await h.call('/appointments/:id/invite-to-meet', 'doctor')
  assert.equal(invitation.code, 200)
  assert.equal(invitation.body.data.meetLink, meeting.meetLink)
  assert.ok(h.records.get('appointments/a').consultationInviteAt)
  assert.equal([...h.records.values()].find(value => value.title === 'Your practitioner invited you to Google Meet').recipientUserId, 'customer')
})

test('incorrect codes commit attempt limits; strangers and practitioners cannot submit a customer code', async () => {
  const h = fixture()
  assert.equal((await h.call('/appointments/:id/consultation-access', 'stranger', { serviceKey: '123456' })).code, 403)
  assert.equal((await h.call('/appointments/:id/consultation-access', 'doctor', { serviceKey: '123456' })).code, 403)
  for (let i = 0; i < 5; i++) assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '000000' })).code, 400)
  assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })).code, 429)
  assert.equal(h.calls.length, 0)
})

test('missing host connection and wrong Google organizer never fall back to a shared account', async () => {
  const h = fixture(); h.records.get('googlePractitionerConnections/doctor').active = false
  assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })).code, 409)
  assert.equal(h.calls.length, 0)
  h.records.get('googlePractitionerConnections/doctor').active = true; h.wrongOrganizer()
  assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })).code, 409)
  assert.equal(h.records.has('appointmentMeetings/a'), false)
  assert.equal(h.records.get('appointments/a').consultationCodeVerifiedAt, undefined)
})

test('unpaid, unsigned, cancelled, and out-of-window consultations cannot generate meetings', async () => {
  for (const change of [{ amountPaid: 0 }, { contract: { status: 'pending' } }, { status: 'Cancelled' }, { date: '2000-01-01' }]) {
    const h = fixture(); Object.assign(h.records.get('appointments/a'), change)
    assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })).code, 409)
    assert.equal(h.calls.length, 0)
  }
})

test('provider errors stay retryable and never expose tokens or consume the appointment', async () => {
  const h = fixture(); h.setFailure(Error('sensitive test-token'))
  const failure = await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })
  assert.equal(failure.code, 503); assert.doesNotMatch(failure.body.error, /test-token/)
  assert.equal(h.records.get('appointments/a').consultationCodeVerifiedAt, undefined)
  h.setFailure(null)
  assert.equal((await h.call('/appointments/:id/consultation-access', 'customer', { serviceKey: '123456' })).code, 200)
})

test('OAuth state is single-use, binds the logged-in practitioner, and stores encrypted credentials', async () => {
  const h = fixture()
  assert.equal((await h.call('/google-meet/account/connect', 'doctor')).code, 200)
  const state = h.state()
  const callback = await h.call('/google-meet/oauth/callback', null, {}, { state, code: 'code' })
  assert.equal(callback.code, 200); assert.match(callback.redirect, /^https:\/\/app.test.invalid\//)
  const account = h.records.get('googlePractitionerConnections/doctor')
  assert.equal(account.email, 'different-google@test.invalid')
  assert.notEqual(account.refreshToken.data, 'test-token')
  assert.equal((await h.call('/google-meet/oauth/callback', null, {}, { state, code: 'code' })).code, 400)
  const status = await h.call('/google-meet/account', 'doctor')
  assert.equal(status.body.data.connected, true); assert.equal(status.body.data.attendanceEnabled, true); assert.equal(status.body.data.refreshToken, undefined)
  assert.equal((await h.call('/google-meet/account/disconnect', 'doctor')).code, 200)
  assert.equal(h.records.get('googlePractitionerConnections/doctor').refreshToken, undefined)
})

test('encrypted Google tokens cannot be decrypted for another practitioner or with altered data', () => {
  const cipher = googleTokenCipher(encryptionKey), token = cipher.encrypt('secret', 'doctor:sub')
  assert.equal(cipher.decrypt(token, 'doctor:sub'), 'secret')
  assert.throws(() => cipher.decrypt(token, 'other:sub'))
  assert.throws(() => cipher.decrypt({ ...token, data: Buffer.alloc(6).toString('base64') }, 'doctor:sub'))
})

test('expired OAuth requests and already-owned Google accounts cannot be linked', async () => {
  const h = fixture()
  await h.call('/google-meet/account/connect', 'doctor')
  h.records.get(`googleConnectionStates/${h.state()}`).expiresAt = 0
  assert.equal((await h.call('/google-meet/oauth/callback', null, {}, { state: h.state(), code: 'code' })).code, 400)
  await h.call('/google-meet/account/connect', 'doctor')
  h.seed('googleConnectionOwners', 'sub-doctor', { uid: 'another-doctor' })
  assert.equal((await h.call('/google-meet/oauth/callback', null, {}, { state: h.state(), code: 'code' })).code, 409)
  assert.equal(h.records.get('googlePractitionerConnections/doctor').version, 'v1')
})
