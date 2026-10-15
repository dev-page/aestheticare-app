import test from 'node:test'
import assert from 'node:assert/strict'
import { isCustomerCareListing, assertCustomerCheckoutSupported } from './customerCatalog.js'

const published = { financeStatus: 'approved', isPublished: true, archived: false }
test('the public catalog permits approved, published care listings and excludes products', () => {
  for (const postType of ['Service', 'Consultation', 'Package']) assert.equal(isCustomerCareListing({ ...published, postType }), true)
  for (const postType of ['Product', 'product', '', 'Other']) assert.equal(isCustomerCareListing({ ...published, postType }), false)
  for (const financeStatus of ['draft', 'pending', 'changes_requested', undefined]) assert.equal(isCustomerCareListing({ ...published, postType: 'Service', financeStatus }), false)
  assert.equal(isCustomerCareListing({ ...published, postType: 'Service', isPublished: false }), false)
  assert.equal(isCustomerCareListing({ ...published, postType: 'Service', archived: true }), false)
})

test('product checkout is rejected before creating a payment while service and subscription payments remain available', () => {
  for (const module of ['customer_order', ' CUSTOMER_ORDER ']) assert.throws(() => assertCustomerCheckoutSupported({ module }), error => error.status === 410)
  for (const module of ['subscription', 'customer_appointment', 'customer_consultation']) assert.doesNotThrow(() => assertCustomerCheckoutSupported({ module }))
})
