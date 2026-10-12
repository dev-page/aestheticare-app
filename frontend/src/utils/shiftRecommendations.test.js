import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendRecurringShifts } from './shiftRecommendations.js'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const shift = (id, end = '17:00', capacity = 3) => ({ id, label: id, start: '08:00', end, capacity })
const plan = overrides => recommendRecurringShifts({ days, shifts: [shift('morning')],
  employmentType: 'full-time', targetHours: 48, employeeId: 'selected', ...overrides })

test('nine-hour shifts produce 45 hours rather than seven days and 63 hours', () => {
  const result = plan({})
  assert.equal(result.plannedHours, 45)
  assert.equal(Object.keys(result.suggestions).length, 5)
  assert.equal(result.suggestions.Saturday, undefined)
})
test('eight-hour schedules keep a day free even when target could fit more work', () => {
  const result = plan({ shifts: [shift('eight', '16:00')] })
  assert.equal(result.plannedHours, 48)
  assert.equal(result.suggestions.Sunday, undefined)
})
test('existing 45-hour schedule cannot add another nine-hour shift', () => {
  const assignments = Object.fromEntries(days.slice(0, 5).map(day => [day, 'morning']))
  assert.deepEqual(plan({ assignments }).suggestions, {})
})
test('counts other employees per day, supports legacy labels, and excludes selected employee', () => {
  const result = plan({ shifts: [{ ...shift('a', '16:00', 1), label: 'legacy label' }],
    schedules: [{ employeeId: 'other', assignments: { Monday: 'legacy label' } },
      { employeeId: 'selected', assignments: { Tuesday: 'a' } }] })
  assert.equal(result.suggestions.Monday, undefined)
  assert.equal(result.suggestions.Tuesday.id, 'a')
})
test('retains existing assignments and explicitly selected off days', () => {
  const result = plan({ assignments: { Monday: 'morning' }, protectedDays: ['Tuesday'] })
  assert.equal(result.suggestions.Monday, undefined)
  assert.equal(result.suggestions.Tuesday, undefined)
  assert.equal(result.suggestions.Wednesday.id, 'morning')
})
test('part-time suggestions need an agreed target and never fallback to long shifts', () => {
  assert.deepEqual(plan({ employmentType: 'part-time', targetHours: '' }).suggestions, {})
  assert.deepEqual(plan({ employmentType: 'part-time', targetHours: 20 }).suggestions, {})
  const result = plan({ employmentType: 'part-time', targetHours: 12, shifts: [shift('short', '12:00')] })
  assert.equal(result.plannedHours, 12)
  assert.equal(Object.keys(result.suggestions).length, 3)
})
test('unknown types, interns, invalid hours and invalid shift windows never yield misleading recommendations', () => {
  for (const employmentType of ['', 'Intern']) assert.deepEqual(plan({ employmentType }).suggestions, {})
  for (const targetHours of [-1, 49, 'invalid']) assert.deepEqual(plan({ targetHours }).suggestions, {})
  assert.deepEqual(plan({ shifts: [shift('invalid', '07:00')] }).suggestions, {})
})
