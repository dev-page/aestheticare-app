import { assertWorkflow as check, normalized, resourceConflict } from './bookingWorkflow.js'

export const prepareBooking = async ({ tx, db, reservation, getBookingRange, rangesOverlap, appointmentId = null }) => {
  const branchId = reservation.branchId
  const ids = [...new Set(reservation.selectedServiceIds || reservation.serviceIds || [])]
  check(ids.length > 0, 'Select a published service.', 400)
  const services = []
  for (const id of ids) {
    const snapshot = await tx.get(db.collection('productServicePosts').doc(String(id)))
    const service = snapshot.data()
    check(service && service.branchId === branchId && service.archived !== true && service.isPublished === true && service.financeStatus === 'approved' && service.status !== 'Archived', 'A selected service is unavailable.')
    check(normalized(service.postType) !== 'product', 'Select a service or consultation.', 400)
    services.push({ ...service, id: snapshot.id })
  }
  const requirements = new Map()
  for (const service of services) {
    for (const [field, kind] of [['requiredSupplyIds', 'material'], ['requiredEquipmentIds', 'equipment']]) {
      for (const id of service[field] || []) {
        const key = `${kind}:${id}`
        requirements.set(key, { id, kind, quantity: (requirements.get(key)?.quantity || 0) + 1 })
      }
    }
  }
  const resources = [...requirements.values()]
  check(new Set(resources.map((item) => item.id)).size === resources.length, 'A resource cannot be configured as both a consumable material and reusable equipment.')
  const inventory = []
  for (const resource of resources) {
    const snapshot = await tx.get(db.collection('inventoryItems').doc(resource.id))
    check(snapshot.exists && snapshot.data().branchId === branchId, 'A required resource is unavailable.')
    inventory.push({ ...snapshot.data(), id: snapshot.id })
  }
  const duration = services.reduce((sum, service) => sum + Math.max(1, Number(service.durationMinutes || 60)), 0)
  const totalSessions = Math.max(1, ...services.map((service) => Math.min(50, Math.max(1, Number(service.sessionCount || 1)))))
  const range = getBookingRange({ ...reservation, endTime: '', totalServiceDurationMinutes: duration })
  check(range, 'Choose a valid appointment time.', 400)
  const day = String(reservation.date || '')
  const dayDate = new Date(`${day}T00:00:00+08:00`)
  check(/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(dayDate.getTime()) && new Date(dayDate.getTime() + 8 * 3600000).toISOString().slice(0, 10) === day, 'Choose a valid booking date.', 400)
  check(dayDate.getTime() + range.start * 60000 > Date.now(), 'Choose a future booking date and time.')
  check(range.end <= 24 * 60, 'The service must finish within the selected day.')
  const workerId = reservation.practitionerId || reservation.assignedPractitionerId
  check(workerId, 'Select an available worker.', 400)
  const worker = await tx.get(db.collection('users').doc(workerId))
  check(worker.exists && worker.data().branchId === branchId && !['inactive', 'disabled', 'archived'].includes(normalized(worker.data().status)), 'The selected worker is unavailable.')
  const schedules = await tx.get(db.collection('users').doc(workerId).collection('schedules'))
  const calendarDay = new Date(day + 'T00:00:00Z')
  calendarDay.setUTCDate(calendarDay.getUTCDate() - (calendarDay.getUTCDay() + 6) % 7)
  const weekKey = calendarDay.toISOString().slice(0, 10)
  const entries = schedules.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
  const schedule = entries.find((entry) => (entry.weekStart || entry.id) === weekKey) || entries.find((entry) => entry.id === 'recurring' || entry.recurring || entry.type === 'recurring') || {}
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(dayDate)
  const assignment = schedule.assignments?.[weekday]
  const label = schedule.assignmentLabels?.[weekday] || assignment
  const shifts = await tx.get(db.collection('shifts').where('branchId', '==', branchId))
  const shift = shifts.docs.map((doc) => ({ ...doc.data(), id: doc.id })).find((item) => item.id === assignment || `${item.shiftType || 'Shift'} || ${item.start} - ${item.end}` === label)
  const [labelStart, labelEnd] = String(label || '').split('||').pop().trim().split(' - ')
  const shiftRange = shift ? getBookingRange({ time: shift.start, endTime: shift.end }) : labelStart && labelEnd ? getBookingRange({ time: labelStart, endTime: labelEnd }) : null
  check(shiftRange && range.start >= shiftRange.start && range.end <= shiftRange.end, 'The selected time is outside the worker’s assigned shift.')
  const lock = db.collection('bookingResourceLocks').doc(branchId)
  await tx.get(lock)
  const appointments = await tx.get(db.collection('appointments').where('branchId', '==', branchId))
  const active = appointments.docs.filter((doc) => doc.id !== appointmentId).map((doc) => doc.data()).filter((a) => !['cancelled', 'rejected', 'completed', 'expired'].includes(normalized(a.status)))
  const overlaps = (a) => {
    const existing = getBookingRange(a)
    return a.date === reservation.date && existing && rangesOverlap(range.start, range.end, existing.start, existing.end)
  }
  check(!active.some((a) => [a.practitionerId, a.assignedPractitionerId].includes(workerId) && overlaps(a)), 'The worker is already booked at this time.')
  const conflict = resourceConflict({ requirements: resources, inventory, appointments: active, overlaps })
  check(!conflict, conflict)
  const total = services.reduce((sum, service) => sum + Number(service.price || 0), 0)
  check(Number.isFinite(total) && total > 0, 'The clinic must set a valid price for every booked service.')
  const installmentsAllowed = services.every((service) => service.allowInstallments === true)
  const depositPercent = installmentsAllowed ? Math.max(...services.map((service) => Number(service.depositPercent || 50))) : 100
  check(depositPercent >= 1 && depositPercent <= 100, 'The clinic must configure a valid deposit percentage.')
  const terms = services.map((service) => `${service.title || service.name || 'Service'}\n${String(service.termsAndConditions || '').trim()}`).join('\n\n')
  check(services.every((service) => String(service.termsAndConditions || '').trim()), 'The clinic must publish contract terms for each selected service before it can be booked.')
  const endTime = `${String(Math.floor(range.end / 60)).padStart(2, '0')}:${String(range.end % 60).padStart(2, '0')}`
  return { lock, data: { bookingWorkflowVersion: 2, resources, endTime, selectedServices: services, serviceDetails: services, totalServiceDurationMinutes: duration, sessionNumber: 1, treatmentPlan: { totalSessions, completedSessions: 0, remainingSessions: totalSessions, schedulingMode: totalSessions > 1 ? 'clinic-scheduled' : 'single-visit' }, amount: total, totalAmount: total, installmentsAllowed, depositPercent, contractRequired: true, contract: { title: 'Service booking agreement', terms, status: 'pending', requiredSigners: [], signatures: {} } } }
}
