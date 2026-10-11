import test from 'node:test'
import assert from 'node:assert/strict'
import { createPageLoadingState } from './pageLoadingState.js'

const tick = () => new Promise(resolve => queueMicrotask(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

test('keeps the skeleton until all overlapping requests finish and skips later live refreshes', async () => {
  const changes = []
  const state = createPageLoadingState(value => changes.push(value))
  const first = deferred(), second = deferred()
  const one = state.track(() => first.promise)()
  const two = state.track(() => second.promise)()
  first.resolve('first')
  assert.equal(await one, 'first')
  await tick()
  assert.equal(changes.at(-1), true)
  second.resolve('second')
  await two
  await tick()
  assert.equal(changes.at(-1), false)
  const count = changes.length
  assert.equal(await state.track(async () => 42)(), 42)
  assert.equal(changes.length, count)
})

test('waits for initial listener results including nested async data loads', async () => {
  const changes = []
  const state = createPageLoadingState(value => changes.push(value))
  let next
  const extra = deferred()
  state.listen((_ref, callback) => { next = callback; return () => {} }, 'records', async () => { await extra.promise })
  assert.equal(changes.at(-1), true)
  const result = next({ docs: [] })
  await tick()
  assert.equal(changes.at(-1), true)
  extra.resolve()
  await result
  await tick()
  assert.equal(changes.at(-1), false)
  const count = changes.length
  await next({ docs: [] })
  assert.equal(changes.length, count)
})

test('listener errors and cancellations clear pending loading and preserve callbacks', async () => {
  for (const cancel of [false, true]) {
    const changes = [], failures = []
    const state = createPageLoadingState(value => changes.push(value))
    let fail, unsubscribed = false
    const stop = state.listen((_ref, _next, error) => { fail = error; return () => { unsubscribed = true } }, 'records', () => {}, error => failures.push(error.message))
    if (cancel) stop()
    else fail(new Error('permission denied'))
    await tick()
    assert.equal(changes.at(-1), false)
    assert.equal(unsubscribed, cancel)
    assert.deepEqual(failures, cancel ? [] : ['permission denied'])
  }
})

test('request failures clear loading while preserving the original error', async () => {
  const changes = []
  const state = createPageLoadingState(value => changes.push(value))
  const failure = new Error('network unavailable')
  await assert.rejects(state.track(async () => { throw failure })(), error => error === failure)
  await tick()
  assert.equal(changes.at(-1), false)
})

test('disposing a page ignores late responses and does not change callback results', async () => {
  const changes = []
  const state = createPageLoadingState(value => changes.push(value))
  const pending = deferred()
  const result = state.track(() => pending.promise)()
  state.dispose()
  const count = changes.length
  pending.resolve('done')
  assert.equal(await result, 'done')
  await tick()
  assert.equal(changes.length, count)
  assert.equal(changes.at(-1), false)
})
