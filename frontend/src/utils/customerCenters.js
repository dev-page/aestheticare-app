import { getCustomerCareListingName, isPublicClinicCustomerDiscoverable, isCustomerCareListing } from '../../../shared/customerCatalog.js'
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

const FALLBACK_SERVICE = 'General Services'

const toText = (value) => String(value || '').trim()

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

const isCenterDiscoverableClinic = (clinic) => Boolean(
  toText(clinic.ownerId) && isPublicClinicCustomerDiscoverable(clinic)
)

const buildBranches = (clinics, serviceMap) =>
  clinics
    .filter(isCenterDiscoverableClinic)
    .map((clinic) => {
      const clinicServices = Array.isArray(clinic.services)
        ? clinic.services.map((entry) => toText(entry)).filter(Boolean)
        : []
      const postedServices = Array.from(serviceMap.get(clinic.id) || [])
      // Published and approved listings are the current customer catalog. The
      // legacy clinic.services field is only a fallback for older clinics
      // that have not published listings yet.
      const services = postedServices.length ? postedServices : clinicServices
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
    let postsSnapshot
    try {
      postsSnapshot = await getDocs(
        query(collection(db, 'productServicePosts'), where('branchId', 'in', chunk), where('financeStatus', '==', 'approved'), where('isPublished', '==', true))
      )
    } catch (error) {
      console.warn('Could not load clinic service listings; using public profile services.', error)
      continue
    }
    postsSnapshot.forEach((snap) => {
      const post = snap.data() || {}
      if (!isCustomerCareListing(post)) return
      const branchId = toText(post.branchId)
      if (!branchId) return

      const serviceLabel = getCustomerCareListingName(post)
      if (!serviceLabel) return

      if (!serviceMap.has(branchId)) {
        serviceMap.set(branchId, new Set())
      }
      serviceMap.get(branchId).add(serviceLabel)
    })
  }

  return serviceMap
}

const fetchPublicClinicProfiles = async () => {
  const response = await fetch(`${OTP_API_BASE}/public/clinics`, {
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.clinics)) {
    throw new Error(payload?.error || 'Unable to load clinics right now.')
  }
  return payload.data.clinics
    .filter(isCenterDiscoverableClinic)
}

export const fetchPublicClinicProfile = async (branchId) => {
  const normalizedBranchId = toText(branchId)
  if (!normalizedBranchId) throw new Error('Branch not found.')
  const response = await fetch(`${OTP_API_BASE}/public/clinics/${encodeURIComponent(normalizedBranchId)}/profile`, {
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (response.status === 404) throw new Error('Branch not found.')
  if (!response.ok || !payload?.success || !payload?.data?.clinic) {
    throw new Error(payload?.error || 'Unable to load this clinic right now.')
  }
  return payload.data.clinic
}

export const fetchCustomerCenters = async () => {
  const clinics = await fetchPublicClinicProfiles()
  const serviceMap = await buildServiceMap(clinics.map((clinic) => clinic.id))
  return buildCenters(clinics, serviceMap)
}

export const subscribeCustomerCenters = (onChange, onError) => {
  let serviceUnsubscribers = []
  let serviceSnapshots = new Map()
  let disposed = false
  let refreshTimer = null
  let refreshInFlight = false
  let currentClinics = []
  let currentClinicIds = ''
  let refreshSequence = 0

  const emit = () => {
    if (disposed) return
    const serviceMap = new Map()
    serviceSnapshots.forEach((posts, sourceKey) => {
      posts.filter(isCustomerCareListing).forEach((post) => {
        const branchId = toText(post.branchId)
        if (!branchId) return
        const serviceLabel = getCustomerCareListingName(post)
        if (!serviceLabel) return
        if (!serviceMap.has(branchId)) {
          serviceMap.set(branchId, new Set())
        }
        serviceMap.get(branchId).add(serviceLabel)
      })
    })
    onChange(buildCenters(currentClinics, serviceMap))
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

  const refresh = async () => {
    if (disposed || refreshInFlight) return
    refreshInFlight = true
    const sequence = ++refreshSequence
    try {
      const clinics = await fetchPublicClinicProfiles()
      if (disposed || sequence !== refreshSequence) return
      const clinicIds = clinics.map((clinic) => clinic.id).sort().join('|')
      currentClinics = clinics
      if (clinicIds === currentClinicIds) {
        emit()
        return
      }
      currentClinicIds = clinicIds
      stopServiceListeners()
      if (!currentClinics.length) {
        emit()
        return
      }

      const chunks = chunkArray(currentClinics.map((clinic) => clinic.id), 10)
      chunks.forEach((chunk) => {
        const sourceKey = chunk.join('|')
        const unsubscribe = onSnapshot(
          query(collection(db, 'productServicePosts'), where('branchId', 'in', chunk), where('financeStatus', '==', 'approved'), where('isPublished', '==', true)),
          (postsSnapshot) => {
            serviceSnapshots.set(sourceKey, postsSnapshot.docs.map((docSnap) => docSnap.data() || {}))
            emit()
          },
          (error) => {
            console.warn('Could not load clinic service listings; using public profile services.', error)
            serviceSnapshots.delete(sourceKey)
            emit()
          }
        )
        serviceUnsubscribers.push(unsubscribe)
      })
      emit()
    } catch (error) {
      if (!currentClinics.length && typeof onError === 'function') onError(error)
      else console.warn('Could not refresh public clinics; keeping the last result.', error)
    } finally {
      refreshInFlight = false
    }
  }

  void refresh()
  refreshTimer = setInterval(() => { void refresh() }, 45000)

  return () => {
    disposed = true
    refreshSequence += 1
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = null
    stopServiceListeners()
  }
}
