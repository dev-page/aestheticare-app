const parseClockToMinutes = (timeValue) => {
  if (!timeValue) return null
  const input = String(timeValue).trim().toUpperCase().replace(/\s+/g, '')
  const meridiem = input.endsWith('AM') ? 'AM' : input.endsWith('PM') ? 'PM' : ''
  const parts = (meridiem ? input.slice(0, -2) : input).split(':')
  if (parts.length < 2) return null
  let hours = Number(parts[0])
  const minutes = Number(parts[1])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null
  if (meridiem) {
    if (hours === 12) hours = 0
    if (meridiem === 'PM') hours += 12
  }
  return hours * 60 + minutes
}

export const PHILIPPINE_NORMAL_WORK_MINUTES = 8 * 60
export const PHILIPPINE_OT_MULTIPLIERS = Object.freeze({
  ordinary: 1.25,
  'rest-day': 1.69,
  'special-holiday': 1.69,
  'regular-holiday': 1.69,
})

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-')

export const normalizeDayClassification = (value) => {
  const day = normalize(value)
  if (day.includes('regular') && day.includes('holiday')) return 'regular-holiday'
  if (day.includes('special') && day.includes('holiday')) return 'special-holiday'
  if (day.includes('rest')) return 'rest-day'
  return 'ordinary'
}

export const isPhilippineOvertimeExempt = (employee = {}) => {
  const role = normalize(`${employee.role || ''} ${employee.customRoleName || ''} ${employee.jobTitle || ''}`)
  return Boolean(
    employee.isManagerial ||
    employee.isFieldPersonnel ||
    employee.governmentEmployee ||
    role.includes('manager') ||
    role.includes('field-personnel') ||
    role.includes('government')
  )
}

const elapsedMinutes = (start, end) => {
  if (start === null || end === null) return null
  const elapsed = end - start
  return elapsed >= 0 ? elapsed : elapsed + 24 * 60
}

const overlapMinutes = (start, end, windowStart, windowEnd) => {
  let finish = end
  if (finish <= start) finish += 24 * 60
  let total = 0
  for (let day = 0; day <= 24 * 60; day += 24 * 60) {
    const from = windowStart + day
    const to = windowEnd + day
    total += Math.max(0, Math.min(finish, to) - Math.max(start, from))
  }
  return Math.min(total, Math.max(0, finish - start))
}

export const calculatePhilippineOvertime = (attendance = {}, employee = {}) => {
  const timeIn = parseClockToMinutes(attendance.timeIn)
  const timeOut = parseClockToMinutes(attendance.timeOut)
  const shiftStart = parseClockToMinutes(attendance.shiftStart)
  const shiftEnd = parseClockToMinutes(attendance.shiftEnd)
  const rawWorkedMinutes = elapsedMinutes(timeIn, timeOut)
  if (rawWorkedMinutes === null) return { overtimeMinutes: 0, nightMinutes: 0, dayClassification: 'ordinary', multiplier: 1.25, exempt: isPhilippineOvertimeExempt(employee) }

  const scheduledMinutes = elapsedMinutes(shiftStart, shiftEnd)
  const explicitMealBreak = Number(attendance.unpaidMealBreakMinutes ?? attendance.mealBreakMinutes)
  const mealBreakMinutes = Number.isFinite(explicitMealBreak) && explicitMealBreak >= 0
    ? explicitMealBreak
    : scheduledMinutes > PHILIPPINE_NORMAL_WORK_MINUTES ? 60 : 0
  const workedMinutes = Math.max(0, rawWorkedMinutes - mealBreakMinutes)
  const exempt = isPhilippineOvertimeExempt(employee)
  const overtimeMinutes = exempt ? 0 : Math.max(0, workedMinutes - PHILIPPINE_NORMAL_WORK_MINUTES)
  const dayClassification = normalizeDayClassification(attendance.dayClassification || attendance.dayType || attendance.holidayType)
  const multiplier = PHILIPPINE_OT_MULTIPLIERS[dayClassification]
  const nightMinutes = overtimeMinutes
    ? Math.min(overtimeMinutes, overlapMinutes((timeIn ?? 0), (timeIn ?? 0) + rawWorkedMinutes, 22 * 60, 30 * 60))
    : 0

  return { rawWorkedMinutes, mealBreakMinutes, workedMinutes, overtimeMinutes, nightMinutes, dayClassification, multiplier, exempt }
}

export const calculatePhilippineOvertimePay = (attendance, employee, hourlyRate) => {
  const result = calculatePhilippineOvertime(attendance, employee)
  const rate = Math.max(0, Number(hourlyRate) || 0)
  const overtimePay = (result.overtimeMinutes / 60) * rate * result.multiplier
  const nightDifferential = (result.nightMinutes / 60) * rate * 0.10
  return { ...result, overtimePay, nightDifferential, totalOvertimePay: overtimePay + nightDifferential }
}
