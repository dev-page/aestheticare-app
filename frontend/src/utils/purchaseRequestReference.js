export const createPurchaseRequestNumber = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type).value
  return `PR-${value('year')}${value('month')}${value('day')}-${value('hour')}${value('minute')}${value('second')}${String(date.getMilliseconds()).padStart(3, '0')}`
}

export const purchaseRequestReference = (request = {}) => {
  if (request.requestNumber) return request.requestNumber
  const timestamp = request.createdAt
  const date = timestamp?.toDate ? timestamp.toDate()
    : timestamp?.seconds != null ? new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1e6)
      : timestamp ? new Date(timestamp) : null
  return date && Number.isFinite(date.getTime()) ? createPurchaseRequestNumber(date) : 'Legacy request'
}
