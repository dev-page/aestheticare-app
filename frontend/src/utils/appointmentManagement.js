const text = value => String(value || '').trim()
export const appointmentClientName = item => text(item.clientName || item.customerName || item.patientName || item.name) || 'Client not provided'
export const appointmentSource = item => ['walk_in', 'walk-in', 'walkin'].includes(text(item.source).toLowerCase()) ? 'Walk-in' : 'Online booking'
export const appointmentServiceType = item => {
  if (item.treatmentPlan?.packageId || text(item.type || item.postType).toLowerCase() === 'package') return 'Package'
  return text(item.type || item.postType).toLowerCase() === 'consultation' && text(item.consultationMode || 'online').toLowerCase() === 'online' ? 'Online Consultation' : 'Service'
}
export const appointmentServiceName = item => text(item.service || item.serviceName || item.packageName || item.consultationName)
  || (item.selectedServices || item.serviceDetails || []).map(service => text(service.title || service.serviceName || service.name)).filter(Boolean).join(', ') || 'Service not provided'
export const appointmentSessions = item => {
  const count = Number(item.treatmentPlan?.totalSessions || item.totalSessions || item.numberOfSessions || 1)
  return Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1
}
export const appointmentRecipients = (booking, records) => {
  if (!booking) return []
  if (booking.isGroupParent || booking.isGroupRecipient || booking.groupBookingId) {
    const groupId = booking.groupBookingId || booking.bookingId
    return records.filter(item => item.isGroupRecipient && ((groupId && item.groupBookingId === groupId) || item.parentAppointmentId === booking.id))
      .sort((a, b) => Number(a.groupRecipientIndex || 0) - Number(b.groupRecipientIndex || 0))
  }
  if (booking.isBookingOrderParent) return records.filter(item => !item.isBookingOrderParent && (item.parentAppointmentId === booking.id || (booking.bookingOrderId && item.bookingOrderId === booking.bookingOrderId)))
  return [booking]
}
export const appointmentBookingRows = records => {
  const parents = new Set(records.filter(item => item.isGroupParent || item.isBookingOrderParent).map(item => item.id))
  const groups = new Set(records.filter(item => item.isGroupParent).map(item => item.groupBookingId).filter(Boolean))
  const orders = new Set(records.filter(item => item.isBookingOrderParent).map(item => item.bookingOrderId).filter(Boolean))
  return records.filter(item => !((item.isGroupRecipient || (!item.isBookingOrderParent && item.bookingOrderId))
    && (parents.has(item.parentAppointmentId) || groups.has(item.groupBookingId) || orders.has(item.bookingOrderId))))
}
export const appointmentCheckInAllowed = item => !item.isGroupParent && !item.isBookingOrderParent
  && !item.workerKeyVerified && !item.checkedInAt && !item.startedAt
  && ['paid', 'scheduled', 'ready to start'].includes(text(item.status).toLowerCase())
  && text(item.contract?.status).toLowerCase() === 'signed' && Boolean(item.serviceKey)
