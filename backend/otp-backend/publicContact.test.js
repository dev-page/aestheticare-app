import test from 'node:test'
import assert from 'node:assert/strict'
import { validateContact, registerPublicContact } from './publicContact.js'

const valid = { name: ' Visitor ', email: 'PERSON@example.com', subject: 'Question', message: 'How do I get started?' }
test('normalizes visitor contact details and rejects malformed or oversized submissions', () => {
  assert.equal(validateContact(valid).email, 'person@example.com')
  assert.equal(validateContact(valid).name, 'Visitor')
  for (const body of [null, {}, { ...valid, name: ' ' }, { ...valid, email: 'invalid' }, { ...valid, subject: 'x'.repeat(161) }, { ...valid, message: 'x'.repeat(5001) }]) {
    assert.throws(() => validateContact(body))
  }
})

test('contact route rejects spam and invalid input before accessing the database', async () => {
  let handler
  registerPublicContact({ post(path, callback) { assert.equal(path, '/public/contact'); handler = callback } }, {})
  for (const body of [{ ...valid, website: 'spam' }, { ...valid, email: 'invalid' }]) {
    const res = { status(code) { assert.equal(code, 400); return this }, json(result) { assert.ok(result.error) } }
    await handler({ body }, res)
  }
})

test('saves messages and admin notifications atomically, then limits repeated submissions', async () => {
  let handler
  const records = new Map()
  let sequence = 0
  const db = {
    collection(name) { return { doc(id = String(++sequence)) { return `${name}/${id}` } } },
    async runTransaction(callback) {
      const writes = []
      await callback({
        async get(ref) { return { data: () => records.get(ref) } },
        set(ref, value) { writes.push([ref, value]) },
      })
      writes.forEach(([ref, value]) => records.set(ref, value))
    },
  }
  const firestore = () => db
  firestore.FieldValue = { serverTimestamp: () => 'timestamp' }
  registerPublicContact({ post(_path, callback) { handler = callback } }, { firestore })
  for (let attempt = 0; attempt < 4; attempt++) {
    let status
    await handler({ body: valid, ip: '127.0.0.1' }, {
      status(code) { status = code; return this },
      json(result) { assert.equal(status, attempt < 3 ? 201 : 429); assert.equal(Boolean(result.success), attempt < 3) },
    })
  }
  const tickets = [...records.entries()].filter(([key]) => key.startsWith('supportTickets/'))
  const notifications = [...records.entries()].filter(([key]) => key.startsWith('notifications/'))
  assert.equal(tickets.length, 3)
  assert.equal(notifications.length, 3)
  assert.equal(tickets[0][1].userEmail, 'person@example.com')
  assert.equal(tickets[0][1].status, 'Open')
  assert.equal(notifications[0][1].recipientRole, 'Superadmin')
})
