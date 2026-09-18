const number = value => Number(value || 0)
const millis = value => typeof value === 'object' ? number(value?._seconds ?? value?.seconds) * 1000 : Date.parse(value || '') || 0
const month = value => millis(value) ? new Date(millis(value)).toISOString().slice(0, 7) : 'Undated'
const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0)
const named = (key, label, select) => ({ key, label, select })
const kind = (data, value) => (data.records || []).filter(row => row.kind === value)
const flags = (data, flag) => (data.items || []).filter(item => item.signals?.includes(flag))
const orders = data => kind(data, 'po')
const ongoing = row => ['Sent to Supplier', 'Supplier Confirmed', 'Ongoing', 'Partially Received'].includes(row.status)
const receipts = data => kind(data, 'receiving')
const inventory = data => data.items || []
const financialRows = data => kind(data, 'budget').map(b => ({ ...b, available: b.total - b.committed - b.spent, utilizationPercent: b.total ? Math.round(10000 * b.spent / b.total) / 100 : 0 }))
export const spendingRows = data => kind(data, 'payment').filter(p => p.status === 'Paid').map(p => {
  const budget = kind(data, 'budget').find(b => b.id === p.budgetId)
  return { ...p, department: budget?.department || '', category: budget?.category || '', month: month(p.paymentDate || p.createdAt), supplier: (data.suppliers || []).find(s => s.id === p.supplierId)?.businessName || p.supplierId }
})
export const supplierPerformance = data => (data.suppliers || []).map(s => {
  const pos = orders(data).filter(p => p.supplierId === s.id), delivered = receipts(data).filter(r => r.supplierId === s.id)
  const lines = delivered.flatMap(r => r.lines || [])
  return { id: s.id, name: s.businessName || s.name, kind: 'supplierPerformance', orders: pos.length, deliveries: delivered.length, acceptedQuantity: sum(lines, 'accepted'), rejectedQuantity: sum(lines, 'rejected'), delayedDeliveries: delivered.filter(r => { const po = pos.find(p => p.id === r.poId); return po && r.deliveryDate > po.deliveryDate }).length, total: sum(spendingRows(data).filter(p => p.supplierId === s.id), 'total'), links: pos.map(p => p.id) }
})
export const traceRows = data => kind(data, 'request').map(request => {
  const related = (data.records || []).filter(r => r.id === request.id || r.links?.includes(request.id)), select = k => related.filter(r => r.kind === k).map(r => r.number).join('; ')
  return { ...request, kind: 'trace', inventoryRequest: request.number, procurement: select('procurement'), rfq: select('rfq'), quotation: select('quotation'), evaluation: select('evaluation'), budgetApproval: select('budgetRequest'), purchaseOrder: select('po'), receiving: select('receiving'), invoice: select('invoice'), payment: select('payment'), links: related.map(r => r.id), total: sum(related.filter(r => r.kind === 'payment' && r.status === 'Paid'), 'total') }
})
export const reportDefinitions = {
  inventory: [
    named('current', 'Current Inventory', inventory), named('low', 'Low Stock', d => flags(d, 'For Restocking')), named('over', 'Overstock', d => flags(d, 'Overstocked')),
    named('expiring', 'Expiring Items', d => flags(d, 'Expiring Soon')), named('expired', 'Expired Items', d => flags(d, 'Expired')),
    named('movement', 'Inventory Movement', d => (d.movements || []).map(m => ({ ...m, kind: 'movement', number: m.type, links: [m.inventoryItemId, m.receivingId, m.poId].filter(Boolean) }))),
    named('equipment', 'Equipment Condition', d => inventory(d).filter(i => i.itemType === 'Equipment')), named('requests', 'Inventory Requests', d => kind(d, 'request')),
    named('history', 'Stock History', d => (d.snapshots || []).map(s => ({ ...s, name: inventory(d).find(i => i.id === s.itemId)?.name || s.itemId, kind: 'snapshot', signals: s.flags, createdAt: s.date }))),
  ],
  procurement: [named('requests', 'Procurement Requests', d => kind(d, 'procurement')), named('rfqs', 'RFQs', d => kind(d, 'rfq')), named('quotes', 'Supplier Quotations & Comparison', d => kind(d, 'quotation')), named('selection', 'Supplier Selection', d => kind(d, 'evaluation')), named('orders', 'Purchase Orders', orders), named('ongoing', 'Ongoing Orders', d => orders(d).filter(ongoing)), named('completed', 'Completed Orders', d => orders(d).filter(r => r.status === 'Completed')), named('cancelled', 'Cancelled Orders', d => orders(d).filter(r => r.status === 'Cancelled')), named('spending', 'Procurement Spending', spendingRows)],
  finance: [named('budget', 'Budget Balances & Utilization', financialRows), named('requests', 'Budget Requests', d => kind(d, 'budgetRequest')), named('decisions', 'Approved / Rejected Funding', d => kind(d, 'budgetRequest').filter(r => ['Approved', 'Rejected', 'Returned'].includes(r.status))), named('spending', 'Procurement Spending', spendingRows), named('invoices', 'Invoice Report', d => kind(d, 'invoice')), named('pending', 'Pending Payments', d => kind(d, 'invoice').filter(r => r.status !== 'Paid')), named('completed', 'Completed / Supplier Payments', spendingRows), named('department', 'Spending by Department', d => summarize(spendingRows(d), 'department')), named('category', 'Spending by Category', d => summarize(spendingRows(d), 'category'))],
  logistics: [named('expected', 'Expected Deliveries', d => orders(d).filter(ongoing)), named('history', 'Delivery History', receipts), named('delayed', 'Delayed Deliveries', (d, today) => orders(d).filter(r => ongoing(r) && r.deliveryDate < today)), named('receiving', 'Receiving History', receipts), named('partial', 'Partial Deliveries', d => orders(d).filter(r => r.status === 'Partially Received')), named('quantity', 'Quantity Discrepancies', d => receipts(d).filter(r => r.lines.some(l => l.delivered !== l.ordered || l.rejected > 0))), named('damaged', 'Damaged / Rejected Goods', d => kind(d, 'discrepancy')), named('performance', 'Supplier Delivery Performance', supplierPerformance)],
  management: [named('trace', 'Inventory Need to Payment', traceRows), named('performance', 'Supplier Delivery Performance', supplierPerformance), named('spending', 'Organization Spending', spendingRows)],
  supplier: [named('rfqs', 'My RFQs', d => kind(d, 'rfq')), named('quotes', 'My Quotations', d => kind(d, 'quotation')), named('orders', 'My Purchase Orders', orders), named('invoices', 'My Invoices', d => kind(d, 'invoice')), named('payments', 'My Payments', d => kind(d, 'payment'))],
}
const summarize = (rows, key) => {
  const groups = new Map()
  for (const row of rows) { const name = row[key] || 'Unspecified'; if (!groups.has(name)) groups.set(name, { id: name, name, kind: 'summary', total: 0, payments: 0 }); const group = groups.get(name); group.total += number(row.total); group.payments++ }
  return [...groups.values()]
}
const chart = (title, entries, money = false) => ({ title, entries, money, max: Math.max(1, ...entries.map(e => Math.abs(e.value))) })
const grouped = (title, rows, key, amount) => {
  const groups = new Map()
  for (const r of rows) { const label = typeof key === 'function' ? key(r) : r[key] || 'Unspecified'; groups.set(label, (groups.get(label) || 0) + (amount ? number(r[amount]) : 1)) }
  return chart(title, [...groups.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([label, value]) => ({ label, value })), Boolean(amount && amount === 'total'))
}
export function dashboardCharts(data, department) {
  const items = inventory(data), records = data.records || [], spending = spendingRows(data)
  if (department === 'finance' || department === 'management') {
    const budgets = financialRows(data)
    return [chart('Budget utilization', [{ label: 'Available', value: sum(budgets, 'available') }, { label: 'Committed', value: sum(budgets, 'committed') }, { label: 'Actual spending', value: sum(budgets, 'spent') }], true), grouped('Spending by department', spending, 'department', 'total'), grouped('Spending by category', spending, 'category', 'total'), grouped('Monthly procurement spending', spending, 'month', 'total'), grouped('Supplier spending', spending, 'supplier', 'total')]
  }
  if (department === 'inventory') return [grouped('Inventory by category', items, 'category'), grouped('Inventory by item type', items, 'itemType'), grouped('Equipment condition', items.filter(i => i.itemType === 'Equipment'), 'condition'), grouped('Consumable vs non-consumable', items.filter(i => i.itemType !== 'Equipment'), 'consumability'), grouped('Inventory movement over time', data.movements || [], r => month(r.createdAt), 'quantity'), grouped('Daily low-stock observations', (data.snapshots || []).filter(s => s.flags?.includes('For Restocking')), 'date')]
  if (department === 'logistics') return [grouped('Delivery status', orders(data), 'status'), chart('Inspection quantities', ['accepted', 'rejected'].map(key => ({ label: key, value: sum(receipts(data).flatMap(r => r.lines), key) }))), grouped('Deliveries by month', receipts(data), r => month(r.deliveryDate))]
  return [grouped('RFQ status', kind(data, 'rfq'), 'status'), grouped('Quotation status', kind(data, 'quotation'), 'status'), grouped('Purchase order status', orders(data), 'status'), grouped('Procurement mode', orders(data), 'mode')]
}

export function exportReportCsv(rows) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(k => !['imageUrl', 'storagePath'].includes(k))
  const cell = value => { const text = typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''); return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"' }
  return '\uFEFF' + [keys.map(cell).join(','), ...rows.map(row => keys.map(key => cell(row[key])).join(','))].join('\r\n')
}
