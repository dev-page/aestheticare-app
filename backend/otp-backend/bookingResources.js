import { onlinePolicy } from '../../shared/onlineConsultation.js'
import { assertWorkflow as check, normalized, resourceConflict } from './bookingWorkflow.js'
import crypto from 'node:crypto'
import { normalizeStaffing, appointmentStaffIds } from '../../shared/practitionerTeam.js'
import { buildClientContract, buildClientContractDocument } from '../../shared/clientContract.js'
import { hasCompletedOnlineConsultation } from '../../shared/consultationRequirements.js'

export const prepareBooking = async ({ tx, db, reservation, getBookingRange, rangesOverlap, appointmentId = null }) => {
  const branchId = reservation.branchId
  const ids = [...new Set(reservation.selectedServiceIds || reservation.serviceIds || [])]
  check(ids.length > 0, 'Select a published service.', 400)
  check(ids.length === 1, 'Each service requires its own appointment and a separate date. Schedule selected services individually.', 400)
  if (reservation.groupBooking) return prepareGroupBooking({ tx, db, reservation, getBookingRange, rangesOverlap, appointmentId })
  const services = []
  for (const id of ids) {
    const snapshot = await tx.get(db.collection('productServicePosts').doc(String(id)))
    const service = snapshot.data()
    check(service && service.branchId === branchId && service.archived !== true && service.isPublished === true && service.financeStatus === 'approved' && service.status !== 'Archived', 'A selected service is unavailable.')
    check(normalized(service.postType) !== 'product', 'Select a service or consultation.', 400)
    services.push({ ...service, id: snapshot.id })
  }
  const offer = services[0]
  const definitions = []
  let packageComponents = []
  let packageIncludesConsultation = false
  if (normalized(offer.postType) === 'package') {
    check(!reservation.groupBooking, 'Packages are individual treatment plans. Book group services separately.', 400)
    const components = []
    for (const id of offer.packageServiceIds || []) {
      const snapshot = await tx.get(db.collection('productServicePosts').doc(String(id))), component = snapshot.data()
      check(component && component.branchId === branchId && component.isPublished === true && component.financeStatus === 'approved' && component.archived !== true && ['service', 'consultation'].includes(normalized(component.postType)), 'A package component is unavailable.')
      components.push({ ...component, id: snapshot.id })
    }
    check(components.length > 0, 'This package has no services.', 400)
    packageComponents = components
    packageIncludesConsultation = components.some(component => normalized(component.postType) === 'consultation')
    for (let cycle = 0; cycle < Math.min(50, Math.max(1, Number(offer.sessionCount || 1))); cycle++) for (const component of components) {
      for (let visit = 0; visit < Math.min(50, Math.max(1, Number(component.sessionCount || 1))); visit++) definitions.push({ serviceId: component.id, serviceName: component.title || component.serviceName || component.consultationName, durationMinutes: Number(component.durationMinutes || 60), sessionIntervalDays: Math.max(1, Number(component.sessionIntervalDays || offer.sessionIntervalDays || 1)) })
    }
    check(definitions.length <= 50, 'Packages support at most 50 individual visits.', 400)
    services.splice(0, services.length, components[0])
  } else {
    for (let visit = 0; visit < Math.min(50, Math.max(1, Number(offer.sessionCount || 1))); visit++) definitions.push({ serviceId: offer.id, serviceName: offer.title || offer.serviceName || offer.consultationName, durationMinutes: Number(offer.durationMinutes || 60), sessionIntervalDays: Math.max(1, Number(offer.sessionIntervalDays || 1)) })
  }
  const consultationRequiredService = normalized(offer.postType) === 'package'
    ? packageComponents.find(component => component.requiresConsultationFirst === true)
    : services[0]
  if (consultationRequiredService?.requiresConsultationFirst === true && normalized(consultationRequiredService.postType) !== 'consultation' && !packageIncludesConsultation) {
    const customerId = reservation.customerId
    const consultations = await tx.get(db.collection('appointments').where('customerId', '==', customerId))
    check(hasCompletedOnlineConsultation(consultationRequiredService, consultations.docs.map(doc => doc.data()), branchId), 'Complete the linked online consultation before booking this service. Packages that include a consultation are exempt.', 422)
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
  const group = reservation.groupBooking && typeof reservation.groupBooking === 'object' ? reservation.groupBooking : null
  check(!group || !services.some(service => normalized(service.postType) === 'consultation'), 'Consultations are individual appointments. Group consultations are not available.', 400)
  const guests = Array.isArray(group?.guests) ? group.guests : []
  const attendeeCount = group ? guests.length + (group.organizerIncluded === true ? 1 : 0) : 1
  if (group) for (const resource of resources) if (resource.kind === 'material') resource.quantity *= attendeeCount
  const attendeeEmails = [...guests.map(guest => normalized(guest.email)), ...(group?.organizerIncluded ? [normalized(reservation.customerEmail)] : [])]
  check(new Set(attendeeEmails).size === attendeeEmails.length, 'Use a different email address for each group attendee.', 400)
  check(!group || (attendeeCount >= 1 && attendeeCount <= 11 && guests.every((guest) => String(guest?.name || '').trim() && /^\S+@\S+\.\S+$/.test(String(guest?.email || '').trim()))), 'Each group guest needs a full name and valid email address.', 400)
  const duration = services.reduce((sum, service) => sum + Math.max(1, Number(service.durationMinutes || 60)), 0) * attendeeCount
  const totalSessions = definitions.length
  // A combined booking observes the longest configured interval, so none of
  // its selected services is scheduled sooner than the clinic intends.
  const sessionIntervalDays = totalSessions > 1
    ? Math.max(0, ...services.map((service) => Math.min(365, Math.max(0, Number(service.sessionIntervalDays || 0)))))
    : 0
  const isOnline = normalized(services[0].postType) === 'consultation' && normalized(services[0].consultationMode || 'online') === 'online'
  const previous = isOnline && appointmentId ? (await tx.get(db.collection('appointments').doc(appointmentId))).data() : null
  const consultationPolicy = isOnline ? onlinePolicy(previous?.consultationPolicy || services[0].consultationPolicy) : null
  if (isOnline) check(Number.isInteger(duration) && duration >= 5 && duration <= 240, 'Online consultation duration must be between 5 and 240 minutes.', 400)
  const reservedDuration = duration + (consultationPolicy?.bufferMinutes || 0)
  const range = getBookingRange({ ...reservation, endTime: '', totalServiceDurationMinutes: reservedDuration })
  check(range, 'Choose a valid appointment time.', 400)
  const day = String(reservation.date || '')
  const dayDate = new Date(`${day}T00:00:00+08:00`)
  check(/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(dayDate.getTime()) && new Date(dayDate.getTime() + 8 * 3600000).toISOString().slice(0, 10) === day, 'Choose a valid booking date.', 400)
  check(dayDate.getTime() + range.start * 60000 > Date.now(), 'Choose a future booking date and time.')
  check(range.end <= 24 * 60, 'The service must finish within the selected day.')
  const workerId = reservation.practitionerId || reservation.assignedPractitionerId
  check(workerId, 'Select an available worker.', 400)
  const worker = await tx.get(db.collection('users').doc(workerId))
  check(worker.exists && [worker.data().branchId, ...(worker.data().branchIds || [])].includes(branchId) && !['inactive', 'disabled', 'archived'].includes(normalized(worker.data().status)), 'The selected worker is unavailable.')
  const workerData = worker.data()
  if (isOnline) {
    const connection = (await tx.get(db.collection('googlePractitionerConnections').doc(workerId))).data()
    check(connection?.active === true, 'This practitioner must connect their Google hosting account before accepting online consultation bookings.')
  }
  let practitioner = ['practitioner', 'doctor', 'therapist'].includes(normalized(workerData.role).replace(/[\s_-]+/g, '')) || [...(workerData.permissions || []), ...(workerData.effectivePermissions || [])].some(permission => ['appointments:update', 'consultations:view', 'consultations:create'].includes(permission))
  if (!practitioner) {
    const branch = (await tx.get(db.collection('clinics').doc(branchId))).data() || {}
    for (const id of [...new Set([...(workerData.customRoleIds || []), workerData.customRoleId].filter(Boolean))]) {
      const role = (await tx.get(db.collection('clinicRoles').doc(id))).data() || {}
      if (role.ownerId === branch.ownerId && (role.permissions || []).some(permission => ['consultations:view', 'consultations:create'].includes(permission))) practitioner = true
    }
  }
  check(practitioner, 'Select an eligible practitioner for this appointment.', 400)
  const staffingRequirements = normalizeStaffing(services[0].staffingRequirements)
  if (staffingRequirements.length) {
    const profile = (await tx.get(db.collection('practitionerProfiles').doc(workerId))).data()
    const lead = staffingRequirements.find(row => row.responsibility === 'lead')
    check(profile?.type === lead.type && profile.approvedServiceIds?.includes(services[0].id) && (!['Doctor', 'Registered Nurse'].includes(profile.type) || profile.credentialsVerified), 'Choose a credentialed lead practitioner approved for this service.')
  }
  const schedules = await tx.get(db.collection('users').doc(workerId).collection('schedules'))
  const calendarDay = new Date(day + 'T00:00:00Z')
  calendarDay.setUTCDate(calendarDay.getUTCDate() - (calendarDay.getUTCDay() + 6) % 7)
  const weekKey = calendarDay.toISOString().slice(0, 10)
  const entries = schedules.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
  const schedule = entries.find((entry) => (entry.weekStart || entry.id) === weekKey) || entries.find((entry) => entry.id === 'recurring' || entry.recurring || entry.type === 'recurring') || {}
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(dayDate)
  const directAvailability = schedule.availability?.[weekday]
  const assignment = schedule.assignments?.[weekday]
  const label = schedule.assignmentLabels?.[weekday] || assignment
  const shifts = await tx.get(db.collection('shifts').where('branchId', '==', branchId))
  const shift = shifts.docs.map((doc) => ({ ...doc.data(), id: doc.id })).find((item) => item.id === assignment || `${item.shiftType || 'Shift'} || ${item.start} - ${item.end}` === label)
  const [labelStart, labelEnd] = String(label || '').split('||').pop().trim().split(' - ')
  const shiftRange = directAvailability?.enabled !== false && directAvailability?.start && directAvailability?.end
    ? getBookingRange({ time: directAvailability.start, endTime: directAvailability.end })
    : shift ? getBookingRange({ time: shift.start, endTime: shift.end }) : labelStart && labelEnd ? getBookingRange({ time: labelStart, endTime: labelEnd }) : null
  check(shiftRange && range.start >= shiftRange.start && range.end <= shiftRange.end, 'The selected time is outside the worker’s assigned shift or published availability.')
  const lock = db.collection('bookingResourceLocks').doc(branchId)
  await tx.get(lock)
  const identities = [...guests.map(guest => normalized(guest.email)), ...(!group || group.organizerIncluded ? [reservation.customerId, normalized(reservation.customerEmail)] : [])].filter(Boolean)
  const customerLocks = [...new Set(identities)].map(identity => db.collection('bookingCustomerDayLocks').doc(crypto.createHash('sha256').update(`${identity}:${day}`).digest('hex')))
  for (const customerLock of customerLocks) await tx.get(customerLock)
  const appointments = await tx.get(db.collection('appointments').where('branchId', '==', branchId))
  const active = appointments.docs.filter((doc) => doc.id !== appointmentId).map((doc) => doc.data()).filter((a) => !a.isGroupParent && !a.isBookingOrderParent && !['cancelled', 'rejected', 'completed', 'expired', 'no-show', 'incomplete', 'forfeited'].includes(normalized(a.status)))
  const customerRows = reservation.customerId && (!group || group.organizerIncluded) ? await tx.get(db.collection('appointments').where('customerId', '==', reservation.customerId)) : { docs: [] }
  check(!customerRows.docs.some(doc => doc.id !== appointmentId && !doc.data().isGroupParent && !doc.data().isBookingOrderParent && doc.data().date === day && !['cancelled', 'rejected', 'expired'].includes(normalized(doc.data().status))), 'This customer already has a service on this date. Choose a separate date.', 409)
  if (reservation.customerEmail && (!group || group.organizerIncluded)) {
    const emailRows = await tx.get(db.collection('appointments').where('customerEmail', '==', normalized(reservation.customerEmail)))
    check(!emailRows.docs.some(doc => doc.id !== appointmentId && !doc.data().isGroupParent && !doc.data().isBookingOrderParent && doc.data().date === day && !['cancelled', 'rejected', 'expired'].includes(normalized(doc.data().status))), 'This attendee already has a service on this date. Choose another date.', 409)
  }
  for (const guest of guests) {
    const guestRows = await tx.get(db.collection('appointments').where('customerEmail', '==', normalized(guest.email)))
    check(!guestRows.docs.some(doc => doc.id !== appointmentId && doc.data().date === day && !doc.data().isGroupParent && !doc.data().isBookingOrderParent && !['cancelled', 'rejected', 'expired'].includes(normalized(doc.data().status))), 'A group attendee already has a service on this date. Choose another date.', 409)
  }
  const overlaps = (a) => {
    const existing = getBookingRange(a)
    return a.date === reservation.date && existing && rangesOverlap(range.start, range.end, existing.start, existing.end)
  }
  check(!active.some((a) => appointmentStaffIds(a).includes(workerId) && overlaps(a)), 'The worker is already booked at this time.')
  const conflict = resourceConflict({ requirements: resources, inventory, appointments: active, overlaps })
  check(!conflict, conflict)
  const total = Number(offer.price || 0) * attendeeCount
  check(Number.isFinite(total) && total > 0, 'The clinic must set a valid price for every booked service.')
  const installmentsAllowed = !group && offer.allowInstallments === true
  const depositPercent = installmentsAllowed ? Number(offer.depositPercent || 50) : 100
  check(depositPercent >= 1 && depositPercent <= 100, 'The clinic must configure a valid deposit percentage.')
  const contractBranch = (await tx.get(db.collection('clinics').doc(branchId))).data() || {}
  const contractOwnerId = String(contractBranch.ownerId || contractBranch.organizationOwnerId || '').trim()
  let contractPolicy = contractOwnerId ? (await tx.get(db.collection('clinicPolicies').doc(contractOwnerId))).data() : null
  if (!contractPolicy) contractPolicy = (await tx.get(db.collection('clinicPolicies').doc(branchId))).data() || {}
  const clinicContractConfigured = contractPolicy.clientContract?.configured === true
  const contractDocument = clinicContractConfigured ? buildClientContractDocument(contractPolicy, { branch: contractBranch, source: reservation.source || 'customer_booking_request', serviceName: offer.title || offer.serviceName || offer.packageName || offer.consultationName || 'Service', serviceTerms: offer.termsAndConditions }) : null
  let terms = clinicContractConfigured
    ? buildClientContract(contractPolicy, { branch: contractBranch, source: reservation.source || 'customer_booking_request', serviceName: offer.title || offer.serviceName || offer.packageName || offer.consultationName || 'Service', serviceTerms: offer.termsAndConditions })
    : `${offer.title || offer.name || 'Service'}\n${String(offer.termsAndConditions || '').trim()}`
  if (!clinicContractConfigured) {
    check(String(offer.termsAndConditions || '').trim(), 'Publish contract terms before booking.')
    check(services.every((service) => String(service.termsAndConditions || '').trim()), 'The clinic must publish contract terms for each selected service before it can be booked.')
  }
  if (isOnline) {
    const notice = `Online consultation: ${duration} minutes from the verified start. Join up to five minutes early. Arrival grace: ${consultationPolicy.graceMinutes} minutes. Late arrivals and connection failures require clinic review before penalties, rescheduling, or refunds. Report delivery problems within 48 hours of completion.`
    terms += '\n\n' + notice
    if (contractDocument) contractDocument.sections.push({ title: 'Online consultation timing and review', text: notice })
  }
  const endTime = `${String(Math.floor(range.end / 60)).padStart(2, '0')}:${String(range.end % 60).padStart(2, '0')}`
  return { lock, customerLocks, data: { bookingWorkflowVersion: 2, ...(isOnline ? { consultationPolicy, consultationDurationMinutes: duration } : {}), staffingRequirements, treatmentTeam: [], resources, endTime, selectedServices: services, serviceDetails: services, selectedServiceIds: ids, serviceIds: ids, service: `${offer.title || offer.serviceName || offer.packageName || offer.consultationName || 'Service'}${normalized(offer.postType) === 'package' ? ` — first visit: ${definitions[0].serviceName}` : ''}`, type: normalized(services[0].postType) === 'consultation' ? 'Consultation' : 'Service', consultationMode: normalized(services[0].postType) === 'consultation' ? services[0].consultationMode || 'online' : null, ...(normalized(services[0].postType) === 'consultation' ? { consultationForServiceIds: definitions.map(visit => visit.serviceId) } : {}), totalServiceDurationMinutes: duration, groupBooking: group ? { organizerId: String(group.organizerId || reservation.customerId || ''), organizerIncluded: group.organizerIncluded === true, participantCount: attendeeCount, guests: guests.map((guest) => ({ name: String(guest.name).trim(), email: String(guest.email).trim().toLowerCase(), phone: String(guest.phone || '').trim().slice(0, 32) })) } : null, sessionNumber: 1, treatmentPlan: { totalSessions, sessionIntervalDays, sessions: definitions, packageId: normalized(offer.postType) === 'package' ? offer.id : null, completedSessions: 0, remainingSessions: totalSessions, schedulingMode: totalSessions > 1 ? 'clinic-scheduled' : 'single-visit' }, amount: total, totalAmount: total, commissionPercent: 10, commissionAmount: Math.round(total * 10) / 100, merchantNetAmount: Math.round(total * 90) / 100, installmentsAllowed, depositPercent, contractRequired: true, contract: { title: 'Service booking agreement', terms, ...(contractDocument ? { document: contractDocument } : {}), status: 'pending', requiredSigners: [], signatures: {} } } }
}

const prepareGroupBooking = async ({ tx, db, reservation, getBookingRange, rangesOverlap, appointmentId }) => {
  const group = reservation.groupBooking, guests = group.guests || []
  check(Array.isArray(guests) && guests.length <= 10, 'A group can include up to ten guests.', 400)
  const attendees = [...(group.organizerIncluded ? [{ name: reservation.customerName, email: reservation.customerEmail, customerId: reservation.customerId, organizer: true }] : []), ...guests]
  check(attendees.length > 0 && attendees.every(person => String(person.name || '').trim() && /^\S+@\S+\.\S+$/.test(String(person.email || ''))), 'Each group guest needs a full name and valid email address.', 400)
  check(new Set(attendees.map(person => normalized(person.email))).size === attendees.length, 'Use a different email address for each group attendee.', 400)
  let start = getBookingRange({ time: reservation.time, totalServiceDurationMinutes: 1 })?.start
  check(Number.isFinite(start), 'Choose a valid appointment time.', 400)
  const visits = []
  for (const person of attendees) {
    const serviceId = person.serviceId || reservation.selectedServiceIds?.[0] || reservation.serviceIds?.[0]
    const offer = (await tx.get(db.collection('productServicePosts').doc(serviceId))).data()
    check(normalized(offer?.postType) === 'service', 'Group attendees need individual appointments for consultations and packages.', 400)
    const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`
    const visit = await prepareBooking({ tx, db, reservation: { ...reservation, groupBooking: null, selectedServiceIds: [serviceId], serviceIds: [serviceId], customerId: person.organizer ? reservation.customerId : `guest:${normalized(person.email)}`, customerName: person.name, customerEmail: normalized(person.email), time, endTime: '' }, getBookingRange, rangesOverlap, appointmentId })
    visits.push({ ...person, email: normalized(person.email), serviceId, time, data: visit.data, lock: visit.lock, customerLocks: visit.customerLocks })
    start += visit.data.totalServiceDurationMinutes
  }
  const resources = new Map()
  for (const visit of visits) for (const resource of visit.data.resources) {
    const key = `${resource.kind}:${resource.id}`, prior = resources.get(key)
    resources.set(key, { ...resource, quantity: resource.kind === 'material' ? Number(prior?.quantity || 0) + resource.quantity : Math.max(Number(prior?.quantity || 0), resource.quantity) })
  }
  const inventory = []
  for (const resource of resources.values()) inventory.push({ id: resource.id, ...(await tx.get(db.collection('inventoryItems').doc(resource.id))).data() })
  const appointments = (await tx.get(db.collection('appointments').where('branchId', '==', reservation.branchId))).docs.filter(doc => doc.id !== appointmentId).map(doc => doc.data()).filter(row => !row.isGroupParent && !row.isBookingOrderParent && !['cancelled', 'rejected', 'completed', 'expired', 'no-show', 'incomplete', 'forfeited'].includes(normalized(row.status)))
  const first = visits[0], duration = visits.reduce((sum, visit) => sum + visit.data.totalServiceDurationMinutes, 0)
  const groupRange = getBookingRange({ time: reservation.time, totalServiceDurationMinutes: duration })
  const conflict = resourceConflict({ requirements: [...resources.values()], inventory, appointments, overlaps: row => { const range = getBookingRange(row); return row.date === reservation.date && range && rangesOverlap(groupRange.start, groupRange.end, range.start, range.end) } })
  check(!conflict, conflict)
  const total = Math.round(visits.reduce((sum, visit) => sum + visit.data.totalAmount, 0) * 100) / 100
  return { lock: first.lock, customerLocks: [...new Map(visits.flatMap(visit => visit.customerLocks || []).map(lock => [lock.id, lock])).values()], data: { ...first.data, selectedServiceIds: reservation.selectedServiceIds || reservation.serviceIds, serviceIds: reservation.selectedServiceIds || reservation.serviceIds, resources: [...resources.values()], totalServiceDurationMinutes: duration, endTime: visits.at(-1).data.endTime, amount: total, totalAmount: total, commissionPercent: 10, commissionAmount: Math.round(total * 10) / 100, merchantNetAmount: Math.round(total * 90) / 100, installmentsAllowed: false, depositPercent: 100, groupBooking: { organizerId: reservation.customerId, organizerIncluded: group.organizerIncluded === true, participantCount: attendees.length, guests: guests.map(person => ({ name: String(person.name).trim(), email: normalized(person.email), phone: String(person.phone || '').trim().slice(0, 32), serviceId: person.serviceId || reservation.selectedServiceIds?.[0] })), recipientPlans: visits.map(({ data, time, serviceId }) => ({ data, time, serviceId })) } } }
}
