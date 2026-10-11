const retiredOrderPolicyFields = new Set([
  'deliveryPolicy', 'deliveryPolicyEnabled', 'expectedDeliveryPeriodDays',
  'productDeliveryPaymentPolicyEnabled', 'productCancellationPolicyEnabled',
  'productOrderCancellationPolicy', 'productOrderCancellationPolicyEnabled',
  'productReturnPolicy', 'productReturnPolicyEnabled', 'productTerms', 'productTermsEnabled',
  'orderCancellationAllowed', 'orderCancellationWindowHours',
  'orderCancellationNonRefundable', 'orderCancellationRefundPercentage',
  'orderReturnsAllowed', 'orderReturnWindowDays', 'orderReturnConditionUnopened',
  'orderReturnConditionUnused', 'orderReturnConditionOriginalPackaging', 'orderReturnConditionContents',
  'orderReturnReasonDamaged', 'orderReturnReasonDefective', 'orderReturnReasonWrongProduct',
  'orderReturnReasonExpired', 'orderReturnReasonDescriptionMismatch', 'orderReturnReasonOther',
  'orderReturnOtherReason', 'orderReturnNonRefundable', 'orderReturnRefundPercentage',
])
export const isProductOrderPolicyKey = key => retiredOrderPolicyFields.has(key)

export const walkInServicePolicy = acknowledgementRequired => `Full payment is required before a walk-in service starts. Services, consultations, and packages follow the clinic's applicable service policies.${acknowledgementRequired ? ' Staff confirms the service, price, session details, and applicable policies with the client before payment.' : ''}`

// Ignore retired settings even when older clinic documents still contain them.
export const serviceOnlyClinicPolicies = source => {
  const policy = Object.fromEntries(Object.entries(source || {}).filter(([key]) => !isProductOrderPolicyKey(key)))
  if (typeof policy.walkInPolicy === 'string' && /product|counter sale|pickup|delivery/i.test(policy.walkInPolicy)) policy.walkInPolicy = walkInServicePolicy(policy.walkInPolicyAcknowledgementRequired !== false)
  return policy
}
