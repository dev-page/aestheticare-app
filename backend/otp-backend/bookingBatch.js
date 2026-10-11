import { prepareBooking } from './bookingResources.js'
import { assertWorkflow as check, normalized } from './bookingWorkflow.js'

export const validateSchedules = rows => {
  check(Array.isArray(rows) && rows.length >= 1 && rows.length <= 10, 'Schedule between one and ten services.', 400)
  check(rows.every(row => Array.isArray(row.selectedServiceIds) && row.selectedServiceIds.length === 1 && !row.groupBooking), 'Each appointment must contain one service for one customer.', 400)
  check(new Set(rows.map(row => row.date)).size === rows.length, 'Choose a different date for every service.', 400)
  check(new Set(rows.map(row => row.branchId)).size === 1, 'Book services from one branch per checkout.', 400)
}

// Prepare every visit before writing anything: failure leaves no partial order.
export const registerBookingBatch = (app, { admin, requireAuth, getBookingRange, rangesOverlap, assertClinicPlanFeature, getClinicPoliciesForBranch, getApprovedLeaveForDate, getEffectiveClinicPlan = () => 'paid' }) => {
  app.post('/bookings/batch', requireAuth, async (req, res) => {
    try {
      const rows = req.body?.appointments
      validateSchedules(rows)
      const db = admin.firestore(), uid = req.user.uid
      const profile = (await db.collection('users').doc(uid).get()).data() || {}
      check(normalized(profile.role || profile.userType) === 'customer', 'Customer access is required.', 403)
      check(!['inactive', 'disabled', 'archived', 'closed'].includes(normalized(profile.status)), 'This customer account is unavailable.', 403)
      const branchId = String(rows[0].branchId || '')
      await assertClinicPlanFeature(db, branchId, 'booking_availability')
      const orderRef = db.collection('bookings').doc(), parentRef = db.collection('appointments').doc()
      const refs = rows.map(() => db.collection('appointments').doc())
      const result = await db.runTransaction(async tx => {
        const branchSnap = await tx.get(db.collection('clinics').doc(branchId)), branch = branchSnap.data() || {}
        check(branchSnap.exists && branch.isPublished === true && !['inactive', 'archived'].includes(normalized(branch.status)), 'This clinic is unavailable.')
        const directBooking = getEffectiveClinicPlan(branch) === 'free'
        const { policy } = await getClinicPoliciesForBranch(db, branchId, branch)
        const customer = { customerId: uid, customerName: profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || req.user.email, customerEmail: req.user.email || profile.email || '' }
        const prepared = []
        for (const row of rows) {
          check(row.policyAcknowledged === true || !Object.entries(policy || {}).some(([key, value]) => key.endsWith('Enabled') && value === true && policy[key.slice(0, -7)]), 'Please acknowledge the clinic policies.', 422)
          check(!await getApprovedLeaveForDate(row.practitionerId, row.date), 'A selected practitioner is on approved leave.')
          const reservation = { ...row, ...customer, groupBooking: null }
          const visit = await prepareBooking({ tx, db, reservation, getBookingRange, rangesOverlap })
          const worker = (await tx.get(db.collection('users').doc(row.practitionerId))).data() || {}
          const role = normalized(worker.role).replace(/[\s_-]+/g, '')
          const permissions = [...(worker.permissions || []), ...(worker.effectivePermissions || [])]
          let eligible = ['practitioner', 'doctor', 'therapist'].includes(role) || permissions.includes('consultations:create') || permissions.includes('consultations:view')
          for (const id of [...new Set([...(worker.customRoleIds || []), worker.customRoleId].filter(Boolean))]) {
            const custom = (await tx.get(db.collection('clinicRoles').doc(id))).data() || {}
            if (custom.ownerId === branch.ownerId && (custom.permissions || []).some(p => ['consultations:create', 'consultations:view'].includes(p))) eligible = true
          }
          check(eligible, 'Choose a practitioner assigned to this branch.', 400)
          const service = visit.data.selectedServices[0]
          if (service.requiresConsultationFirst === true) {
            const clearances = await tx.get(db.collection('consultationClearances').where('customerId', '==', uid))
            const consultations = await tx.get(db.collection('appointments').where('customerId', '==', uid))
            check(clearances.docs.some(doc => doc.data().branchId === branchId && doc.data().status === 'Approved' && (doc.data().serviceIds || []).includes(service.id)) || consultations.docs.some(doc => doc.data().branchId === branchId && doc.data().status === 'Completed' && (doc.data().consultationForServiceIds || []).includes(service.id)), 'A selected service requires consultation clearance.', 422)
          }
          prepared.push({ reservation, visit, worker, service })
        }
        // Consumables are reserved across dates; validate the whole unwritten
        // order as well as each visit so one unit cannot fund two appointments.
        const materialTotals = new Map()
        for (const { visit } of prepared) for (const resource of visit.data.resources || []) if (resource.kind === 'material') materialTotals.set(resource.id, Number(materialTotals.get(resource.id) || 0) + resource.quantity)
        const existing = (await tx.get(db.collection('appointments').where('branchId', '==', branchId))).docs.map(doc => doc.data()).filter(row => !row.isGroupParent && !row.isBookingOrderParent && !['cancelled', 'rejected', 'completed', 'expired', 'no-show', 'incomplete', 'forfeited'].includes(normalized(row.status)))
        for (const [id, quantity] of materialTotals) {
          const stock = (await tx.get(db.collection('inventoryItems').doc(id))).data()
          const reserved = existing.reduce((sum, row) => sum + (row.materialsConsumed ? 0 : (row.resources || []).filter(resource => resource.id === id && resource.kind === 'material').reduce((total, resource) => total + resource.quantity, 0)), 0)
          check(stock && Number(stock.currentStock) - reserved >= quantity, 'There are not enough materials for all the selected appointments.')
        }
        const now = admin.firestore.FieldValue.serverTimestamp()
        let total = 0
        prepared.forEach(({ reservation, visit, worker, service }, index) => {
          total += visit.data.totalAmount
          const name = service.title || service.serviceName || service.consultationName || 'Service'
          const data = { ...reservation, ...visit.data, bookingId: orderRef.id, bookingOrderId: orderRef.id, paymentManagedByOrganizer: true, parentAppointmentId: parentRef.id, service: name, services: [name], serviceIds: [service.id], type: normalized(service.postType) === 'consultation' ? 'Consultation' : 'Service', consultationMode: service.consultationMode || null, practitionerName: worker.fullName || `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || worker.email, assignedPractitionerId: reservation.practitionerId, approvalStatus: 'Pending', status: 'Pending Approval', amountPaid: 0, paymentStatus: 'Pending', serviceKey: null, workerKeyVerified: false, workerCompleted: false, customerCompleted: false, createdAt: now, updatedAt: now }
          tx.set(refs[index], data)
          if (directBooking) {
            tx.update(refs[index], { approvalStatus: 'Approved', status: 'Awaiting Payment' })
            const count = Number(data.treatmentPlan?.totalSessions || 1)
            if (count > 1) for (let number = 1; number <= count; number++) tx.set(db.collection('treatmentSessions').doc(`${refs[index].id}-${number}`), { branchId, treatmentPlanAppointmentId: refs[index].id, customerId: uid, customerName: customer.customerName, practitionerId: data.practitionerId, sessionNumber: number, totalSessions: count, status: number === 1 ? 'Scheduled' : 'Unscheduled', appointmentId: number === 1 ? refs[index].id : '', ...(number === 1 ? { date: data.date, time: data.time } : {}), sessionIntervalDays: data.treatmentPlan?.sessionIntervalDays || 1, createdAt: now, updatedAt: now }, { merge: true })
          }
          tx.set(visit.lock, { updatedAt: now })
          for (const lock of visit.customerLocks || []) tx.set(lock, { updatedAt: now })
        })
        const parent = { ...customer, branchId, bookingId: orderRef.id, bookingOrderId: orderRef.id, bookingWorkflowVersion: 2, isBookingOrderParent: true, service: `Service bookings (${rows.length} appointments)`, services: prepared.map(p => p.service.title || p.service.serviceName || 'Service'), selectedServiceIds: [], date: rows[0].date, time: '', practitionerId: '', totalServiceDurationMinutes: 0, totalAmount: Math.round(total * 100) / 100, amount: Math.round(total * 100) / 100, amountPaid: 0, installmentsAllowed: false, depositPercent: 100, approvalStatus: 'Pending', status: 'Pending Approval', paymentStatus: 'Pending', contract: { status: 'signed', terms: 'Each appointment requires individual treatment consent before check-in.' }, appointmentIds: refs.map(ref => ref.id), createdAt: now, updatedAt: now }
        tx.set(parentRef, parent)
        tx.set(orderRef, { ...parent, appointmentId: parentRef.id })
        if (directBooking) {
          tx.update(parentRef, { approvalStatus: 'Approved', status: 'Awaiting Payment' })
          tx.update(orderRef, { approvalStatus: 'Approved', status: 'Awaiting Payment' })
        }
        tx.set(db.collection('notifications').doc(), { recipientUserId: uid, title: 'Booking requests submitted', message: 'Your services have separate appointment dates. The clinic will review them together.', link: '/customer/appointments', read: false, createdAt: now })
        return { bookingId: orderRef.id, appointmentId: parentRef.id, appointmentIds: refs.map(ref => ref.id) }
      })
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
