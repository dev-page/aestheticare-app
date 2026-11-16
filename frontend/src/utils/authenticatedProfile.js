import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'

export const fetchAuthenticatedProfile = async (firebaseUser) => {
  let firestoreError = null

  // Firestore rules allow a signed-in user to read only their own profile.
  // Prefer that permitted read so login does not depend on the API service's
  // Admin SDK being available just to load the same profile document.
  try {
    const profile = await getDoc(doc(db, 'users', firebaseUser.uid))
    return profile.exists() ? profile.data() || {} : {}
  } catch (error) {
    firestoreError = error
  }

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

  if (firestoreError) {
    throw new AggregateError(
      [lastError, firestoreError].filter(Boolean),
      'Unable to load the authenticated profile.'
    )
  }

  return {}
}
