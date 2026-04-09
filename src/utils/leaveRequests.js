export const PAID_LEAVE_ALLOWANCE = 5

export const LEAVE_TYPES = [
  'Vacation Leave',
  'Sick Leave',
  'Emergency Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Bereavement Leave',
  'Personal Leave'
]

export const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled']

export const PAYMENT_TYPES = ['Paid Leave', 'Unpaid Leave']

export const calculateLeaveDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  const diffMs = end.getTime() - start.getTime()
  return Math.floor(diffMs / 86400000) + 1
}

export const formatLeaveDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return 'No dates'
  if (startDate && endDate && startDate === endDate) return startDate
  if (!startDate) return endDate || 'No dates'
  if (!endDate) return startDate
  return `${startDate} to ${endDate}`
}

export const isPendingLeaveStatus = (status) => String(status || '').trim().toLowerCase() === 'pending'
