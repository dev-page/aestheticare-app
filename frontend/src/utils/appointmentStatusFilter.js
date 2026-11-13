export const APPOINTMENT_STATUS_FILTERS = Object.freeze([
  { value: '', label: 'All statuses' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'finished', label: 'Finished' },
])

const STATUS_GROUPS = new Map([
  ['scheduled', 'upcoming'],
  ['paid', 'upcoming'],
  ['checked in', 'in_progress'],
  ['ready to start', 'in_progress'],
  ['ongoing', 'in_progress'],
  ['completed', 'finished'],
  ['cancelled', 'finished'],
  ['canceled', 'finished'],
  ['no show', 'finished'],
  ['incomplete', 'finished'],
  ['rejected', 'finished'],
  ['booking rejected', 'finished'],
  ['expired', 'finished'],
  ['forfeited', 'finished'],
])

export function appointmentStatusGroup(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return STATUS_GROUPS.get(normalized) || 'needs_attention'
}
