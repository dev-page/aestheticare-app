const MIN_EFFECTIVE_DATE = '0001-01-01'

const validDateKey = (value) => {
  const normalized = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false
  const parsed = new Date(`${normalized}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized
}

export const normalizeScheduleEffectiveDate = (value) => {
  const normalized = String(value || '').trim()
  const dateKey = validDateKey(normalized) ? normalized : MIN_EFFECTIVE_DATE
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0, 10)
}

const isScheduleVersion = (value) => value && typeof value === 'object'
  && ((value.assignments && typeof value.assignments === 'object' && !Array.isArray(value.assignments))
    || (value.availability && typeof value.availability === 'object' && !Array.isArray(value.availability)))

export const recurringScheduleVersions = (schedule = {}) => {
  const byDate = new Map()
  const history = Array.isArray(schedule.scheduleVersions) ? schedule.scheduleVersions : []

  history.forEach((version) => {
    if (!isScheduleVersion(version)) return
    const effectiveFrom = normalizeScheduleEffectiveDate(version.effectiveFrom)
    byDate.set(effectiveFrom, {
      effectiveFrom,
      assignments: version.assignments || {},
      assignmentLabels: version.assignmentLabels || version.assignments || {},
      historical: true,
      ...(Number.isFinite(Number(version.weeklyHoursCap)) && Number(version.weeklyHoursCap) > 0
        ? { weeklyHoursCap: Number(version.weeklyHoursCap) }
        : {}),
      ...(version.availability && typeof version.availability === 'object' ? { availability: version.availability } : {}),
    })
  })

  if (isScheduleVersion(schedule)) {
    const effectiveFrom = normalizeScheduleEffectiveDate(schedule.effectiveFrom)
    byDate.set(effectiveFrom, {
      effectiveFrom,
      assignments: schedule.assignments || {},
      assignmentLabels: schedule.assignmentLabels || schedule.assignments || {},
      historical: false,
      ...(Number.isFinite(Number(schedule.weeklyHoursCap)) && Number(schedule.weeklyHoursCap) > 0
        ? { weeklyHoursCap: Number(schedule.weeklyHoursCap) }
        : {}),
      ...(schedule.availability && typeof schedule.availability === 'object' ? { availability: schedule.availability } : {}),
    })
  }

  return [...byDate.values()].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
}

export const resolveRecurringScheduleVersion = (schedule = {}, dateKey = '') => {
  const target = normalizeScheduleEffectiveDate(dateKey)
  const versions = recurringScheduleVersions(schedule)
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    if (versions[index].effectiveFrom <= target) return versions[index]
  }
  return null
}

// Keep earlier weekly patterns as history. A newly saved version replaces the
// selected week and any later plan, while leaving earlier effective weeks intact.
export const withRecurringScheduleVersion = (existing = {}, next = {}) => {
  const effectiveFrom = normalizeScheduleEffectiveDate(next.effectiveFrom)
  const scheduleVersions = recurringScheduleVersions(existing)
    .filter((version) => version.effectiveFrom < effectiveFrom)
  return { ...next, effectiveFrom, scheduleVersions }
}
