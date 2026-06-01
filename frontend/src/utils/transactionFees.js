export const PRODUCT_COMMISSION_PERCENT = 5
export const SERVICE_COMMISSION_PERCENT = 10

const normalizePercent = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, 100)
}

export const getProductCommissionPercent = () => PRODUCT_COMMISSION_PERCENT

export const getServiceCommissionPercent = () => SERVICE_COMMISSION_PERCENT

export const calculateCommissionAmount = (amount, percent = SERVICE_COMMISSION_PERCENT) => {
  const normalizedAmount = Number(amount || 0)
  const normalizedPercent = normalizePercent(percent, SERVICE_COMMISSION_PERCENT)
  return Number(((normalizedAmount * normalizedPercent) / 100).toFixed(2))
}

export const calculateCommissionRate = (percent = SERVICE_COMMISSION_PERCENT) => {
  const normalizedPercent = normalizePercent(percent, SERVICE_COMMISSION_PERCENT)
  return Number((normalizedPercent / 100).toFixed(4))
}

export const calculateNetAmount = (amount, commissionAmount = 0) => {
  const normalizedAmount = Number(amount || 0)
  const normalizedCommission = Number(commissionAmount || 0)
  return Number((normalizedAmount - normalizedCommission).toFixed(2))
}
