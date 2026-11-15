export const DEFAULT_PAYROLL_DEDUCTION_SETTINGS = Object.freeze({
  sssRate: 4.5,
  philHealthRate: 2.5,
  pagIbigRate: 2,
  incomeTaxRate: 10,
  useGraduatedIncomeTax: true,
})

const roundCurrency = value => Math.round((Number(value) || 0) * 100) / 100
const roundRate = value => Math.round((Number(value) || 0) * 100) / 100

export const normalizePayrollDeductionSettings = input => {
  const source = input || {}
  const graduated = source.useGraduatedIncomeTax ?? DEFAULT_PAYROLL_DEDUCTION_SETTINGS.useGraduatedIncomeTax
  if (typeof graduated !== 'boolean') throw Object.assign(new Error('Choose a valid income tax calculation mode.'), { status: 400 })
  const settings = {
    sssRate: Number(source.sssRate ?? DEFAULT_PAYROLL_DEDUCTION_SETTINGS.sssRate),
    philHealthRate: Number(source.philHealthRate ?? DEFAULT_PAYROLL_DEDUCTION_SETTINGS.philHealthRate),
    pagIbigRate: Number(source.pagIbigRate ?? DEFAULT_PAYROLL_DEDUCTION_SETTINGS.pagIbigRate),
    incomeTaxRate: Number(source.incomeTaxRate ?? DEFAULT_PAYROLL_DEDUCTION_SETTINGS.incomeTaxRate),
    useGraduatedIncomeTax: graduated,
  }
  for (const key of ['sssRate', 'philHealthRate', 'pagIbigRate', 'incomeTaxRate']) {
    if (!Number.isFinite(settings[key]) || settings[key] < 0 || settings[key] > 100) {
      throw Object.assign(new Error(`${key} must be between 0 and 100 percent.`), { status: 400 })
    }
    settings[key] = roundRate(settings[key])
  }
  return settings
}

const graduatedIncomeTax = gross => {
  if (gross <= 20833) return 0
  if (gross <= 33332) return (gross - 20833) * 0.15
  if (gross <= 66666) return 1875 + (gross - 33333) * 0.2
  if (gross <= 166666) return 8541.8 + (gross - 66667) * 0.25
  if (gross <= 666666) return 33541.8 + (gross - 166667) * 0.3
  return 183541.8 + (gross - 666667) * 0.35
}

export const calculatePayrollDeductions = (grossPay, inputSettings = {}) => {
  const gross = Number(grossPay)
  if (!Number.isFinite(gross) || gross < 0) throw Object.assign(new Error('Payroll gross pay must be a non-negative amount.'), { status: 400 })
  const settings = normalizePayrollDeductionSettings(inputSettings)
  const sss = gross * settings.sssRate / 100
  const philHealth = gross * settings.philHealthRate / 100
  const pagIbigRaw = gross * settings.pagIbigRate / 100
  const pagIbig = Math.min(pagIbigRaw, 200)
  const incomeTax = settings.useGraduatedIncomeTax ? graduatedIncomeTax(gross) : gross * settings.incomeTaxRate / 100
  return {
    sss: { amount: roundCurrency(sss), rate: settings.sssRate },
    philHealth: { amount: roundCurrency(philHealth), rate: settings.philHealthRate },
    pagIbig: { amount: roundCurrency(pagIbig), rate: settings.pagIbigRate, capped: pagIbigRaw > 200 },
    incomeTax: {
      amount: roundCurrency(incomeTax),
      rate: gross > 0 ? roundRate(incomeTax / gross * 100) : 0,
      mode: settings.useGraduatedIncomeTax ? 'graduated' : 'flat',
    },
  }
}

const near = (left, right) => Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) < 0.011

export const payrollDeductionsMatch = ({ grossPay, settings, settingsSnapshot, deductions, totalDeductions, netPay } = {}) => {
  try {
    const policy = normalizePayrollDeductionSettings(settings)
    const snapshot = normalizePayrollDeductionSettings(settingsSnapshot)
    if (Object.keys(policy).some(key => policy[key] !== snapshot[key])) return false
    const expected = calculatePayrollDeductions(grossPay, policy)
    if (!deductions || typeof deductions !== 'object') return false
    for (const key of Object.keys(expected)) {
      if (!near(deductions[key]?.amount, expected[key].amount) || !near(deductions[key]?.rate, expected[key].rate)) return false
      if (key === 'incomeTax' && deductions[key]?.mode !== expected[key].mode) return false
      if (key === 'pagIbig' && Boolean(deductions[key]?.capped) !== expected[key].capped) return false
    }
    const other = Object.entries(deductions).filter(([key]) => !Object.hasOwn(expected, key))
    if (other.some(([key, value]) => key !== 'unpaidLeave' || !value || !Number.isFinite(Number(value.amount)) || Number(value.amount) < 0)) return false
    const calculatedTotal = Object.values(deductions).reduce((sum, value) => sum + Number(value?.amount || 0), 0)
    return near(totalDeductions, calculatedTotal) && near(netPay, Number(grossPay) - calculatedTotal)
  } catch {
    return false
  }
}
