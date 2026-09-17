import { extractShiftWindowMinutes, getDayName, getWeekStartKey, parseClockToMinutes, minutesToTime, minutesToTime12 } from './appointmentDss.js'
import { resolveWeekAssignments } from './employeeSchedules.js'

// Use the same slots for calendar days, time choices, and staff suggestions.
export const getAppointmentSlots = ({ date, practitionerId, schedules = {}, appointments = [], durationMinutes, now = Date.now() }) => {
  const duration = Number(durationMinutes)
  if (!date || !practitionerId || !Number.isFinite(duration) || duration <= 0) return []
  const assignments = resolveWeekAssignments(schedules[practitionerId] || {}, getWeekStartKey(date))
  const shift = extractShiftWindowMinutes(assignments[getDayName(date)])
  if (!shift || shift.end <= shift.start) return []
  const midnight = new Date(`${date}T00:00:00+08:00`).getTime()
  if (!Number.isFinite(midnight)) return []
  const blocks = appointments.filter(a => a.date === date
    && [a.practitionerId, a.assignedPractitionerId, a.staffId, a.assignedTo].includes(practitionerId)
    && !['cancelled', 'rejected', 'expired', 'no-show'].includes(String(a.status || '').trim().toLowerCase())
  ).map(a => {
    const start = parseClockToMinutes(a.time)
    const end = parseClockToMinutes(a.endTime)
    return start === null ? null : { start, end: end !== null && end > start ? end : start + Math.max(1, Number(a.totalServiceDurationMinutes || a.durationMinutes || 60)) }
  }).filter(Boolean)
  const slots = []
  for (let start = shift.start; start + duration <= Math.min(shift.end, 1440); start += 30) {
    if (midnight + start * 60000 <= now || blocks.some(b => start < b.end && start + duration > b.start)) continue
    slots.push({ value: minutesToTime(start), label: `${minutesToTime12(start)} – ${minutesToTime12(start + duration)}` })
  }
  return slots
}
