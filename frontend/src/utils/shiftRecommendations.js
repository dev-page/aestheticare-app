import { normalizeEmploymentType, parseShiftDurationHours } from './employeeSchedules.js'

// Planning limits are application settings, not a determination of contracted hours.
export function recommendRecurringShifts({ days, shifts, assignments = {}, employmentType,
  targetHours, schedules = [], employeeId, protectedDays = [] }) {
  const type = normalizeEmploymentType(employmentType)
  const suggestions = {}
  const reasons = {}
  const lookup = value => shifts.find(shift => shift.id === value || shift.label === value)
  const hours = shift => parseShiftDurationHours(shift)
  let plannedHours = days.reduce((sum, day) => sum + (hours(lookup(assignments[day]) || {})), 0)
  let workDays = days.filter(day => assignments[day]).length
  const target = Number(targetHours)
  const counts = new Map()
  schedules.filter(schedule => schedule.employeeId !== employeeId).forEach(schedule => {
    days.forEach(day => {
      const shift = lookup(schedule.assignments?.[day])
      if (shift) {
        const key = `${day}:${shift.id}`
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    })
  })
  const templates = shifts.filter(shift => hours(shift) > 0 &&
    (type === 'full-time' ? hours(shift) >= 8 : type === 'part-time' && hours(shift) < 8))
    .sort((a, b) => hours(b) - hours(a) || String(a.label).localeCompare(String(b.label)))
  for (const day of days) {
    if (assignments[day]) { reasons[day] = 'Existing assignment retained.'; continue }
    if (!type || type === 'intern') { reasons[day] = 'Assign manually; no supported employment type.'; continue }
    if (!Number.isFinite(target) || target <= 0 || target > 48) { reasons[day] = 'Enter a weekly target between 1 and 48 hours.'; continue }
    if (protectedDays.includes(day)) { reasons[day] = 'Off day retained.'; continue }
    if (workDays >= 6) { reasons[day] = 'Off — keep at least one day free.'; continue }
    const available = templates.filter(shift => (counts.get(`${day}:${shift.id}`) || 0) < shift.capacity)
    const shift = available.find(shift => plannedHours + hours(shift) <= target)
    if (!shift) {
      reasons[day] = !templates.length ? 'No matching shift duration; assign manually.'
        : !available.length ? 'Matching shifts are full.' : 'Off — remaining weekly hours cannot fit a shift.'
      continue
    }
    suggestions[day] = shift
    plannedHours += hours(shift)
    workDays++
  }
  return { suggestions, reasons, plannedHours, templates }
}
