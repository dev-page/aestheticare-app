import { auth } from '@/config/firebaseConfig'
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'

const buildActorName = (userData, fallbackEmail) => {
  if (userData?.fullName) return userData.fullName
  const firstName = userData?.firstName || ''
  const lastName = userData?.lastName || ''
  const joined = `${firstName} ${lastName}`.trim()
  return joined || fallbackEmail || 'Unknown User'
}

export const logActivity = async (db, payload = {}) => {
  try {
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
      actorName: buildActorName(userData, payload.actorEmail || currentUser.email),
      actorRole: userData.role || 'Unknown',
      actorUserType: userData.userType || '',
      branchId: branchId || null,
      ownerId: ownerId || null,
      targetUserId: payload.targetUserId || null,
      targetUserName: payload.targetUserName || null,
      createdAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Activity logging failed:', error)
  }
}
