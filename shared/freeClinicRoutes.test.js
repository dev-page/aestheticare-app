import test from 'node:test'
import assert from 'node:assert/strict'
import { isFreeClinicRoute } from './freeClinicRoutes.js'

test('Free preserves appointment resolution, clinic settings, listings and subscription access', () => {
  for (const path of ['/crm/appointments', '/crm/transactions', '/crm/inbox', '/catalog/products-services', '/catalog/archived', '/clinic/policies', '/account/subscription', '/account/plans']) assert.equal(isFreeClinicRoute(path), true, path)
  for (const path of ['/procurement/purchase-orders', '/inventory/items', '/logistics/receiving', '/finance/procurement/budgets', '/hr/employees', '/crm/appointments-other']) assert.equal(isFreeClinicRoute(path), false, path)
})
