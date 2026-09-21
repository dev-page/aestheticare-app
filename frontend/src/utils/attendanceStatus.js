export const parseClockToMinutes = (timeValue) => {
  if (!timeValue) return null
  const input = String(timeValue).trim().toUpperCase()
  if (!input) return null

  const hasMeridiem = input.includes('AM') || input.includes('PM')
  const clean = input.replace(/\s+/g, '')
  const meridiem = clean.endsWith('AM') ? 'AM' : clean.endsWith('PM') ? 'PM' : ''
  const timePart = meridiem ? clean.slice(0, -2) : clean
  const parts = timePart.split(':')

  if (parts.length < 2) return null

  let hours = Number(parts[0])
  const minutes = Number(parts[1])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  if (hasMeridiem) {
    if (hours === 12) hours = 0
    if (meridiem === 'PM') hours += 12
  }

  return hours * 60 + minutes
}

export const classifyAttendanceRecord = ({
  timeIn,
  timeOut,
  shiftStart,
  shiftEnd,
  dayClassification,
  unpaidMealBreakMinutes,
}) => {
  const hasShiftAssignment = Boolean(String(shiftStart || '').trim() && String(shiftEnd || '').trim())

  const result = {
    // A missing punch alone is not evidence of absence. The attendance UI
    // must wait for schedule, approved-leave, holiday, and cutoff evaluation
    // before a separate workflow marks an employee absent.
    attendanceStatus: hasShiftAssignment ? 'Scheduled' : 'N/A',
    workHoursStatus: hasShiftAssignment ? '-' : 'N/A',
    lateMinutes: 0,
    overtimeMinutes: 0,
    undertimeMinutes: 0,
    totalWorkedMinutes: 0,
    shiftStart: shiftStart || '',
    shiftEnd: shiftEnd || '',
  }

  const inMinutes = parseClockToMinutes(timeIn)
  const outMinutes = parseClockToMinutes(timeOut)
  const shiftStartMinutes = parseClockToMinutes(shiftStart)
  const shiftEndMinutes = parseClockToMinutes(shiftEnd)

  if (inMinutes !== null && outMinutes !== null && outMinutes >= inMinutes) {
    result.totalWorkedMinutes = outMinutes - inMinutes
  }

  if (!hasShiftAssignment) {
    if (timeIn) {
      result.attendanceStatus = 'Logged'
      result.workHoursStatus = timeOut ? 'Completed' : 'No Clock Out'
    }
    return result
  }

  if (timeIn && inMinutes !== null && shiftStartMinutes !== null) {
    result.lateMinutes = Math.max(0, inMinutes - shiftStartMinutes)
    result.attendanceStatus = result.lateMinutes > 0 ? 'Late' : 'Present'
  }

  if (timeIn && !timeOut) {
    result.workHoursStatus = 'No Clock Out'
    return result
  }

  if (timeIn && timeOut && outMinutes !== null && shiftEndMinutes !== null) {
    // Philippine overtime is measured after eight net hours in the workday.
    const rawMinutes = result.totalWorkedMinutes
    const scheduledMinutes = shiftStartMinutes !== null
      ? (shiftEndMinutes >= shiftStartMinutes ? shiftEndMinutes - shiftStartMinutes : shiftEndMinutes + 1440 - shiftStartMinutes)
      : 0
    const mealBreak = Number.isFinite(Number(unpaidMealBreakMinutes))
      ? Math.max(0, Number(unpaidMealBreakMinutes))
      : scheduledMinutes > 480 ? 60 : 0
    result.overtimeMinutes = Math.max(0, rawMinutes - mealBreak - 480)
    result.undertimeMinutes = Math.max(0, shiftEndMinutes - outMinutes)

    if (result.overtimeMinutes > 0) result.workHoursStatus = 'Overtime'
    else if (result.undertimeMinutes > 0) result.workHoursStatus = 'Undertime'
    else result.workHoursStatus = 'On Time'
    return result
  }

  if (timeIn && timeOut) {
    result.workHoursStatus = 'Completed'
  }

  return result
}
