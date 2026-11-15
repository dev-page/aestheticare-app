const toDate = value => {
  if (value?.toDate) return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (value?.seconds) return new Date(value.seconds * 1000)
  return null
}

const monthFromTimestamp = value => {
  const date = toDate(value)
  return date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(date).slice(0, 7) : ''
}

const monthFromRecord = record => {
  for (const key of ['expenseDate', 'invoiceDate', 'payrollPeriod', 'monthKey', 'payPeriodMonthKey']) {
    const value = String(record?.[key] || '').trim()
    if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return value.slice(0, 7)
  }
  return monthFromTimestamp(record?.createdAt || record?.updatedAt)
}

const isActiveRecord = record => !['cancelled', 'void', 'rejected'].includes(String(record?.status || '').toLowerCase())
const roundCurrency = value => Math.round((Number(value) || 0) * 100) / 100

export const summarizeFinanceMonth = ({ transactions = [], payrolls = [], financialRecords = [], monthKey = '' } = {}) => {
  const monthlyTransactions = transactions.filter(transaction => monthFromTimestamp(transaction.createdAt) === monthKey)
  const grossCollections = monthlyTransactions.reduce((sum, transaction) => {
    const amount = Number(transaction.amount || 0)
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum
  }, 0)
  const refunds = monthlyTransactions.reduce((sum, transaction) => {
    const amount = Number(transaction.amount || 0)
    return Number.isFinite(amount) && amount < 0 ? sum + Math.abs(amount) : sum
  }, 0)
  const monthlyPayrolls = payrolls.filter(entry =>
    String(entry.monthKey || entry.payPeriodMonthKey || monthFromTimestamp(entry.createdAt || entry.updatedAt)) === monthKey
    && String(entry.status || '').toLowerCase() === 'approved'
  )
  const monthlyRecords = financialRecords.filter(record => monthFromRecord(record) === monthKey && isActiveRecord(record))
  const payroll = monthlyPayrolls.reduce((sum, entry) => sum + Number(entry.totalPayroll || 0), 0)
  const supplierCosts = monthlyRecords.filter(record => record.kind === 'procurementPayable')
    .reduce((sum, record) => sum + Number(record.amount || 0) / 100, 0)
  const operatingExpenses = monthlyRecords.filter(record => record.kind === 'operatingExpense')
    .reduce((sum, record) => sum + Number(record.amount || 0) / 100, 0)
  const netCollections = roundCurrency(grossCollections - refunds)
  return {
    grossCollections: roundCurrency(grossCollections),
    refunds: roundCurrency(refunds),
    netCollections,
    payroll: roundCurrency(payroll),
    supplierCosts: roundCurrency(supplierCosts),
    operatingExpenses: roundCurrency(operatingExpenses),
    netRecordedActivity: roundCurrency(netCollections - payroll - supplierCosts - operatingExpenses),
    monthlyTransactions,
  }
}

export const financeActivityMonth = monthFromRecord
export const financeTransactionMonth = monthFromTimestamp
