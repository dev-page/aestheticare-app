const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_ALIASES = {
  sun: 'sunday', sunday: 'sunday',
  mon: 'monday', monday: 'monday',
  tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday',
  wed: 'wednesday', wednesday: 'wednesday',
  thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday',
  fri: 'friday', friday: 'friday',
  sat: 'saturday', saturday: 'saturday',
}

export const weekdayForDateKey = (dateKey) => {
  const value = String(dateKey || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T12:00:00+08:00`)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(date).toLowerCase()
}

export const clockMinutes = (value) => {
  const raw = String(value || '').trim()
  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]), minute = Number(twentyFourHour[2])
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null
  }
  const twelveHour = raw.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i)
  if (!twelveHour) return null
  let hour = Number(twelveHour[1])
  const minute = Number(twelveHour[2])
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null
  const marker = twelveHour[3].toLowerCase()
  if (marker === 'pm' && hour !== 12) hour += 12
  if (marker === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

const normalizeRanges = (ranges = []) => ranges
  .map((range) => {
    const start = clockMinutes(range?.open ?? range?.start)
    const end = clockMinutes(range?.close ?? range?.end)
    return start !== null && end !== null && end > start ? { start, end } : null
  })
  .filter(Boolean)
  .sort((left, right) => left.start - right.start)
  .reduce((merged, current) => {
    const previous = merged.at(-1)
    if (previous && current.start <= previous.end) previous.end = Math.max(previous.end, current.end)
    else merged.push({ ...current })
    return merged
  }, [])

export const clinicOperatingRangesForDate = (operatingHours, dateKey, legacyClinic = {}) => {
  const day = weekdayForDateKey(dateKey)
  if (!day || !DAY_KEYS.includes(day)) return []
  const hours = operatingHours && typeof operatingHours === 'object' ? operatingHours : {}
  const configuredDays = Object.keys(hours).map((key) => DAY_ALIASES[String(key).toLowerCase()]).filter(Boolean)
  if (configuredDays.length) {
    const dayConfig = hours[day] || hours[Object.keys(hours).find((key) => DAY_ALIASES[String(key).toLowerCase()] === day)] || {}
    if (dayConfig.closed === true) return []
    const ranges = Array.isArray(dayConfig.ranges) ? dayConfig.ranges : [dayConfig]
    return normalizeRanges(ranges)
  }

  // Older clinic records used openDays/openTime/closeTime instead of ranges.
  const legacyDays = Array.isArray(legacyClinic.openDays)
    ? legacyClinic.openDays.map((value) => DAY_ALIASES[String(value || '').toLowerCase()]).filter(Boolean)
    : null
  if (legacyDays && !legacyDays.includes(day)) return []
  const legacyRange = normalizeRanges([{ open: legacyClinic.openTime, close: legacyClinic.closeTime }])
  return legacyRange
}

export const intersectClinicHoursAndShift = (operatingHours, dateKey, shiftWindow, legacyClinic = {}) => {
  const shiftStart = clockMinutes(shiftWindow?.start)
  const rawShiftEnd = clockMinutes(shiftWindow?.end)
  if (shiftStart === null || rawShiftEnd === null) return []
  const shiftEnd = rawShiftEnd <= shiftStart ? rawShiftEnd + 24 * 60 : rawShiftEnd
  return clinicOperatingRangesForDate(operatingHours, dateKey, legacyClinic)
    .map(({ start, end }) => ({ start: Math.max(start, shiftStart), end: Math.min(end, shiftEnd) }))
    .filter((range) => range.end > range.start)
}

export const bookingFitsClinicHours = (operatingHours, dateKey, start, end, legacyClinic = {}) => {
  const requestedStart = Number(start), requestedEnd = Number(end)
  return Number.isFinite(requestedStart) && Number.isFinite(requestedEnd) && requestedEnd > requestedStart
    && clinicOperatingRangesForDate(operatingHours, dateKey, legacyClinic)
      .some((range) => requestedStart >= range.start && requestedEnd <= range.end)
}
