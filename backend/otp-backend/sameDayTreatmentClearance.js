import { assertWorkflow as check, normalized } from './bookingWorkflow.js'

const clockMinutes = value => /^\d{2}:\d{2}$/.test(String(value || '')) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN

export const registerSameDayTreatmentClearance = (app, { admin, requireAuth }) => {
  app.post('/appointments/:id/same-day-treatment-clearance', requireAuth, async (req, res) => {
    try {
      const db = admin.firestore()
      const appointmentId = String(req.params.id || '').trim()
      const decision = String(req.body?.decision || '').trim().toLowerCase()
      const note = String(req.body?.note || '').trim().slice(0, 500)
      check(appointmentId && ['clear', 'do_not_clear'].includes(decision), 'Choose whether to clear the treatment for today.', 400)
      if (decision === 'do_not_clear') check(note.length >= 10, 'Add a short reason before declining treatment for today.', 400)

      const result = await db.runTransaction(async tx => {
        const selectedRef = db.collection('appointments').doc(appointmentId)
        const selectedSnap = await tx.get(selectedRef)
        check(selectedSnap.exists, 'Appointment not found.', 404)
        const selected = selectedSnap.data() || {}
        const consultationId = String(selected.sameDayConsultationAppointmentId || (selected.type === 'Consultation' ? selectedSnap.id : '')).trim()
        const treatmentId = String(selected.sameDayTreatmentAppointmentId || (selected.type === 'Service' ? selectedSnap.id : '')).trim()
        check(consultationId && treatmentId && selected.sameDayBookingId, 'This appointment is not part of a same-day consultation request.', 409)
        const consultationRef = db.collection('appointments').doc(consultationId)
        const treatmentRef = db.collection('appointments').doc(treatmentId)
        const [consultationSnap, treatmentSnap] = await Promise.all([tx.get(consultationRef), tx.get(treatmentRef)])
        check(consultationSnap.exists && treatmentSnap.exists, 'A linked same-day appointment is missing.', 409)
        const consultation = consultationSnap.data() || {}, treatment = treatmentSnap.data() || {}
        const uid = String(req.user.uid || '')
        const assignedPractitionerId = String(consultation.assignedPractitionerId || consultation.practitionerId || '')
        check(assignedPractitionerId === uid && String(treatment.assignedPractitionerId || treatment.practitionerId || '') === uid, 'Only the practitioner assigned to both appointments can decide same-day treatment clearance.', 403)
        check(consultation.sameDayBookingId === treatment.sameDayBookingId && consultation.sameDayBookingId === selected.sameDayBookingId
          && consultation.sameDayTreatmentAppointmentId === treatmentSnap.id && treatment.sameDayConsultationAppointmentId === consultationSnap.id,
        'The consultation and treatment links do not match.', 409)
        check(consultation.branchId === treatment.branchId && /^\d{4}-\d{2}-\d{2}$/.test(String(treatment.date || '')) && consultation.date === treatment.date, 'The linked appointments must be for the same branch and clinic date.', 409)
        check(normalized(consultation.type) === 'consultation' && normalized(consultation.consultationMode).replace(/[\s_]+/g, '-') === 'on-site', 'Same-day clearance requires the linked on-site consultation.', 409)
        check(normalized(consultation.status) !== 'cancellation requested', 'The consultation has a pending cancellation request. Resolve that request before deciding on treatment.', 409)
        check(Number.isFinite(clockMinutes(consultation.time)) && Number.isFinite(clockMinutes(treatment.time))
          && clockMinutes(consultation.time) < clockMinutes(treatment.time)
          && clockMinutes(consultation.sameDayConsultationEndTime || consultation.endTime) <= clockMinutes(treatment.time),
        'The provisional treatment must follow the on-site consultation on the same day.', 409)
        check(consultation.workerCompleted === true && !['cancelled', 'rejected', 'incomplete', 'no-show'].includes(normalized(consultation.status)), 'Complete the consultation before deciding whether treatment can proceed today.', 409)
        check(normalized(treatment.type) === 'service' && treatment.approvalStatus === 'Approved' && treatment.sameDayTreatmentStatus === 'pending_clinical_clearance', 'This treatment is no longer awaiting clinical clearance.', 409)

        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const clear = decision === 'clear'
        const update = clear ? {
          sameDayTreatmentStatus: 'cleared', sameDayTreatmentClearedAt: timestamp, sameDayTreatmentClearedById: uid,
          sameDayTreatmentClearanceNote: note, status: treatment.source === 'walk_in' ? 'Unpaid' : 'Contract Pending', paymentStatus: 'Pending', updatedAt: timestamp,
        } : {
          sameDayTreatmentStatus: 'not_cleared', sameDayTreatmentClearedAt: timestamp, sameDayTreatmentClearedById: uid,
          sameDayTreatmentClearanceNote: note, status: 'Cancelled', paymentStatus: 'Not Applicable', updatedAt: timestamp,
        }
        tx.update(treatmentRef, update)
        tx.update(consultationRef, { sameDayTreatmentStatus: update.sameDayTreatmentStatus, sameDayTreatmentClearedAt: timestamp, sameDayTreatmentClearedById: uid, sameDayTreatmentClearanceNote: note, updatedAt: timestamp })
        const totalSessions = Math.max(1, Number(treatment.treatmentPlan?.totalSessions || 1))
        if (clear && totalSessions > 1) for (let number = 1; number <= totalSessions; number++) tx.set(db.collection('treatmentSessions').doc(`${treatmentSnap.id}-${number}`), {
          branchId: treatment.branchId, treatmentPlanAppointmentId: treatmentSnap.id,
          customerId: treatment.customerId || '', customerName: treatment.customerName || '',
          practitionerId: number === 1 ? treatment.practitionerId || treatment.assignedPractitionerId || '' : '',
          sessionNumber: number, totalSessions, status: number === 1 ? 'Scheduled' : 'Unscheduled',
          appointmentId: number === 1 ? treatmentSnap.id : '',
          ...(number === 1 ? { date: treatment.date, time: treatment.time } : {}),
          sessionIntervalDays: treatment.treatmentPlan?.sessionIntervalDays || 1, createdAt: timestamp, updatedAt: timestamp,
        }, { merge: true })
        tx.set(db.collection('appointmentAudit').doc(), {
          appointmentId: treatmentSnap.id, branchId: treatment.branchId, action: clear ? 'same_day_treatment_cleared' : 'same_day_treatment_not_cleared',
          actorId: uid, previousStatus: treatment.status, nextStatus: update.status, note, createdAt: timestamp,
        })
        if (treatment.customerId && treatment.source !== 'walk_in') tx.set(db.collection('notifications').doc(), {
          recipientUserId: treatment.customerId,
          title: clear ? 'Treatment cleared to proceed today' : 'Treatment not cleared for today',
          message: clear
            ? 'Your practitioner cleared the treatment after your consultation. Review and sign the treatment agreement, then complete payment before check-in.'
            : `Your practitioner did not clear the treatment for today. The provisional treatment slot was released.${note ? ` Note: ${note}` : ''}`,
          link: '/customer/appointments', read: false, deleted: false, createdAt: timestamp,
        })
        return { appointmentId: treatmentSnap.id, sameDayTreatmentStatus: update.sameDayTreatmentStatus, status: update.status }
      })
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
