import { auth } from '@/config/firebaseConfig'
import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'
import { createJsonApiClient } from './jsonApiClient'

const request = createJsonApiClient(OTP_API_BASE_CANDIDATES)
export const compensationApi = async (path, method = 'GET', body) => {
  if (!auth.currentUser) throw new Error('Please sign in again to access employee compensation.')
  const token = await auth.currentUser.getIdToken()
  return request(path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
