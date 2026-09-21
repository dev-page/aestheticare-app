import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

export async function attendanceApi(path, body = {}) {
  if (!auth.currentUser) throw new Error('Sign in to continue.')
  const token = await auth.currentUser.getIdToken()
  // Never retry a mutation against a different server after an ambiguous response.
  const response = await fetch(`${OTP_BACKEND_CANDIDATES[0]}/attendance/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Attendance request failed (${response.status}).`)
  return data
}
