const legacyAdjustments = record => [
  { type: 'tax', label: 'Tax', amount: Number(record?.tax || 0) },
  { type: 'fee', label: 'Delivery', amount: Number(record?.delivery || 0) },
  { type: 'fee', label: 'Other supplier charges', amount: Number(record?.otherCharges || 0) },
  { type: 'discount', label: 'Discount', amount: Number(record?.discount || 0) },
].filter(row => row.amount > 0)

export const quoteAdjustmentRows = record => {
  const rows = Array.isArray(record?.adjustments) && record.adjustments.length
    ? record.adjustments
    : legacyAdjustments(record)
  return rows.map((row, index) => ({
    key: `${row.type || 'adjustment'}-${row.label || index}-${index}`,
    type: row.type || 'fee',
    label: row.label || 'Supplier adjustment',
    amount: Number(row.amount || 0),
  })).filter(row => row.amount > 0)
}

export const quoteAdjustmentDrafts = record => quoteAdjustmentRows(record).map((row, index) => ({
  id: row.key || `adjustment-${index}`,
  type: row.type,
  label: row.label,
  amount: row.amount / 100,
}))

export const quoteTaxTreatment = record => {
  if (['included', 'separate', 'not-applicable'].includes(record?.taxTreatment)) return record.taxTreatment
  const lineTreatments = (record?.lines || []).map(line => line.taxTreatment).filter(Boolean)
  if (lineTreatments.length && lineTreatments.every(value => value === 'vat-inclusive')) return 'included'
  if (lineTreatments.length && lineTreatments.every(value => value === 'vat-exclusive')) return 'separate'
  if (lineTreatments.length && lineTreatments.every(value => ['zero-rated', 'vat-exempt'].includes(value))) return 'not-applicable'
  return Number(record?.tax || 0) > 0 || quoteAdjustmentRows(record).some(row => row.type === 'tax')
    ? 'separate'
    : 'not-applicable'
}

export const quoteTaxTreatmentLabel = treatment => ({
  included: 'Tax included in item prices',
  separate: 'Tax added separately',
  'not-applicable': 'Tax not applicable',
}[treatment] || '')

export const quoteDraftTotal = (lines = [], adjustments = []) =>
  lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
  + adjustments.filter(row => row.type !== 'discount').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  - adjustments.filter(row => row.type === 'discount').reduce((sum, row) => sum + Number(row.amount || 0), 0)

export const quoteDraftIsValid = (lines = [], adjustments = [], taxTreatment = 'not-applicable', statedTotal = '') => {
  if (!lines.length || lines.some(line => !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) <= 0)) return false
  if (!['included', 'separate', 'not-applicable'].includes(taxTreatment)) return false
  if (adjustments.some(row => {
    const amount = Number(row.amount || 0)
    return !Number.isFinite(amount) || amount < 0 || (amount > 0 && !String(row.label || '').trim())
  })) return false
  if (taxTreatment !== 'separate' && adjustments.some(row => row.type === 'tax' && Number(row.amount || 0) > 0)) return false
  const calculated = Math.round(quoteDraftTotal(lines, adjustments) * 100)
  const stated = Math.round(Number(statedTotal) * 100)
  return Number.isFinite(stated) && stated > 0 && calculated > 0 && stated === calculated
}
