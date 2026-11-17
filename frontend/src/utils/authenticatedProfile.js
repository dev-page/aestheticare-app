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
    if (profile.exists()) return profile.data() || {}
    firestoreError = new Error('User profile was not found in Firestore.')
  } catch (error) {
    firestoreError = error
  }

  // Refresh tokens after inactivity or a restored PWA session before asking
  // Firebase Admin to verify them.
  let token
  try {
    token = await firebaseUser.getIdToken(true)
  } catch (error) {
    throw new AggregateError(
      [firestoreError, error].filter(Boolean),
      'Unable to load the authenticated profile.'
    )
  }
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
      const payload = await response.json().catch(() => ({}))
      lastError = Object.assign(
        new Error(payload.error || `Authenticated profile request failed (${response.status}).`),
        { status: response.status, code: payload.code || null }
      )
    } catch (error) {
      lastError = error
    }
  }

  if (firestoreError) {
    const profileErrors = [lastError, firestoreError].filter(Boolean)
    throw new AggregateError(
      profileErrors,
      'Unable to load the authenticated profile.'
    )
  }

  return {}
}
