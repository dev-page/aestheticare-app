import { appointmentStaffIds } from '../../shared/practitionerTeam.js'
import { onlineWindow, onlineAccessOpen, timestampDate } from '../../shared/onlineConsultation.js'
import crypto from 'node:crypto'
import { prepareTeamStart } from './practitionerTeams.js'
import { normalized, initialPaymentReceived, balanceSettled, afterPaymentStatus, assertWorkflow as check } from './bookingWorkflow.js'

const getServiceKeyWindow = (appointment) => {
  const date = String(appointment.date || '').trim()
  const time = String(appointment.time || '').trim()
  if (!date || !time) return null
  const start = new Date(`${date}T${time}+08:00`)
  if (Number.isNaN(start.getTime())) return null
  const endTime = String(appointment.endTime || '').trim()
  const end = endTime ? new Date(`${date}T${endTime}+08:00`) : new Date(start.getTime() + Math.max(30, Number(appointment.totalServiceDurationMinutes || 60)) * 60 * 1000)
  if (Number.isNaN(end.getTime()) || end <= start) return null
  return { opensAt: new Date(start.getTime() - 30 * 60 * 1000), closesAt: end }
}

const getOnlineConsultationWindow = appointment => {
  const window = onlineWindow(appointment)
  return Number.isFinite(window.start.getTime()) ? { ...window, startsAt: window.start, endsAt: window.end, durationMinutes: window.duration } : null
}

export const registerBookingMilestones = (app, { admin, requireAuth, authorizeClinicAction, sendServiceCode = async () => {} }) => {
  const guestAuth = async (req, res, next) => {
    try {
      check(/^[a-f0-9]{48}$/i.test(String(req.params.token || '')), 'Invalid invitation.', 400)
      check(req.body?.action === 'customer_complete', 'Only individual completion confirmation is supported.', 400)
      const db = admin.firestore(), invite = (await db.collection('groupConsentInvitations').doc(req.params.token).get()).data()
      check(invite?.status === 'Completed', 'Complete individual consent first.', 403)
      const original = (await db.collection('appointments').doc(invite.appointmentId).get()).data()
      const targetId = String(req.body.appointmentId || invite.appointmentId)
      const appointment = targetId === invite.appointmentId ? original : (await db.collection('appointments').doc(targetId).get()).data()
      check(original?.isGroupRecipient && appointment && normalized(appointment.customerEmail) === normalized(invite.recipientEmail) && (targetId === invite.appointmentId || (appointment.treatmentPlanAppointmentId === invite.appointmentId && appointment.customerId === original.customerId)), 'This invitation is not valid for this appointment.', 403)
      req.params.id = targetId
      req.user = { uid: appointment.customerId, email: invite.recipientEmail }
      next()
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  }
  const run = (path, action, middleware = requireAuth) => app.post(path, middleware, async (req, res) => {
    try {
      const db = admin.firestore()
      const result = await db.runTransaction(async (tx) => {
        const ref = db.collection('appointments').doc(req.params.id)
        const snapshot = await tx.get(ref)
        check(snapshot.exists, 'Appointment not found.', 404)
        const appointment = snapshot.data()
        const walkIn = appointment.source === 'walk_in'
        const customer = !walkIn && appointment.customerId === req.user.uid
        const worker = (appointment.assignedPractitionerId || appointment.practitionerId || appointment.staffId || appointment.assignedTo) === req.user.uid
        const online = normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online'
        check(!appointment.isGroupParent && !appointment.isBookingOrderParent, 'Use the individual appointment for service actions.')
        let checkInStaff = false
        if (action === 'key' || req.body?.action === 'manual_check_in') {
          check(!customer, 'Customers cannot check themselves in using a service code.', 403)
          if (authorizeClinicAction) await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:update')
          else check(worker, 'Check-in permission is required.', 403)
          checkInStaff = true
        }
        let assistedSigning = false
        if (walkIn && action === 'sign') {
          if (!worker) await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:create')
          assistedSigning = true
        }
        check(customer || worker || assistedSigning || checkInStaff, 'Only the booking customer, assigned worker, or authorized reception staff can perform this action.', 403)
        check(!['cancelled', 'rejected'].includes(normalized(appointment.status)), 'This booking is closed.')
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const planId = appointment.treatmentPlanAppointmentId || ref.id
        const planRef = db.collection('appointments').doc(planId)
        const plan = planId === ref.id ? appointment : (await tx.get(planRef)).data() || appointment
        const update = { updatedAt: timestamp }
        const status = normalized(appointment.status)
        let sharedParentRef = null, sharedParent = null
        const siblings = []
        if (appointment.isGroupRecipient || appointment.bookingOrderId) {
          let parentId = appointment.parentAppointmentId
          if (!parentId && appointment.groupBookingId) parentId = (await tx.get(db.collection('groupBookings').doc(appointment.groupBookingId))).data()?.parentAppointmentId
          if (parentId) {
            sharedParentRef = db.collection('appointments').doc(parentId)
            sharedParent = (await tx.get(sharedParentRef)).data()
            for (const id of sharedParent?.appointmentIds || sharedParent?.groupRecipientAppointmentIds || []) {
              if (id !== ref.id) siblings.push((await tx.get(db.collection('appointments').doc(id))).data())
            }
          }
        }
        if (action === 'sign') {
          check(customer || assistedSigning, 'Only the customer or authorized walk-in assistant can submit the signature.', 403)
          if (walkIn) check(balanceSettled(appointment), 'Collect payment at POS before signing.')
          check(appointment.approvalStatus === 'Approved', 'The clinic must approve this booking before signing.')
          check(normalized(appointment.contract?.status) !== 'signed', 'This contract has already been signed.')
          const signatureImage = String(req.body?.signatureImage || '')
          check(req.body?.accepted === true, 'Please accept the contract before signing.', 400)
          check(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signatureImage) && signatureImage.length <= 200000, 'Draw your electronic signature (PNG, up to 150 KB).', 400)
          const signatureBytes = Buffer.from(signatureImage.split(',')[1], 'base64')
          check(signatureBytes.length > 32 && signatureBytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid signature image.', 400)
          check(appointment.contract?.terms || appointment.contract?.templateUrl, 'The clinic must provide a contract first.')
          check(['contract pending', 'awaiting payment', 'payment pending', 'approved', 'paid', 'ready to start', 'scheduled'].includes(status), 'The contract cannot be signed at this stage.')
          update.contract = { ...appointment.contract, status: 'signed', signatures: { ...(appointment.contract.signatures || {}), [walkIn ? appointment.clientId : req.user.uid]: { uid: walkIn ? null : req.user.uid, clientId: walkIn ? appointment.clientId : null, witnessedBy: walkIn ? req.user.uid : null, signatureImage, method: 'drawn-signature', accepted: true, name: String(walkIn ? appointment.clientName || appointment.customerName || 'Walk-in client' : req.body?.name || req.user.name || req.user.email || 'Customer'), email: walkIn ? appointment.customerEmail || '' : req.user.email || '', signedAt: new Date().toISOString() } } }
          update.contractSignedAt = timestamp
          update.serviceKey = appointment.serviceKey || String(crypto.randomInt(100000, 1000000))
          update.status = afterPaymentStatus({ ...appointment, ...update })
        } else if (action === 'key' || req.body?.action === 'manual_check_in') {
          check(checkInStaff && !online, 'Reception check-in is available for on-site appointments only.', 403)
          check(appointment.approvalStatus === 'Approved' && initialPaymentReceived(appointment) && normalized(appointment.contract?.status) === 'signed', 'Approval, initial payment, and a signed contract are required.')
          check(['paid', 'ready to start', 'scheduled'].includes(status) && !appointment.checkedInAt && !appointment.workerKeyVerified, 'This appointment is already checked in or cannot be checked in at this stage.')
          const keyWindow = getServiceKeyWindow(appointment)
          check(appointment.bookingWorkflowVersion !== 2 || keyWindow, 'This appointment needs a valid check-in window.')
          if (keyWindow) {
            const now = new Date()
            check(now >= keyWindow.opensAt, 'The service key can be verified only within 30 minutes of the appointment start time.')
            check(now <= keyWindow.closesAt, 'The service key has expired for this appointment.')
          }
          if (req.body?.action === 'manual_check_in') {
            const reason = String(req.body?.reason || '').trim()
            check(reason.length >= 10 && reason.length <= 500, 'Explain how the customer identity was verified (10–500 characters).', 400)
            update.manualCheckInReason = reason
          } else check(appointment.serviceKey && String(req.body?.serviceKey || '').trim() === String(appointment.serviceKey), 'Invalid service key.', 403)
          update.workerKeyVerified = true
          update.workerKeyVerifiedAt = timestamp
          update.checkedInAt = timestamp
          update.checkedInById = req.user.uid
          update.status = afterPaymentStatus({ ...appointment, ...update })
        } else {
          const transition = req.body?.action
          if (transition === 'join_consultation') {
            check(online && (customer || worker), 'Only consultation participants may enter the waiting room.', 403)
            check(appointment.consultationCodeVerifiedAt && appointment.consultationCodeVerifiedBy === appointment.customerId, 'The customer must submit their service code before joining.', 409)
            const meeting = (await tx.get(db.collection('appointmentMeetings').doc(ref.id))).data()
            const hostId = appointment.assignedPractitionerId || appointment.practitionerId
            check(meeting?.hostVerified && meeting.practitionerId === hostId && meeting.customerId === appointment.customerId && meeting.scheduledStartAt === new Date(`${appointment.date}T${appointment.time}+08:00`).toISOString(), 'The meeting must be generated for the current assigned practitioner and schedule.', 409)
            check(appointment.approvalStatus === 'Approved' && initialPaymentReceived(appointment) && normalized(appointment.contract?.status) === 'signed', 'Approval, payment, and a signed contract are required.')
            check(['paid', 'checked in', 'ready to start', 'scheduled', 'ongoing'].includes(status), 'This consultation is closed.')
            const window = getOnlineConsultationWindow(appointment)
            check(window && onlineAccessOpen(appointment), 'This consultation is closed or its arrival grace period has ended.')
            const demoPractitionerJoin = appointment.demoMode === true && worker && req.body?.demoParticipantRole === 'practitioner'
            const field = demoPractitionerJoin ? 'practitionerJoinedAt' : customer ? 'clientJoinedAt' : 'practitionerJoinedAt'
            if (!appointment[field]) update[field] = timestamp
            update.status = appointment.status
          } else if (transition === 'client_end_consultation') {
            check(customer && online && status === 'ongoing', 'Only the consultation customer can end their active participation.', 403)
            check(!appointment.consultationClientEndedAt, 'Your participation was already ended.')
            update.consultationClientEndedAt = timestamp
            update.consultationEndedAt = appointment.consultationEndedAt || timestamp
            update.consultationEndedById = appointment.consultationEndedById || req.user.uid
            update.status = appointment.status
          } else if (transition === 'start') {
            check(worker, 'Only the assigned worker can start the service.', 403)
            const teamStart = await prepareTeamStart(tx, db, appointment, ref.id)
            const onlineConsultation = normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online'
            const serviceIsReady = onlineConsultation
              ? ['paid', 'ready to start', 'scheduled'].includes(status) && appointment.approvalStatus === 'Approved' && normalized(appointment.contract?.status) === 'signed' && initialPaymentReceived(appointment)
              : (['checked in', 'ready to start'].includes(status) || (walkIn && status === 'paid')) && appointment.workerKeyVerified && normalized(appointment.contract?.status) === 'signed' && initialPaymentReceived(appointment)
            check(serviceIsReady, onlineConsultation
              ? 'Clinic approval, the signed consultation contract, and the required payment are needed before starting the online consultation.'
              : 'Reception must check the customer in after payment and signing.')
            if (!onlineConsultation) {
              const window = getServiceKeyWindow(appointment)
              check(appointment.bookingWorkflowVersion !== 2 || window, 'This appointment needs a valid service window.')
              if (window) {
                check(new Date() >= window.opensAt, 'This appointment is not ready to start yet.')
                check(new Date() <= window.closesAt, 'This appointment window has expired. Ask the clinic to review and reschedule.')
              }
            }
            if (onlineConsultation) {
              check(appointment.consultationCodeVerifiedAt && appointment.consultationCodeVerifiedBy === appointment.customerId, 'The customer must verify their service code before consultation starts.', 409)
              const meetingSnap = await tx.get(db.collection('appointmentMeetings').doc(ref.id))
              check(meetingSnap.exists && String(meetingSnap.data()?.meetLink || '').trim(), 'Create the system Google Meet link before starting this consultation.')
              const meeting = meetingSnap.data()
              check(meeting.hostVerified && meeting.practitionerId === (appointment.assignedPractitionerId || appointment.practitionerId) && meeting.customerId === appointment.customerId && meeting.scheduledStartAt === new Date(`${appointment.date}T${appointment.time}+08:00`).toISOString(), 'The meeting must belong to the current assigned practitioner and schedule.', 409)
              if (meeting.consultationQueueEnabled) check(appointment.consultationCustomerReadyAt && appointment.consultationInviteAt, 'The customer must check in and receive the practitioner invitation before starting.')
              const window = getOnlineConsultationWindow(appointment)
              check(window, 'This consultation needs a valid scheduled date and time.')
              const now = new Date()
              check(now >= window.opensAt, 'This consultation can be started only within 5 minutes of its scheduled time.')
              check(now < window.arrivalDeadline, 'The arrival grace period ended. Contact the clinic for review and rescheduling.')
              if (meeting.meetPresenceTrackingEnabled) {
                const presence = meeting.meetPresence || {}
                check(presence.state === 'participants_detected' && Number(presence.activeParticipantCount) >= 2 && now.getTime() - new Date(presence.checkedAt || 0).getTime() <= 60000, 'Google Meet must report both participants as currently present. Refresh meeting attendance and try again.', 409)
              } else {
                check(appointment.clientJoinedAt && appointment.practitionerJoinedAt, 'Both participants must enter the consultation waiting room before starting.')
              }
              check(req.body?.participantVerified === true, 'Confirm the customer is present in Google Meet and their identity is verified before starting.', 400)
              const actualEnd = new Date(now.getTime() + window.durationMinutes * 60000)
              await tx.get(db.collection('bookingResourceLocks').doc(appointment.branchId))
              const peers = await tx.get(db.collection('appointments').where('branchId', '==', appointment.branchId))
              const teamIds = appointmentStaffIds(appointment)
              check(!peers.docs.some(doc => {
                const peer = doc.data()
                if (doc.id === ref.id || peer.demoMode === true || peer.isGroupParent || peer.isBookingOrderParent || !['paid', 'scheduled', 'ready to start', 'checked in', 'ongoing', 'approved', 'contract pending', 'awaiting payment'].includes(normalized(peer.status)) || !appointmentStaffIds(peer).some(id => teamIds.includes(id))) return false
                const start = new Date(`${peer.date}T${peer.time}+08:00`)
                const end = peer.endTime ? new Date(`${peer.date}T${peer.endTime}+08:00`) : new Date(start.getTime() + Number(peer.totalServiceDurationMinutes || 60) * 60000)
                return start < actualEnd && end > now
              }), 'A full consultation now overlaps another team appointment. Ask the clinic to review and reschedule.')
              const reservedEnd = window.reservedEnd > actualEnd ? window.reservedEnd : actualEnd
              const localEnd = new Date(reservedEnd.getTime() + 8 * 3600000).toISOString()
              check(localEnd.slice(0, 10) === appointment.date, 'The full consultation must finish within the booked date.')
              update.endTime = localEnd.slice(11, 16)
              update.consultationPresenceVerifiedAt = timestamp
              update.consultationPresenceVerifiedBy = req.user.uid
              update.consultationWindowStartAt = now.toISOString()
              update.consultationWindowEndAt = new Date(now.getTime() + window.durationMinutes * 60000).toISOString()
              update.consultationDurationMinutes = window.durationMinutes
            }
            const resourceRefs = (appointment.resources || []).filter((r) => r.kind === 'material').map((r) => ({ ...r, ref: db.collection('inventoryItems').doc(r.id) }))
            const stocks = []
            for (const resource of resourceRefs) stocks.push({ resource, snapshot: await tx.get(resource.ref) })
            for (const { resource, snapshot: stock } of stocks) check(stock.exists && Number(stock.data().currentStock) >= resource.quantity, 'A required material is no longer available. Contact the clinic.')
            if (onlineConsultation) tx.set(db.collection('bookingResourceLocks').doc(appointment.branchId), { updatedAt: timestamp })
            tx.set(teamStart.termsRef, { ...teamStart.terms, capturedAt: timestamp })
            update.treatmentTeam = teamStart.members
            for (const { resource, snapshot: stock } of stocks) tx.update(resource.ref, { currentStock: Number(stock.data().currentStock) - resource.quantity, updatedAt: timestamp })
            tx.set(db.collection('inventoryMovements').doc('service-' + ref.id), { branchId: appointment.branchId, appointmentId: ref.id, type: 'service_consumption', items: (appointment.resources || []).filter((r) => r.kind === 'material'), createdBy: req.user.uid, createdAt: timestamp })
            update.materialsConsumed = true
            update.status = 'Ongoing'; update.startedAt = timestamp; update.startedById = req.user.uid
          } else if (transition === 'worker_complete') {
            check(worker, 'Only the assigned worker can finish the service.', 403)
            check(status === 'ongoing' && appointment.startedAt, 'Start the service before marking it done.')
            check(!(appointment.treatmentTeam || []).some(member => !member.participationConfirmed), 'Every team member must confirm their own participation before completion.')
            const onlineConsultation = normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online'
            if (onlineConsultation) {
              const window = getOnlineConsultationWindow(appointment)
              check(window, 'This consultation needs a valid scheduled window.')
              check(String(req.body?.treatmentNotes || '').trim().length >= 10, 'Save consultation notes and recommendations (at least 10 characters).', 400)
              const end = new Date(Math.min(timestampDate(appointment.consultationEndedAt || new Date()).getTime(), window.endsAt.getTime()))
              update.consultationEndedAt = end.toISOString()
              update.consultationEndedById = appointment.consultationEndedById || req.user.uid
              update.consultationActualDurationSeconds = Math.max(0, Math.floor((end - timestampDate(appointment.startedAt)) / 1000))
              update.consultationNeedsReview = Boolean(appointment.consultationNeedsReview) || update.consultationActualDurationSeconds < window.durationMinutes * 60 * 0.8 || !String(req.body?.treatmentNotes || '').trim()
            }
            update.treatmentNotes = String(req.body?.treatmentNotes || '').trim().slice(0, 5000)
            update.aftercareInstructions = String(req.body?.aftercareInstructions || '').trim().slice(0, 5000)
            if (req.body?.prescriptions !== undefined) {
              check(normalized(appointment.type) === 'consultation', 'Prescriptions can only be recorded for consultations.', 400)
              check(Array.isArray(req.body.prescriptions) && req.body.prescriptions.length <= 20, 'Enter up to 20 prescription items.', 400)
              update.prescriptions = req.body.prescriptions.map((item, index) => {
                check(item && typeof item === 'object' && !Array.isArray(item), `Prescription item ${index + 1} is invalid.`, 400)
                const field = value => String(value || '').trim()
                const name = field(item.name || item.medication || item.productName, 160)
                check(name, `Prescription item ${index + 1} needs a name.`, 400)
                const dosage = field(item.dosage || item.strength), frequency = field(item.frequency), duration = field(item.duration), instructions = field(item.instructions || item.notes)
                check(name.length <= 160 && dosage.length <= 160 && frequency.length <= 160 && duration.length <= 160 && instructions.length <= 500, `Prescription item ${index + 1} is too long.`, 400)
                return { name, dosage, frequency, duration, instructions }
              })
              update.prescriptionStatus = update.prescriptions.length ? 'pending' : 'none'
            }
            update.workerCompleted = true; update.workerCompletedAt = timestamp; update.workerCompletedById = req.user.uid
            update.status = walkIn ? 'Completed' : 'Awaiting Customer Confirmation'
          } else if (transition === 'end_online_window') {
            check(worker, 'Only the assigned worker can close this consultation window.', 403)
            const onlineConsultation = normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online'
            check(onlineConsultation && status === 'ongoing' && appointment.startedAt, 'Only an active online consultation can be closed by its time limit.')
            const window = getOnlineConsultationWindow(appointment)
            check(window && new Date() >= window.endsAt, 'The official consultation window has not ended yet.')
            update.workerCompleted = true; update.workerCompletedAt = timestamp; update.workerCompletedById = req.user.uid
            update.consultationWindowEndedAt = timestamp; update.consultationEndedByTimer = true
            update.consultationEndedAt = appointment.consultationEndedAt || window.endsAt.toISOString()
            update.consultationEndedById = appointment.consultationEndedById || req.user.uid
            const actualEnd = new Date(appointment.consultationEndedAt?.toDate?.() || appointment.consultationEndedAt || window.endsAt)
            update.consultationActualDurationSeconds = Math.max(0, Math.floor((actualEnd.getTime() - new Date(appointment.startedAt?.toDate?.() || appointment.startedAt).getTime()) / 1000))
            update.consultationNeedsReview = Boolean(appointment.consultationNeedsReview) || !appointment.clientJoinedAt || !appointment.practitionerJoinedAt || update.consultationActualDurationSeconds < 60
            if (!appointment.treatmentNotes) update.consultationNeedsReview = true
            update.status = appointment.consultationDispute?.status === 'Open' ? 'Consultation Review' : 'Awaiting Customer Confirmation'
          } else if (transition === 'customer_complete') {
            check(customer, 'Only the customer can confirm completion.', 403)
            check(appointment.workerCompleted && !appointment.customerCompleted && ['awaiting customer confirmation', 'balance due'].includes(status), 'The worker must finish the service first, and completion can only be confirmed once.')
            check(!online || appointment.consultationDispute?.status !== 'Open', 'The clinic must review your reported problem before completion.')
            if (online) {
              check(String(appointment.treatmentNotes || '').trim().length >= 10, 'The practitioner must save consultation notes before completion can be confirmed.')
              check(!(appointment.treatmentTeam || []).some(member => !member.participationConfirmed), 'The treatment team must confirm participation before completion can be confirmed.')
            }
            update.customerCompleted = true; update.customerCompletedAt = timestamp
            update.status = balanceSettled(appointment) ? 'Completed' : 'Balance Due'
          } else check(false, 'Invalid booking action.', 400)
        }
        if (update.status === 'Completed' || (req.body?.action === 'customer_complete' && update.status === 'Balance Due')) {
          if (update.status === 'Completed') update.completedAt = timestamp
          const totalSessions = Number(appointment.treatmentPlan?.totalSessions || 1)
          if (totalSessions > 1) {
            const sessionNumber = Number(appointment.sessionNumber || 1)
            tx.set(db.collection('treatmentSessions').doc(`${planId}-${sessionNumber}`), {
              branchId: appointment.branchId, treatmentPlanAppointmentId: planId, customerId: appointment.customerId,
              practitionerId: appointment.practitionerId || appointment.assignedPractitionerId || '', sessionNumber, totalSessions,
              appointmentId: ref.id, status: 'Completed', completedById: req.user.uid, completedAt: timestamp, updatedAt: timestamp,
            }, { merge: true })
            tx.set(db.collection('treatmentSessionAudit').doc(), {
              sessionId: `${planId}-${sessionNumber}`, treatmentPlanAppointmentId: planId, branchId: appointment.branchId,
              action: 'completed', previousStatus: appointment.status || '', nextStatus: 'Completed', actorId: req.user.uid,
              actorName: req.user.email || '', createdAt: timestamp,
            })
            update.treatmentPlan = { ...(plan.treatmentPlan || {}), totalSessions, completedSessions: Math.min(totalSessions, Number(plan.treatmentPlan?.completedSessions || 0) + 1), remainingSessions: Math.max(0, totalSessions - Number(plan.treatmentPlan?.forfeitedSessions || 0) - Math.min(totalSessions, Number(plan.treatmentPlan?.completedSessions || 0) + 1)), schedulingMode: 'clinic-scheduled' }
            if (planId !== ref.id) tx.update(planRef, { treatmentPlan: update.treatmentPlan, updatedAt: timestamp })
            if (sessionNumber < totalSessions) {
              const nextDate = new Date(`${appointment.date}T12:00:00Z`)
              nextDate.setUTCDate(nextDate.getUTCDate() + Math.max(1, Number(plan.treatmentPlan?.sessions?.[sessionNumber - 1]?.sessionIntervalDays || plan.treatmentPlan?.sessionIntervalDays || 1)))
              tx.set(db.collection('treatmentSessions').doc(`${planId}-${sessionNumber + 1}`), { earliestScheduleDate: nextDate.toISOString().slice(0, 10), updatedAt: timestamp }, { merge: true })
            }
            if (sessionNumber < totalSessions) tx.set(db.collection('notifications').doc(), { recipientUserId: appointment.customerId, branchId: appointment.branchId, title: 'Next treatment session ready to schedule', message: `Session ${sessionNumber + 1} is ready for the clinic to schedule.`, link: '/customer/appointments', read: false, deleted: false, createdAt: timestamp })
          }
        }
        tx.update(ref, update)
        if (update.status === 'Completed' && sharedParentRef && siblings.every(sibling => sibling && ['completed', 'cancelled', 'rejected', 'no-show', 'forfeited'].includes(normalized(sibling.status)))) {
          tx.update(sharedParentRef, { status: 'Completed', completedAt: timestamp, updatedAt: timestamp })
          if (sharedParent?.bookingId) tx.set(db.collection('bookings').doc(sharedParent.bookingId), { status: 'Completed', updatedAt: timestamp }, { merge: true })
        }
        tx.set(db.collection('appointmentAudit').doc(), { appointmentId: ref.id, branchId: appointment.branchId, actorId: req.user.uid, action: action === 'transition' ? req.body?.action : action, previousStatus: appointment.status, nextStatus: update.status, createdAt: timestamp })
        if (appointment.bookingId && !appointment.isGroupRecipient && !appointment.bookingOrderId && !appointment.treatmentPlanAppointmentId) tx.set(db.collection('bookings').doc(appointment.bookingId), { status: update.status, updatedAt: timestamp }, { merge: true })
        const recipientUserId = customer ? appointment.practitionerId || appointment.assignedPractitionerId : appointment.customerId
        if (recipientUserId && !walkIn) tx.set(db.collection('notifications').doc(), { recipientUserId, title: 'Booking updated', message: `${appointment.service || 'Your booking'}: ${update.status}.`, link: customer ? '/clinical/appointments' : '/customer/appointments', read: false, deleted: false, createdAt: timestamp })
        return { appointmentId: ref.id, ...(update.consultationWindowEndAt ? { consultationWindowEndAt: update.consultationWindowEndAt, consultationWindowStartAt: update.consultationWindowStartAt } : {}), status: update.status, contract: update.contract || appointment.contract, ...(action === 'sign' ? { codeDelivery: { email: appointment.customerEmail, serviceKey: update.serviceKey, date: appointment.date, time: appointment.time } } : {}) }
      })
      if (result.codeDelivery) {
        await sendServiceCode(result.codeDelivery).catch(error => console.warn('Service code email failed:', error.message))
        delete result.codeDelivery
      }
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  run('/appointments/:id/transition', 'transition')
  run('/appointments/:id/verify-service-key', 'key')
  run('/appointments/:id/contract/sign', 'sign')
  run('/group-consents/:token/transition', 'transition', guestAuth)
}
