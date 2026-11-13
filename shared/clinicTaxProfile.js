export const clinicTaxProfileIsReviewed = (profile = {}) =>
  profile?.reviewSource === 'admin_review'
  && Boolean(String(profile?.reviewedBy || '').trim())
  && Boolean(profile?.reviewedAt)
  && ['vat_registered', 'non_vat', 'needs_clarification'].includes(String(profile?.status || '').trim())

export const clinicIsVatRegistered = (policy = {}) =>
  clinicTaxProfileIsReviewed(policy?.taxProfile)
  && policy.taxProfile.status === 'vat_registered'

