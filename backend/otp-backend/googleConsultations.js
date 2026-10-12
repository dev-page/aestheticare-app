import { onlineWindow } from '../../shared/onlineConsultation.js'
import crypto from 'node:crypto'
import { assertWorkflow as check, normalized, initialPaymentReceived } from './bookingWorkflow.js'

export const consultationWindow = appointment => {
  const start = new Date(`${appointment.date}T${appointment.time}+08:00`)
  check(!Number.isNaN(start.getTime()), 'This consultation needs a valid schedule.', 409)
  const duration = Math.min(240, Math.max(5, Number(appointment.consultationDurationMinutes || appointment.durationMinutes || appointment.totalServiceDurationMinutes || 30)))
  check(Number.isFinite(duration), 'Invalid consultation duration.', 409)
  return { start, end: onlineWindow(appointment).reservedEnd, arrivalDeadline: onlineWindow(appointment).arrivalDeadline, duration }
}

export const googleTokenCipher = encodedKey => {
  const key = Buffer.from(encodedKey || '', 'base64')
  check(key.length === 32, 'Google account connections are not configured. Contact the administrator.', 503)
  return {
    encrypt(token, identity) {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(identity))
      const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
      return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
    },
    decrypt(token, identity) {
      const cipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(token.iv, 'base64'))
      cipher.setAAD(Buffer.from(identity)); cipher.setAuthTag(Buffer.from(token.tag, 'base64'))
      return Buffer.concat([cipher.update(Buffer.from(token.data, 'base64')), cipher.final()]).toString('utf8')
    },
  }
}

export const registerGoogleConsultations = (app, deps) => {
  const { admin, google, requireAuth, authorizeClinicAction, loadUserContext, config } = deps
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const connectionRef = uid => db.collection('googlePractitionerConnections').doc(uid)
  const configured = () => Boolean(config.clientId && config.clientSecret && config.redirectUri && Buffer.from(config.encryptionKey || '', 'base64').length === 32)
  const oauth = () => {
    check(configured(), 'Google account connections are not configured. Contact the administrator.', 503)
    return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  }
  const authorizeSelf = async uid => {
    const context = await loadUserContext(uid)
    const user = context?.userData || {}
    check(user.branchId && !['inactive', 'archived', 'disabled'].includes(normalized(user.status)), 'An active clinic account is required.', 403)
    await authorizeClinicAction(uid, user.branchId, 'consultations:create')
  }
  const respondError = (res, error) => res.status(error.status || 503).json({ success: false, error: error.status ? error.message : 'Google Meet is unavailable. The practitioner may need to reconnect their Google account. Please try again.' })

  app.get('/google-meet/account', requireAuth, async (req, res) => {
    try {
      await authorizeSelf(req.user.uid)
      const account = (await connectionRef(req.user.uid).get()).data()
      res.json({ success: true, data: { configured: configured(), connected: Boolean(account?.active), email: account?.email || '' } })
    } catch (error) { respondError(res, error) }
  })
  app.post('/google-meet/account/connect', requireAuth, async (req, res) => {
    try {
      await authorizeSelf(req.user.uid)
      const client = oauth(), state = crypto.randomBytes(32).toString('hex')
      await db.collection('googleConnectionStates').doc(state).set({ uid: req.user.uid, expiresAt: Date.now() + 600000, used: false })
      const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent select_account', scope: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events.owned'], state, nonce: state })
      res.json({ success: true, data: { url } })
    } catch (error) { respondError(res, error) }
  })
  app.get('/google-meet/oauth/callback', async (req, res) => {
    try {
      check(/^[a-f0-9]{64}$/.test(String(req.query.state || '')), 'Invalid Google connection request.', 400)
      const stateRef = db.collection('googleConnectionStates').doc(req.query.state)
      const uid = await db.runTransaction(async tx => {
        const state = (await tx.get(stateRef)).data()
        check(state && !state.used && state.expiresAt > Date.now(), 'This Google connection request has expired. Connect again.', 400)
        tx.update(stateRef, { used: true })
        return state.uid
      })
      await authorizeSelf(uid)
      check(!req.query.error && req.query.code, 'Google authorization was not completed. Connect again.', 400)
      const client = oauth(), { tokens } = await client.getToken(String(req.query.code))
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId })
      const identity = ticket.getPayload()
      check(identity?.sub && identity.email_verified && identity.email && identity.nonce === req.query.state, 'Unable to verify the selected Google account.', 400)
      check(tokens.refresh_token, 'Google did not grant ongoing access. Connect again and grant Calendar permission.', 400)
      check(String(tokens.scope || '').split(' ').includes('https://www.googleapis.com/auth/calendar.events.owned'), 'Calendar permission is required to host consultations.', 400)
      const meetings = await db.collection('appointmentMeetings').where('practitionerId', '==', uid).get()
      check(!meetings.docs.some(snapshot => { const meeting = snapshot.data(); return meeting.hostGoogleSub && meeting.hostGoogleSub !== identity.sub && new Date(meeting.scheduledEndAt).getTime() > Date.now() }), 'Finish existing scheduled consultations before changing the hosting Google account. Reconnect their original account instead.', 409)
      const cipher = googleTokenCipher(config.encryptionKey)
      await db.runTransaction(async tx => {
        const ownerRef = db.collection('googleConnectionOwners').doc(identity.sub), owner = (await tx.get(ownerRef)).data()
        check(!owner || owner.uid === uid, 'This Google account is already connected to another practitioner.', 409)
        tx.set(ownerRef, { uid })
        tx.set(connectionRef(uid), { active: true, email: identity.email.toLowerCase(), googleSub: identity.sub, version: crypto.randomUUID(), refreshToken: cipher.encrypt(tokens.refresh_token, `${uid}:${identity.sub}`), updatedAt: stamp() })
      })
      res.redirect(`${config.frontendUrl.replace(/\/$/, '')}/clinical/consultations/online?google=connected`)
    } catch (error) {
      // Never include Google's raw response, credentials, or authorization code.
      res.status(error.status || 503).type('text').send(error.status ? error.message : 'Google connection failed. Return to Online Consultation and connect again.')
    }
  })
  app.post('/google-meet/account/disconnect', requireAuth, async (req, res) => {
    try {
      await authorizeSelf(req.user.uid)
      await db.runTransaction(async tx => {
        const ref = connectionRef(req.user.uid), account = (await tx.get(ref)).data()
        if (account) tx.set(ref, { active: false, email: account.email, googleSub: account.googleSub, version: crypto.randomUUID(), updatedAt: stamp() })
      })
      res.json({ success: true })
    } catch (error) { respondError(res, error) }
  })

  app.post('/appointments/:id/consultation-access', requireAuth, async (req, res) => {
    try {
      check(/^[A-Za-z0-9_-]{1,150}$/.test(req.params.id), 'Invalid appointment.', 400)
      const ref = db.collection('appointments').doc(req.params.id), meetingRef = db.collection('appointmentMeetings').doc(ref.id)
      const attemptRef = db.collection('consultationCodeAttempts').doc(ref.id)
      const result = await db.runTransaction(async tx => {
        const appointment = (await tx.get(ref)).data()
        check(appointment, 'Appointment not found.', 404)
        check(appointment.customerId === req.user.uid, 'Only the booked customer may submit this code.', 403)
        check(normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online', 'Select an online consultation.', 409)
        check(['paid', 'ready to start', 'scheduled'].includes(normalized(appointment.status)) && appointment.approvalStatus === 'Approved' && normalized(appointment.contract?.status) === 'signed' && initialPaymentReceived(appointment), 'Approval, a signed contract, and the required payment are needed.', 409)
        const window = consultationWindow(appointment)
        check(Date.now() >= window.start.getTime() - 30 * 60000 && Date.now() < window.arrivalDeadline.getTime(), 'Submit your service code within 30 minutes of the consultation, before the arrival grace period ends.', 409)
        const attempts = (await tx.get(attemptRef)).data() || {}
        check(!(attempts.count >= 5 && attempts.until > Date.now()), 'Too many incorrect codes. Try again in ten minutes.', 429)
        const code = String(req.body?.serviceKey || '').trim()
        if (!/^\d{6}$/.test(code) || code !== String(appointment.serviceKey || '')) {
          tx.set(attemptRef, { count: attempts.until > Date.now() ? (attempts.count || 0) + 1 : 1, until: Date.now() + 600000 })
          return { invalid: true }
        }
        const practitionerId = appointment.assignedPractitionerId || appointment.practitionerId
        check(practitionerId, 'A practitioner must be assigned first.', 409)
        const account = (await tx.get(connectionRef(practitionerId))).data(), meeting = (await tx.get(meetingRef)).data()
        check(account?.active, 'Your practitioner needs to connect their Google hosting account. Contact the clinic.', 409)
        tx.set(attemptRef, { count: 0, until: 0 })
        return { appointment, practitionerId, account, window, meeting }
      })
      check(!result.invalid, 'Invalid service code.', 400)
      const { appointment, practitionerId, account, window } = result
      await authorizeClinicAction(practitionerId, appointment.branchId, 'consultations:create')
      const client = oauth()
      client.setCredentials({ refresh_token: googleTokenCipher(config.encryptionKey).decrypt(account.refreshToken, `${practitionerId}:${account.googleSub}`) })
      const calendar = google.calendar({ version: 'v3', auth: client })
      const eventId = crypto.createHash('sha256').update(`${ref.id}:${practitionerId}:${account.googleSub}:${window.start.toISOString()}:${window.duration}:${appointment.serviceKey}`).digest('hex')
      let event
      try {
        event = (await calendar.events.insert({ calendarId: 'primary', conferenceDataVersion: 1, sendUpdates: 'none', requestBody: {
          id: eventId, summary: 'AesthetiCare online consultation',
          start: { dateTime: window.start.toISOString(), timeZone: 'Asia/Manila' }, end: { dateTime: window.end.toISOString(), timeZone: 'Asia/Manila' },
          guestsCanModify: false, guestsCanInviteOthers: false,
          conferenceData: { createRequest: { requestId: eventId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        } })).data
      } catch (error) {
        if (Number(error.code || error.response?.status) !== 409) throw error
        event = (await calendar.events.get({ calendarId: 'primary', eventId })).data
      }
      check(event.organizer?.email?.toLowerCase() === account.email, 'Google did not confirm the practitioner as meeting organizer. Reconnect the hosting account.', 409)
      let meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.find(point => point.entryPointType === 'video')?.uri
      // Conference creation is asynchronous. Briefly wait for Google so the
      // normal flow does not ask the customer to submit the same code twice.
      for (let attempt = 0; !meetLink && attempt < 4; attempt++) {
        check(event.conferenceData?.createRequest?.status?.statusCode !== 'failure', 'Google could not create a Meet conference for this hosting account. The practitioner should reconnect or contact their Google administrator.', 409)
        await new Promise(resolve => setTimeout(resolve, 1000))
        event = (await calendar.events.get({ calendarId: 'primary', eventId })).data
        check(event.organizer?.email?.toLowerCase() === account.email, 'The Google meeting organizer changed. Contact the clinic.', 409)
        meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.find(point => point.entryPointType === 'video')?.uri
      }
      check(/^https:\/\/meet\.google\.com\/[a-z-]+$/.test(String(meetLink || '')), 'Google is preparing the meeting link. Submit your code again in a few seconds.', 503)
      const meeting = { meetLink, meetEventId: eventId, meetCreatedAt: stamp(), meetCreatedBy: practitionerId, customerId: appointment.customerId,
        practitionerId, hostGoogleSub: account.googleSub, hostEmail: account.email, hostVerified: true,
        scheduledStartAt: window.start.toISOString(), scheduledEndAt: window.end.toISOString(), durationMinutes: window.duration }
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data(), connection = (await tx.get(connectionRef(practitionerId))).data()
        const previousMeeting = (await tx.get(meetingRef)).data()
        check(current && (current.assignedPractitionerId || current.practitionerId) === practitionerId && current.date === appointment.date && current.time === appointment.time && ['paid', 'ready to start', 'scheduled'].includes(normalized(current.status)), 'The appointment changed. Refresh and try again.', 409)
        check(connection?.active && connection.version === account.version, 'The hosting account changed. Submit the code again.', 409)
        check(Date.now() < window.arrivalDeadline.getTime(), 'The consultation window has ended.', 409)
        check(normalized(current.contract?.status) === 'signed' && initialPaymentReceived(current) && current.approvalStatus === 'Approved' && current.serviceKey === appointment.serviceKey, 'The booking changed. Refresh before joining.', 409)
        tx.set(meetingRef, meeting)
        tx.update(ref, { consultationAccessVersion: 1, consultationCodeVerifiedAt: stamp(), consultationCodeVerifiedBy: req.user.uid, updatedAt: stamp() })
        if (previousMeeting?.meetEventId !== eventId) tx.set(db.collection('notifications').doc(`meet-ready-${eventId}`), {
          recipientUserId: practitionerId, branchId: current.branchId, title: 'Online consultation ready',
          message: `The customer verified their service code. Join Google Meet using ${account.email}.`,
          link: '/crm/appointments?tab=queue&mode=online', read: false, deleted: false, createdAt: stamp(),
        })
      })
      res.json({ success: true, data: { meetLink, hostEmail: account.email } })
    } catch (error) { respondError(res, error) }
  })
}
