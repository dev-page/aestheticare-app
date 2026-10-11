import test from 'node:test'
import assert from 'node:assert/strict'
import { createJsonApiClient } from './jsonApiClient.js'
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

test('HTML from an old backend falls back to hosted JSON and pins subsequent saves', async () => {
  const calls = []
  const api = createJsonApiClient(['https://old.example', '/api'], async (url, options) => {
    calls.push([url, options.method || 'GET'])
    return url.startsWith('https://old.example') ? new Response('<!DOCTYPE html><html>App</html>', { headers: { 'Content-Type': 'text/html' } }) : json({ success: true, data: { amount: 50 } })
  })
  assert.deepEqual(await api('/staff-earnings'), { amount: 50 })
  await api('/practitioner-profiles/worker', { method: 'POST', body: '{}' })
  assert.deepEqual(calls, [['https://old.example/staff-earnings', 'GET'], ['/api/staff-earnings', 'GET'], ['/api/practitioner-profiles/worker', 'POST']])
})

test('Authorization errors are preserved without retrying another endpoint', async () => {
  let calls = 0
  const api = createJsonApiClient(['/api', '/other'], async () => { calls++; return json({ error: 'Insufficient permissions.' }, 403) })
  await assert.rejects(api('/staff-earnings'), /Insufficient permissions/)
  assert.equal(calls, 1)
})

test('A non-JSON save response is reported clearly and never retried', async () => {
  let calls = 0
  const api = createJsonApiClient(['/api', '/other'], async () => { calls++; return new Response('<html>Unavailable</html>') })
  await assert.rejects(api('/save', { method: 'POST', body: '{}' }), /API is unavailable or outdated/)
  assert.equal(calls, 1)
})

test('A missing read endpoint tries the hosted backend but missing endpoints stay errors', async () => {
  const api = createJsonApiClient(['/old', '/api'], async url => url.startsWith('/old') ? json({ error: 'Missing route' }, 404) : json({ data: [] }))
  assert.deepEqual(await api('/staff-earnings'), [])
  const unavailable = createJsonApiClient(['/api'], async () => new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } }))
  await assert.rejects(unavailable('/staff-earnings'), /Deploy the updated backend/)
})
