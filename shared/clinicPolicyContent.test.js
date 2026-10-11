import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceOnlyClinicPolicies, walkInServicePolicy } from './clinicPolicyContent.js'

test('Retired order settings are ignored while service policies and their limits remain intact', () => {
  const source = { paymentPolicy: 'Pay before care.', paymentPolicyEnabled: true, maximumRescheduleAllowance: 2, deliveryPolicy: 'Collect an order.', productReturnPolicyEnabled: true, productTerms: 'Return items.', orderReturnsAllowed: true, expectedDeliveryPeriodDays: 3, walkInPolicy: 'Full payment before a product is released. Products are counter sales.', walkInPolicyAcknowledgementRequired: true }
  const policy = serviceOnlyClinicPolicies(source)
  assert.deepEqual(Object.keys(policy).sort(), ['paymentPolicy', 'paymentPolicyEnabled', 'maximumRescheduleAllowance', 'walkInPolicy', 'walkInPolicyAcknowledgementRequired'].sort())
  assert.equal(policy.paymentPolicy, source.paymentPolicy)
  assert.equal(policy.maximumRescheduleAllowance, 2)
  assert.equal(policy.walkInPolicy, walkInServicePolicy(true))
  assert.match(source.walkInPolicy, /product/)
})

test('Custom service-only walk-in wording is preserved and disabled policies stay disabled', () => {
  const policy = serviceOnlyClinicPolicies({ walkInPolicy: 'Please arrive ten minutes early for your consultation.', walkInPolicyEnabled: false })
  assert.equal(policy.walkInPolicy, 'Please arrive ten minutes early for your consultation.')
  assert.equal(policy.walkInPolicyEnabled, false)
  assert.equal(serviceOnlyClinicPolicies({ walkInPolicy: 'Products are counter sales.', walkInPolicyAcknowledgementRequired: false }).walkInPolicy, walkInServicePolicy(false))
})

test('Policy cleanup preserves unrelated clinic product and order records', () => {
  const policy = serviceOnlyClinicPolicies({ productPostCount: 4, orderCount: 8, productTermsEnabled: true })
  assert.deepEqual(policy, { productPostCount: 4, orderCount: 8 })
})
