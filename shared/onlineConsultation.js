const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback
export const onlinePolicy = (value = {}) => {
  value = value || {}
  return ({
  version: 2, graceMinutes: bounded(value.graceMinutes ?? 10, 10, 0, 30),
  bufferMinutes: Math.max(bounded(value.bufferMinutes ?? 15, 15, 5, 45), bounded(value.graceMinutes ?? 10, 10, 0, 30) + 5),
  interruptionMinutes: 5, confirmationHours: 48,
})
}
export const timestampDate = value => value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : new Date(value)
export const onlineWindow = appointment => {
  const start = new Date(`${appointment.date}T${appointment.time}+08:00`)
  const duration = bounded(appointment.consultationDurationMinutes || appointment.durationMinutes || appointment.totalServiceDurationMinutes || 30, 30, 5, 240)
  const policy = onlinePolicy(appointment.consultationPolicy)
  const actualStart = appointment.startedAt ? timestampDate(appointment.startedAt) : null
  const end = appointment.consultationWindowEndAt ? timestampDate(appointment.consultationWindowEndAt) : new Date((actualStart || start).getTime() + duration * 60000)
  const reserved = appointment.endTime ? new Date(`${appointment.date}T${appointment.endTime}+08:00`) : new Date(start.getTime() + (duration + policy.bufferMinutes) * 60000)
  return { start, actualStart, end, duration, policy, opensAt: new Date(start.getTime() - 5 * 60000), arrivalDeadline: new Date(start.getTime() + policy.graceMinutes * 60000), reservedEnd: reserved }
}
export const consultationRecoveryDeadline = appointment => {
  const window = onlineWindow(appointment)
  if (!appointment?.consultationInterruption?.open) return window.end
  const used = Math.max(0, Number(appointment.consultationExtensionSeconds) || 0)
  const policyAllowance = Math.max(0, window.policy.interruptionMinutes * 60 - used)
  const reservedAllowance = Math.max(0, Math.floor((window.reservedEnd.getTime() - window.end.getTime()) / 1000))
  const remainingAllowance = Math.min(policyAllowance, reservedAllowance)
  return new Date(window.end.getTime() + remainingAllowance * 1000)
}
export const onlineAccessOpen = (appointment, now = Date.now()) => {
  if (!['paid', 'scheduled', 'ready to start', 'ongoing'].includes(String(appointment.status || '').toLowerCase()) || appointment.consultationClientEndedAt) return false
  // Once a consultation has started, keep its app entry open until the
  // practitioner records completion. The booked duration is a scheduling
  // target, not an automatic lockout for an active call.
  if (String(appointment.status || '').toLowerCase() === 'ongoing' && appointment.startedAt) return true
  const window = onlineWindow(appointment)
  return now >= window.opensAt.getTime() && now < (appointment.startedAt ? consultationRecoveryDeadline(appointment) : window.arrivalDeadline).getTime()
}
