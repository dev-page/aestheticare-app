import test from 'node:test'
import assert from 'node:assert/strict'
import { manilaDate, walkInSlots } from './walkInScheduling.js'
const date = '2026-10-12'
const args = () => ({ row: { key: 'a', clientId: 'one', serviceId: 'facial', practitionerId: 'worker', date }, clients: [{ id: 'one', email: 'one@test.invalid' }, { id: 'two', email: 'two@test.invalid' }], services: [{ id: 'facial', durationMinutes: 60 }], schedules: { worker: { __recurring__: { availability: { Monday: { start: '08:00', end: '12:00' } } } } }, now: new Date('2026-10-11T01:00:00+08:00').getTime() })
test('calendar date uses Manila even while UTC is on the previous day', () => {
  assert.equal(manilaDate(new Date('2026-10-10T17:00:00Z').getTime()), '2026-10-11')
})
test('same person cannot select the date of their other service', () => {
  assert.deepEqual(walkInSlots({ ...args(), rows: [{ key: 'b', clientId: 'one', date }] }), [])
})
test('an existing appointment for another client blocks overlapping practitioner slots', () => {
  const slots = walkInSlots({ ...args(), appointments: [{ customerId: 'two', practitionerId: 'worker', date, time: '09:00', totalServiceDurationMinutes: 60, status: 'Approved' }] })
  assert.ok(slots.some(slot => slot.value === '10:00'))
  assert.equal(slots.some(slot => slot.value === '08:30' || slot.value === '09:00' || slot.value === '09:30'), false)
})
test('calendar respects leaves, existing appointments, and client identity across duplicate records', () => {
  assert.deepEqual(walkInSlots({ ...args(), leaves: { worker: [{ startDate: date, endDate: date }] } }), [])
  assert.deepEqual(walkInSlots({ ...args(), appointments: [{ date, customerEmail: 'one@test.invalid', status: 'Completed' }] }), [])
  assert.ok(walkInSlots({ ...args(), appointments: [{ date, customerEmail: 'one@test.invalid', status: 'Cancelled' }] }).length)
})
test('calendar excludes past times and allows only slots long enough for the service', () => {
  const slots = walkInSlots({ ...args(), now: new Date(`${date}T10:15:00+08:00`).getTime() })
  assert.deepEqual(slots.map(slot => slot.value), ['10:30', '11:00'])
})
