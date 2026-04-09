import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import { hasExpiredSuspension, isSuspendedStatus, restoreExpiredSuspension } from '@/utils/centerSuspension'

const OWNER_LIKE_ROLES = new Set(['owner', 'clinicadmin', 'clinicadministrator'])

const normalizeRole = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const buildClinicLabel = (clinic) =>
  String(clinic?.clinicName || clinic?.clinicBranch || 'this center').trim()

const normalizeClinicAfterRestore = (clinic) => ({
  ...clinic,
  status: 'Active',
  moderationStatus: 'Resolved',
  isPublished: true,
  suspendedAt: null,
  suspensionEndsAt: null,
  suspensionReason: '',
  suspensionSource: ''
})

const ensureClinicIsCurrent = async (clinicId, clinic) => {
  if (!clinicId || !clinic) return clinic
  if (!hasExpiredSuspension(clinic)) return clinic
  await restoreExpiredSuspension(db, clinicId, clinic)
  return normalizeClinicAfterRestore(clinic)
}

const getBlockedClinicDetails = (clinicId, clinic) => {
  const status = String(clinic?.status || '').trim()
  const moderationStatus = String(clinic?.moderationStatus || '').trim()
  if (!isSuspendedStatus(status) && !isSuspendedStatus(moderationStatus)) return null
  return {
    clinicId,
    clinicName: buildClinicLabel(clinic),
    status,
    moderationStatus
  }
}

export const getSuspendedCenterAccess = async (userId, userData) => {
  if (!userId || !userData) return null

  const normalizedRole = normalizeRole(userData.role || userData.userType)
  const branchId = String(userData.branchId || '').trim()
  const userType = String(userData.userType || '').trim().toLowerCase()

  if (normalizedRole === 'superadmin' || userType === 'customer' || normalizedRole === 'customer') {
    return null
  }

  if (branchId) {
    const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
    if (clinicSnap.exists()) {
      const clinic = await ensureClinicIsCurrent(branchId, clinicSnap.data() || {})
      return getBlockedClinicDetails(branchId, clinic)
    }
  }

  if (OWNER_LIKE_ROLES.has(normalizedRole)) {
    const clinicsSnap = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', userId)))
    for (const clinicDoc of clinicsSnap.docs) {
      const clinic = await ensureClinicIsCurrent(clinicDoc.id, clinicDoc.data() || {})
      const blocked = getBlockedClinicDetails(clinicDoc.id, clinic)
      if (blocked) return blocked
    }
  }

  return null
}

