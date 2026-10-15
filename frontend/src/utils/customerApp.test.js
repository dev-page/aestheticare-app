import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createCustomerAppContext, customerAppAuthRedirect, isCustomerAppAccount, isCustomerAppRoute } from './customerApp.js'

test('PWABuilder launches the customer login; ordinary website tabs retain their normal flow', () => {
  const websiteManifest = JSON.parse(fs.readFileSync(new URL('../../public/manifest.json', import.meta.url)))
  assert.equal(websiteManifest.start_url, '/')
  assert.equal(websiteManifest.id, '/')
  const manifest = JSON.parse(fs.readFileSync(new URL('../../public/customer-app/manifest.json', import.meta.url)))
  assert.equal(manifest.start_url, '/customer-app/login')
  assert.equal(manifest.scope, '/')
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  const app = createCustomerAppContext(storage)
  assert.equal(app('/login'), false)
  assert.equal(app('/customer-app/login'), true)
  assert.equal(app('/customer/home'), true)
  assert.equal(app('/login'), true) // Logout stays in the customer app.
  assert.equal(createCustomerAppContext(storage, '/customer/home')('/customer/home'), true)
  assert.equal(createCustomerAppContext()('/login'), false) // Separate website tab.
  assert.equal(createCustomerAppContext()('/', true), true) // Optional dedicated mobile build.
})

test('app authentication links never open the landing page or registration chooser', () => {
  assert.equal(customerAppAuthRedirect('/'), '/customer-app/login')
  assert.equal(customerAppAuthRedirect('/login'), '/customer-app/login')
  assert.equal(customerAppAuthRedirect('/register'), '/customer-app/register')
  assert.equal(customerAppAuthRedirect('/forgot-password'), '/customer-app/forgot-password')
  assert.equal(customerAppAuthRedirect('/customer-app/register'), '')
})

test('only customer routes and required shared care/account flows are permitted in the app', () => {
  for (const path of ['/customer-app/login', '/customer-app/register', '/customer-app/forgot-password', '/customer/home', '/customer/appointments', '/customer/center/clinic', '/customer/account-recovery', '/change-password', '/support/report', '/activate-account', '/group-consent']) assert.equal(isCustomerAppRoute(path), true, path)
  for (const path of ['/', '/register', '/clinic/register', '/clinic/dashboard', '/supplier/supplies', '/superadmin/dashboard', '/customer-app/supplier', '/customer-other']) assert.equal(isCustomerAppRoute(path), false, path)
})

test('app sign-in rejects operational and unknown roles instead of defaulting them to Customer', () => {
  for (const record of [{ role: 'Customer' }, { userType: 'customer' }, { role: 'customer', userType: 'customer' }]) assert.equal(isCustomerAppAccount(record), true)
  for (const record of [{}, { role: 'Owner' }, { role: 'Supplier' }, { role: 'Superadmin' }, { role: 'Staff' }, { role: 'Practitioner', userType: 'customer' }, { role: 'Customer', userType: 'staff' }]) assert.equal(isCustomerAppAccount(record), false)
})

test('storage restrictions retain app context in memory', () => {
  const context = createCustomerAppContext({ getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
  assert.equal(context('/customer-app/register'), true)
  assert.equal(context('/customer/appointments'), true)
})
