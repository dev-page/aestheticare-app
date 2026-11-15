import crypto from 'node:crypto'
import { assertWorkflow as check, normalized } from './bookingWorkflow.js'

export const registerClientDirectory = (app, { admin, requireAuth, authorizeClinicAction }) => {
  app.put('/clinic/clients/profile', requireAuth, async (req, res) => {
    try {
      const branchId = String(req.body?.branchId || '').trim()
      const clientRecordId = String(req.body?.clientRecordId || '').trim()
      const customerId = String(req.body?.customerId || '').trim()
      const sourceAppointmentId = String(req.body?.sourceAppointmentId || '').trim()
      const input = req.body?.profile || {}
      check(branchId && branchId.length <= 200 && !branchId.includes('/'), 'Select a valid clinic branch.', 400)
      check([clientRecordId, customerId, sourceAppointmentId].filter(Boolean).length === 1, 'Select one clinic client profile to update.', 400)
      check(clientRecordId.length <= 200 && !clientRecordId.includes('/') && customerId.length <= 200
        && sourceAppointmentId.length <= 200 && !sourceAppointmentId.includes('/'), 'Invalid client identity.', 400)
      await authorizeClinicAction(req.user.uid, branchId, 'clients:update')

      const firstName = String(input.firstName || '').trim().replace(/\s+/g, ' ')
      const middleName = String(input.middleName || '').trim().replace(/\s+/g, ' ')
      const lastName = String(input.lastName || '').trim().replace(/\s+/g, ' ')
      const suffix = String(input.suffix || '').trim().replace(/\s+/g, ' ')
      const email = normalized(input.email || '')
      const phone = String(input.phone || '').trim()
      check(firstName && lastName && firstName.length <= 100 && middleName.length <= 100 && lastName.length <= 100 && suffix.length <= 20,
        'Enter a first and last name. Middle name and suffix are optional.', 400)
      check(email.length <= 254 && /^\S+@\S+\.\S+$/.test(email), 'Enter a valid email address.', 400)
      check(phone.length <= 32 && (!phone || /^\+?[0-9 ()-]{7,32}$/.test(phone)), 'Enter a valid phone number.', 400)

      const fullNameBase = [firstName, middleName, lastName].filter(Boolean).join(' ')
      const fullName = suffix ? `${fullNameBase}, ${suffix}` : fullNameBase
      const db = admin.firestore()
      const result = await db.runTransaction(async tx => {
        const branchSnap = await tx.get(db.collection('clinics').doc(branchId))
        check(branchSnap.exists && !['inactive', 'archived', 'closed'].includes(normalized(branchSnap.data()?.status)), 'This branch is unavailable.', 404)

        let profileRef
        let existing = null
        let linkedCustomerId = customerId
        let linkedClientId = ''
        let linkedAppointmentId = sourceAppointmentId
        if (clientRecordId) {
          profileRef = db.collection('clients').doc(clientRecordId)
          const profileSnap = await tx.get(profileRef)
          check(profileSnap.exists && profileSnap.data()?.branchId === branchId, 'This client profile is not part of the selected branch.', 404)
          existing = profileSnap.data()
          linkedCustomerId = String(existing?.customerId || '')
          linkedClientId = clientRecordId
          linkedAppointmentId = String(existing?.sourceAppointmentId || '')
        } else {
          // Appointment-derived people do not have a directory document yet.
          // Confirm the identity has actually had an appointment at this branch
          // before creating the clinic-only editable profile.
          let appointmentData = null
          if (sourceAppointmentId) {
            const appointmentSnap = await tx.get(db.collection('appointments').doc(sourceAppointmentId))
            appointmentData = appointmentSnap.exists ? appointmentSnap.data() || null : null
            check(appointmentData?.branchId === branchId && !appointmentData.isGroupParent && !appointmentData.isBookingOrderParent,
              'This appointment is not part of the selected branch.', 404)
            linkedCustomerId = String(appointmentData.customerId || '')
            linkedClientId = String(appointmentData.clientId || '')
          } else {
            const appointmentsSnap = await tx.get(db.collection('appointments').where('customerId', '==', customerId))
            const appointment = appointmentsSnap.docs.find(snapshot => {
              const row = snapshot.data() || {}
              return row.branchId === branchId && !row.isGroupParent && !row.isBookingOrderParent
            })
            check(appointment, 'This person has no appointment record in the selected branch.', 404)
            linkedAppointmentId = appointment.id
            appointmentData = appointment.data() || {}
            linkedCustomerId = String(appointmentData.customerId || customerId)
            linkedClientId = String(appointmentData.clientId || '')
          }

          let matchingProfile = null
          if (linkedCustomerId) {
            const existingProfiles = await tx.get(db.collection('clients').where('customerId', '==', linkedCustomerId))
            matchingProfile = existingProfiles.docs.find(snapshot => snapshot.data()?.branchId === branchId) || null
          } else if (linkedClientId) {
            const legacyProfile = await tx.get(db.collection('clients').doc(linkedClientId))
            if (legacyProfile.exists && legacyProfile.data()?.branchId === branchId) matchingProfile = legacyProfile
          }
          if (!matchingProfile && (linkedAppointmentId || sourceAppointmentId)) {
            const appointmentProfiles = await tx.get(db.collection('clients').where('sourceAppointmentId', '==', linkedAppointmentId || sourceAppointmentId))
            matchingProfile = appointmentProfiles.docs.find(snapshot => snapshot.data()?.branchId === branchId) || null
          }
          if (matchingProfile) {
            profileRef = matchingProfile.ref
            existing = matchingProfile.data()
          } else {
            const stableIdentity = linkedCustomerId || `${linkedClientId}:${linkedAppointmentId || sourceAppointmentId}`
            const id = `profile-${crypto.createHash('sha256').update(`${branchId}:${stableIdentity}`).digest('hex').slice(0, 40)}`
            profileRef = db.collection('clients').doc(id)
          }
        }

        const now = admin.firestore.FieldValue.serverTimestamp()
        const profile = {
          branchId,
          ...(linkedCustomerId ? { customerId: linkedCustomerId } : {}),
          ...(linkedClientId ? { clientId: linkedClientId } : {}),
          ...(linkedAppointmentId ? { sourceAppointmentId: linkedAppointmentId } : {}),
          fullName,
          firstName,
          middleName,
          lastName,
          suffix,
          email,
          phone,
          status: existing?.status || 'Active',
          ...(existing?.createdBy ? {} : { createdBy: req.user.uid }),
          ...(existing?.createdAt ? {} : { createdAt: now }),
          updatedBy: req.user.uid,
          updatedAt: now,
        }
        tx.set(profileRef, profile, { merge: true })
        return { id: profileRef.id, customerId: existing?.customerId || linkedCustomerId || '', ...profile }
      })

      res.json({ success: true, data: result })
    } catch (error) {
      res.status(error.status || 500).json({ success: false, error: error.message })
    }
  })
}
