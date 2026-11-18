import test from 'node:test'
import assert from 'node:assert/strict'
import { isReactive, reactive } from 'vue'
import { copyOnboardingOperatingHours } from './onboardingAvailability.js'

test('copies reactive onboarding hours into independent Firestore-safe data', () => {
  const hours = reactive({
    monday: { closed: false, ranges: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '18:00' }] },
    sunday: { closed: true, ranges: [{ open: '09:00', close: '18:00' }] },
  })

  const copy = copyOnboardingOperatingHours(hours, ['monday', 'sunday'])

  assert.deepEqual(copy, {
    monday: { closed: false, ranges: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '18:00' }] },
    sunday: { closed: true, ranges: [{ open: '09:00', close: '18:00' }] },
  })
  assert.equal(isReactive(copy.monday.ranges[0]), false)
  assert.deepEqual(structuredClone(copy), copy)
  hours.monday.ranges[0].open = '10:00'
  assert.equal(copy.monday.ranges[0].open, '09:00')
})
