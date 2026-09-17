import test from 'node:test'
import assert from 'node:assert/strict'
import { getAppointmentSlots } from './appointmentSlots.js'

const fixture = (overrides = {}) => ({
  date: '2030-09-23', practitionerId: 'worker', durationMinutes: 60,
  now: new Date('2030-09-22T00:00:00+08:00').getTime(),
  schedules: { worker: { __recurring__: { Monday: 'Morning || 08:00 - 12:00', Sunday: 'Off' } } },
  ...overrides,
})

test('calendar and times follow assigned days, full duration, and weekly overrides', () => {
  assert.equal(getAppointmentSlots(fixture({ date: '2030-09-22' })).length, 0)
  const slots = getAppointmentSlots(fixture({ durationMinutes: 90 }))
  assert.equal(slots[0].value, '08:00')
  assert.equal(slots.at(-1).value, '10:30')
  assert.deepEqual(getAppointmentSlots(fixture({ schedules: { worker: {
    __recurring__: { Monday: '08:00 - 12:00' }, '2030-09-23': { Monday: 'Off' },
  } } })), [])
})

test('pending bookings block their full duration; cancellations and other workers do not', () => {
  const appointments = [
    { date: '2030-09-23', practitionerId: 'worker', time: '09:00', totalServiceDurationMinutes: 90, status: 'Pending Approval' },
    { date: '2030-09-23', practitionerId: 'worker', time: '08:00', endTime: '09:00', status: 'Cancelled' },
    { date: '2030-09-23', practitionerId: 'other', time: '11:00', endTime: '12:00', status: 'Paid' },
  ]
  assert.deepEqual(getAppointmentSlots(fixture({ appointments })).map(s => s.value), ['08:00', '10:30', '11:00'])
})

test('today omits elapsed times using Manila time, and never offers a slot past shift end', () => {
  const now = new Date('2030-09-23T09:10:00+08:00').getTime()
  assert.deepEqual(getAppointmentSlots(fixture({ now, durationMinutes: 120 })).map(s => s.value), ['09:30', '10:00'])
  assert.deepEqual(getAppointmentSlots(fixture({ now, durationMinutes: 300 })), [])
})

test('missing, off, and malformed schedules do not offer free-form fallback times', () => {
  for (const label of ['', 'Off', 'unknown-shift-id', '17:00 - 08:00']) {
    assert.deepEqual(getAppointmentSlots(fixture({ schedules: { worker: { __recurring__: { Monday: label } } } })), [])
  }
})
