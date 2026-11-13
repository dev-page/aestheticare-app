import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAppointmentManagementState, resolveAppointmentBranchQuery } from './appointmentManagementNavigation.js'

test('legacy request links open Needs review inside Appointments', () => {
  assert.deepEqual(resolveAppointmentManagementState({
    query: { tab: 'requests' },
    canView: true,
    canReview: true,
    canOnline: true,
    canQueue: true,
  }), {
    activeTab: 'appointments',
    appointmentView: 'review',
    onlineMode: false,
  })
})

test('the default route opens All appointments for appointment viewers', () => {
  assert.deepEqual(resolveAppointmentManagementState({
    query: {},
    canView: true,
    canReview: true,
    canOnline: false,
    canQueue: true,
  }), {
    activeTab: 'appointments',
    appointmentView: 'all',
    onlineMode: false,
  })
})

test('review-only staff land on Needs review without appointment-list access', () => {
  assert.deepEqual(resolveAppointmentManagementState({
    query: {},
    canView: false,
    canReview: true,
    canOnline: false,
    canQueue: false,
  }), {
    activeTab: 'appointments',
    appointmentView: 'review',
    onlineMode: false,
  })
})

test('a request to open Needs review falls back to All appointments without review permission', () => {
  assert.deepEqual(resolveAppointmentManagementState({
    query: { tab: 'appointments', view: 'review' },
    canView: true,
    canReview: false,
    canOnline: false,
    canQueue: true,
  }), {
    activeTab: 'appointments',
    appointmentView: 'all',
    onlineMode: false,
  })
})

test('the legacy queue URL keeps its selected online consultation mode', () => {
  assert.deepEqual(resolveAppointmentManagementState({
    query: { tab: 'queue', mode: 'online' },
    canView: true,
    canReview: true,
    canOnline: true,
    canQueue: true,
  }), {
    activeTab: 'queue',
    appointmentView: 'all',
    onlineMode: true,
  })
})

test('consultation-only staff land directly in Online Consultations', () => {
  assert.deepEqual(resolveAppointmentManagementState({
    query: {},
    canView: false,
    canReview: false,
    canOnline: true,
    canQueue: true,
  }), {
    activeTab: 'queue',
    appointmentView: 'all',
    onlineMode: true,
  })
})

test('branch navigation preserves an explicitly selected branch', () => {
  assert.equal(resolveAppointmentBranchQuery({
    queryBranchId: 'branch-a',
    selectedBranchId: 'branch-b',
    selectionTouched: true,
  }), 'branch-b')
})

test('default branch selection does not unexpectedly scope All appointments', () => {
  assert.equal(resolveAppointmentBranchQuery({
    queryBranchId: undefined,
    selectedBranchId: 'default-branch',
    selectionTouched: false,
  }), undefined)
})

test('branch navigation retains an existing deep-link branch', () => {
  assert.equal(resolveAppointmentBranchQuery({
    queryBranchId: 'branch-a',
    selectedBranchId: 'default-branch',
    selectionTouched: false,
  }), 'branch-a')
})
