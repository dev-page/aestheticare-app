import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_LEAVE_POLICY, isEligibleForPaidLeave, normalizeLeavePolicy } from './leavePolicy.js'

test('normalizes clinic paid leave allowance and service eligibility settings', () => {
  assert.deepEqual(normalizeLeavePolicy({ annualPaidDays: '8', eligibilityMonths: '6' }), {
    annualPaidDays: 8,
    eligibilityMonths: 6,
  })
  assert.deepEqual(normalizeLeavePolicy({}), DEFAULT_LEAVE_POLICY)
  assert.throws(() => normalizeLeavePolicy({ annualPaidDays: 1.5 }), /whole number/)
  assert.throws(() => normalizeLeavePolicy({ eligibilityMonths: 61 }), /between 0 and 60/)
})

test('checks eligibility on the requested leave date and rejects missing or future hire dates', () => {
  assert.equal(isEligibleForPaidLeave('2025-11-15', '2026-11-14', 12), false)
  assert.equal(isEligibleForPaidLeave('2025-11-15', '2026-11-15', 12), true)
  assert.equal(isEligibleForPaidLeave('2025-01-31', '2025-02-28', 1), true)
  assert.equal(isEligibleForPaidLeave('', '2026-11-15', 12), false)
  assert.equal(isEligibleForPaidLeave('', '2026-11-15', 0), true)
  assert.equal(isEligibleForPaidLeave('2027-01-01', '2026-11-15', 0), false)
  assert.equal(isEligibleForPaidLeave('2026-01-01', '2026-01-01', 0), true)
})
