export const SUPPLIER_BUSINESS_TYPES = [
  'Sole Proprietorship',
  'Corporation',
  'Partnership',
  'Other',
]

export const normalizeTinDigits = (value) =>
  String(value || '')
    .replace(/\D/g, '')
    .slice(0, 12)

export const formatTinDisplay = (value) => {
  const digits = normalizeTinDigits(value)
  if (!digits) return ''
  return digits.match(/.{1,3}/g)?.join('-') || digits
}

export const isValidTinDigits = (value) => {
  const digits = normalizeTinDigits(value)
  return /^\d{12}$/.test(digits) && !/^0+$/.test(digits)
}
