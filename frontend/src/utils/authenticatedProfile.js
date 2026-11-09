import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'

export const fetchAuthenticatedProfile = async (firebaseUser) => {
  const token = await firebaseUser.getIdToken()
  let lastError = null

  for (const baseUrl of OTP_API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}/auth/profile`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const payload = await response.json()
        return payload.data || {}
      }
      lastError = new Error(`Authenticated profile request failed (${response.status}).`)
    } catch (error) {
      lastError = error
    }
  }

  try {
    const profile = await getDoc(doc(db, 'users', firebaseUser.uid))
    return profile.exists() ? profile.data() || {} : {}
  } catch (firestoreError) {
    throw new AggregateError(
      [lastError, firestoreError].filter(Boolean),
      'Unable to load the authenticated profile.'
    )
  }
}
