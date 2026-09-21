// Attendance policy is deliberately independent of HTTP and Firestore.
export function demand(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), { status })
}

export function dateKey(value) {
  const text = String(value || '')
  demand(/^\d{4}-\d{2}-\d{2}$/.test(text) && new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text, 'Use a valid YYYY-MM-DD date.')
  return text
}

export function clock(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  demand(match, 'Use a valid time such as 08:30 or 5:30 PM.')
  let hours = Number(match[1])
  const minutes = Number(match[2]), seconds = Number(match[3] || 0)
  demand(minutes < 60 && seconds < 60 && (match[4] ? hours >= 1 && hours <= 12 : hours <= 23), 'Invalid clock time.')
  if (match[4]) hours = hours % 12 + (match[4].toUpperCase() === 'PM' ? 12 : 0)
  return `${String(hours).padStart(2, '0')}:${match[2]}:${String(seconds).padStart(2, '0')}`
}

export function punches(date, timeIn, timeOut, overnight = false) {
  dateKey(date)
  const start = clock(timeIn), end = clock(timeOut)
  demand(!end || start, 'Time out requires time in.')
  const inMs = start ? Date.parse(`${date}T${start}+08:00`) : null
  let outMs = end ? Date.parse(`${date}T${end}+08:00`) : null
  if (outMs !== null && outMs <= inMs) {
    demand(overnight, 'Time out must follow time in; explicitly select overnight for a shift crossing midnight.')
    outMs += 86400000
  }
  return { timeIn: start, timeOut: end, timeInEpoch: inMs, timeOutEpoch: outMs,
    totalWorkedMinutes: outMs === null ? 0 : Math.round((outMs - inMs) / 60000),
    attendanceStatus: end ? 'Complete' : start ? 'On Duty' : 'Needs Review' }
}

export function validateField(input) {
  const label = String(input.label || '').trim()
  demand(label.length > 0 && label.length <= 80, 'Field label must have 1–80 characters.')
  demand(['text', 'number', 'date', 'dropdown', 'boolean'].includes(input.type), 'Unsupported field type.')
  const options = input.type === 'dropdown' ? [...new Set((input.options || []).map(v => String(v).trim()).filter(Boolean))] : []
  demand(input.type !== 'dropdown' || (options.length > 0 && options.length <= 30 && options.every(v => v.length <= 80)), 'Provide 1–30 dropdown options of at most 80 characters.')
  return { label, type: input.type, options }
}

export function fieldValues(values = {}, fields = [], previous = {}) {
  demand(values && typeof values === 'object' && !Array.isArray(values), 'Invalid custom field values.')
  const result = { ...previous }
  for (const [id, value] of Object.entries(values)) {
    const field = fields.find(f => f.id === id && !f.archived)
    demand(field, 'Unknown or archived custom field.')
    if (value === '' || value === null) { result[id] = null; continue }
    if (field.type === 'number') demand(typeof value === 'number' && Number.isFinite(value), `${field.label} must be a number.`)
    if (field.type === 'boolean') demand(typeof value === 'boolean', `${field.label} must be Yes or No.`)
    if (field.type === 'date') dateKey(value)
    if (field.type === 'dropdown') demand(field.options.includes(value), `${field.label} has an invalid option.`)
    if (field.type === 'text') demand(typeof value === 'string' && value.length <= 1000, `${field.label} must be text of at most 1000 characters.`)
    result[id] = value
  }
  return result
}

export function verifyLocation(evidence, branch, now = Date.now()) {
  const numeric = v => typeof v === 'number' && Number.isFinite(v)
  const { latitude, longitude, accuracy, locationTimestamp } = evidence
  demand(numeric(latitude) && numeric(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180, 'Valid location coordinates are required.')
  const settings = branch.attendanceSettings || {}
  demand(numeric(accuracy) && accuracy >= 0 && accuracy <= Number(settings.maxAccuracyMeters || 150), 'Location accuracy is too low. Move to an open area and try again.')
  demand(numeric(locationTimestamp) && now - locationTimestamp <= 60000 && now - locationTimestamp >= -10000, 'Your location is stale. Scan again for a fresh reading.')
  const lat = branch.latitude ?? branch.lat ?? branch.clinicLocationLat
  const lng = branch.longitude ?? branch.lng ?? branch.clinicLocationLng
  demand(lat !== '' && lat != null && lng !== '' && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180, 'The branch attendance location is not configured.')
  const rad = v => v * Math.PI / 180
  const a = Math.sin(rad(latitude - Number(lat)) / 2) ** 2 + Math.cos(rad(latitude)) * Math.cos(rad(Number(lat))) * Math.sin(rad(longitude - Number(lng)) / 2) ** 2
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
  demand(distance <= Math.max(25, Math.min(1000, Number(settings.geofenceRadiusMeters || 150))), 'You are outside the allowed attendance area.')
  return Math.round(distance)
}

export function scanAction(existing, intent, now) {
  demand(['clock_in', 'clock_out'].includes(intent), 'Choose a clock-in or clock-out action.')
  demand(existing.source !== 'imported', 'Imported attendance requires HR review.', 409)
  demand(!existing.timeOut, 'Attendance is already complete.', 409)
  const expected = existing.timeIn ? 'clock_out' : 'clock_in'
  demand(intent === expected, 'Attendance changed since this page loaded. Refresh before scanning again.', 409)
  if (intent === 'clock_out') demand(!existing.timeInEpoch || now - existing.timeInEpoch >= 60000, 'Wait at least one minute after clock-in before clocking out.', 409)
  return expected
}
