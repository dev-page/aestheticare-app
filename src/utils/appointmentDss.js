import { resolveWeekAssignments } from '@/utils/employeeSchedules'

const BLOCKING_STATUSES = new Set([
  'scheduled',
  'approved',
  'paid',
  'completed',
  'in progress',
  'ongoing',
])

export const parseClockToMinutes = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const hour = Number(hhmm[1])
    const minute = Number(hhmm[2])
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  }

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (!ampm) return null

  let hour = Number(ampm[1])
  const minute = Number(ampm[2])
  const marker = ampm[3].toUpperCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null
  if (marker === 'PM' && hour !== 12) hour += 12
  if (marker === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

export const minutesToTime = (minutes) => {
  const normalized = ((Number(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60)
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export const minutesToTime12 = (minutes) => {
  const normalized = ((Number(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60)
  let hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour %= 12
  if (hour === 0) hour = 12
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`
}

export const getWeekStartKey = (dateString) => {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return ''

  const currentDay = date.getDay()
  const diffToMonday = (currentDay + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - diffToMonday)

  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

export const getDayName = (dateString) => {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export const extractShiftWindowMinutes = (shiftLabel) => {
  const label = String(shiftLabel || '').trim()
  if (!label || label.toLowerCase() === 'off') return null

  const base = label.includes('||') ? String(label.split('||').pop() || '').trim() : label
  const [startRaw, endRaw] = base.split('-').map((part) => String(part || '').trim())
  if (!startRaw || !endRaw) return null

  const start = parseClockToMinutes(startRaw)
  const end = parseClockToMinutes(endRaw)
  if (start === null || end === null) return null
  return { start, end }
}

const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const normalizeStatus = (status) => String(status || '').trim().toLowerCase()

const dateFromKey = (dateKey) => {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

const buildAppointmentBlocks = (appointments = [], defaultDurationMinutes = 60) => {
  const blocked = new Map()

  appointments.forEach((appointment) => {
    const date = String(appointment?.date || '').trim()
    const practitionerId = String(
      appointment?.assignedPractitionerId || appointment?.practitionerId || ''
    ).trim()
    const status = normalizeStatus(appointment?.status)
    if (!date || !practitionerId || !BLOCKING_STATUSES.has(status)) return

    const start = parseClockToMinutes(appointment?.time)
    if (start === null) return
    const endRaw = parseClockToMinutes(appointment?.endTime)
    const end = endRaw === null ? start + defaultDurationMinutes : endRaw
    const key = `${date}|${practitionerId}`
    const nextList = blocked.get(key) || []
    nextList.push({ start, end: end <= start ? start + defaultDurationMinutes : end })
    blocked.set(key, nextList)
  })

  return blocked
}

const overlapsBlockedRange = (candidateStart, candidateEnd, blockedRanges = []) =>
  blockedRanges.some((range) => candidateStart < range.end && candidateEnd > range.start)

export const buildAppointmentRecommendations = ({
  practitioners = [],
  practitionerSchedules = {},
  appointments = [],
  preferredPractitionerId = '',
  selectedDate = '',
  selectedTime = '',
  daysAhead = 14,
  slotIntervalMinutes = 60,
  defaultDurationMinutes = 60,
} = {}) => {
  if (!Array.isArray(practitioners) || !practitioners.length) return []

  const blockedMap = buildAppointmentBlocks(appointments, defaultDurationMinutes)
  const startAnchor = selectedDate ? dateFromKey(selectedDate) : new Date()
  const todayKey = toDateKey(new Date())
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const preferredTimeMinutes = parseClockToMinutes(selectedTime)
  const slots = []

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const nextDate = new Date(startAnchor)
    nextDate.setDate(startAnchor.getDate() + offset)
    const dateKey = toDateKey(nextDate)
    const weekKey = getWeekStartKey(dateKey)
    const dayName = getDayName(dateKey)
    if (!weekKey || !dayName) continue

    practitioners.forEach((practitioner) => {
      const assignments = resolveWeekAssignments(practitionerSchedules?.[practitioner.id] || {}, weekKey)
      const shiftLabel = String(assignments?.[dayName] || '').trim()
      const shiftWindow = extractShiftWindowMinutes(shiftLabel)
      if (!shiftWindow) return

      let { start, end } = shiftWindow
      if (end <= start) end += 24 * 60

      let candidateStart = start
      if (dateKey === todayKey) {
        const threshold = nowMinutes + 30
        while (candidateStart < threshold) {
          candidateStart += slotIntervalMinutes
        }
      }

      const blockedRanges = blockedMap.get(`${dateKey}|${practitioner.id}`) || []

      for (let minutes = candidateStart; minutes + defaultDurationMinutes <= end; minutes += slotIntervalMinutes) {
        const normalizedStart = minutes % (24 * 60)
        const normalizedEnd = (minutes + defaultDurationMinutes) % (24 * 60)
        if (overlapsBlockedRange(normalizedStart, normalizedStart + defaultDurationMinutes, blockedRanges)) {
          continue
        }

        const practitionerLoad = blockedRanges.length
        const dateDistance = offset
        const timeDistance =
          preferredTimeMinutes === null ? 0 : Math.abs(preferredTimeMinutes - normalizedStart)
        const preferredPenalty = preferredPractitionerId && preferredPractitionerId !== practitioner.id ? 1 : 0

        slots.push({
          key: `${dateKey}|${minutesToTime(normalizedStart)}|${practitioner.id}`,
          date: dateKey,
          time: minutesToTime(normalizedStart),
          endTime: minutesToTime(normalizedEnd),
          practitionerId: practitioner.id,
          practitionerName: practitioner.fullName || 'Practitioner',
          practitionerLoad,
          label: `${dateKey} - ${minutesToTime12(normalizedStart)} - ${practitioner.fullName || 'Practitioner'}`,
          score: dateDistance * 100 + practitionerLoad * 20 + preferredPenalty * 10 + timeDistance / 15,
          isPreferredPractitioner: preferredPractitionerId === practitioner.id,
        })
      }
    })
  }

  if (!slots.length) return []

  const byEarliest = [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.time.localeCompare(b.time)
  })

  const byBalanced = [...slots].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.time.localeCompare(b.time)
  })

  const preferred = preferredPractitionerId
    ? [...slots]
        .filter((slot) => slot.practitionerId === preferredPractitionerId)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date)
          return a.time.localeCompare(b.time)
        })[0]
    : null

  const unique = []
  const seen = new Set()
  const pushRecommendation = (type, title, description, slot) => {
    if (!slot || seen.has(slot.key)) return
    seen.add(slot.key)
    unique.push({ type, title, description, ...slot })
  }

  pushRecommendation(
    'earliest',
    'Earliest Available',
    'Fastest slot based on schedule and current bookings.',
    byEarliest[0]
  )
  pushRecommendation(
    'balanced',
    'Best Balanced Option',
    'Recommended to avoid busier schedules while staying close.',
    byBalanced[0]
  )
  pushRecommendation(
    'preferred',
    'Preferred Practitioner',
    'Best available slot for the currently selected practitioner.',
    preferred
  )

  return unique.slice(0, 3)
}
