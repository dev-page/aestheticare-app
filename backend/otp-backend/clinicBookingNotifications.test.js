import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { prepareClinicBookingRecipients, writeClinicBookingNotifications } from './clinicBookingNotifications.js'

const fixture = () => {
  const h = transactionDb()
  const seed = (id, data) => h.seed('users', id, { status: 'Active', ...data })
  seed('owner', { role: 'Owner', permissions: ['appointments:review'] })
  seed('admin', { role: 'Clinic Admin', branchId: 'branch', branchIds: ['branch'], permissions: ['appointments:review'] })
  seed('reception', { role: 'Custom', branchIds: ['branch'], effectivePermissions: ['appointments:view'] })
  seed('disabled', { role: 'Clinic Admin', branchId: 'branch', status: 'Disabled', permissions: ['appointments:review'] })
  seed('inventory', { role: 'Inventory', branchId: 'branch', permissions: ['inventory:view'] })
  seed('other-branch', { role: 'Clinic Admin', branchId: 'elsewhere', permissions: ['appointments:review'] })
  seed('customer', { role: 'Customer', branchId: 'branch', permissions: ['appointments:view'] })
  const loadUserContext = async uid => ({ permissions: new Set(h.records.get(`users/${uid}`).permissions || h.records.get(`users/${uid}`).effectivePermissions || []) })
  const prepare = tx => prepareClinicBookingRecipients({ tx, db: h.db, branchId: 'branch', branch: { ownerId: 'owner', organizationOwnerId: 'owner' }, loadUserContext })
  const write = (tx, recipients, directBooking = false) => writeClinicBookingNotifications({ tx, db: h.db, recipients, branchId: 'branch', bookingId: 'booking', appointmentId: 'appointment', customerName: 'Client', count: 2, directBooking, createdAt: new Date() })
  return { ...h, prepare, write }
}

test('New bookings notify active branch readers/reviewers and the owner, once per person', async () => {
  const h = fixture()
  await h.db.runTransaction(async tx => h.write(tx, await h.prepare(tx)))
  const notices = [...h.records].filter(([key]) => key.startsWith('notifications/')).map(([, data]) => data)
  assert.deepEqual(notices.map(row => row.recipientUserId).sort(), ['admin', 'owner', 'reception'])
  for (const notice of notices) {
    const url = new URL(notice.link, 'https://clinic.example')
    assert.equal(url.pathname, '/crm/appointments')
    assert.equal(url.searchParams.get('branchId'), 'branch')
    assert.equal(url.searchParams.get('tab'), notice.recipientUserId === 'reception' ? 'all' : 'requests')
    assert.equal(notice.read, false)
    assert.equal(notice.appointmentId, 'appointment')
    assert.match(notice.message, /2 separately scheduled/)
    assert.match(notice.message, /Payment is not yet confirmed/)
  }
  h.records.get('notifications/booking-created-booking-admin').read = true
  assert.equal(h.records.get('notifications/booking-created-booking-owner').read, false)
})

test('Notification writes roll back with the booking if the transaction fails', async () => {
  const h = fixture()
  await assert.rejects(h.db.runTransaction(async tx => {
    const recipients = await h.prepare(tx)
    tx.set(h.db.collection('appointments').doc('appointment'), { branchId: 'branch' })
    h.write(tx, recipients)
    throw Error('Booking failed')
  }), /Booking failed/)
  assert.equal(h.records.has('appointments/appointment'), false)
  assert.equal([...h.records.keys()].some(key => key.startsWith('notifications/')), false)
})

test('Free plan bookings link to appointment records rather than the approval queue', async () => {
  const h = fixture()
  await h.db.runTransaction(async tx => h.write(tx, await h.prepare(tx), true))
  const notice = h.records.get('notifications/booking-created-booking-owner')
  assert.equal(notice.title, 'New online booking')
  assert.equal(new URL(notice.link, 'https://clinic.example').searchParams.get('tab'), 'all')
  assert.match(notice.message, /Awaiting customer payment/)
})
