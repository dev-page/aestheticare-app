const toMillis = (value) => {
  if (!value) return 0
  if (typeof value?.toDate === 'function') {
    const date = value.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
  }
  // API responses serialize Firestore Timestamp instances as plain objects.
  // The Admin SDK uses `_seconds`, while SDK/browser payloads may use
  // `seconds`; both must retain the same newest-first ordering.
  if (typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds
    if (Number.isFinite(Number(seconds))) return Number(seconds) * 1000
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  }
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
  }
  return 0
}

export const getRecordTimestampMillis = (record) => {
  if (!record || typeof record !== 'object') return 0
  const fields = [
    'createdAt',
    'updatedAt',
    'approvedAt',
    'archivedAt',
    'rejectedAt',
    'paidAt',
    'completedAt',
    'dateGenerated',
    'date',
    'timestamp',
    'lastUpdatedAt',
  ]
  for (const field of fields) {
    const millis = toMillis(record[field])
    if (millis) return millis
  }
  return 0
}

export const sortRecordsNewestFirst = (records = []) =>
  [...records].sort((a, b) => getRecordTimestampMillis(b) - getRecordTimestampMillis(a))
