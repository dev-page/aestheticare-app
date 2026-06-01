export const CAVITE_BOUNDS = {
  north: 14.518,
  south: 13.679,
  east: 121.255,
  west: 120.559,
}

export const CAVITE_PSGC_CODE = '0402100000'

export const DEFAULT_CAVITE_CENTER = {
  lat: 14.2814,
  lng: 120.8612,
}

export const PHILIPPINES_BOUNDS = {
  north: 21.5,
  south: 4.3,
  east: 127.5,
  west: 116.0,
}

export const DEFAULT_PHILIPPINES_CENTER = {
  lat: 12.8797,
  lng: 121.774,
}

const WATER_KEYWORDS = /\b(ocean|sea|bay|gulf|strait|channel|reef|water|waters|shore|coast|coastal|harbor|harbour|marina|dock|pier|lagoon|river|lake|pond|estuary|floodplain)\b/i
const CAVITE_KEYWORDS = /\bcavite\b/i
const LAND_COMPONENT_TYPES = new Set([
  'street_address',
  'premise',
  'subpremise',
  'route',
  'intersection',
  'political',
  'locality',
  'sublocality',
  'sublocality_level_1',
  'sublocality_level_2',
  'neighborhood',
  'administrative_area_level_3',
  'administrative_area_level_4',
  'administrative_area_level_2',
])

export const flattenAddressComponents = (entries = []) =>
  (entries || []).flatMap((entry) => entry?.address_components || entry?.addressComponents || [])

export const getAddressComponentValue = (components, types, mode = 'long') => {
  const preferredTypes = Array.isArray(types) ? types : [types]
  const match = (components || []).find((component) =>
    preferredTypes.some((preferredType) => component.types?.includes(preferredType))
  )

  if (!match) return ''

  return mode === 'short'
    ? String(match.short_name || match.shortName || '').trim()
    : String(match.long_name || match.longName || '').trim()
}

const toSearchText = (...parts) => parts.map((value) => String(value || '').trim()).filter(Boolean).join(' ')

export const isWithinCavite = ({ components = [], formattedAddress = '', fallbackText = '' } = {}) => {
  const province =
    getAddressComponentValue(components, 'administrative_area_level_2') ||
    getAddressComponentValue(components, 'administrative_area_level_1')

  return CAVITE_KEYWORDS.test(toSearchText(province, formattedAddress, fallbackText))
}

export const looksLikeLandLocation = ({ components = [], formattedAddress = '', fallbackText = '' } = {}) => {
  const text = toSearchText(formattedAddress, fallbackText)
  if (WATER_KEYWORDS.test(text)) return false

  return (components || []).some((component) =>
    (component.types || []).some((type) => LAND_COMPONENT_TYPES.has(type))
  )
}

export const validateCavitePinSelection = ({
  components = [],
  formattedAddress = '',
  fallbackText = '',
} = {}) => {
  if (!isWithinCavite({ components, formattedAddress, fallbackText })) {
    return {
      ok: false,
      reason: 'Please pin a location within Cavite only.',
    }
  }

  if (!looksLikeLandLocation({ components, formattedAddress, fallbackText })) {
    return {
      ok: false,
      reason: 'Pins in the ocean or on water are not allowed.',
    }
  }

  return { ok: true }
}

export const isWithinBounds = (lat, lng, bounds) => {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !bounds) return false
  return (
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  )
}

export const validatePhilippinesPinSelection = ({
  lat,
  lng,
  components = [],
  formattedAddress = '',
  fallbackText = '',
} = {}) => {
  if (!isWithinBounds(lat, lng, PHILIPPINES_BOUNDS)) {
    return {
      ok: false,
      reason: 'Please select a location within the Philippines.',
    }
  }

  const country = getAddressComponentValue(components, 'country')
  if (country && !/philippines/i.test(country) && String(country || '').toLowerCase() !== 'ph') {
    return {
      ok: false,
      reason: 'Please select a location within the Philippines.',
    }
  }

  const text = toSearchText(formattedAddress, fallbackText)
  if (WATER_KEYWORDS.test(text)) {
    return {
      ok: false,
      reason: 'Pins in the ocean or on water are not allowed.',
    }
  }

  return { ok: true }
}

const normalizeGeoJsonPoint = (position = []) => {
  const longitude = Number(position?.[0])
  const latitude = Number(position?.[1])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { lat: latitude, lng: longitude }
}

export const geoJsonGeometryToOuterRings = (geometry) => {
  if (!geometry || !Array.isArray(geometry.coordinates)) return []

  if (geometry.type === 'Polygon') {
    return geometry.coordinates
      .map((ring) => (Array.isArray(ring) ? ring.map(normalizeGeoJsonPoint).filter(Boolean) : []))
      .filter((ring) => ring.length)
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => (Array.isArray(polygon) ? polygon[0] : []))
      .map((ring) => (Array.isArray(ring) ? ring.map(normalizeGeoJsonPoint).filter(Boolean) : []))
      .filter((ring) => ring.length)
  }

  return []
}

export const geoJsonGeometryBounds = (geometry) => {
  const rings = geoJsonGeometryToOuterRings(geometry)
  const allPoints = rings.flat()
  if (!allPoints.length) return null

  return allPoints.reduce(
    (bounds, point) => ({
      north: Math.max(bounds.north, point.lat),
      south: Math.min(bounds.south, point.lat),
      east: Math.max(bounds.east, point.lng),
      west: Math.min(bounds.west, point.lng),
    }),
    {
      north: -90,
      south: 90,
      east: -180,
      west: 180,
    }
  )
}

export const pointInGeoJsonGeometry = ({ lat, lng }, geometry) => {
  const rings = geoJsonGeometryToOuterRings(geometry)
  if (!rings.length) return false

  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false

  const point = { lat: latitude, lng: longitude }

  const isPointInRing = (ring) => {
    if (!Array.isArray(ring) || ring.length < 3) return false

    let inside = false
    for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
      const current = ring[index]
      const previous = ring[previousIndex]
      if (!current || !previous) continue

      const currentLng = Number(current.lng)
      const currentLat = Number(current.lat)
      const previousLng = Number(previous.lng)
      const previousLat = Number(previous.lat)

      const intersects =
        currentLat > point.lat !== previousLat > point.lat &&
        point.lng <
          ((previousLng - currentLng) * (point.lat - currentLat)) /
            (previousLat - currentLat || Number.EPSILON) +
            currentLng

      if (intersects) {
        inside = !inside
      }
    }

    return inside
  }

  return rings.some((ring) => isPointInRing(ring))
}
