import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import { hasExpiredSuspension, isSuspendedStatus, restoreExpiredSuspension, toDate } from '@/utils/centerSuspension'

const FALLBACK_SERVICE = 'General Services'

const toText = (value) => String(value || '').trim()

const extractCity = (location) => {
  const raw = toText(location)
  if (!raw) return ''
  return raw.split(',')[0].trim()
}

export const fetchCustomerCenters = async () => {
  const clinicsSnapshot = await getDocs(collection(db, 'clinics'))

  const clinics = clinicsSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  const restoreTargets = clinics.filter((clinic) => hasExpiredSuspension(clinic))
  if (restoreTargets.length) {
    await Promise.all(
      restoreTargets.map((clinic) => restoreExpiredSuspension(db, clinic.id, clinic))
    )
  }

  const serviceMap = new Map()
  const activeClinics = clinics.map((clinic) => (
    hasExpiredSuspension(clinic)
      ? {
          ...clinic,
          status: 'Active',
          moderationStatus: 'Resolved',
          isPublished: true,
          suspendedAt: null,
          suspensionEndsAt: null,
          suspensionReason: '',
          suspensionSource: ''
        }
      : clinic
  ))
  const clinicIds = activeClinics.map((clinic) => clinic.id)
  const chunkArray = (items, size = 10) => {
    const chunks = []
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size))
    }
    return chunks
  }

  if (clinicIds.length) {
    const chunks = chunkArray(clinicIds, 10)
    for (const chunk of chunks) {
      const postsSnapshot = await getDocs(
        query(collection(db, 'productServicePosts'), where('branchId', 'in', chunk))
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
  }

  const centers = activeClinics
    .filter((clinic) => {
      const ownerId = toText(clinic.ownerId)
      const status = toText(clinic.status).toLowerCase()
      const moderationStatus = toText(clinic.moderationStatus).toLowerCase()
      const isPublished = clinic.isPublished === true
      const expiresAt = toDate(clinic.subscriptionExpiresAt)
      const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false
      return (
        Boolean(ownerId) &&
        status !== 'inactive' &&
        !isSuspendedStatus(status) &&
        !isSuspendedStatus(moderationStatus) &&
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
        name: toText(clinic.clinicName || clinic.clinicBranch) || 'Unnamed Center',
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

  return centers
}
