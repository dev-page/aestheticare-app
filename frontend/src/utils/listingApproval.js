import { getAuth } from 'firebase/auth'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
export { draftListing, financialTermsChanged } from '../../../backend/otp-backend/listingApproval.js'
export const updateListingApproval = async (id, action, note = '') => {
  const token = await getAuth().currentUser.getIdToken()
  const response = await fetch(`${OTP_API_BASE}/listings/${id}/approval`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, note }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to update listing approval.')
  return result.data
}
