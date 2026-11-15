import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeFinanceMonth } from './financeSummary.js'

test('splits gross collections from refunds and subtracts each refund once', () => {
  const summary = summarizeFinanceMonth({
    monthKey: '2026-11',
    transactions: [
      { amount: 1200, createdAt: new Date('2026-11-10T12:00:00Z') },
      { amount: 300, createdAt: new Date('2026-11-11T12:00:00Z') },
      { amount: -250, type: 'refund', createdAt: new Date('2026-11-12T12:00:00Z') },
      { amount: -75, type: 'refund', createdAt: new Date('2026-10-31T12:00:00Z') },
    ],
  })

  assert.equal(summary.grossCollections, 1500)
  assert.equal(summary.refunds, 250)
  assert.equal(summary.netCollections, 1250)
})

test('groups payroll, supplier invoices, and operating expenses by their financial period dates', () => {
  const summary = summarizeFinanceMonth({
    monthKey: '2026-11',
    transactions: [{ amount: 3000, createdAt: new Date('2026-11-01T00:00:00Z') }],
    payrolls: [
      { status: 'approved', monthKey: '2026-11', totalPayroll: 900 },
      { status: 'pending', monthKey: '2026-11', totalPayroll: 200 },
    ],
    financialRecords: [
      { kind: 'procurementPayable', amount: 123456, invoiceDate: '2026-11-07', status: 'Paid' },
      { kind: 'operatingExpense', amount: 50000, expenseDate: '2026-11-08', status: 'Unpaid' },
      { kind: 'operatingExpense', amount: 99900, expenseDate: '2026-10-31', status: 'Paid' },
    ],
  })

  assert.equal(summary.payroll, 900)
  assert.equal(summary.supplierCosts, 1234.56)
  assert.equal(summary.operatingExpenses, 500)
  assert.equal(summary.netRecordedActivity, 365.44)
})
