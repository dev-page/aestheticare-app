import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

const block = (source, marker) => {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `Expected rule block ${marker}`)
  const open = source.indexOf('{', start + marker.length)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}' && --depth === 0) return source.slice(open, index + 1)
  }
  throw new Error(`Unclosed rule block ${marker}`)
}

test('support ticket attachments are readable only by their owner or a superadmin', () => {
  const rule = block(read('storage.rules'), 'match /support-tickets/{userId}/{ticketId}/{fileName}')
  assert.match(rule, /allow read:\s*if\s+isSignedIn\(\)\s*&&\s*\(request\.auth\.uid\s*==\s*userId\s*\|\|\s*isSuperadmin\(\)\)/)
})

test('financial, refund, and inventory source records reject direct browser writes', () => {
  const rules = read('firestore.rules')
  for (const marker of ['match /transactions/{transactionId}', 'match /inventoryItems/{itemId}', 'match /refundVouchers/{voucherId}']) {
    assert.match(block(rules, marker), /allow (?:create, update, delete|write):\s*if\s+false\s*;/, `${marker} must be server-write-only`)
  }
  const refundRequests = block(rules, 'match /refundRequests/{requestId}')
  assert.match(refundRequests, /allow create, update:\s*if\s+false\s*;/)
  assert.match(refundRequests, /allow delete:\s*if\s+false\s*;/)
  const customerOrders = block(rules, 'match /customerOrders/{orderId}')
  assert.doesNotMatch(customerOrders, /request\.resource\.data\.diff\(resource\.data\)[^;]*(?:refundStatus|refundRequestStatus|refundAmount|refundRequestId)/)
})

test('payroll and paid-leave policy settings are only writable through validated backend workflows', () => {
  const rules = read('firestore.rules')
  for (const marker of [
    'match /payrollSettings/{branchId}',
    'match /payrollSettingsAudit/{auditId}',
    'match /leavePolicySettings/{branchId}',
    'match /leavePolicyAudit/{auditId}',
  ]) {
    assert.match(block(rules, marker), /allow (?:create, update|create|read, write):\s*if\s+false\s*;/, `${marker} must be backend-managed`)
  }
})
