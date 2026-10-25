export const practitionerTypes = ['Doctor', 'Registered Nurse', 'Aesthetician', 'Therapist', 'Other']
export const employeeSpecialtyTypes = [...practitionerTypes.slice(0, 2), 'Pharmacist', ...practitionerTypes.slice(2)]
export const isPractitionerEmployee = user => {
  if (!user || user.archived || (user.userType && String(user.userType).toLowerCase() !== 'staff')) return false
  if (user.status && String(user.status).toLowerCase() !== 'active') return false
  if (practitionerTypes.includes(user.practitionerType)) return true
  const roles = [user.role, user.customRoleName, ...(Array.isArray(user.roles) ? user.roles : [])]
  return roles.some(role => /\bpractitioner\b/i.test(String(typeof role === 'object' ? role?.name || '' : role || '')))
}
export const appointmentServiceId = row => row.serviceDetails?.[0]?.id || row.selectedServices?.[0]?.id || row.selectedServiceIds?.[0] || row.serviceIds?.[0] || ''
const check = (ok, message) => { if (!ok) throw Object.assign(new Error(message), { status: 400 }) }
export const basePayForPeriod = ({ model = 'hourly', rate, hours = 0, days = 0, monthlyHours = 176 }) => {
  check(['hourly', 'daily', 'monthly-retainer'].includes(model), 'Choose a valid base pay model.')
  check([rate, hours, days, monthlyHours].every(value => Number.isFinite(Number(value)) && Number(value) >= 0) && monthlyHours > 0, 'Invalid base pay or attendance values.')
  return { amount: Math.round(Number(rate) * (model === 'hourly' ? hours : model === 'daily' ? days : 1) * 100) / 100, hourlyEquivalent: model === 'daily' ? rate / 8 : model === 'monthly-retainer' ? rate / monthlyHours : rate }
}
export const normalizeStaffing = (value) => {
  if (value == null) return []
  check(Array.isArray(value) && value.length <= 8, 'Configure at most eight staffing requirements.')
  const result = value.map(row => {
    check(practitionerTypes.includes(row.type), 'Choose a valid practitioner specialty.')
    check(['lead', 'assistant'].includes(row.responsibility), 'Choose lead or assistant.')
    const count = Number(row.count)
    check(Number.isInteger(count) && count >= 1 && count <= 8, 'Staff count must be from 1 to 8.')
    check(row.responsibility !== 'lead' || count === 1, 'An appointment has one lead practitioner.')
    return { type: row.type, responsibility: row.responsibility, count }
  })
  check(!result.length || result.filter(row => row.responsibility === 'lead').length === 1, 'Configure exactly one lead practitioner.')
  check(result.reduce((sum, row) => sum + row.count, 0) <= 8, 'A treatment team supports at most eight staff.')
  check(new Set(result.map(row => row.type + row.responsibility)).size === result.length, 'Combine duplicate staffing requirements.')
  return result
}
export const normalizePractitionerProfile = (body) => {
  check(practitionerTypes.includes(body.type), 'Choose a practitioner specialty.')
  check(Array.isArray(body.approvedServiceIds || []) && Array.isArray(body.rates || []), 'Approved services and compensation agreements must be lists.')
  const approvedServiceIds = [...new Set(body.approvedServiceIds || [])]
  check(approvedServiceIds.length <= 100 && approvedServiceIds.every(id => typeof id === 'string' && id.length <= 150 && !id.includes('/')), 'Invalid approved services.')
  const rates = (body.rates || []).map(rate => {
    check(['lead', 'assistant'].includes(rate.responsibility) && ['percent', 'fixed'].includes(rate.model), 'Choose a valid responsibility and compensation model.')
    const amount = Number(rate.amount)
    check(rate.amount !== '' && Number.isFinite(amount) && amount >= 0 && (rate.model !== 'percent' || amount <= 100), 'Enter a valid nonnegative staff rate; percentages cannot exceed 100.')
    check(/^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveFrom || '') && (!rate.effectiveUntil || /^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveUntil) && rate.effectiveUntil >= rate.effectiveFrom), 'Enter valid agreement dates.')
    return { serviceId: String(rate.serviceId || ''), responsibility: rate.responsibility, model: rate.model, amount, effectiveFrom: rate.effectiveFrom, effectiveUntil: rate.effectiveUntil || '' }
  })
  check(rates.length <= 100, 'Too many compensation agreements.')
  for (let i = 0; i < rates.length; i++) for (let j = i + 1; j < rates.length; j++) {
    const a = rates[i], b = rates[j]
    check(a.serviceId !== b.serviceId || a.responsibility !== b.responsibility || a.effectiveFrom > (b.effectiveUntil || '9999-12-31') || b.effectiveFrom > (a.effectiveUntil || '9999-12-31'), 'Compensation agreements for the same service and responsibility cannot overlap.')
  }
  return { type: body.type, credentialNumber: String(body.credentialNumber || '').trim().slice(0, 100), credentialsVerified: body.credentialsVerified === true, approvedServiceIds, rates }
}
export const rateFor = (profile, serviceId, responsibility, date) => {
  const active = (profile?.rates || []).filter(rate => rate.responsibility === responsibility && rate.effectiveFrom <= date && (!rate.effectiveUntil || rate.effectiveUntil >= date))
  return active.find(rate => rate.serviceId === serviceId) || active.find(rate => !rate.serviceId) || null
}
export const teamMeetsRequirements = (team, requirements) => normalizeStaffing(requirements).every(row => team.filter(member => member.type === row.type && member.responsibility === row.responsibility).length === row.count)
export const appointmentStaffIds = appointment => [...new Set([appointment.practitionerId, appointment.assignedPractitionerId, ...(appointment.treatmentTeam || []).map(member => member.employeeId)].filter(Boolean))]
export const sessionEarningBase = (appointment, plan = appointment) => {
  const sessions = Math.max(1, Number(plan.treatmentPlan?.totalSessions || 1))
  const number = Math.max(1, Number(appointment.sessionNumber || 1))
  const cents = Math.round(Number(plan.totalAmount ?? plan.amount ?? plan.price ?? 0) * 100)
  check(Number.isSafeInteger(cents) && cents >= 0 && number <= sessions, 'The treatment plan has an invalid earning basis.')
  return (Math.floor(cents / sessions) + (number <= cents % sessions ? 1 : 0)) / 100
}
export const calculateStaffEarnings = (team, base) => {
  check(Number.isFinite(base) && base >= 0, 'Invalid service earning basis.')
  return team.map(member => {
    check(member.participationConfirmed === true, 'Every team member must confirm participation before earnings approval.')
    check(member.rateSnapshot, 'A staff compensation agreement is missing.')
    const rate = member.rateSnapshot
    const amount = rate.model === 'percent' ? Math.round(Math.round(base * 100) * rate.amount / 100) : Math.round(rate.amount * 100)
    check(Number.isSafeInteger(amount) && amount >= 0, 'Invalid staff earning amount.')
    return { employeeId: member.employeeId, employeeName: member.name, responsibility: member.responsibility, practitionerType: member.type, rateSnapshot: rate, baseAmount: base, amount: amount / 100 }
  })
}
