import { auth } from '@/config/firebaseConfig'
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'

const buildActorName = (userData, fallbackEmail) => {
  const fullName = String(userData?.fullName || '').trim()
  if (fullName && !/^anon(ymous)?\s+anon(ymous)?$/i.test(fullName)) return fullName
  const joined = [userData?.firstName, userData?.middleName, userData?.lastName, userData?.suffix]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
  const safeJoined = !/^anon(ymous)?\s+anon(ymous)?$/i.test(joined) ? joined : ''
  return safeJoined || String(userData?.displayName || userData?.name || '').trim() || fallbackEmail || 'Unknown User'
}

const buildActorRole = (userData) => {
  const role = String(userData?.role || '').trim().toLowerCase()
  if (['owner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(role)) return 'Clinic Admin'
  if (role === 'superadmin' || role === 'system admin' || role === 'systemadmin') return 'System Admin'
  return String(userData?.customRoleName || userData?.role || userData?.userType || 'Unknown').trim()
}

const lowSignalActivityPattern = /\b(viewed|opened|open|visited|accessed|loaded|entered|displayed)\b/i

export const isSignificantActivity = (payload = {}) => {
  const action = String(payload.action || '').trim()
  const details = String(payload.details || '').trim()
  const combined = `${action} ${details}`.trim()
  if (!combined) return false
  return !lowSignalActivityPattern.test(combined)
}

export const logActivity = async (db, payload = {}) => {
  try {
    if (!isSignificantActivity(payload)) return

    const currentUser = auth.currentUser
    if (!currentUser) return

    const actorId = payload.actorId || currentUser.uid

    const userSnap = await getDoc(doc(db, 'users', actorId))
    if (!userSnap.exists()) return

    const userData = userSnap.data()
    const branchId = userData.branchId || ''
    let ownerId = ''

    if (branchId) {
      const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
      if (clinicSnap.exists()) {
        ownerId = clinicSnap.data().ownerId || ''
      }
    }

    await addDoc(collection(db, 'activities'), {
      action: payload.action || 'Performed an action',
      details: payload.details || '',
      module: payload.module || 'General',
      actorId,
      actorEmail: userData.email || payload.actorEmail || currentUser.email || '',
      actorName: buildActorName(userData, payload.actorEmail || currentUser.displayName || currentUser.email),
      actorRole: buildActorRole(userData),
      actorUserType: userData.userType || '',
      branchId: branchId || null,
      ownerId: ownerId || null,
      targetUserId: payload.targetUserId || null,
      targetUserName: payload.targetUserName || null,
      targetId: payload.targetId || null,
      targetName: payload.targetName || null,
      success: payload.success !== false,
      createdAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Activity logging failed:', error)
  }
}
