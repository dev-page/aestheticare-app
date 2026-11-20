import { isPublicClinicCustomerDiscoverable } from '../../../shared/customerCatalog.js'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

const FALLBACK_SERVICE = 'General Services'

const toText = (value) => String(value || '').trim()

const extractCity = (location) => {
  const raw = toText(location)
  if (!raw) return ''
  return raw.split(',')[0].trim()
}

const isCenterDiscoverableClinic = (clinic) => Boolean(
  toText(clinic.ownerId) && isPublicClinicCustomerDiscoverable(clinic)
)

const buildBranches = (clinics) =>
  clinics
    .filter(isCenterDiscoverableClinic)
    .map((clinic) => {
      const clinicServices = Array.isArray(clinic.services)
        ? clinic.services.map((entry) => toText(entry)).filter(Boolean)
        : []
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
        services: clinicServices.length ? clinicServices : [FALLBACK_SERVICE],
        rating: Number(clinic.rating || 0),
        profilePicture: toText(clinic.profilePicture),
        bannerPicture: toText(clinic.bannerPicture),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

// Clinic documents represent branches. Public discovery should show the clinic
// organization once, then let the visitor choose its branch before browsing.
const buildCenters = (clinics) => {
  const groups = new Map()

  buildBranches(clinics).forEach((branch) => {
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
  return buildCenters(clinics)
}

export const subscribeCustomerCenters = (onChange, onError) => {
  let disposed = false
  let refreshTimer = null
  let refreshInFlight = false
  let currentClinics = []

  const emit = () => {
    if (disposed) return
    onChange(buildCenters(currentClinics))
  }

  const refresh = async () => {
    if (disposed || refreshInFlight) return
    refreshInFlight = true
    try {
      const clinics = await fetchPublicClinicProfiles()
      if (disposed) return
      currentClinics = clinics
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
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = null
  }
}
