// Callers load these records for the actual customer, never another attendee.
export const hasConsultationRequirement = (service, appointments = [], clearances = [], branchId = service?.branchId) => {
  if (!service?.requiresConsultationFirst) return true
  if (clearances.some(record => record.branchId === branchId && record.status === 'Approved' && (record.serviceIds || []).includes(service.id))) return true
  return appointments.some(record => {
    if (record.branchId !== branchId || String(record.status || '').toLowerCase() !== 'completed' || String(record.type || '').toLowerCase() !== 'consultation') return false
    const consultationIds = [...(record.selectedServiceIds || []), ...(record.serviceIds || []), ...(record.selectedServices || []).map(item => item.id)]
    // Older services have no link; retain their explicit service clearance.
    return service.linkedConsultationId
      ? consultationIds.includes(service.linkedConsultationId)
      : (record.consultationForServiceIds || []).includes(service.id)
  })
}

// Treatment bookings that require an online consultation must be preceded by
// a completed online consultation linked to that treatment, in the same branch.
export const hasCompletedOnlineConsultation = (service, appointments = [], branchId = service?.branchId) => {
  if (!service?.requiresConsultationFirst) return true
  return appointments.some(record => {
    if (record.branchId !== branchId || String(record.status || '').toLowerCase() !== 'completed' || String(record.type || '').toLowerCase() !== 'consultation' || String(record.consultationMode || '').toLowerCase() !== 'online') return false
    const ids = [...(record.selectedServiceIds || []), ...(record.serviceIds || []), ...(record.selectedServices || []).map(item => item.id)]
    return service.linkedConsultationId ? ids.includes(service.linkedConsultationId) : (record.consultationForServiceIds || []).includes(service.id)
  })
}
