import crypto from 'node:crypto'
import { prepareBooking } from './bookingResources.js'
import { assertWorkflow as check, cents, normalized } from './bookingWorkflow.js'
import { buildBookingTermsDocument } from '../../shared/clientContract.js'

export const registerWalkInBookings = (app, { admin, requireAuth, authorizeClinicAction,
  assertClinicPlanFeature, getBookingRange, rangesOverlap, getApprovedLeaveForDate, getClinicPoliciesForBranch, sendBooking }) => {
  app.get('/walk-in/availability', requireAuth, async (req, res) => {
    try {
      const branchId = String(req.query?.branchId || '').trim()
      check(branchId, 'Select a branch.', 400)
      await authorizeClinicAction(req.user.uid, branchId, 'appointments:create')
      const db = admin.firestore()
      const [appointments, branch] = await Promise.all([
        db.collection('appointments').where('branchId', '==', branchId).get(),
        db.collection('clinics').doc(branchId).get()
      ])
      check(branch.exists, 'Branch not found.', 404)
      const { policy } = await getClinicPoliciesForBranch(db, branchId, branch.data())
      // Availability needs busy windows and recipient identities, never codes,
      // signatures, medical notes, or financial agreements.
      const fields = ['date', 'time', 'endTime', 'totalServiceDurationMinutes', 'durationMinutes',
        'practitionerId', 'assignedPractitionerId', 'clientId', 'customerId', 'customerEmail',
        'status', 'isGroupParent', 'isBookingOrderParent']
      res.json({ success: true, data: { policy, appointments: appointments.docs.map(snapshot => {
        const data = snapshot.data()
        return { id: snapshot.id, ...Object.fromEntries(fields.filter(field => data[field] !== undefined).map(field => [field, data[field]])),
          treatmentTeam: (data.treatmentTeam || []).map(member => ({ employeeId: member.employeeId })) }
      }) } })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  app.post('/walk-in/bookings', requireAuth, async (req, res) => {
    try {
      const { branchId, submissionId, appointments: rows } = req.body || {}
      const clientId = req.body?.clientId || req.body?.organizerClientId
      check(typeof clientId === 'string' && clientId.trim(), 'Select a walk-in client.', 400)
      check(!req.body.groupBooking, 'Group bookings are not available for walk-ins.', 400)
      check(typeof branchId === 'string' && branchId.trim(), 'Select a branch.', 400)
      await authorizeClinicAction(req.user.uid, branchId, 'appointments:create')
      await assertClinicPlanFeature(admin.firestore(), branchId, 'booking_availability')
      check(/^[a-zA-Z0-9-]{16,80}$/.test(String(submissionId || '')), 'A booking submission ID is required.', 400)
      check(Array.isArray(rows) && rows.length > 0 && rows.length <= 20, 'Schedule between one and twenty individual appointments.', 400)
      check(req.body.policyAcknowledged === true, 'Confirm the applicable policies with the client before creating appointments.', 422)
      const acceptance = req.body.bookingAcceptance || {}
      check(acceptance.accepted === true, 'The person arranging the booking must accept the booking terms.', 400)
      const signatureImage = String(acceptance.signatureImage || '')
      check(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signatureImage) && signatureImage.length <= 200000, 'Draw the booking arranger signature (PNG, up to 150 KB).', 400)
      const signatureBytes = Buffer.from(signatureImage.split(',')[1], 'base64')
      check(signatureBytes.length > 32 && signatureBytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid booking signature image.', 400)
      const bookingForSomeoneElse = req.body.bookingForSomeoneElse === true
      const booker = bookingForSomeoneElse ? {
        name: String(req.body.booker?.name || '').trim(),
        email: normalized(req.body.booker?.email || ''),
        phone: String(req.body.booker?.phone || '').trim(),
      } : null
      if (booker) {
        check(booker.name.length >= 2 && booker.name.length <= 150 && /^\+?[0-9 ()-]{7,25}$/.test(booker.phone), 'Enter the booking arranger name and valid contact number.', 400)
        check(!booker.email || (booker.email.length <= 254 && /^\S+@\S+\.\S+$/.test(booker.email)), 'Enter a valid booking arranger email.', 400)
      }
      const cleanRows = rows.map(row => {
        check(row && ['clientId', 'serviceId', 'practitionerId', 'date', 'time'].every(key => typeof row[key] === 'string' && row[key].trim()), 'Each appointment needs a client, service, practitioner, date, and time.', 400)
        return Object.fromEntries(['clientId', 'serviceId', 'practitionerId', 'date', 'time', 'notes'].map(key => [key, String(row[key] || '').trim().slice(0, key === 'notes' ? 2000 : 200)]))
      })
      check(rows.every(row => !row.groupBooking) && cleanRows.every(row => row.clientId === clientId), 'Walk-in bookings support one client only. Create a separate booking for each person.', 400)
      const db = admin.firestore()
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ branchId, clientId, cleanRows, bookingForSomeoneElse, booker, signatureImage })).digest('hex')
      const requestKey = crypto.createHash('sha256').update(`${req.user.uid}:${branchId}:${submissionId}`).digest('hex')
      const bookingRef = db.collection('bookings').doc(`walk-in-${requestKey}`)
      const parentRef = db.collection('appointments').doc()
      const childRefs = cleanRows.map(() => db.collection('appointments').doc())
      const result = await db.runTransaction(async tx => {
        const previous = await tx.get(bookingRef)
        if (previous.exists) {
          check(previous.data().submissionFingerprint === fingerprint, 'This submission was already used for different appointments. Start a new booking.', 409)
          const visits = await Promise.all(previous.data().appointmentIds.map(id => tx.get(db.collection('appointments').doc(id))))
          return { bookingId: bookingRef.id, alreadyCreated: true, appointments: visits.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })) }
        }
        const branchSnap = await tx.get(db.collection('clinics').doc(branchId))
        check(branchSnap.exists && !['inactive', 'archived', 'closed'].includes(normalized(branchSnap.data().status)), 'This branch is unavailable.')
        const snapshot = await tx.get(db.collection('clients').doc(clientId))
        check(snapshot.exists && snapshot.data().branchId === branchId && !['inactive', 'archived'].includes(normalized(snapshot.data().status)), 'Select an active client registered at this branch.', 403)
        const data = snapshot.data(), email = normalized(data.email)
        check(/^\S+@\S+\.\S+$/.test(email), 'The client needs a valid email address.', 400)
        const client = { customerId: clientId, clientId, customerName: data.fullName || (String(data.firstName || '') + ' ' + String(data.lastName || '')).trim(), customerEmail: email, customerPhone: data.phone || data.contactNumber || '' }
        const arranger = booker || { name: client.customerName, email: client.customerEmail, phone: client.customerPhone }
        const { policy } = await getClinicPoliciesForBranch(db, branchId, branchSnap.data())
        const bookingAgreement = {
          version: 1, status: 'signed', purpose: 'booking_payment_only',
          document: buildBookingTermsDocument(policy, { source: 'walk_in', branch: branchSnap.data() }),
          appointments: [],
          signer: { ...arranger, signatureImage, accepted: true, witnessedBy: req.user.uid, signedAt: new Date().toISOString() },
        }
        const dayIdentities = new Set(), prepared = []
        for (const row of cleanRows) {
          for (const identity of [client.customerId, client.customerEmail]) {
            const key = `${identity}:${row.date}`
            check(!dayIdentities.has(key), 'Each person needs a different date for every service.', 409)
            dayIdentities.add(key)
          }
          check(!await getApprovedLeaveForDate(row.practitionerId, row.date), 'A selected practitioner is on approved leave.', 409)
          const reservation = { ...row, ...client, branchId, selectedServiceIds: [row.serviceId], source: 'walk_in', policyAcknowledged: true, groupBooking: null }
          const visit = await prepareBooking({ tx, db, reservation, getBookingRange, rangesOverlap })
          check(!(String(visit.data.type).toLowerCase() === 'consultation' && String(visit.data.consultationMode).toLowerCase() === 'online'), 'Online consultations must be booked through the customer account so the recipient can verify their code and join the call.', 409)
          const worker = (await tx.get(db.collection('users').doc(row.practitionerId))).data() || {}
          const range = getBookingRange({ ...reservation, ...visit.data })
          for (const other of prepared) {
            if (other.reservation.date !== row.date) continue
            const otherRange = getBookingRange({ ...other.reservation, ...other.visit.data })
            const overlaps = rangesOverlap(range.start, range.end, otherRange.start, otherRange.end)
            check(!overlaps || other.reservation.practitionerId !== row.practitionerId, 'Two appointments in this booking overlap for the same practitioner.', 409)
          }
          prepared.push({ reservation, visit, worker })
        }
        // Each preparation checks existing bookings. Check the unwritten batch's
        // combined materials and simultaneous equipment demands as well.
        const existingSnap = await tx.get(db.collection('appointments').where('branchId', '==', branchId))
        const existing = existingSnap.docs.map(snapshot => snapshot.data()).filter(row => !row.isGroupParent && !row.isBookingOrderParent && !['cancelled', 'rejected', 'completed', 'expired', 'no-show', 'incomplete', 'forfeited'].includes(normalized(row.status)))
        const resourceIds = new Set(prepared.flatMap(({ visit }) => (visit.data.resources || []).map(resource => resource.id)))
        for (const id of resourceIds) {
          const stock = (await tx.get(db.collection('inventoryItems').doc(id))).data()
          const material = prepared.reduce((sum, { visit }) => sum + (visit.data.resources || []).filter(resource => resource.id === id && resource.kind === 'material').reduce((total, resource) => total + resource.quantity, 0), 0)
          if (material) {
            const reserved = existing.reduce((sum, row) => sum + (row.materialsConsumed ? 0 : (row.resources || []).filter(resource => resource.id === id && resource.kind === 'material').reduce((total, resource) => total + resource.quantity, 0)), 0)
            check(stock && Number(stock.currentStock) >= material + reserved, 'There are not enough materials for all selected appointments.')
          }
          const equipmentVisits = prepared.filter(({ visit }) => (visit.data.resources || []).some(resource => resource.id === id && resource.kind === 'equipment'))
          // Sweep each appointment start: simultaneous use reaches its maximum
          // at a start boundary, including an existing appointment's start.
          const equipmentRows = [...equipmentVisits.map(({ reservation, visit }) => ({ ...reservation, ...visit.data })), ...existing].filter(row => (row.resources || []).some(resource => resource.id === id && resource.kind === 'equipment'))
          for (const row of equipmentRows) {
            const range = getBookingRange(row)
            if (!range || !equipmentVisits.some(visit => visit.reservation.date === row.date)) continue
            const used = equipmentRows.filter(other => other.date === row.date && (() => { const otherRange = getBookingRange(other); return otherRange && otherRange.start <= range.start && range.start < otherRange.end })()).reduce((sum, other) => sum + other.resources.filter(resource => resource.id === id && resource.kind === 'equipment').reduce((total, resource) => total + resource.quantity, 0), 0)
            check(stock && Number(stock.currentStock) >= used, 'Required equipment cannot cover the selected appointment times.')
          }
        }
        const now = admin.firestore.FieldValue.serverTimestamp()
        bookingAgreement.appointments = prepared.map(({ reservation, visit }) => ({ serviceId: reservation.serviceId, service: visit.data.service || reservation.serviceId, date: reservation.date, time: reservation.time, amount: visit.data.totalAmount ?? visit.data.amount }))
        const appointments = prepared.map(({ reservation, visit, worker }, index) => ({
          ...reservation, ...visit.data, bookingId: bookingRef.id,
          clientName: reservation.customerName, practitionerName: worker.fullName || `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || worker.email || '',
          assignedPractitionerId: reservation.practitionerId,
          bookingForSomeoneElse, bookedByName: arranger.name, bookedByEmail: arranger.email, bookedByPhone: arranger.phone,
          bookingAgreement, bookingAgreementRequired: true,
          approvalStatus: 'Approved', status: 'Unpaid', paymentStatus: 'Pending', amountPaid: 0,
          installmentsAllowed: false, depositPercent: 100, serviceKey: null,
          workerKeyVerified: false, customerKeyVerified: false, workerCompleted: false, customerCompleted: false,
          paymentManagedByOrganizer: false, approvedBy: req.user.uid, approvedAt: now,
          createdBy: req.user.uid, createdAt: now, updatedAt: now, policyAcknowledgedAt: now,
          ...(cleanRows.length > 1 ? { parentAppointmentId: parentRef.id, bookingOrderId: bookingRef.id } : {}),
        }))
        const total = appointments.reduce((sum, row) => sum + cents(row.totalAmount), 0) / 100
        appointments.forEach((appointment, index) => {
          tx.set(childRefs[index], appointment)
          const count = appointment.treatmentPlan.totalSessions
          if (count > 1) for (let number = 1; number <= count; number++) tx.set(db.collection('treatmentSessions').doc(`${childRefs[index].id}-${number}`), {
            branchId, treatmentPlanAppointmentId: childRefs[index].id, customerId: appointment.customerId, customerName: appointment.customerName,
            practitionerId: number === 1 ? appointment.practitionerId : '', sessionNumber: number, totalSessions: count,
            status: number === 1 ? 'Scheduled' : 'Unscheduled', appointmentId: number === 1 ? childRefs[index].id : '',
            ...(number === 1 ? { date: appointment.date, time: appointment.time } : {}),
            sessionIntervalDays: appointment.treatmentPlan.sessionIntervalDays || 1, createdAt: now, updatedAt: now
          })
          tx.set(prepared[index].visit.lock, { updatedAt: now })
          for (const lock of prepared[index].visit.customerLocks || []) tx.set(lock, { updatedAt: now })
        })
        const ids = childRefs.map(ref => ref.id)
        const summary = { ...client, clientName: client.customerName, branchId, source: 'walk_in', bookingWorkflowVersion: 2,
          bookingId: bookingRef.id, bookingOrderId: bookingRef.id, bookingForSomeoneElse,
          bookedByName: arranger.name, bookedByEmail: arranger.email, bookedByPhone: arranger.phone, bookingAgreement,
          service: `Walk-in services (${ids.length} appointments)`,
          date: cleanRows.map(row => row.date).sort()[0], time: '', practitionerId: '', totalServiceDurationMinutes: 0, resources: [],
          amount: total, totalAmount: total, amountPaid: 0, status: 'Unpaid', approvalStatus: 'Approved', paymentStatus: 'Pending',
          appointmentIds: ids, paymentManagedByOrganizer: false, createdBy: req.user.uid, createdAt: now, updatedAt: now,
          isBookingOrderParent: true }
        if (ids.length > 1) tx.set(parentRef, summary)
        tx.set(bookingRef, { ...summary, appointmentId: ids.length > 1 ? parentRef.id : ids[0], submissionFingerprint: fingerprint })
        return { bookingId: bookingRef.id, appointments: appointments.map((appointment, index) => ({ id: ids[index], ...appointment })) }
      })
      if (!result.alreadyCreated && sendBooking) await Promise.all(result.appointments.map(async appointment => {
        try { await sendBooking(appointment) } catch (error) { console.warn('Walk-in booking email failed:', error.message) }
      }))
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
