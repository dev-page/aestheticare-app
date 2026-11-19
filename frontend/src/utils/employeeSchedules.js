import { recurringScheduleVersions, resolveRecurringScheduleVersion } from '../../../shared/recurringEmployeeSchedules.js'
export { resolveRecurringScheduleVersion, withRecurringScheduleVersion } from '../../../shared/recurringEmployeeSchedules.js'

export const RECURRING_SCHEDULE_ID = 'recurring'
export const RECURRING_WEEKMAP_KEY = '__recurring__'

export const createAssignmentsMap = (daysOfWeek = []) =>
  daysOfWeek.reduce((acc, day) => {
    acc[day] = ''
    return acc
  }, {})

export const normalizeAssignments = (assignments = {}, daysOfWeek = []) => {
  const nextAssignments = createAssignmentsMap(daysOfWeek)
  daysOfWeek.forEach((day) => {
    nextAssignments[day] = String(assignments?.[day] || '').trim()
  })
  return nextAssignments
}

export const buildWeekScheduleMap = (scheduleDocs = []) => {
  const weekMap = {}

  scheduleDocs.forEach((entry) => {
    const data = entry?.data || {}
    const docId = String(entry?.id || '').trim()
    const isRecurring =
      docId === RECURRING_SCHEDULE_ID ||
      Boolean(data.recurring) ||
      String(data.type || '').trim().toLowerCase() === RECURRING_SCHEDULE_ID

    if (isRecurring) {
      weekMap[RECURRING_WEEKMAP_KEY] = {
        assignments: data.assignments || {},
        assignmentLabels: data.assignmentLabels || data.assignments || {},
        availability: data.availability || {},
        effectiveFrom: data.effectiveFrom || '',
        scheduleVersions: data.scheduleVersions || [],
      }
      return
    }

    const weekKey = String(data.weekStart || docId || '').trim()
    if (!weekKey) return
    weekMap[weekKey] = {
      assignments: data.assignments || {},
      assignmentLabels: data.assignmentLabels || data.assignments || {},
      availability: data.availability || {},
    }
  })

  return weekMap
}

export const resolveWeekAssignments = (weekMap = {}, weekKey = '') => {
  const specific = weekKey ? weekMap?.[weekKey] : null
  if (specific && typeof specific === 'object') return specific.assignmentLabels || specific.assignments || specific
  const recurring = weekMap?.[RECURRING_WEEKMAP_KEY]
  if (recurring && typeof recurring === 'object') {
    const version = resolveRecurringScheduleVersion(recurring, weekKey)
    return version?.assignmentLabels || version?.assignments || {}
  }
  return {}
}

export const hasAnyAssignedShift = (scheduleDocs = []) =>
  scheduleDocs.some((entry) => {
    const data = entry?.data || entry || {}
    const isRecurring = String(entry?.id || '').trim() === RECURRING_SCHEDULE_ID
      || Boolean(data.recurring)
      || String(data.type || '').trim().toLowerCase() === RECURRING_SCHEDULE_ID
    const assignmentSets = isRecurring
      ? recurringScheduleVersions(data).map((version) => version.assignments)
      : [data.assignments || {}]
    return assignmentSets.some((assignments) => Object.values(assignments).some((value) => {
      const normalized = String(value || '').trim().toLowerCase()
      return Boolean(normalized) && normalized !== 'off'
    }))
  })

const parseShiftElapsedMinutes = (shift = {}) => {
  const start = String(shift?.start || '').trim()
  const end = String(shift?.end || '').trim()
  if (!start || !end) return 0

  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) return 0

  const startTotal = startHour * 60 + startMinute
  const endTotal = endHour * 60 + endMinute
  if (endTotal <= startTotal) return 0
  return endTotal - startTotal
}

// Clock span includes the meal break. Use this for shift-type matching, where
// the scheduled window determines whether a template is full-time or part-time.
export const parseShiftScheduledHours = (shift = {}) =>
  parseShiftElapsedMinutes(shift) / 60

export const parseShiftDurationHours = (shift = {}) => {
  const elapsedMinutes = parseShiftElapsedMinutes(shift)
  if (!elapsedMinutes) return 0
  const explicitBreak = Number(shift?.unpaidMealBreakMinutes ?? shift?.mealBreakMinutes)
  // Older shift templates have no break field. Keep their previous payroll
  // behavior: infer one unpaid hour only when the scheduled span exceeds 8h.
  const breakMinutes = Number.isFinite(explicitBreak) && explicitBreak >= 0
    ? explicitBreak
    : elapsedMinutes > 8 * 60 ? 60 : 0
  return Math.max(0, elapsedMinutes - breakMinutes) / 60
}

// Basic plans store booking windows directly; Premium schedules can continue
// using their existing shift labels. This keeps customer booking independent
// of the HR module.
export const getScheduleDayWindow = (scheduleMap = {}, weekKey = '', day = '') => {
  const specific = weekKey ? scheduleMap?.[weekKey] : null
  const recurring = scheduleMap?.[RECURRING_WEEKMAP_KEY] || {}
  const source = specific || resolveRecurringScheduleVersion(recurring, weekKey) || {}
  const availability = source?.availability?.[day]
  if (availability && availability.enabled !== false && availability.start && availability.end) {
    return { start: String(availability.start), end: String(availability.end) }
  }
  const label = String((source?.assignmentLabels || source?.assignments || source)?.[day] || '').trim()
  const parts = label.split('||').pop().trim().split(' - ')
  return parts.length === 2 && parts[0] && parts[1] ? { start: parts[0], end: parts[1] } : null
}

export const normalizeEmploymentType = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized.includes('full')) return 'full-time'
  if (normalized.includes('part')) return 'part-time'
  if (normalized === 'intern' || normalized.includes('intern')) return 'intern'
  return ''
}

export const classifyShiftEmploymentType = (shift = {}, thresholdHours = 8) => {
  const durationHours = parseShiftScheduledHours(shift)
  if (!durationHours) return ''
  return durationHours >= thresholdHours ? 'full-time' : 'part-time'
}
