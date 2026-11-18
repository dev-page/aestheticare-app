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
  const { admin, google, requireAuth, authorizeClinicAction, loadUserContext, config, sendEmail } = deps
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const connectionRef = uid => db.collection('googlePractitionerConnections').doc(uid)
  const meetReadScope = 'https://www.googleapis.com/auth/meetings.space.readonly'
  const meetCreateScope = 'https://www.googleapis.com/auth/meetings.space.created'
  const configured = () => Boolean(config.clientId && config.clientSecret && config.redirectUri && Buffer.from(config.encryptionKey || '', 'base64').length === 32)
  const oauth = () => {
    check(configured(), 'Google account connections are not configured. Contact the administrator.', 503)
    return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
  }
  const respondError = (res, error) => res.status(error.status || 503).json({ success: false, error: error.status ? error.message : 'Online consultation is unavailable. Please try again or contact the clinic.' })

  const validMeetLink = value => {
    try {
      const url = new URL(String(value || '').trim())
      const code = url.pathname.match(/^\/([a-z0-9-]{6,40})\/?$/i)?.[1]
      if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com' || url.port || url.username || url.password || !code) return ''
      return `https://meet.google.com/${code}`
    } catch { return '' }
  }

  app.get('/google-meet/account', requireAuth, async (req, res) => {
    res.json({ success: true, data: { manualMeetLinks: true, connected: false } })
  })
  app.post('/google-meet/account/connect', requireAuth, async (req, res) => {
    res.status(410).json({ success: false, error: 'Google account connection is no longer needed. Create a room in Google Meet and add its link to the appointment.' })
  })
  app.get('/google-meet/oauth/callback', async (req, res) => {
    res.status(410).type('text').send('Google account connection is no longer used for AesthetiCare consultations. Return to the clinic appointment page.')
  })
  app.post('/google-meet/account/disconnect', requireAuth, async (req, res) => {
    res.status(410).json({ success: false, error: 'Google account connections are no longer used for online consultations.' })
  })

  app.post('/appointments/demo-online-consultation', requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      const branchId = String(req.body?.branchId || '').trim()
      check(branchId, 'Select a clinic branch.', 400)
      check(!['inactive', 'archived', 'disabled'].includes(normalized(context?.userData?.status)), 'An active clinic account is required.', 403)
      await authorizeClinicAction(req.user.uid, branchId, 'consultations:create')
      const profile = context.userData || {}
      const customerName = String(profile.fullName || profile.name || req.user.name || req.user.email || 'Demo Customer').trim()
      // Put the demo inside the app's five-minute online waiting-room window
      // so the customer and practitioner can exercise the flow immediately.
      const now = new Date(Date.now() + 5 * 60000)
      const localParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(now).reduce((parts, item) => ({ ...parts, [item.type]: item.value }), {})
      const timeParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(now).reduce((parts, item) => ({ ...parts, [item.type]: item.value }), {})
      const date = `${localParts.year}-${localParts.month}-${localParts.day}`
      const time = `${timeParts.hour}:${timeParts.minute}`
      const serviceKey = String(crypto.randomInt(100000, 1000000))
      const ref = db.collection('appointments').doc()
      const timestamp = stamp()
      const appointment = {
        branchId, customerId: req.user.uid, customerName, clientName: customerName,
        customerEmail: String(req.user.email || profile.email || '').trim(),
        practitionerId: req.user.uid, assignedPractitionerId: req.user.uid,
        practitionerName: customerName, assignedPractitionerName: customerName,
        service: 'Demo Online Consultation', type: 'Consultation', consultationMode: 'online',
        date, time, status: 'Scheduled', approvalStatus: 'Approved',
        paymentStatus: 'Paid', paymentMethod: 'Demo', paymentCoverage: 'full',
        amount: 0, totalAmount: 0, amountPaid: 0,
        contract: { status: 'signed', terms: 'Demo consultation only. No real payment or clinical care is provided.' },
        serviceKey, consultationDurationMinutes: 15, durationMinutes: 15,
        consultationPolicy: { version: 2, graceMinutes: 10, bufferMinutes: 15 },
        source: 'demo_online_consultation', demoMode: true,
        createdAt: timestamp, updatedAt: timestamp,
      }
      await ref.set(appointment)
      res.status(201).json({ success: true, data: { id: ref.id, date, time, serviceKey } })
    } catch (error) { respondError(res, error) }
  })

  app.post('/appointments/:id/consultation-access', requireAuth, async (req, res) => {
    try {
      check(/^[A-Za-z0-9_-]{1,150}$/.test(req.params.id), 'Invalid appointment.', 400)
      const ref = db.collection('appointments').doc(req.params.id)
      const attemptRef = db.collection('consultationCodeAttempts').doc(ref.id)
      const result = await db.runTransaction(async tx => {
        const appointment = (await tx.get(ref)).data()
        check(appointment, 'Appointment not found.', 404)
        check(appointment.customerId === req.user.uid, 'Only the booked customer may submit this code.', 403)
        check(normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online', 'Select an online consultation.', 409)
        check(['paid', 'ready to start', 'scheduled', 'ongoing'].includes(normalized(appointment.status)) && appointment.approvalStatus === 'Approved' && normalized(appointment.contract?.status) === 'signed' && initialPaymentReceived(appointment), 'Approval, a signed contract, and the required payment are needed.', 409)
        const attempts = (await tx.get(attemptRef)).data() || {}
        check(!(attempts.count >= 5 && attempts.until > Date.now()), 'Too many incorrect codes. Try again in ten minutes.', 429)
        const code = String(req.body?.serviceKey || '').trim()
        if (!/^\d{6}$/.test(code) || code !== String(appointment.serviceKey || '')) {
          tx.set(attemptRef, { count: attempts.until > Date.now() ? (attempts.count || 0) + 1 : 1, until: Date.now() + 600000 })
          return { invalid: true }
        }
        const practitionerId = appointment.assignedPractitionerId || appointment.practitionerId
        check(practitionerId, 'A practitioner must be assigned first.', 409)
        const meeting = (await tx.get(db.collection('appointmentMeetings').doc(ref.id))).data() || {}
        const readyAt = appointment.consultationCustomerReadyAt || stamp()
        const notificationRef = db.collection('notifications').doc(`meet-ready-${ref.id}`)
        const existingNotification = (await tx.get(notificationRef)).data()
        tx.set(attemptRef, { count: 0, until: 0 })
        tx.update(ref, {
          consultationAccessVersion: 1,
          consultationCodeVerifiedAt: appointment.consultationCodeVerifiedAt || stamp(),
          consultationCodeVerifiedBy: req.user.uid,
          consultationCustomerReadyAt: readyAt,
          updatedAt: stamp(),
        })
        if (!existingNotification) tx.set(notificationRef, {
          recipientUserId: practitionerId, branchId: appointment.branchId, title: 'Customer is in the virtual waiting room',
          message: 'The customer entered their service code for the online consultation.',
          link: '/crm/appointments?tab=queue&mode=online', read: false, deleted: false, createdAt: stamp(),
        })
        const matchingMeeting = (meeting.hostVerified || meeting.meetingProvider === 'google-meet-manual')
          && meeting.practitionerId === practitionerId && meeting.customerId === appointment.customerId
          && meeting.scheduledStartAt === consultationWindow(appointment).start.toISOString()
        return { queued: true, meetLink: matchingMeeting ? String(meeting.meetLink || '') : '' }
      })
      check(!result.invalid, 'Invalid service code.', 400)
      res.json({ success: true, data: result })
    } catch (error) { respondError(res, error) }
  })

  app.post('/appointments/:id/meet-presence', requireAuth, async (req, res) => {
    try {
      check(/^[A-Za-z0-9_-]{1,150}$/.test(req.params.id), 'Invalid appointment.', 400)
      const ref = db.collection('appointments').doc(req.params.id), meetingRef = db.collection('appointmentMeetings').doc(ref.id)
      const [appointmentSnap, meetingSnap] = await Promise.all([ref.get(), meetingRef.get()])
      const appointment = appointmentSnap.data(), meeting = meetingSnap.data()
      check(appointment && meeting?.hostVerified, 'Online consultation not found.', 404)
      const practitionerId = appointment.assignedPractitionerId || appointment.practitionerId
      check(practitionerId === req.user.uid, 'Only the assigned practitioner can check meeting attendance.', 403)
      await authorizeClinicAction(req.user.uid, appointment.branchId, 'consultations:create')
      check(normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online', 'Select an online consultation.', 409)
      check(meeting.practitionerId === practitionerId && meeting.customerId === appointment.customerId && meeting.scheduledStartAt === new Date(`${appointment.date}T${appointment.time}+08:00`).toISOString(), 'The meeting does not match this appointment.', 409)
      if (meeting.consultationQueueEnabled) check(appointment.consultationInviteAt, 'Invite the customer before checking live meeting attendance.', 409)
      const account = (await connectionRef(practitionerId).get()).data()
      check(account?.active && account.scopes?.includes(meetReadScope), 'Reconnect the Google hosting account and grant Google Meet attendance access.', 409)
      const code = String(meeting.meetLink || '').match(/^https:\/\/meet\.google\.com\/([a-z-]+)$/)?.[1]
      check(code, 'The Google Meet link is invalid.', 409)
      const client = oauth()
      client.setCredentials({ refresh_token: googleTokenCipher(config.encryptionKey).decrypt(account.refreshToken, `${practitionerId}:${account.googleSub}`) })
      let space
      try {
        space = (await client.request({ url: `https://meet.googleapis.com/v2/spaces/${encodeURIComponent(code)}` })).data
      } catch (error) {
        const status = Number(error.code || error.response?.status)
        if (status === 404) {
          const result = { state: 'waiting', activeParticipantCount: 0, customerNameMatched: false, practitionerNameMatched: false, checkedAt: new Date().toISOString() }
          await meetingRef.set({ meetPresence: result }, { merge: true })
          res.json({ success: true, data: result })
          return
        }
        throw error
      }
      const conference = space.activeConference?.conferenceRecord
      if (!conference) {
        const result = { state: 'waiting', activeParticipantCount: 0, customerNameMatched: false, practitionerNameMatched: false, checkedAt: new Date().toISOString() }
        await meetingRef.set({ meetPresence: result }, { merge: true })
        res.json({ success: true, data: result })
        return
      }
      const participants = []
      let pageToken
      do {
        const page = (await client.request({ url: `https://meet.googleapis.com/v2/${conference}/participants`, params: { pageSize: 100, pageToken } })).data
        participants.push(...(page.participants || []))
        pageToken = page.nextPageToken
      } while (pageToken && participants.length < 250)
      const active = []
      for (const participant of participants.slice(0, 250)) {
        let sessionToken
        do {
          const page = (await client.request({ url: `https://meet.googleapis.com/v2/${participant.name}/participantSessions`, params: { pageSize: 100, pageToken: sessionToken } })).data
          if ((page.participantSessions || []).some(session => !session.endTime)) active.push(participant)
          sessionToken = page.nextPageToken
        } while (sessionToken)
      }
      const normalizedName = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const customerName = normalizedName(appointment.clientName || appointment.patientName || '')
      const practitioner = await loadUserContext(practitionerId)
      const practitionerName = normalizedName(practitioner?.userData?.fullName || '')
      const names = active.map(participant => normalizedName(participant.signedinUser?.displayName || participant.anonymousUser?.displayName || participant.phoneUser?.displayName || ''))
      const customerNameMatched = Boolean(customerName && names.includes(customerName))
      const practitionerNameMatched = Boolean(practitionerName && names.includes(practitionerName))
      const result = { state: active.length >= 2 ? 'participants_detected' : active.length === 1 ? 'one_participant' : 'waiting', activeParticipantCount: active.length, customerNameMatched, practitionerNameMatched, checkedAt: new Date().toISOString() }
      await meetingRef.set({ meetPresence: result }, { merge: true })
      res.json({ success: true, data: result })
    } catch (error) { respondError(res, error) }
  })

  app.post('/appointments/:id/attach-meet-link', requireAuth, async (req, res) => {
    try {
      check(/^[A-Za-z0-9_-]{1,150}$/.test(req.params.id), 'Invalid appointment.', 400)
      const meetLink = validMeetLink(req.body?.meetLink)
      check(meetLink, 'Enter a valid Google Meet link.', 400)
      const ref = db.collection('appointments').doc(req.params.id)
      const meetingRef = db.collection('appointmentMeetings').doc(req.params.id)
      const customerNotificationRef = db.collection('notifications').doc(`meet-invite-${ref.id}`)
      const result = await db.runTransaction(async tx => {
        const appointment = (await tx.get(ref)).data()
        check(appointment, 'Online consultation not found.', 404)
        await authorizeClinicAction(req.user.uid, appointment.branchId, 'consultations:create')
        check(normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online', 'Select an online consultation.', 409)
        check(!['cancelled', 'rejected', 'completed', 'no-show', 'ongoing', 'awaiting customer confirmation'].includes(normalized(appointment.status)), 'This consultation is no longer waiting to start.', 409)
        check(appointment.assignedPractitionerId || appointment.practitionerId, 'A practitioner must be assigned first.', 409)
        const window = consultationWindow(appointment)
        const invitedAt = appointment.consultationInviteAt || stamp()
        const previousMeeting = (await tx.get(meetingRef)).data() || {}
        tx.set(meetingRef, {
          meetingProvider: 'google-meet-manual', meetLink, meetCode: meetLink.split('/').pop(),
          meetCreatedBy: req.user.uid, meetCreatedAt: previousMeeting.meetLink === meetLink ? previousMeeting.meetCreatedAt || stamp() : stamp(),
          customerId: appointment.customerId, practitionerId: appointment.assignedPractitionerId || appointment.practitionerId,
          branchId: appointment.branchId, hostVerified: false, hostEmail: '', consultationQueueEnabled: true,
          meetPresenceTrackingEnabled: false, scheduledStartAt: window.start.toISOString(),
          scheduledEndAt: window.end.toISOString(), durationMinutes: window.duration, updatedAt: stamp(),
        }, { merge: true })
        tx.update(ref, { consultationInviteAt: invitedAt, consultationInviteSentBy: req.user.uid, consultationInviteEmailStatus: 'pending', updatedAt: stamp() })
        tx.set(customerNotificationRef, {
          recipientUserId: appointment.customerId, branchId: appointment.branchId, title: 'Your clinic shared a Google Meet link',
          message: 'Your clinic added a consultation link. Enter your service code in My Appointments to reveal it.',
          link: '/customer/appointments?tab=online', read: false, deleted: false, createdAt: stamp(),
        }, { merge: true })
        return {
          meetLink, invitedAt: appointment.consultationInviteAt || null,
          customerName: String(appointment.customerName || appointment.clientName || 'Customer').trim(),
          customerEmail: String(appointment.customerEmail || '').trim(),
          serviceName: String(appointment.service || appointment.serviceName || 'Online consultation').trim(),
          date: String(appointment.date || ''), time: String(appointment.time || ''), branchId: appointment.branchId,
        }
      })

      let emailSent = false
      if (result.customerEmail && typeof sendEmail === 'function') {
        try {
          const name = result.customerName.replace(/[<>]/g, '')
          const service = result.serviceName.replace(/[<>]/g, '')
          const dateTime = `${result.date} at ${result.time} (Philippine time)`
          const delivery = await sendEmail({
            to: result.customerEmail,
            subject: 'Your online consultation link is ready',
            text: `Hi ${name},\n\nYour clinic has prepared the Google Meet link for your ${service} on ${dateTime}. Open My Appointments in AesthetiCare and enter your service code to reveal and copy the link.`,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408"><p>Hi ${name},</p><p>Your clinic has prepared the Google Meet link for your <strong>${service}</strong> on ${dateTime}.</p><p>Open My Appointments in AesthetiCare and enter your service code to reveal and copy the link.</p></div>`,
          })
          emailSent = delivery?.statusCode === 200
        } catch { emailSent = false }
      }
      await ref.set({ consultationInviteEmailStatus: emailSent ? 'sent' : 'failed', updatedAt: stamp() }, { merge: true })
      res.json({ success: true, data: { meetLink: result.meetLink, invitedAt: result.invitedAt, emailSent } })
    } catch (error) { respondError(res, error) }
  })

  app.post('/appointments/:id/end-meet', requireAuth, async (req, res) => {
    try {
      check(/^[A-Za-z0-9_-]{1,150}$/.test(req.params.id), 'Invalid appointment.', 400)
      const ref = db.collection('appointments').doc(req.params.id)
      const meetingRef = db.collection('appointmentMeetings').doc(req.params.id)
      const [appointmentSnap, meetingSnap] = await Promise.all([ref.get(), meetingRef.get()])
      const appointment = appointmentSnap.data(), meeting = meetingSnap.data()
      check(appointment && meeting?.hostVerified, 'Online consultation not found.', 404)
      const practitionerId = appointment.assignedPractitionerId || appointment.practitionerId
      check(practitionerId === req.user.uid, 'Only the assigned practitioner can end this Google Meet.', 403)
      await authorizeClinicAction(req.user.uid, appointment.branchId, 'consultations:create')
      check(normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online', 'Select an online consultation.', 409)
      check(['ongoing', 'awaiting customer confirmation', 'completed', 'balance due'].includes(normalized(appointment.status)), 'Start the consultation before ending its Google Meet.', 409)
      check(meeting.practitionerId === practitionerId && meeting.customerId === appointment.customerId, 'The meeting does not match this appointment.', 409)
      check(meeting.scheduledStartAt === new Date(`${appointment.date}T${appointment.time}+08:00`).toISOString(), 'This meeting does not match the current appointment schedule.', 409)
      check(Boolean(appointment.startedAt), 'Start the consultation before ending its Google Meet.', 409)
      if (meeting.meetEndedAt) {
        res.json({ success: true, data: { ended: true, alreadyEnded: true } })
        return
      }
      check(/^spaces\/[A-Za-z0-9_-]+$/.test(String(meeting.meetSpaceName || '')), 'This older meeting cannot be ended from AesthetiCare. Open it in Google Meet and choose End meeting for everyone.', 409)
      const account = (await connectionRef(practitionerId).get()).data()
      check(account?.active && account.googleSub === meeting.hostGoogleSub, 'Reconnect the Google hosting account that created this meeting.', 409)
      check(account.scopes?.includes(meetCreateScope), 'Reconnect the hosting account and grant Google Meet room control.', 409)
      const client = oauth()
      client.setCredentials({ refresh_token: googleTokenCipher(config.encryptionKey).decrypt(account.refreshToken, `${practitionerId}:${account.googleSub}`) })
      await client.request({
        method: 'POST',
        url: `https://meet.googleapis.com/v2/${meeting.meetSpaceName}:endActiveConference`,
        data: {},
      })
      await meetingRef.set({ meetEndedAt: stamp(), meetEndedBy: req.user.uid }, { merge: true })
      res.json({ success: true, data: { ended: true } })
    } catch (error) { respondError(res, error) }
  })
}
