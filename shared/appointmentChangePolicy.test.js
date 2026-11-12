import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cancellationRefundEstimate,
  canRequestAppointmentReschedule,
  isCancellationWindowConfigurationValid,
} from './appointmentChangePolicy.js'

const appointmentAt = (hoursFromNow, now = new Date()) => {
  const start = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000)
  const manila = new Date(start.getTime() + 8 * 60 * 60 * 1000)
  return { date: manila.toISOString().slice(0, 10), time: manila.toISOString().slice(11, 16), amountPaid: 1000, commissionAmount: 100 }
}

const policy = {
  serviceCancellationPolicyEnabled: true,
  serviceReschedulingPolicyEnabled: true,
  earlyMinimumHours: 48,
  midMinimumHours: 24,
  midMaximumHours: 48,
  lateMaximumHours: 24,
  earlyNonRefundable: false,
  earlyRefundPercentage: 100,
  midNonRefundable: false,
  midRefundPercentage: 50,
  lateNonRefundable: false,
  lateRefundPercentage: 0,
  maximumRescheduleAllowance: 2,
}

test('cancellation estimate selects early, mid, and late windows at their boundaries', () => {
  const now = new Date()
  now.setSeconds(0, 0)
  assert.equal(cancellationRefundEstimate({ policy, appointment: appointmentAt(48, now), now }).tier, 'early')
  assert.equal(cancellationRefundEstimate({ policy, appointment: appointmentAt(24, now), now }).tier, 'mid')
  assert.equal(cancellationRefundEstimate({ policy, appointment: appointmentAt(23, now), now }).tier, 'late')
})

test('cancellation estimate applies the refund percentage after excluding commission', () => {
  const estimate = cancellationRefundEstimate({ policy, appointment: appointmentAt(30), now: new Date() })
  assert.equal(estimate.eligibleAmount, 900)
  assert.equal(estimate.refundPercentage, 50)
  assert.equal(estimate.refundAmount, 450)
})

test('non-refundable bands and unpaid appointments estimate zero refunds', () => {
  const nonRefundablePolicy = { ...policy, earlyNonRefundable: true }
  const noPayment = { ...appointmentAt(72), amountPaid: 0 }
  assert.equal(cancellationRefundEstimate({ policy: nonRefundablePolicy, appointment: appointmentAt(72) }).refundAmount, 0)
  assert.equal(cancellationRefundEstimate({ policy, appointment: noPayment }).refundAmount, 0)
})

test('refund estimates do not exceed the appointment total when recorded payment is larger', () => {
  const overpaid = { ...appointmentAt(72), amount: 800, totalAmount: 800, amountPaid: 1000, commissionAmount: 100 }
  const estimate = cancellationRefundEstimate({ policy, appointment: overpaid })
  assert.equal(estimate.eligibleAmount, 700)
  assert.equal(estimate.refundAmount, 700)
})

test('rescheduling requires an enabled policy and an unused allowance', () => {
  assert.equal(canRequestAppointmentReschedule(policy, { rescheduleCount: 1 }), true)
  assert.equal(canRequestAppointmentReschedule(policy, { rescheduleCount: 2 }), false)
  assert.equal(canRequestAppointmentReschedule({ ...policy, maximumRescheduleAllowance: 0 }, { rescheduleCount: 0 }), false)
  assert.equal(canRequestAppointmentReschedule({ ...policy, serviceReschedulingPolicyEnabled: false }, { rescheduleCount: 0 }), false)
})

test('cancellation windows must share their adjacent boundaries', () => {
  assert.equal(isCancellationWindowConfigurationValid(policy), true)
  assert.equal(isCancellationWindowConfigurationValid({ ...policy, earlyMinimumHours: 72 }), false)
  assert.equal(isCancellationWindowConfigurationValid({ ...policy, lateMaximumHours: 12 }), false)
  assert.equal(isCancellationWindowConfigurationValid({ ...policy, lateMaximumHours: '' }), false)
})
