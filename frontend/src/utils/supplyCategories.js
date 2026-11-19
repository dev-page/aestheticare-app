export const STANDARD_SUPPLY_CATEGORIES = Object.freeze([
  'Medical supplies',
  'Injectables',
  'Skincare',
  'Medication',
  'Personal protective equipment',
  'Cleaning and sanitation',
  'Office supplies',
  'Equipment',
  'Pharmacy supplies',
  'General supplies',
])

export const supplyCategoryOptions = (additionalCategories = []) => {
  const values = new Map()

  for (const category of [...STANDARD_SUPPLY_CATEGORIES, ...additionalCategories]) {
    const value = String(category || '').trim().replace(/\s+/gu, ' ')
    if (!value) continue
    const key = value.normalize('NFKC').toLowerCase()
    if (!values.has(key)) values.set(key, value)
  }

  return [
    ...STANDARD_SUPPLY_CATEGORIES.filter(category => values.get(category.toLowerCase()) === category),
    ...[...values.entries()]
      .filter(([key, value]) => !STANDARD_SUPPLY_CATEGORIES.some(category => category.toLowerCase() === key && category === value))
      .map(([, value]) => value)
      .sort((left, right) => left.localeCompare(right)),
  ]
}
