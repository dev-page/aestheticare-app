import test from 'node:test'
import assert from 'node:assert/strict'
import { clock, punches, validateField, fieldValues, verifyLocation, scanAction } from './attendancePolicy.js'

test('clock parsing normalizes 12-hour and 24-hour inputs', () => {
  assert.equal(clock('8:05 AM'), '08:05:00')
  assert.equal(clock('12:05 PM'), '12:05:00')
  assert.equal(clock('12:05 AM'), '00:05:00')
  assert.throws(() => clock('25:00'))
})

test('punches reject same-day inverted times and support explicit overnight shifts', () => {
  assert.throws(() => punches('2026-09-21', '17:00', '08:00'))
  const record = punches('2026-09-21', '17:00', '08:00', true)
  assert.equal(record.totalWorkedMinutes, 900)
  assert.equal(record.attendanceStatus, 'Complete')
})

test('custom fields keep stable ids and validate values', () => {
  const field = { id: 'uniform', ...validateField({ label: 'Uniform Check', type: 'dropdown', options: ['Compliant', 'Non-compliant'] }) }
  assert.deepEqual(fieldValues({ uniform: 'Compliant' }, [field]), { uniform: 'Compliant' })
  assert.throws(() => fieldValues({ uniform: 'Unknown' }, [field]))
  assert.throws(() => fieldValues({ missing: 'x' }, [field]))
})

test('location evidence must be fresh, accurate, and in the branch radius', () => {
  const branch = { clinicLocationLat: 14.5995, clinicLocationLng: 120.9842, attendanceSettings: { maxAccuracyMeters: 100, geofenceRadiusMeters: 150 } }
  const now = 1_800_000_000_000
  assert.equal(verifyLocation({ latitude: 14.5995, longitude: 120.9842, accuracy: 20, locationTimestamp: now - 5000 }, branch, now), 0)
  assert.throws(() => verifyLocation({ latitude: 14.5995, longitude: 120.9842, accuracy: 120, locationTimestamp: now - 5000 }, branch, now))
  assert.throws(() => verifyLocation({ latitude: 14.5995, longitude: 120.9842, accuracy: 20, locationTimestamp: now - 61000 }, branch, now))
  assert.throws(() => verifyLocation({ latitude: 14.61, longitude: 120.99, accuracy: 20, locationTimestamp: now - 5000 }, branch, now))
})

test('scan action prevents duplicate and out-of-order attendance transitions', () => {
  assert.equal(scanAction({}, 'clock_in', 100000), 'clock_in')
  assert.equal(scanAction({ timeIn: '08:00', timeInEpoch: 100000 }, 'clock_out', 161000), 'clock_out')
  assert.throws(() => scanAction({ timeIn: '08:00', timeInEpoch: 100000 }, 'clock_in', 161000))
  assert.throws(() => scanAction({ timeIn: '08:00', timeOut: '17:00' }, 'clock_out', 200000))
  assert.throws(() => scanAction({ source: 'imported' }, 'clock_in', 200000))
})
