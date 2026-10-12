import { getAppointmentSlots } from './appointmentSlots.js'

export const manilaDate = (now = Date.now()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now))
  const value = type => parts.find(part => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export const walkInSlots = ({ row, date = row.date, rows = [], clients = [], services = [], schedules = {}, appointments = [], leaves = {}, now = Date.now() }) => {
  const service = services.find(service => service.id === row.serviceId)
  if (!service || !row.clientId || !row.practitionerId || !date) return []
  const client = clients.find(client => client.id === row.clientId)
  const email = String(client?.email || '').trim().toLowerCase()
  const samePerson = other => other.clientId === row.clientId || other.customerId === row.clientId || (email && String(other.customerEmail || clients.find(client => client.id === other.clientId)?.email || '').trim().toLowerCase() === email)
  if (rows.some(other => other.key !== row.key && other.date === date && samePerson(other))) return []
  if (appointments.some(other => !other.isGroupParent && !other.isBookingOrderParent && other.date === date && samePerson(other) && !['cancelled', 'rejected', 'expired'].includes(String(other.status || '').toLowerCase()))) return []
  if ((leaves[row.practitionerId] || []).some(leave => leave.startDate <= date && date <= leave.endDate)) return []
  const draft = rows.filter(other => other.key !== row.key && other.date && other.time && other.practitionerId).map(other => ({ ...other, status: 'Unpaid', durationMinutes: services.find(service => service.id === other.serviceId)?.durationMinutes || 60 }))
  return getAppointmentSlots({ date, practitionerId: row.practitionerId, schedules, appointments: [...appointments, ...draft], durationMinutes: service.durationMinutes || 60, now })
}
