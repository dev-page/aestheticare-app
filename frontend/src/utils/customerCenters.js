import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'

const FALLBACK_SERVICE = 'General Services'

const toText = (value) => String(value || '').trim()

const toDate = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const extractCity = (location) => {
  const raw = toText(location)
  if (!raw) return ''
  return raw.split(',')[0].trim()
}

const chunkArray = (items, size = 10) => {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const buildBranches = (clinics, serviceMap) =>
  clinics
    .filter((clinic) => {
      const ownerId = toText(clinic.ownerId)
      const status = toText(clinic.status).toLowerCase()
      const isPublished = clinic.isPublished === true
      const expiresAt = toDate(clinic.subscriptionExpiresAt)
      const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false
      return (
        Boolean(ownerId) &&
        status !== 'inactive' &&
        isPublished &&
        !isExpired
      )
    })
    .map((clinic) => {
      const clinicServices = Array.isArray(clinic.services)
        ? clinic.services.map((entry) => toText(entry)).filter(Boolean)
        : []
      const postedServices = Array.from(serviceMap.get(clinic.id) || [])
      const services = clinicServices.length ? clinicServices : postedServices
      const location = toText(clinic.clinicLocation)
      return {
        id: clinic.id,
        organizationId: toText(clinic.organizationOwnerId || clinic.ownerId) || clinic.id,
        clinicName: toText(clinic.clinicName),
        name: toText(clinic.clinicName || clinic.clinicBranch) || 'Unnamed Center',
        branchName: toText(clinic.clinicBranch || clinic.clinicName) || 'Unnamed Branch',
        isMainBranch: clinic.isMainBranch === true,
        city: extractCity(location),
        location,
        lat: Number(clinic.clinicLocationLat || 0) || null,
        lng: Number(clinic.clinicLocationLng || 0) || null,
        services: services.length ? services : [FALLBACK_SERVICE],
        rating: Number(clinic.rating || 0),
        profilePicture: toText(clinic.profilePicture),
        bannerPicture: toText(clinic.bannerPicture),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

// Clinic documents represent branches. Public discovery should show the clinic
// organization once, then let the visitor choose its branch before browsing.
const buildCenters = (clinics, serviceMap) => {
  const groups = new Map()

  buildBranches(clinics, serviceMap).forEach((branch) => {
    const key = branch.organizationId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(branch)
  })

  return Array.from(groups, ([id, branches]) => {
    const primary = branches.find((branch) => branch.isMainBranch) || branches.find((branch) => branch.id === id) || branches[0]
    const mainBranch = { ...primary, isMainBranch: true }
    const services = [...new Set(branches.flatMap((branch) => branch.services))]
    return {
      ...mainBranch,
      id,
      // The organization card is named after the main clinic record, never a
      // secondary branch. Its location and image also come from that branch.
      name: primary.clinicName || primary.name,
      services: services.length ? services : [FALLBACK_SERVICE],
      rating: Math.max(...branches.map((branch) => branch.rating || 0)),
      mainBranch,
      branches: [mainBranch, ...branches.filter((branch) => branch.id !== primary.id)],
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

const buildServiceMap = async (clinicIds) => {
  const serviceMap = new Map()
  if (!clinicIds.length) return serviceMap

  const chunks = chunkArray(clinicIds, 10)
  for (const chunk of chunks) {
    const postsSnapshot = await getDocs(
      query(collection(db, 'productServicePosts'), where('branchId', 'in', chunk), where('financeStatus', '==', 'approved'), where('isPublished', '==', true))
    )
    postsSnapshot.forEach((snap) => {
      const post = snap.data() || {}
      const branchId = toText(post.branchId)
      if (!branchId) return

      const serviceLabel = toText(post.serviceName || post.productName || post.title)
      if (!serviceLabel) return

      if (!serviceMap.has(branchId)) {
        serviceMap.set(branchId, new Set())
      }
      serviceMap.get(branchId).add(serviceLabel)
    })
  }

  return serviceMap
}

export const fetchCustomerCenters = async () => {
  // This constraint is required by the Firestore rule for public clinic
  // discovery; querying the whole collection could include private drafts.
  const clinicsSnapshot = await getDocs(
    query(collection(db, 'clinics'), where('isPublished', '==', true))
  )
  const clinics = clinicsSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  const serviceMap = await buildServiceMap(clinics.map((clinic) => clinic.id))
  return buildCenters(clinics, serviceMap)
}

export const subscribeCustomerCenters = (onChange, onError) => {
  let clinicUnsubscribe = null
  let serviceUnsubscribers = []
  let serviceSnapshots = new Map()
  let disposed = false

  const emit = (clinics) => {
    if (disposed) return
    const serviceMap = new Map()
    serviceSnapshots.forEach((posts, sourceKey) => {
      posts.forEach((post) => {
        const branchId = toText(post.branchId)
        if (!branchId) return
        const serviceLabel = toText(post.serviceName || post.productName || post.title)
        if (!serviceLabel) return
        if (!serviceMap.has(branchId)) {
          serviceMap.set(branchId, new Set())
        }
        serviceMap.get(branchId).add(serviceLabel)
      })
    })
    onChange(buildCenters(clinics, serviceMap))
  }

  const stopServiceListeners = () => {
    serviceUnsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe()
      } catch (_error) {
        // ignore cleanup failures
      }
    })
    serviceUnsubscribers = []
    serviceSnapshots = new Map()
  }

  clinicUnsubscribe = onSnapshot(
    query(collection(db, 'clinics'), where('isPublished', '==', true)),
    (snapshot) => {
      const clinics = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      stopServiceListeners()

      if (!clinics.length) {
        emit([])
        return
      }

      const clinicIds = clinics.map((clinic) => clinic.id)
      const chunks = chunkArray(clinicIds, 10)
      chunks.forEach((chunk) => {
        const sourceKey = chunk.join('|')
        const unsubscribe = onSnapshot(
          query(collection(db, 'productServicePosts'), where('branchId', 'in', chunk), where('financeStatus', '==', 'approved'), where('isPublished', '==', true)),
          (postsSnapshot) => {
            serviceSnapshots.set(
              sourceKey,
              postsSnapshot.docs.map((docSnap) => docSnap.data() || {})
            )
            emit(clinics)
          },
          (error) => {
            if (typeof onError === 'function') onError(error)
          }
        )
        serviceUnsubscribers.push(unsubscribe)
      })

      emit(clinics)
    },
    (error) => {
      if (typeof onError === 'function') onError(error)
    }
  )

  return () => {
    disposed = true
    stopServiceListeners()
    if (clinicUnsubscribe) {
      clinicUnsubscribe()
      clinicUnsubscribe = null
    }
  }
}
