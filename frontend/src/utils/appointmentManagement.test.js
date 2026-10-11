import test from 'node:test'
import assert from 'node:assert/strict'
import { appointmentBookingRows, appointmentRecipients, appointmentServiceType, appointmentSource, appointmentSessions, appointmentCheckInAllowed } from './appointmentManagement.js'

test('Group bookings show once, with each real recipient including the organizer when booked', () => {
  const parent = { id: 'parent', isGroupParent: true, groupBookingId: 'group' }
  const guest = { id: 'guest', parentAppointmentId: 'parent', groupBookingId: 'group', isGroupRecipient: true, groupRecipientIndex: 2, customerEmail: 'guest@example.com' }
  const organizer = { ...guest, id: 'organizer', groupRecipientIndex: 1, customerEmail: 'organizer@example.com' }
  const unrelated = { id: 'other', isGroupRecipient: true, groupBookingId: 'other-group' }
  const records = [parent, guest, unrelated, organizer]
  assert.deepEqual(appointmentBookingRows(records).map(item => item.id), ['parent', 'other'])
  assert.deepEqual(appointmentRecipients(parent, records).map(item => item.id), ['organizer', 'guest'])
})
test('An organizer who did not book a service is not inserted into the recipient table', () => {
  const parent = { id: 'parent', isGroupParent: true, groupBookingId: 'group', customerName: 'Organizer' }
  const guest = { id: 'guest', parentAppointmentId: 'parent', groupBookingId: 'group', isGroupRecipient: true }
  assert.deepEqual(appointmentRecipients(parent, [parent, guest]), [guest])
})
test('Separate dates from a multi-service booking remain individual recipient appointments', () => {
  const parent = { id: 'parent', bookingOrderId: 'order', isBookingOrderParent: true }
  const visits = [{ id: 'a', parentAppointmentId: 'parent', bookingOrderId: 'order', date: '2026-11-01' }, { id: 'b', parentAppointmentId: 'parent', bookingOrderId: 'order', date: '2026-11-03' }]
  assert.deepEqual(appointmentBookingRows([parent, ...visits]), [parent])
  assert.deepEqual(appointmentRecipients(parent, [parent, ...visits]), visits)
  assert.deepEqual(appointmentBookingRows(visits), visits)
})
test('Booking channel is separate from service type and package visits retain the session count', () => {
  assert.equal(appointmentSource({ source: 'walk_in' }), 'Walk-in')
  assert.equal(appointmentSource({ type: 'Service' }), 'Online booking')
  assert.equal(appointmentServiceType({ type: 'Consultation', consultationMode: 'online' }), 'Online Consultation')
  assert.equal(appointmentServiceType({ type: 'Consultation', consultationMode: 'in-person' }), 'Service')
  assert.equal(appointmentServiceType({ type: 'Service', treatmentPlan: { packageId: 'package', totalSessions: 6 } }), 'Package')
  assert.equal(appointmentSessions({ treatmentPlan: { totalSessions: 6 } }), 6)
  assert.equal(appointmentSessions({ totalSessions: 'invalid' }), 1)
})
test('Check-in is offered only for a signed, funded individual appointment with an unused code', () => {
  const ready = { status: 'Paid', serviceKey: '123456', contract: { status: 'signed' } }
  assert.equal(appointmentCheckInAllowed(ready), true)
  for (const change of [{ isGroupParent: true }, { isBookingOrderParent: true }, { workerKeyVerified: true }, { checkedInAt: 'now' }, { status: 'Completed' }, { contract: { status: 'pending' } }, { serviceKey: null }]) assert.equal(appointmentCheckInAllowed({ ...ready, ...change }), false)
})
