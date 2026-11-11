export const demand = (condition, message, status = 409) => { if (!condition) throw Object.assign(new Error(message), { status }) }
export const money = value => {
  const result = Math.round(Number(value) * 100)
  demand(Number.isSafeInteger(result) && result >= 0, 'Enter a valid non-negative monetary amount.', 400)
  return result
}
export const quantity = (value, allowZero = false) => {
  const result = Number(value)
  demand(Number.isSafeInteger(result) && result >= (allowZero ? 0 : 1), 'Quantity must be a whole number.', 400)
  return result
}
export const required = (value, label) => { const text = String(value || '').trim(); demand(text && text.length <= 4000, `${label} is required (up to 4000 characters).`, 400); return text }
export const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const dateKey = value => { const text = String(value || ''); const parsed = new Date(text); demand(/^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text, 'A valid date is required.', 400); return text }
export const stockSignals = (item, today = day()) => {
  const flags = []
  const stock = Number(item.currentStock || 0)
  if (stock <= Number(item.minStock || 0)) flags.push('For Restocking')
  const max = Number(item.maxStock || item.targetStock || 0)
  if (max > 0 && stock > max) flags.push('Overstocked')
  if (item.expiryDate) {
    const days = (Date.parse(item.expiryDate) - Date.parse(today)) / 86400000
    if (days < 0) flags.push('Expired')
    else if (days <= 30) flags.push('Expiring Soon')
  }
  if (item.itemType === 'Equipment' && ['damaged', 'defective', 'under repair', 'bad'].includes(String(item.condition || '').toLowerCase())) flags.push('Needs Attention')
  return flags
}
const legacyQuoteAdjustments = input => [
  { type: 'tax', label: 'Tax', amount: input.tax || 0 },
  { type: 'fee', label: 'Delivery', amount: input.delivery || 0 },
  { type: 'fee', label: 'Other supplier charges', amount: input.otherCharges || 0 },
  { type: 'discount', label: 'Discount', amount: input.discount || 0 },
]
const hasLegacyQuoteAmounts = input => ['tax', 'delivery', 'otherCharges', 'discount'].some(key => Number(input[key] || 0) !== 0)
export const quoteAdjustmentRows = record => {
  if (Array.isArray(record?.adjustments) && (record.adjustments.length > 0 || !hasLegacyQuoteAmounts(record || {}))) return record.adjustments.filter(row => Number(row?.amount || 0) > 0).map(row => ({
    type: String(row.type || ''), label: String(row.label || ''), amount: Number(row.amount || 0),
  }))
  return legacyQuoteAdjustments(record || {}).map(row => ({ ...row, amount: Number(row.amount || 0) })).filter(row => row.amount > 0)
}
const normalizeQuoteAdjustments = input => {
  const suppliedRows = Array.isArray(input.adjustments) && (input.adjustments.length > 0 || !hasLegacyQuoteAmounts(input))
  if (suppliedRows && input.adjustments.length && hasLegacyQuoteAmounts(input)) {
    demand(false, 'Enter either itemized adjustments or the older summary amounts, not both.', 400)
  }
  const rawRows = suppliedRows ? input.adjustments : legacyQuoteAdjustments(input)
  demand(rawRows.length <= 30, 'A quotation can have at most 30 tax, fee, or discount rows.', 400)
  const adjustments = rawRows.map(row => {
    const amount = money(row?.amount || 0)
    if (!amount) return null
    const type = String(row.type || '')
    demand(['tax', 'fee', 'discount'].includes(type), 'Choose whether each adjustment is tax, a fee, or a discount.', 400)
    const label = String(row.label || '').trim()
    demand(label && label.length <= 120, 'Each adjustment needs a description of up to 120 characters.', 400)
    return { type, label, amount }
  }).filter(Boolean)
  const hasTax = adjustments.some(row => row.type === 'tax')
  const taxTreatment = String(input.taxTreatment || (hasTax ? 'separate' : 'not-applicable'))
  demand(['included', 'separate', 'not-applicable'].includes(taxTreatment), 'Choose how the supplier quote handles tax.', 400)
  demand(taxTreatment === 'separate' || !hasTax, taxTreatment === 'included'
    ? 'Remove the separate tax amount because tax is already included in the item prices.'
    : 'Remove the tax amount because tax is marked not applicable.', 400)
  return { adjustments, taxTreatment }
}
export const quoteTotals = (input, { requireStatedTotal = false } = {}) => {
  demand(Array.isArray(input.lines) && input.lines.length > 0 && input.lines.length <= 50, 'Provide 1–50 quotation lines.', 400)
  const seen = new Set()
  const lines = input.lines.map(line => {
    const itemId = required(line.itemId, 'Item')
    demand(!seen.has(itemId), 'Duplicate item lines are not allowed.', 400); seen.add(itemId)
    const count = quantity(line.quantity), unitPrice = money(line.unitPrice)
    return { itemId, name: String(line.name || ''), unit: String(line.unit || 'units'), quantity: count, unitPrice, total: count * unitPrice }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const { adjustments, taxTreatment } = normalizeQuoteAdjustments(input)
  const sumType = type => adjustments.filter(row => row.type === type).reduce((sum, row) => sum + row.amount, 0)
  const tax = sumType('tax'), discount = sumType('discount')
  const delivery = adjustments.filter(row => row.type === 'fee' && /delivery|shipping|freight/i.test(row.label)).reduce((sum, row) => sum + row.amount, 0)
  const otherCharges = adjustments.filter(row => row.type === 'fee' && !/delivery|shipping|freight/i.test(row.label)).reduce((sum, row) => sum + row.amount, 0)
  const charges = { tax, delivery, otherCharges, discount }
  const fees = sumType('fee')
  const total = subtotal + tax + fees - discount
  demand(Number.isSafeInteger(total) && total > 0, 'Quotation total must be positive.', 400)
  const hasStatedTotal = input.statedTotal !== undefined && input.statedTotal !== null && String(input.statedTotal).trim() !== ''
  const usesItemizedPricing = Array.isArray(input.adjustments) || input.taxTreatment !== undefined
  demand(!requireStatedTotal || !usesItemizedPricing || hasStatedTotal, 'Enter the supplier-stated grand total.', 400)
  const statedTotal = hasStatedTotal ? money(input.statedTotal) : undefined
  demand(statedTotal === undefined || statedTotal === total, 'The supplier-stated total does not match the calculated total. Check item prices, tax, fees, and discount.', 400)
  return { lines, subtotal, ...charges, adjustments, taxTreatment, ...(statedTotal === undefined ? {} : { statedTotal }), total }
}
export const PURCHASE_ORDER_STATUSES = ['Draft', 'For Review', 'Approved', 'Rejected', 'Receiving', 'Completed']
export const invoiceMatch = (po, invoice, otherInvoices) => {
  const issues = []
  for (const line of invoice.lines) {
    const ordered = po.lines.find(entry => entry.itemId === line.itemId)
    const billed = otherInvoices.filter(r => ['Matched', 'Approved for Payment', 'Paid'].includes(r.status)).reduce((sum, r) => sum + (r.lines.find(l => l.itemId === line.itemId)?.quantity || 0), 0)
    if (!ordered || ordered.unitPrice !== line.unitPrice) issues.push(`${line.name || line.itemId}: price does not match the PO`)
    if (line.quantity + billed > Number(po.accepted?.[line.itemId] || 0)) issues.push(`${line.name || line.itemId}: invoiced quantity exceeds accepted inventory`)
  }
  const billedTotal = otherInvoices.filter(r => ['Matched', 'Approved for Payment', 'Paid'].includes(r.status)).reduce((sum, r) => sum + r.total, 0)
  if (billedTotal + invoice.total > po.total) issues.push('Cumulative invoices exceed the purchase order total')
  if (po.taxTreatment && invoice.taxTreatment && po.taxTreatment !== invoice.taxTreatment) issues.push('Supplier invoice tax treatment differs from the purchase order')
  const allowanceByRow = new Map()
  for (const row of quoteAdjustmentRows(po)) {
    const key = `${row.type}:${row.label.trim().toLowerCase()}`
    allowanceByRow.set(key, (allowanceByRow.get(key) || 0) + row.amount)
  }
  const usedByRow = new Map()
  for (const prior of otherInvoices.filter(r => ['Matched', 'Approved for Payment', 'Paid'].includes(r.status))) {
    for (const row of quoteAdjustmentRows(prior)) {
      const key = `${row.type}:${row.label.trim().toLowerCase()}`
      usedByRow.set(key, (usedByRow.get(key) || 0) + row.amount)
    }
  }
  for (const row of quoteAdjustmentRows(invoice)) {
    const key = `${row.type}:${row.label.trim().toLowerCase()}`
    const allowance = allowanceByRow.get(key) || 0
    const used = usedByRow.get(key) || 0
    if (used + row.amount > allowance) issues.push(`${row.label}: adjustment exceeds the PO allowance`)
  }
  return issues
}
export const permissionsByKind = {
  request: ['inventory:view', 'inventory:create', 'inventory:review', 'procurement:view', 'finance:payables:view'],
  procurement: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:payables:view'],
  rfq: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:payables:view'],
  quotation: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:payables:view'],
  evaluation: ['procurement:view', 'procurement:review', 'finance:payables:view'],
  financeApproval: ['procurement:view', 'procurement:review', 'finance:payables:view', 'finance:payables:approve'],
  budgetAllocation: ['procurement:view', 'finance:payables:view', 'finance:payables:approve'],
  budget: ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle'],
  budgetRequest: ['procurement:view', 'procurement:review', 'finance:payables:view', 'finance:payables:approve'],
  po: ['procurement:view', 'procurement:review', 'inventory:view', 'finance:payables:view', 'finance:payables:settle'],
  supplierConfirmation: ['procurement:view', 'procurement:review', 'inventory:view'],
  receiving: ['inventory:view', 'procurement:view', 'finance:payables:view'],
  inspection: ['inventory:view', 'procurement:view', 'finance:payables:view'],
  discrepancy: ['inventory:view', 'procurement:view'],
  invoice: ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle', 'procurement:view'],
  threeWayMatch: ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle', 'procurement:view'],
  payment: ['finance:payables:view', 'finance:payables:settle', 'procurement:view'],
}
export const hasPermission = (context, permission) => context.permissions.has(permission) || context.permissions.has('administrator:full_access')
