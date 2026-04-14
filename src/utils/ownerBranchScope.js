import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'

const OWNER_ROLE_KEYS = ['owner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator']

const normalizeText = (value) => String(value || '').trim()

const chunkArray = (items, size = 10) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const isOwnerLikeRole = (role) => {
  const normalized = normalizeText(role).toLowerCase()
  return OWNER_ROLE_KEYS.includes(normalized)
}

export const loadOwnerBranchScope = async (db, userId) => {
  if (!userId) {
    return {
      ownerId: '',
      branchId: '',
      branchIds: [],
      isStaffUser: false,
      scopeMode: 'owner',
      userProfile: {},
    }
  }

  const userSnap = await getDoc(doc(db, 'users', userId))
  const userProfile = userSnap.exists() ? (userSnap.data() || {}) : {}
  const userType = normalizeText(userProfile.userType || '').toLowerCase()
  const isStaffUser = userType === 'staff'
  const directBranchId = normalizeText(userProfile.branchId || userProfile.clinicBranch || '')
  const fallbackOwnerId = normalizeText(userProfile.ownerId || userProfile.owner || '')
  let ownerId = fallbackOwnerId
  let branchId = directBranchId

  if (branchId) {
    const branchSnap = await getDoc(doc(db, 'clinics', branchId))
    if (branchSnap.exists()) {
      const branchData = branchSnap.data() || {}
      ownerId = ownerId || normalizeText(branchData.ownerId || '')
    }
  }

  if (!ownerId && isOwnerLikeRole(userProfile.role || userProfile.customRoleName)) {
    ownerId = userId
  }

  const branchIds = new Set()
  if (branchId) branchIds.add(branchId)

  if (!isStaffUser && ownerId) {
    const ownerClinicsSnapshot = await getDocs(
      query(collection(db, 'clinics'), where('ownerId', '==', ownerId))
    )
    ownerClinicsSnapshot.docs.forEach((snap) => branchIds.add(snap.id))
    if (!branchId && ownerClinicsSnapshot.docs.length > 0) {
      branchId = ownerClinicsSnapshot.docs[0].id
    }
  }

  return {
    ownerId,
    branchId,
    branchIds: [...branchIds],
    isStaffUser,
    scopeMode: isStaffUser ? 'branch' : 'owner',
    userProfile,
  }
}

export const loadScopedCollectionDocs = async (db, collectionName, ownerId, branchIds, options = {}) => {
  const docsById = new Map()
  const uniqueBranchIds = [...new Set((branchIds || []).map((id) => normalizeText(id)).filter(Boolean))]
  const scopeMode = String(options.scopeMode || 'owner').trim().toLowerCase()

  const snapshots = []
  if (scopeMode !== 'branch' && ownerId) {
    snapshots.push(
      await getDocs(query(collection(db, collectionName), where('ownerId', '==', ownerId)))
    )
  }

  for (const chunk of chunkArray(uniqueBranchIds, 10)) {
    snapshots.push(
      await getDocs(query(collection(db, collectionName), where('branchId', 'in', chunk)))
    )
  }

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((snap) => {
      docsById.set(snap.id, { id: snap.id, ...snap.data() })
    })
  })

  return [...docsById.values()]
}

export const loadClinicDocsByIds = async (db, branchIds = []) => {
  const uniqueBranchIds = [...new Set((branchIds || []).map((id) => normalizeText(id)).filter(Boolean))]
  if (!uniqueBranchIds.length) return []

  const snapshots = await Promise.all(
    uniqueBranchIds.map((branchId) => getDoc(doc(db, 'clinics', branchId)))
  )

  return snapshots
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }))
}
