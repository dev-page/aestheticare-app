export const APPOINTMENT_VAT_RATE_BASIS_POINTS = 1200
export const APPOINTMENT_PLATFORM_COMMISSION_PERCENT = 10

const toCents = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  const cents = Math.round(amount * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

export const buildAppointmentPricing = ({ listedPrice, vatApplicable = false, vatPriceMode = 'exclusive' } = {}) => {
  const listedPriceCents = toCents(listedPrice)
  if (listedPriceCents === null) throw new TypeError('Appointment price must be a finite, non-negative amount.')

  const applicable = vatApplicable === true
  const priceMode = vatPriceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  let subtotalCents = listedPriceCents
  let vatCents = 0
  let totalCents = listedPriceCents

  if (applicable && priceMode === 'inclusive') {
    vatCents = Math.round((listedPriceCents * APPOINTMENT_VAT_RATE_BASIS_POINTS) / (10000 + APPOINTMENT_VAT_RATE_BASIS_POINTS))
    subtotalCents = listedPriceCents - vatCents
  } else if (applicable) {
    vatCents = Math.round((listedPriceCents * APPOINTMENT_VAT_RATE_BASIS_POINTS) / 10000)
    totalCents = listedPriceCents + vatCents
  }

  return {
    version: 1,
    currency: 'PHP',
    listedPrice: listedPriceCents / 100,
    subtotal: subtotalCents / 100,
    vatApplicable: applicable,
    vatRateBasisPoints: applicable ? APPOINTMENT_VAT_RATE_BASIS_POINTS : 0,
    vatPriceMode: priceMode,
    vatAmount: vatCents / 100,
    total: totalCents / 100,
  }
}

export const sumAppointmentPricing = (snapshots = []) => {
  const rows = Array.isArray(snapshots) ? snapshots.filter(Boolean) : []
  const cents = (key) => rows.reduce((sum, row) => sum + Math.round(Number(row[key] || 0) * 100), 0)
  const totalCents = cents('total')
  return {
    version: 1,
    currency: 'PHP',
    listedPrice: cents('listedPrice') / 100,
    subtotal: cents('subtotal') / 100,
    vatApplicable: rows.some(row => row.vatApplicable === true),
    vatRateBasisPoints: rows.some(row => row.vatApplicable === true) ? APPOINTMENT_VAT_RATE_BASIS_POINTS : 0,
    vatPriceMode: rows.length && rows.every(row => row.vatPriceMode === rows[0].vatPriceMode) ? rows[0].vatPriceMode : 'mixed',
    vatAmount: cents('vatAmount') / 100,
    total: totalCents / 100,
  }
}

export const appointmentCommissionAmount = (subtotal) => {
  const subtotalCents = toCents(subtotal)
  if (subtotalCents === null) throw new TypeError('Appointment subtotal must be a finite, non-negative amount.')
  return Math.round((subtotalCents * APPOINTMENT_PLATFORM_COMMISSION_PERCENT) / 100) / 100
}
