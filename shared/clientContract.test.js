import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClientContract, buildClientContractDocument, clientContractPolicies, normalizeContractAppearance } from './clientContract.js'
const policy = () => ({ paymentPolicyEnabled: true, paymentPolicy: 'A 50% deposit is required.', cancellationPolicyEnabled: false, cancellationPolicy: 'Disabled cancellation terms.', reschedulePolicyEnabled: true, reschedulePolicy: 'One change is allowed.', walkInPolicyEnabled: true, walkInPolicy: 'Pay before treatment.', productReturnPolicyEnabled: true, productReturnPolicy: 'Retired product terms.', clientContract: { configured: true, additionalTerms: 'Tell the practitioner about allergies.' } })
test('Client agreements include enabled service policies and custom terms, with disabled and product rules omitted', () => {
  const terms = buildClientContract(policy(), { source: 'customer_booking_request', serviceName: 'Facial', serviceTerms: 'Facial aftercare.' })
  assert.match(terms, /50% deposit/)
  assert.match(terms, /One change/)
  assert.match(terms, /allergies/)
  assert.match(terms, /Facial aftercare/)
  assert.doesNotMatch(terms, /Disabled cancellation|Retired product|Pay before treatment/)
})
test('Branch links and appointment source determine the policies in the actual agreement', () => {
  const terms = buildClientContract(policy(), { branch: { enforcedPolicyKeys: ['paymentPolicy', 'walkInPolicy'] }, source: 'walk_in' })
  assert.match(terms, /50% deposit/)
  assert.match(terms, /Pay before treatment/)
  assert.doesNotMatch(terms, /One change/)
  assert.deepEqual(clientContractPolicies(policy(), { branch: { enforcedPolicyKeys: [] } }), [])
})
test('The editor preview includes all saved enabled policies without changing stored data', () => {
  const source = policy(), before = structuredClone(source)
  assert.match(buildClientContract(source), /Pay before treatment/)
  assert.deepEqual(source, before)
  assert.match(buildClientContract({}), /By signing/)
})

test('Appearance controls constrain styles and omit retired branding fields', () => {
  const appearance = normalizeContractAppearance({ font: 'unexpected', fontSize: 99, spacing: -5, alignment: 'right', headingColor: 'red;display:none', accentColor: '#123456', logo: 'javascript:alert(1)' })
  assert.equal(appearance.font, 'sans')
  assert.equal(appearance.fontSize, 20)
  assert.equal(appearance.spacing, 12)
  assert.equal(appearance.alignment, 'left')
  assert.equal(appearance.headingColor, '#412d20')
  assert.equal(appearance.accentColor, '#123456')
  assert.equal('logo' in appearance, false)
  assert.equal('header' in normalizeContractAppearance({ header: 'Old clinic header' }), false)
})

test('Structured agreements snapshot appearance and limit formatting to additional clinic terms', () => {
  const source = policy()
  source.clientContract.appearance = { header: 'Sample Clinic', font: 'serif', fontSize: 16, accentColor: '#aabbcc' }
  source.clientContract.additionalTerms = '**Allergies**\n- Tell your practitioner'
  const document = buildClientContractDocument(source, { source: 'customer_booking_request' })
  assert.equal(document.appearance.fontSize, 16)
  assert.equal(document.appearance.font, 'serif')
  assert.equal(document.sections.find(section => section.title === 'Additional clinic terms').formatted, true)
  assert.equal(document.sections.find(section => section.title === 'Payment Policy').formatted, undefined)
  source.clientContract.appearance.fontSize = 20
  source.clientContract.additionalTerms = 'Changed terms'
  assert.equal(document.appearance.fontSize, 16)
  assert.match(document.sections.find(section => section.formatted).text, /Allergies/)
})
