import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeServiceCategory, serviceCategoryKey, serviceCategoryOptions, filterCategorizedServices } from './serviceCategories.js'

const listings = [
  { id: 'facial', type: 'Service', name: 'Hydrating Facial', serviceCategory: 'Facial Treatments' },
  { id: 'laser', type: 'Service', name: 'Laser Facial', serviceCategory: 'Laser Treatments' },
  { id: 'legacy', type: 'Service', name: 'Legacy Treatment' },
  { id: 'package', type: 'Package', name: 'Skin Renewal', serviceCategory: 'Facial Treatments' },
  { id: 'consultation', type: 'Consultation', name: 'Doctor Consultation', serviceCategory: 'Medical' },
  { id: 'component', type: 'Service', name: 'Internal Visit', serviceCategory: 'Hidden', isPackageComponent: true },
]

test('existing uncategorized listings remain discoverable under Other without modifying their records', () => {
  assert.equal(normalizeServiceCategory(undefined), 'Other')
  assert.equal(normalizeServiceCategory({}), 'Other')
  assert.deepEqual(filterCategorizedServices(listings, 'other').map(item => item.id), ['legacy'])
  assert.equal(listings[2].serviceCategory, undefined)
})

test('category filters combine with service-name search, preserving independent consultations', () => {
  assert.deepEqual(filterCategorizedServices(listings, 'facial treatments', 'facial').map(item => item.id), ['facial'])
  assert.deepEqual(filterCategorizedServices(listings, 'laser treatments', 'hydrating'), [])
  assert.deepEqual(filterCategorizedServices(listings, '', 'facial').map(item => item.id), ['facial', 'laser'])
  assert.deepEqual(filterCategorizedServices(listings).map(item => item.id), ['facial', 'laser', 'legacy', 'package'])
})

test('customer category filters derive only from offered services and packages', () => {
  assert.deepEqual(serviceCategoryOptions(listings).map(item => item.label), ['Facial Treatments', 'Laser Treatments', 'Other'])
  assert.deepEqual(serviceCategoryOptions([]), [])
  assert.equal(serviceCategoryOptions(listings).some(item => item.label === 'Medical' || item.label === 'Hidden'), false)
})

test('clinic-defined categories are reusable and normalized without duplicates', () => {
  assert.equal(normalizeServiceCategory('  Skin   Rejuvenation  '), 'Skin Rejuvenation')
  assert.equal(serviceCategoryKey(' SKIN  REJUVENATION '), 'skin rejuvenation')
  assert.equal(normalizeServiceCategory('x'.repeat(100)).length, 60)
  const options = serviceCategoryOptions([
    { postType: 'Service', serviceCategory: '  Skin Rejuvenation ' },
    { postType: 'Service', serviceCategory: 'skin rejuvenation' },
  ], true)
  assert.equal(options.filter(item => item.value === 'skin rejuvenation').length, 1)
  assert.ok(options.some(item => item.label === 'Facial Treatments'))
  assert.ok(options.some(item => item.label === 'Other'))
})
