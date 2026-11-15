import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePayrollDeductions, payrollDeductionsMatch } from './payrollDeductions.js'

const settings = {
  sssRate: 4.5,
  philHealthRate: 2.5,
  pagIbigRate: 2,
  incomeTaxRate: 10,
  useGraduatedIncomeTax: true,
}

test('calculates deductions with the configured rates and existing graduated brackets', () => {
  const deductions = calculatePayrollDeductions(50000, settings)
  assert.deepEqual(deductions, {
    sss: { amount: 2250, rate: 4.5 },
    philHealth: { amount: 1250, rate: 2.5 },
    pagIbig: { amount: 200, rate: 2, capped: true },
    incomeTax: { amount: 5208.4, rate: 10.42, mode: 'graduated' },
  })
})

test('accepts only payroll deductions that match saved settings and recompute to the submitted totals', () => {
  const grossPay = 50000
  const statutory = calculatePayrollDeductions(grossPay, settings)
  const deductions = { ...statutory, unpaidLeave: { amount: 50, rate: 0, mode: 'hours' } }
  const totalDeductions = Object.values(deductions).reduce((sum, item) => sum + item.amount, 0)
  const payload = { grossPay, settings, settingsSnapshot: { ...settings }, deductions, totalDeductions, netPay: grossPay - totalDeductions }

  assert.equal(payrollDeductionsMatch(payload), true)
  assert.equal(payrollDeductionsMatch({ ...payload, deductions: { ...deductions, sss: { ...deductions.sss, amount: 1 } } }), false)
  assert.equal(payrollDeductionsMatch({ ...payload, settingsSnapshot: { ...settings, sssRate: 2 } }), false)
  assert.equal(payrollDeductionsMatch({ ...payload, totalDeductions: totalDeductions + 1 }), false)
  assert.equal(payrollDeductionsMatch({ ...payload, netPay: 50000 }), false)
  assert.equal(payrollDeductionsMatch({ ...payload, deductions: { ...deductions, unpaidLeave: { amount: null } } }), false)
  assert.throws(() => calculatePayrollDeductions(100, { ...settings, sssRate: 101 }), /between 0 and 100/)
  assert.throws(() => calculatePayrollDeductions(100, { ...settings, useGraduatedIncomeTax: 'false' }), /calculation mode/)
})
