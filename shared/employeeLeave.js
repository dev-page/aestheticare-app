import { resolveRecurringScheduleVersion } from './recurringEmployeeSchedules.js'

const validDateKey = (value) => {
  const text = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const parsed = new Date(`${text}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text
}

const weekdayName = (dateKey) => {
  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]
}

export const scheduledWorkDates = (startDate, endDate, schedule = {}) => {
  if (!validDateKey(startDate) || !validDateKey(endDate) || endDate < startDate) return []
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  if ((end.getTime() - start.getTime()) / 86400000 > 3660) return []
  const dates = []
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10)
    const version = resolveRecurringScheduleVersion(schedule, key)
    const assignment = String(version?.assignments?.[weekdayName(key)] || '').trim()
    // Legacy employees without a recurring schedule retain the former weekday
    // convention. Once a schedule exists, its assigned days are authoritative.
    const hasSchedule = Boolean(version?.assignments && Object.keys(version.assignments).length)
    const isScheduled = hasSchedule
      ? Boolean(assignment && assignment.toLowerCase() !== 'off')
      : !['Saturday', 'Sunday'].includes(weekdayName(key))
    if (isScheduled) dates.push(key)
  }
  return dates
}

export const scheduledWorkDatesForYear = (startDate, endDate, year, schedule = {}) =>
  scheduledWorkDates(startDate, endDate, schedule).filter(date => date.startsWith(`${Number(year)}-`))

export const scheduledWorkDatesForMonth = (startDate, endDate, monthKey, schedule = {}) =>
  scheduledWorkDates(startDate, endDate, schedule).filter(date => date.startsWith(`${String(monthKey || '')}-`))

const parseClock = value => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return null
  let hours = Number(match[1]); const minutes = Number(match[2]); const meridiem = String(match[3] || '').toUpperCase()
  if (hours > 23 || minutes > 59 || (meridiem && (hours < 1 || hours > 12))) return null
  if (meridiem) { if (hours === 12) hours = 0; if (meridiem === 'PM') hours += 12 }
  return hours * 60 + minutes
}

export const scheduledShiftHours = (dateKey, schedule = {}, shifts = []) => {
  const version = resolveRecurringScheduleVersion(schedule, dateKey)
  const weekday = weekdayName(dateKey)
  const hasSchedule = Boolean(version?.assignments && Object.keys(version.assignments).length)
  if (!hasSchedule) return ['Saturday', 'Sunday'].includes(weekday) ? 0 : 8
  const assignment = String(version?.assignments?.[weekday] || '').trim()
  if (!assignment || assignment.toLowerCase() === 'off') return 0
  const label = String(version?.assignmentLabels?.[weekday] || assignment).trim()
  const shift = shifts.find(item => item.id === assignment || item.id === label
    || `${String(item.shiftType || 'Shift').trim()} || ${String(item.start || '').trim()} - ${String(item.end || '').trim()}` === label) || {}
  const labelTimes = label.match(/\|\|\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/)
  const start = parseClock(shift.start || labelTimes?.[1])
  const end = parseClock(shift.end || labelTimes?.[2])
  if (start === null || end === null) return 8
  let duration = end - start
  if (duration <= 0) duration += 24 * 60
  const explicitBreak = Number(shift.unpaidMealBreakMinutes ?? shift.mealBreakMinutes)
  const mealBreak = Number.isFinite(explicitBreak) && explicitBreak >= 0 ? explicitBreak : duration > 480 ? 60 : 0
  return Math.max(0, duration - mealBreak) / 60
}

export const calculatePayrollLeaveAdjustments = ({ leaveRequests = [], attendanceRecords = [], schedules = {}, shifts = [], monthKey = '' }) => {
  const attended = new Map()
  for (const record of attendanceRecords) {
    if (!record?.employeeId || !record?.timeIn || !record?.timeOut) continue
    const date = String(record.date || '')
    if (!date.startsWith(`${monthKey}-`)) continue
    if (!attended.has(record.employeeId)) attended.set(record.employeeId, new Set())
    attended.get(record.employeeId).add(date)
  }
  const perEmployee = new Map()
  for (const request of leaveRequests) {
    if (request?.status !== 'Approved' || !request.requesterId || !['Paid Leave', 'Unpaid Leave'].includes(request.paymentType)) continue
    const dates = scheduledWorkDatesForMonth(request.startDate, request.endDate, monthKey, schedules[request.requesterId] || {})
    if (!perEmployee.has(request.requesterId)) perEmployee.set(request.requesterId, new Map())
    const byDate = perEmployee.get(request.requesterId)
    for (const date of dates) {
      if (attended.get(request.requesterId)?.has(date)) continue
      const previous = byDate.get(date)
      if (previous && previous.paymentType !== request.paymentType) {
        throw Object.assign(new Error(`Conflicting approved leave records exist for ${request.requesterId} on ${date}. Resolve them before payroll.`), { status: 409 })
      }
      byDate.set(date, { paymentType: request.paymentType, hours: scheduledShiftHours(date, schedules[request.requesterId] || {}, shifts) })
    }
  }
  return [...perEmployee.entries()].map(([employeeId, days]) => {
    const rows = [...days.values()]
    const paid = rows.filter(row => row.paymentType === 'Paid Leave')
    const unpaid = rows.filter(row => row.paymentType === 'Unpaid Leave')
    return {
      employeeId,
      paidLeaveDays: paid.length,
      paidLeaveHours: paid.reduce((sum, row) => sum + row.hours, 0),
      unpaidLeaveDays: unpaid.length,
      unpaidLeaveHours: unpaid.reduce((sum, row) => sum + row.hours, 0),
    }
  })
}
