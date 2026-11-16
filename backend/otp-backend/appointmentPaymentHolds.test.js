import test from 'node:test'
import assert from 'node:assert/strict'
import { createAppointmentPaymentHoldReaper } from './appointmentPaymentHolds.js'

test('registers the payment hold expiry route on the supplied Express app', () => {
  const registeredRoutes = []
  const app = {
    all(path, handler) {
      registeredRoutes.push({ path, handler })
    },
  }
  const query = {
    where() { return this },
    limit() { return this },
    async get() { return { docs: [] } },
  }
  const db = { collection: () => query }
  const firestore = () => db
  firestore.Timestamp = { fromMillis: value => value }
  firestore.FieldValue = { serverTimestamp: () => new Date() }
  const admin = { firestore }

  createAppointmentPaymentHoldReaper({
    app,
    admin,
    getPayMongoHeaders: () => ({}),
    recordPayment: async () => undefined,
    getCronSecret: () => 'cron-secret',
  })

  assert.equal(registeredRoutes.length, 1)
  assert.equal(registeredRoutes[0].path, '/cron/appointment-payment-holds')
  assert.equal(typeof registeredRoutes[0].handler, 'function')
})
