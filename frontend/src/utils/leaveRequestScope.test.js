import test from 'node:test'
import assert from 'node:assert/strict'
import { leaveRequestScopes, subscribeLeaveScopes } from './leaveRequestScope.js'

test('every query is restricted to a branch; employees also require their requester ID', () => {
  assert.deepEqual(leaveRequestScopes([' branch-a ', 'branch-b', 'branch-a', ''], 'owner', true), [
    { branchId: 'branch-a', requesterId: null }, { branchId: 'branch-b', requesterId: null },
  ])
  assert.deepEqual(leaveRequestScopes(['branch-a'], 'employee', false), [{ branchId: 'branch-a', requesterId: 'employee' }])
  assert.deepEqual(leaveRequestScopes([], 'owner', true), [])
  assert.deepEqual(leaveRequestScopes(['branch-a'], '', true), [])
})

test('waits for all branches, combines records, and updates existing records without duplicates', () => {
  const callbacks = new Map(), states = []
  subscribeLeaveScopes(leaveRequestScopes(['a', 'b'], 'owner', true), (scope, success, failure) => {
    callbacks.set(scope.branchId, { success, failure })
    return () => {}
  }, state => states.push(state))
  callbacks.get('a').success([{ id: 'old', createdAt: { seconds: 1 } }])
  assert.equal(states.at(-1).loading, true)
  callbacks.get('b').success([{ id: 'new', createdAt: { seconds: 2 } }])
  assert.equal(states.at(-1).loading, false)
  assert.deepEqual(states.at(-1).requests.map(record => record.id), ['new', 'old'])
  callbacks.get('a').success([{ id: 'old', updatedAt: { seconds: 3 }, status: 'Approved' }])
  assert.deepEqual(states.at(-1).requests.map(record => record.id), ['old', 'new'])
  assert.equal(states.at(-1).requests[0].status, 'Approved')
})

test('a failed branch remains an error even when another branch returns no requests', () => {
  const callbacks = new Map(), states = []
  subscribeLeaveScopes(leaveRequestScopes(['a', 'b'], 'owner', true), (scope, success, failure) => {
    callbacks.set(scope.branchId, { success, failure })
    return () => {}
  }, state => states.push(state))
  const denied = Object.assign(new Error('Denied'), { code: 'permission-denied' })
  callbacks.get('a').failure(denied)
  callbacks.get('b').success([])
  assert.equal(states.at(-1).loading, false)
  assert.deepEqual(states.at(-1).errors, [denied])
})

test('stops every branch listener and ignores stale results after retry or leaving the page', () => {
  const callbacks = [], states = [], stopped = []
  const stop = subscribeLeaveScopes(leaveRequestScopes(['a', 'b'], 'owner', true), (scope, success) => {
    callbacks.push(success)
    return () => stopped.push(scope.branchId)
  }, state => states.push(state))
  stop()
  callbacks[0]([{ id: 'stale' }])
  assert.deepEqual(stopped, ['a', 'b'])
  assert.deepEqual(states, [])
})
