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
}) => {
  const hasShiftAssignment = Boolean(String(shiftStart || '').trim() && String(shiftEnd || '').trim())

  const result = {
    attendanceStatus: hasShiftAssignment ? 'Absent' : 'N/A',
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
    result.overtimeMinutes = Math.max(0, outMinutes - shiftEndMinutes)
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
