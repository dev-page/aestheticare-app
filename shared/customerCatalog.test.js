import test from 'node:test'
import assert from 'node:assert/strict'
import { getCustomerCareListingName, isCustomerCareListing, isClinicCustomerDiscoverable, assertCustomerCheckoutSupported } from './customerCatalog.js'

const published = { financeStatus: 'approved', isPublished: true, archived: false }
test('the public catalog permits approved, published care listings and excludes products', () => {
  for (const postType of ['Service', 'Consultation', 'Package']) assert.equal(isCustomerCareListing({ ...published, postType }), true)
  for (const postType of ['Product', 'product', '', 'Other']) assert.equal(isCustomerCareListing({ ...published, postType }), false)
  for (const financeStatus of ['draft', 'pending', 'changes_requested', undefined]) assert.equal(isCustomerCareListing({ ...published, postType: 'Service', financeStatus }), false)
  assert.equal(isCustomerCareListing({ ...published, postType: 'Service', isPublished: false }), false)
  assert.equal(isCustomerCareListing({ ...published, postType: 'Service', archived: true }), false)
})

test('customer catalog names use the correct field for services, consultations, and packages', () => {
  assert.equal(getCustomerCareListingName({ postType: 'Service', serviceName: 'Hydration Facial', title: 'Old title' }), 'Hydration Facial')
  assert.equal(getCustomerCareListingName({ postType: 'Consultation', consultationName: 'Online Consultation', title: 'Old title' }), 'Online Consultation')
  assert.equal(getCustomerCareListingName({ postType: 'Package', packageName: 'Skin Renewal Course', title: 'Old title' }), 'Skin Renewal Course')
  assert.equal(getCustomerCareListingName({ postType: 'Package', title: 'Legacy package title' }), 'Legacy package title')
})

test('product checkout is rejected before creating a payment while service and subscription payments remain available', () => {
  for (const module of ['customer_order', ' CUSTOMER_ORDER ']) assert.throws(() => assertCustomerCheckoutSupported({ module }), error => error.status === 410)
  for (const module of ['subscription', 'customer_appointment', 'customer_consultation']) assert.doesNotThrow(() => assertCustomerCheckoutSupported({ module }))
})

test('customer discovery excludes clinics whose subscription is no longer operational', () => {
  const now = new Date('2026-11-16T00:00:00.000Z')
  const activeClinic = {
    isPublished: true,
    status: 'Active',
    subscriptionPlan: 'premium',
    paymentStatus: 'paid',
    subscriptionExpiresAt: '2026-11-22T00:00:00.000Z',
  }
  const expiredClinic = {
    ...activeClinic,
    subscriptionExpiresAt: '2026-10-28T09:15:07.906Z',
  }

  assert.equal(isClinicCustomerDiscoverable(activeClinic, now), true)
  assert.equal(isClinicCustomerDiscoverable(expiredClinic, now), false)
  assert.equal(isClinicCustomerDiscoverable({ ...activeClinic, isPublished: false }, now), false)
})
