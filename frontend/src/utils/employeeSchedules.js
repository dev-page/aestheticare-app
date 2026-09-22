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
  if (recurring && typeof recurring === 'object') return recurring.assignmentLabels || recurring.assignments || recurring
  return {}
}

export const hasAnyAssignedShift = (scheduleDocs = []) =>
  scheduleDocs.some((entry) => {
    const assignments = entry?.data?.assignments || entry?.assignments || {}
    return Object.values(assignments).some((value) => {
      const normalized = String(value || '').trim().toLowerCase()
      return Boolean(normalized) && normalized !== 'off'
    })
  })

export const parseShiftDurationHours = (shift = {}) => {
  const start = String(shift?.start || '').trim()
  const end = String(shift?.end || '').trim()
  if (!start || !end) return 0

  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) return 0

  const startTotal = startHour * 60 + startMinute
  const endTotal = endHour * 60 + endMinute
  if (endTotal <= startTotal) return 0
  return (endTotal - startTotal) / 60
}

// Basic plans store booking windows directly; Premium schedules can continue
// using their existing shift labels. This keeps customer booking independent
// of the HR module.
export const getScheduleDayWindow = (scheduleMap = {}, weekKey = '', day = '') => {
  const specific = weekKey ? scheduleMap?.[weekKey] : null
  const source = specific || scheduleMap?.[RECURRING_WEEKMAP_KEY] || {}
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
  const durationHours = parseShiftDurationHours(shift)
  if (!durationHours) return ''
  return durationHours >= thresholdHours ? 'full-time' : 'part-time'
}
