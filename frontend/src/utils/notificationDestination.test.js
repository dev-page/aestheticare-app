import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationDestination } from './notificationDestination.js'

test('opens the saved page including the correct inbox tab', () => {
  assert.deepEqual(notificationDestination({ link: '/crm/inbox?tab=suppliers' }),
    { to: '/crm/inbox?tab=suppliers', label: 'Open page' })
})
test('legacy supplier chat notices route to the right portal', () => {
  assert.equal(notificationDestination({ title: 'Supplier chat' }).to, '/crm/inbox?tab=suppliers')
  assert.equal(notificationDestination({ title: 'Supplier chat' }, { userType: 'supplier' }).to, '/supplier/chat')
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
