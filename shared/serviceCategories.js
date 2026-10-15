export const OTHER_SERVICE_CATEGORY = 'Other'
export const DEFAULT_SERVICE_CATEGORIES = Object.freeze([
  'Facial Treatments', 'Laser Treatments', 'Injectables', 'Body Treatments', 'Hair & Scalp', OTHER_SERVICE_CATEGORY,
])

export const normalizeServiceCategory = value => (typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 60) : '') || OTHER_SERVICE_CATEGORY
export const serviceCategoryKey = value => normalizeServiceCategory(value).toLocaleLowerCase('en')
export const isCategorizedService = listing => ['Service', 'Package'].includes(listing.type || listing.postType) && !listing.isPackageComponent && !listing.parentPackageId

export function serviceCategoryOptions(listings = [], includeDefaults = false) {
  const labels = new Map()
  const add = value => { const label = normalizeServiceCategory(value), key = serviceCategoryKey(label); if (!labels.has(key)) labels.set(key, label) }
  if (includeDefaults) DEFAULT_SERVICE_CATEGORIES.forEach(add)
  listings.filter(isCategorizedService).forEach(listing => add(listing.serviceCategory))
  return [...labels].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
}

export function filterCategorizedServices(listings = [], category = '', search = '') {
  const query = String(search || '').trim().toLocaleLowerCase('en')
  return listings.filter(listing => isCategorizedService(listing)
    && (!category || serviceCategoryKey(listing.serviceCategory) === category)
    && (!query || String(listing.title || listing.name || listing.serviceName || listing.packageName || '').toLocaleLowerCase('en').includes(query)))
}
