export const manilaDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now)

export const validateSupplierQuote = (quote, requestedQuantity, now = new Date()) => {
  const quantity = Number(quote.quantity)
  const price = Number(quote.unitPrice)
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(requestedQuantity)) return 'Quoted quantity must be a whole number between 1 and the requested quantity.'
  if (!/^\d+(\.\d{1,2})?$/.test(String(quote.unitPrice)) || !Number.isFinite(price) || price <= 0 || price > 999999999.99 || !Number.isSafeInteger(Math.round(price * 100) * quantity)) return 'Enter a positive unit price with at most two decimal places, up to PHP 999,999,999.99.'
  const date = String(quote.fulfillmentDate || '')
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return 'Choose a valid fulfillment date.'
  if (date < manilaDate(now)) return 'Fulfillment date cannot be in the past.'
  if (String(quote.notes || '').length > 2000) return 'Notes and terms must be 2,000 characters or fewer.'
  return ''
}
