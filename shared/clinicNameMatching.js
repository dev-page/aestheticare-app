export const normalizeClinicNameForMatch = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')

const locationCoordinates = (location = {}) => {
  const latValue = location.clinicLocationLat ?? location.lat ?? location.latitude
  const lngValue = location.clinicLocationLng ?? location.lng ?? location.longitude
  if (latValue == null || latValue === '' || lngValue == null || lngValue === '') return null
  const lat = Number(latValue)
  const lng = Number(lngValue)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export const isSameClinicLocation = (left = {}, right = {}, maximumDistanceMeters = 150) => {
  const leftCoordinates = locationCoordinates(left)
  const rightCoordinates = locationCoordinates(right)
  if (leftCoordinates && rightCoordinates) {
    const radians = (degrees) => degrees * Math.PI / 180
    const latitudeDelta = radians(rightCoordinates.lat - leftCoordinates.lat)
    const longitudeDelta = radians(rightCoordinates.lng - leftCoordinates.lng)
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(leftCoordinates.lat)) * Math.cos(radians(rightCoordinates.lat))
      * Math.sin(longitudeDelta / 2) ** 2
    const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    return distanceMeters <= maximumDistanceMeters
  }

  const leftCity = normalizeClinicNameForMatch(left.clinicLocation)
  const rightCity = normalizeClinicNameForMatch(right.clinicLocation)
  const leftAddress = normalizeClinicNameForMatch(left.clinicLocationAddress)
  const rightAddress = normalizeClinicNameForMatch(right.clinicLocationAddress)
  return Boolean(leftCity && leftCity === rightCity && leftAddress && leftAddress === rightAddress)
}

export const findClinicNameMatches = (clinics = [], candidate = {}) => {
  const nameKey = normalizeClinicNameForMatch(candidate.clinicName)
  if (!nameKey || nameKey.length < 3) return { sameName: false, sameLocation: false }

  const matchingClinics = clinics.filter((clinic) =>
    normalizeClinicNameForMatch(clinic.clinicName) === nameKey
  )
  return {
    sameName: matchingClinics.length > 0,
    sameLocation: matchingClinics.some((clinic) => isSameClinicLocation(clinic, candidate)),
  }
}
