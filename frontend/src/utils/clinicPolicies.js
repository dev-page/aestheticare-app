import { doc, getDoc } from 'firebase/firestore'

// Policy configuration is clinic-wide. The branch is used only to resolve the
// owning clinic organization; hours, staff and inventory remain branch data.
export const getClinicPolicyForBranch = async (db, branchId, knownClinic = null) => {
  const normalizedBranchId = String(branchId || '').trim()
  if (!normalizedBranchId) return {}
  let clinic = knownClinic
  if (!clinic) {
    const clinicSnap = await getDoc(doc(db, 'clinics', normalizedBranchId))
    clinic = clinicSnap.exists() ? clinicSnap.data() || {} : {}
  }
  const ownerId = String(clinic.ownerId || clinic.organizationOwnerId || '').trim()
  const applyBranchLinks = (sourcePolicy) => {
    const policy = { ...(sourcePolicy || {}) }
    if (!Array.isArray(clinic?.enforcedPolicyKeys)) return policy
    const linked = new Set(clinic.enforcedPolicyKeys.map((key) => String(key || '').trim()))
    const definitions = [
      ['paymentPolicy', ['paymentPolicyEnabled', 'servicePaymentPolicyEnabled']],
      ['cancellationPolicy', ['cancellationPolicyEnabled', 'serviceCancellationPolicyEnabled', 'refundPolicyEnabled']],
      ['reschedulePolicy', ['reschedulePolicyEnabled', 'serviceReschedulingPolicyEnabled']],
      ['noShowPolicy', ['noShowPolicyEnabled', 'serviceNoShowPolicyEnabled']],
      ['deliveryPolicy', ['deliveryPolicyEnabled', 'productDeliveryPaymentPolicyEnabled']],
      ['productOrderCancellationPolicy', ['productOrderCancellationPolicyEnabled', 'productCancellationPolicyEnabled']],
      ['productReturnPolicy', ['productReturnPolicyEnabled', 'productTermsEnabled']],
      ['walkInPolicy', ['walkInPolicyEnabled']],
    ]
    definitions.forEach(([key, enabledKeys]) => {
      if (!linked.has(key)) enabledKeys.forEach((enabledKey) => { policy[enabledKey] = false })
    })
    return policy
  }
  if (ownerId) {
    const policySnap = await getDoc(doc(db, 'clinicPolicies', ownerId))
    if (policySnap.exists()) return applyBranchLinks(policySnap.data())
  }
  // Supports policy documents saved before clinic-wide policy ownership.
  const legacySnap = await getDoc(doc(db, 'clinicPolicies', normalizedBranchId))
  return legacySnap.exists() ? applyBranchLinks(legacySnap.data()) : {}
}

export const getClinicPolicyOwnerId = (clinic, fallback = '') => String(
  clinic?.ownerId || clinic?.organizationOwnerId || fallback || ''
).trim()
