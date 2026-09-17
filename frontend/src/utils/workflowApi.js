import { getAuth } from 'firebase/auth'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
export const workflowApi = async (path, body = {}) => {
  const token = await getAuth().currentUser.getIdToken()
  const response = await fetch(OTP_API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Unable to update workflow.')
  return payload.data
}
