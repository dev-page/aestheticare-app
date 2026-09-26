const normalized = value => String(value || '').trim().toLowerCase()

// Only settled customer payments count as income. Refund records are stored as
// their own transactions and reduce the total once their amount is recorded.
export const revenueTransactionAmount = transaction => {
  const amount = Number(transaction?.amount ?? transaction?.total ?? 0)
  if (!Number.isFinite(amount)) return 0

  const status = normalized(transaction?.status)
  const type = normalized(transaction?.type)
  const isRefund = status === 'refunded' || type.includes('refund')
  if (isRefund) return -Math.abs(amount)

  return ['paid', 'successful', 'succeeded', 'completed'].includes(status) && amount > 0
    ? amount
    : 0
}

export const sumNetRevenue = (transactions = []) =>
  transactions.reduce((total, transaction) => total + revenueTransactionAmount(transaction), 0)

export const revenueByBranch = (transactions = []) =>
  transactions.reduce((totals, transaction) => {
    const branchId = String(transaction?.branchId || '').trim()
    if (branchId) totals[branchId] = (totals[branchId] || 0) + revenueTransactionAmount(transaction)
    return totals
  }, {})
