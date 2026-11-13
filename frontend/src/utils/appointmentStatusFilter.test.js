import test from 'node:test'
import assert from 'node:assert/strict'
import { APPOINTMENT_STATUS_FILTERS, appointmentStatusGroup } from './appointmentStatusFilter.js'

test('appointment history exposes five simple status filter choices', () => {
  assert.deepEqual(APPOINTMENT_STATUS_FILTERS.map(option => option.value), [
    '', 'needs_attention', 'upcoming', 'in_progress', 'finished'
  ])
  assert.equal(APPOINTMENT_STATUS_FILTERS.length, 5)
})

test('raw payment and review statuses are grouped as needs attention', () => {
  for (const status of ['Unpaid', 'Pending', 'Pending Approval', 'Awaiting Payment', 'Contract Pending', 'Awaiting Customer Confirmation', 'Balance Due', 'Reschedule Requested', 'Cancellation Requested']) {
    assert.equal(appointmentStatusGroup(status), 'needs_attention', status)
  }
})

test('scheduled and funded appointments are grouped as upcoming', () => {
  for (const status of ['Scheduled', 'Paid']) assert.equal(appointmentStatusGroup(status), 'upcoming', status)
})

test('service execution statuses are grouped as in progress', () => {
  for (const status of ['Checked in', 'Ready to Start', 'Ongoing']) assert.equal(appointmentStatusGroup(status), 'in_progress', status)
})

test('terminal appointment statuses are grouped as finished', () => {
  for (const status of ['Completed', 'Cancelled', 'Canceled', 'No-show', 'Incomplete', 'Rejected', 'Expired']) {
    assert.equal(appointmentStatusGroup(status), 'finished', status)
  }
})

test('unknown or missing statuses remain visible under needs attention', () => {
  assert.equal(appointmentStatusGroup('Some new state'), 'needs_attention')
  assert.equal(appointmentStatusGroup(''), 'needs_attention')
  assert.equal(appointmentStatusGroup(null), 'needs_attention')
})
