import test from 'node:test'
import assert from 'node:assert/strict'
import { sidebarRouteMatches } from './sidebarRouteMatch.js'

const path = '/customer/account-settings'
const tabs = ['profile', 'notifications', 'account', 'help', 'privacy']
test('each Account Settings tab activates only its corresponding sidebar link', () => {
  for (const active of tabs) {
    const current = { path, query: { tab: active, unrelated: 'value' } }
    assert.deepEqual(tabs.filter(tab => sidebarRouteMatches(current, { path, query: { tab } }, true)), [active])
  }
})
test('default and invalid account tabs select Profile, matching the settings page', () => {
  for (const query of [{}, { tab: 'unknown' }]) {
    const current = { path, query }
    assert.deepEqual(tabs.filter(tab => sidebarRouteMatches(current, { path, query: { tab } }, true)), ['profile'])
  }
})
test('normal links retain exact and nested path matching without matching neighboring pages', () => {
  assert.equal(sidebarRouteMatches({ path: '/crm/clients/new' }, { path: '/crm/clients' }), true)
  assert.equal(sidebarRouteMatches({ path: '/crm/clients/new' }, { path: '/crm/clients' }, true), false)
  assert.equal(sidebarRouteMatches({ path: '/crm/clients-other' }, { path: '/crm/clients' }), false)
  assert.equal(sidebarRouteMatches({ path: '/crm/clients' }, null), false)
})
