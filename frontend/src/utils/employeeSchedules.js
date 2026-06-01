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
      weekMap[RECURRING_WEEKMAP_KEY] = data.assignments || {}
      return
    }

    const weekKey = String(data.weekStart || docId || '').trim()
    if (!weekKey) return
    weekMap[weekKey] = data.assignments || {}
  })

  return weekMap
}

export const resolveWeekAssignments = (weekMap = {}, weekKey = '') => {
  const specific = weekKey ? weekMap?.[weekKey] : null
  if (specific && typeof specific === 'object') return specific
  const recurring = weekMap?.[RECURRING_WEEKMAP_KEY]
  if (recurring && typeof recurring === 'object') return recurring
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
  const adjustedEnd = endTotal <= startTotal ? endTotal + (24 * 60) : endTotal
  return Math.max(0, (adjustedEnd - startTotal) / 60)
}

export const normalizeEmploymentType = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized.includes('full')) return 'full-time'
  if (normalized.includes('part')) return 'part-time'
  return ''
}

export const classifyShiftEmploymentType = (shift = {}, thresholdHours = 8) => {
  const durationHours = parseShiftDurationHours(shift)
  if (!durationHours) return ''
  return durationHours >= thresholdHours ? 'full-time' : 'part-time'
}
