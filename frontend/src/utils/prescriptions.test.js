import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePrescriptionText } from './prescriptions.js'

test('clinical prescription entry requires an explicit whole-unit quantity', () => {
  assert.deepEqual(parsePrescriptionText('Rx Serum | 10 mg | twice daily | 5 days | With food | 10'), [
    { name: 'Rx Serum', dosage: '10 mg', frequency: 'twice daily', duration: '5 days', instructions: 'With food', quantity: 10 },
  ])
  assert.throws(() => parsePrescriptionText('Rx Serum | 10 mg | twice daily | 5 days | With food'), /quantity/i)
  assert.throws(() => parsePrescriptionText('Rx Serum | 10 mg | twice daily | 5 days | With food | 1.5'), /whole number/i)
})
