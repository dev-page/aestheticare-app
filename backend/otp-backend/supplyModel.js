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
  if (['damaged', 'defective', 'under repair', 'bad'].includes(String(item.condition || '').toLowerCase())) flags.push('Needs Attention')
  return flags
}
export const quoteTotals = input => {
  demand(Array.isArray(input.lines) && input.lines.length > 0 && input.lines.length <= 50, 'Provide 1–50 quotation lines.', 400)
  const seen = new Set()
  const lines = input.lines.map(line => {
    const itemId = required(line.itemId, 'Item')
    demand(!seen.has(itemId), 'Duplicate item lines are not allowed.', 400); seen.add(itemId)
    const count = quantity(line.quantity), unitPrice = money(line.unitPrice)
    return { itemId, name: String(line.name || ''), unit: String(line.unit || 'units'), quantity: count, unitPrice, total: count * unitPrice }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const charges = Object.fromEntries(['tax', 'delivery', 'otherCharges', 'discount'].map(key => [key, money(input[key] || 0)]))
  const total = subtotal + charges.tax + charges.delivery + charges.otherCharges - charges.discount
  demand(Number.isSafeInteger(total) && total > 0, 'Quotation total must be positive.', 400)
  return { lines, subtotal, ...charges, total }
}
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
  for (const key of ['tax', 'delivery', 'otherCharges']) {
    const used = otherInvoices.filter(r => ['Matched', 'Approved for Payment', 'Paid'].includes(r.status)).reduce((sum, r) => sum + Number(r[key] || 0), 0)
    if (used + Number(invoice[key] || 0) > Number(po[key] || 0)) issues.push(`${key}: charges exceed the PO allowance`)
  }
  return issues
}
export const permissionsByKind = {
  request: ['inventory:view', 'inventory:create', 'inventory:review', 'procurement:view', 'finance:payables:view'],
  procurement: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:payables:view'],
  rfq: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:payables:view'],
  quotation: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:payables:view'],
  evaluation: ['procurement:view', 'procurement:review', 'finance:payables:view'],
  budget: ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle'],
  budgetRequest: ['procurement:view', 'procurement:review', 'finance:payables:view', 'finance:payables:approve'],
  po: ['procurement:view', 'procurement:review', 'orders:view', 'orders:update', 'finance:payables:view', 'finance:payables:settle'],
  receiving: ['orders:view', 'orders:update', 'inventory:view', 'finance:payables:view', 'procurement:view'],
  discrepancy: ['orders:view', 'orders:update', 'procurement:view'],
  invoice: ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle', 'procurement:view'],
  payment: ['finance:payables:view', 'finance:payables:settle', 'procurement:view'],
}
export const hasPermission = (context, permission) => context.permissions.has(permission) || context.permissions.has('administrator:full_access')
export const supplierCanRead = (record, supplierIds) => record.mode === 'Online' && (
  (record.kind === 'rfq' && record.status !== 'Draft' && record.supplierIds?.some(id => supplierIds.includes(id)))
  || (['quotation', 'po', 'invoice', 'payment'].includes(record.kind) && supplierIds.includes(record.supplierId) && !(record.kind === 'po' && record.status === 'Draft'))
)
export const supplierProjection = record => {
  const allowed = ['id', 'kind', 'number', 'status', 'branchId', 'mode', 'supplierId', 'rfqId', 'poId', 'invoiceId', 'lines', 'subtotal', 'total', 'tax', 'discount', 'delivery', 'otherCharges', 'deadline', 'deliveryDate', 'deliveryLocation', 'terms', 'contact', 'validUntil', 'leadDays', 'paymentTerms', 'warranty', 'notes', 'invoiceNumber', 'invoiceDate', 'dueDate', 'accepted', 'paidAmount', 'createdAt', 'updatedAt', 'confirmationReason']
  return Object.fromEntries(allowed.filter(key => record[key] !== undefined).map(key => [key, record[key]]))
}
