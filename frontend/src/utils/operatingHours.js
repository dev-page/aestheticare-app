const parseTimeMinutes = (time) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || ''))
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export const hasValidOperatingHours = (operatingHours, dayKeys) => {
  const openDays = dayKeys.filter((key) => operatingHours?.[key]?.closed !== true)
  if (!openDays.length) return false

  return openDays.every((key) => {
    const ranges = operatingHours?.[key]?.ranges
    if (!Array.isArray(ranges) || ranges.length !== 1) return false

    const open = parseTimeMinutes(ranges[0]?.open)
    const close = parseTimeMinutes(ranges[0]?.close)
    const duration = close - open
    return open !== null && close !== null && duration >= 240 && duration <= 720
  })
}
