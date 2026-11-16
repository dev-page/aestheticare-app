import { extractShiftWindowMinutes, getDayName, getWeekStartKey, parseClockToMinutes, minutesToTime, minutesToTime12 } from './appointmentDss.js'
import { getScheduleDayWindow } from './employeeSchedules.js'
import { intersectClinicHoursAndShift } from '../../../shared/clinicOperatingHours.js'
import { isBookingPaymentHoldReleased } from '../../../shared/bookingPaymentHold.js'

// Use the same slots for calendar days, time choices, and staff suggestions.
export const getAppointmentSlots = ({ date, practitionerId, schedules = {}, appointments = [], durationMinutes, operatingHours, legacyOperatingHours = {}, now = Date.now() }) => {
  const duration = Number(durationMinutes)
  if (!date || !practitionerId || !Number.isFinite(duration) || duration <= 0) return []
  const window = getScheduleDayWindow(schedules[practitionerId] || {}, getWeekStartKey(date), getDayName(date))
  const shift = window && extractShiftWindowMinutes(`${window.start} - ${window.end}`)
  if (!shift || shift.end <= shift.start) return []
  const clinicWindows = operatingHours === undefined
    ? [shift]
    : intersectClinicHoursAndShift(operatingHours, date, { start: minutesToTime(shift.start), end: minutesToTime(shift.end) }, legacyOperatingHours)
  if (!clinicWindows.length) return []
  const midnight = new Date(`${date}T00:00:00+08:00`).getTime()
  if (!Number.isFinite(midnight)) return []
  const blocks = appointments.filter(a => a.date === date
    && [a.practitionerId, a.assignedPractitionerId, a.staffId, a.assignedTo, ...(a.treatmentTeam || []).map(member => member.employeeId)].includes(practitionerId)
    && !isBookingPaymentHoldReleased(a, now)
    && !['cancelled', 'rejected', 'expired', 'no-show'].includes(String(a.status || '').trim().toLowerCase())
  ).map(a => {
    const start = parseClockToMinutes(a.time)
    const end = parseClockToMinutes(a.endTime)
    return start === null ? null : { start, end: end !== null && end > start ? end : start + Math.max(1, Number(a.totalServiceDurationMinutes || a.durationMinutes || 60)) }
  }).filter(Boolean)
  const slots = []
  for (const clinicWindow of clinicWindows) {
    for (let start = clinicWindow.start; start + duration <= Math.min(clinicWindow.end, 1440); start += 30) {
      if (midnight + start * 60000 <= now || blocks.some(b => start < b.end && start + duration > b.start)) continue
      slots.push({ value: minutesToTime(start), label: `${minutesToTime12(start)} – ${minutesToTime12(start + duration)}` })
    }
  }
  return slots
}
