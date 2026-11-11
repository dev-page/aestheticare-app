import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationDestination } from './notificationDestination.js'

test('legacy shopping notifications lead to clinic discovery instead of retired shopping pages', () => {
  for (const link of ['/customer/cart', '/customer/orders?status=paid', '/customer/checkout', '/customer/orders/old']) {
    assert.deepEqual(notificationDestination({ link }, { userType: 'customer' }), { to: '/customer/home', label: 'Discover clinics' })
  }
})

test('redirects saved supplier inbox notifications to Procurement', () => {
  assert.deepEqual(notificationDestination({ link: '/crm/inbox?tab=suppliers' }),
    { to: '/procurement/orders', label: 'Open Procurement' })
})
test('legacy supplier chat notices route to clinic Procurement or sign-in', () => {
  assert.deepEqual(notificationDestination({ title: 'Supplier chat' }),
    { to: '/procurement/orders', label: 'Open Procurement' })
  assert.deepEqual(notificationDestination({ title: 'Supplier chat' }, { userType: 'supplier' }),
    { to: '/login', label: 'Go to sign in' })
})
test('notices without a destination always offer the appropriate notifications page', () => {
  assert.equal(notificationDestination({}).to, '/notifications')
  assert.equal(notificationDestination({}, { role: 'Superadmin' }).to, '/superadmin/notifications')
  assert.equal(notificationDestination({}, { userType: 'customer' }).to, '/customer/account-settings?tab=notifications')
})
test('does not interpret external or malformed links as application destinations', () => {
  for (const link of ['https://example.com', '//example.com', '/\\example.com', '/crm/\ninbox', 'javascript:alert(1)']) {
    assert.equal(notificationDestination({ link }).to, '/notifications')
  }
})
