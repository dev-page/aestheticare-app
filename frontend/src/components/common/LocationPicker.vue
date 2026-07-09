<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" v-if="instructionText">
      <p class="font-semibold">{{ instructionTitle }}</p>
      <p class="mt-1 leading-relaxed">{{ instructionText }}</p>
    </div>

    <div class="rounded-2xl border border-gold-200/80 bg-cream-100 p-4 space-y-3">
      <label class="block text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">Search location</label>
      <div class="flex flex-col gap-3 sm:flex-row">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full rounded-xl border border-gold-200/80 bg-white px-4 py-3 text-charcoal-700 outline-none placeholder:text-charcoal-400 focus:border-gold-400 focus:ring-4 focus:ring-gold-200/30"
          :placeholder="searchPlaceholder"
          @keyup.enter.prevent="searchLocation"
        />
        <button
          type="button"
          class="rounded-xl bg-gold-700 px-5 py-3 font-semibold text-white transition hover:bg-gold-800"
          @click="searchLocation"
        >
          Search
        </button>
      </div>
      <p class="text-xs text-charcoal-500">
        {{ searchHint }}
      </p>
    </div>

    <div class="relative">
      <div
        ref="mapCanvas"
        :class="[
          'overflow-hidden rounded-2xl border border-gold-200/80 bg-cream-100',
          mapClass,
          { 'location-picker__cavite-map--fallback': isCaviteRegion && !hasOfficialCaviteBoundary },
        ]"
        :style="{ height: mapHeight }"
      ></div>
      <div
        v-if="isCaviteRegion"
        class="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3"
      >
        <div class="rounded-full border border-amber-200/80 bg-[rgba(255,248,240,0.92)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-800 shadow-sm backdrop-blur-sm">
          {{ hasOfficialCaviteBoundary ? 'Cavite boundary' : 'Cavite only' }}
        </div>
        <div class="hidden rounded-full border border-gold-200/70 bg-[rgba(255,248,240,0.82)] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-charcoal-500 shadow-sm backdrop-blur-sm sm:block">
          {{ hasOfficialCaviteBoundary ? 'OpenStreetMap geometry' : 'Outside Cavite is blocked' }}
        </div>
      </div>
      <div
        v-if="isCaviteRegion && caviteBoundaryNotice"
        class="absolute inset-x-4 bottom-4 z-10 rounded-full border border-amber-200 bg-[rgba(255,248,240,0.92)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 shadow-sm backdrop-blur-sm"
      >
        {{ caviteBoundaryNotice }}
      </div>
      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center rounded-2xl bg-[rgba(255,248,240,0.72)] text-sm font-semibold text-gold-800 backdrop-blur-[2px]"
      >
        Loading map...
      </div>
    </div>

    <div
      v-if="error"
      class="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm"
    >
      {{ error }}
    </div>

    <div class="rounded-2xl border border-gold-200/80 bg-gradient-to-br from-cream-100 to-gold-100 p-4 space-y-3 shadow-[0_10px_24px_rgba(54,34,22,0.06)]">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">{{ pinnedAddressLabel }}</p>
        <p class="mt-1 text-sm text-charcoal-700">{{ displayAddress }}</p>
      </div>
      <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-gold-700/80">Latitude</p>
          <p class="mt-1 text-charcoal-700">{{ lat || '-' }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-gold-700/80">Longitude</p>
          <p class="mt-1 text-charcoal-700">{{ lng || '-' }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-gold-700/80">Allowed area</p>
          <p class="mt-1 text-charcoal-700">{{ allowedAreaLabel }}</p>
        </div>
      </div>
    </div>

    <div v-if="showActions" class="flex justify-end gap-2">
      <button
        v-if="showClose"
        type="button"
        class="rounded-lg border border-gold-300 bg-cream-100 px-4 py-2 text-charcoal-700"
        @click="$emit('close')"
      >
        {{ closeLabel }}
      </button>
      <button
        v-if="showConfirm"
        type="button"
        class="rounded-lg bg-gold-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading || !hasPin"
        @click="confirmPin"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CAVITE_BOUNDS,
  DEFAULT_CAVITE_CENTER,
  DEFAULT_PHILIPPINES_CENTER,
  PHILIPPINES_BOUNDS,
  geoJsonGeometryBounds,
  geoJsonGeometryToOuterRings,
  flattenAddressComponents,
  pointInGeoJsonGeometry,
  validateCavitePinSelection,
  validatePhilippinesPinSelection,
} from '@/utils/locationValidation'
import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'

const props = defineProps({
  region: { type: String, default: 'cavite' },
  title: { type: String, default: '' },
  instructionTitle: { type: String, default: '' },
  instructionText: { type: String, default: '' },
  searchPlaceholder: { type: String, default: 'Search a city, barangay, or address' },
  searchHint: { type: String, default: 'Search first, then fine-tune the exact spot by dragging or clicking the pin.' },
  pinnedAddressLabel: { type: String, default: 'Pinned Address' },
  allowedAreaLabel: { type: String, default: 'Philippines' },
  initialAddress: { type: String, default: '' },
  initialLat: { type: [String, Number], default: '' },
  initialLng: { type: [String, Number], default: '' },
  mapHeight: { type: String, default: '380px' },
  mapClass: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Use Pin' },
  closeLabel: { type: String, default: 'Close' },
  showActions: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  showConfirm: { type: Boolean, default: true },
  autoSelect: { type: Boolean, default: true },
})

const emit = defineEmits(['close', 'confirm', 'selection-change', 'error'])

const mapCanvas = ref(null)
const loading = ref(false)
const error = ref('')
const lat = ref(String(props.initialLat || ''))
const lng = ref(String(props.initialLng || ''))
const displayAddress = ref(props.initialAddress || '')
const searchQuery = ref(props.initialAddress || '')

let mapsReady = false
let map = null
let marker = null
let geocoder = null
let lastValidSelection = null
let caviteBoundaryMask = null
let caviteBoundaryOutlines = []

const caviteBoundaryGeometry = ref(null)
const caviteBoundaryNotice = ref('')

const regionConfig = computed(() => {
  if (String(props.region || '').toLowerCase() === 'philippines') {
    return {
      bounds: PHILIPPINES_BOUNDS,
      defaultCenter: DEFAULT_PHILIPPINES_CENTER,
      validate: validatePhilippinesPinSelection,
      title: props.title || 'Select Address in the Philippines',
      instructionTitle: props.instructionTitle || 'Philippines only',
      instructionText:
        props.instructionText ||
        'Pinning is limited to land locations inside the Philippines. Pins in the ocean or outside the country are blocked.',
    }
  }

  return {
    bounds: geoJsonGeometryBounds(caviteBoundaryGeometry.value) || CAVITE_BOUNDS,
    defaultCenter: DEFAULT_CAVITE_CENTER,
    validate: validateCaviteSelection,
    title: props.title || 'Select Address in Cavite',
    instructionTitle: props.instructionTitle || 'Cavite only',
    instructionText:
      props.instructionText ||
      'Pinning is limited to the official Cavite province boundary. Pins outside Cavite are blocked.',
  }
})

const hasPin = computed(() => Boolean(lat.value && lng.value))
const isCaviteRegion = computed(() => String(props.region || '').toLowerCase() === 'cavite')

const allowedAreaLabel = computed(() => props.allowedAreaLabel || (String(props.region || '').toLowerCase() === 'philippines' ? 'Philippines' : 'Cavite, Philippines'))

const ensureGeocoder = () => {
  if (!geocoder && window.google?.maps?.Geocoder) {
    geocoder = new window.google.maps.Geocoder()
  }
  return geocoder
}

const hasOfficialCaviteBoundary = computed(() => Boolean(caviteBoundaryGeometry.value?.type))

const clearBoundaryOverlays = () => {
  if (caviteBoundaryMask?.setMap) {
    caviteBoundaryMask.setMap(null)
  }
  caviteBoundaryOutlines.forEach((outline) => outline?.setMap?.(null))
  caviteBoundaryMask = null
  caviteBoundaryOutlines = []
}

const getOfficialCaviteBoundary = async () => {
  for (const baseUrl of OTP_API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}/maps/cavite-boundary`)
      if (!response.ok) continue

      const payload = await response.json()
      const geometry = payload?.geometry || payload?.data?.geometry || payload?.data?.features?.[0]?.geometry
      if (geometry?.type && Array.isArray(geometry.coordinates)) {
        return geometry
      }
    } catch (_error) {
      // Try the next backend candidate.
    }
  }

  return null
}

const applyBoundaryOverlays = () => {
  if (!map || !window.google?.maps || !caviteBoundaryGeometry.value) return

  clearBoundaryOverlays()

  const outerRings = geoJsonGeometryToOuterRings(caviteBoundaryGeometry.value)
  const boundaryRing = outerRings[0]
  if (!boundaryRing?.length) return

  const worldRing = [
    { lat: 85, lng: -180 },
    { lat: 85, lng: 180 },
    { lat: -85, lng: 180 },
    { lat: -85, lng: -180 },
  ]

  caviteBoundaryMask = new window.google.maps.Polygon({
    paths: [worldRing, ...outerRings],
    strokeOpacity: 0,
    fillColor: '#fdf6ea',
    fillOpacity: 0.82,
    clickable: false,
    map,
    zIndex: 2,
  })

  caviteBoundaryOutlines = outerRings.map((ring) =>
    new window.google.maps.Polygon({
      paths: ring,
      strokeColor: '#9f6b43',
      strokeOpacity: 1,
      strokeWeight: 3,
      fillOpacity: 0,
      clickable: false,
      map,
      zIndex: 3,
    })
  )
}

const validateCaviteSelection = ({
  lat: selectedLat,
  lng: selectedLng,
  components = [],
  formattedAddress = '',
  fallbackText = '',
} = {}) => {
  if (caviteBoundaryGeometry.value) {
    if (!pointInGeoJsonGeometry({ lat: selectedLat, lng: selectedLng }, caviteBoundaryGeometry.value)) {
      return {
        ok: false,
        reason: 'Please pin a location within the official Cavite province boundary.',
      }
    }
    return { ok: true }
  }

  return validateCavitePinSelection({
    lat: selectedLat,
    lng: selectedLng,
    components,
    formattedAddress,
    fallbackText,
  })
}

const loadMapsScript = () =>
  new Promise((resolve, reject) => {
    const waitForMaps = () => {
      if (window.google?.maps?.Map) {
        resolve()
        return
      }
      if (Date.now() - start > 5000) {
        reject(new Error('Google Maps JS API loaded but maps object was not initialized.'))
        return
      }
      setTimeout(waitForMaps, 50)
    }

    if (window.google?.maps?.Map) {
      resolve()
      return
    }

    const start = Date.now()
    const existing = document.getElementById('google-maps-js')
    if (existing) {
      existing.addEventListener('load', () => waitForMaps(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), { once: true })
      return
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY in environment.'))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-js'
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&loading=async&v=weekly`
    script.onload = () => waitForMaps()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

const setMarkerPosition = (position) => {
  if (!marker || !position) return
  if (typeof marker.setPosition === 'function') {
    marker.setPosition(position)
    return
  }
  marker.position = position
}

const getMarkerPosition = () => {
  if (!marker) return null
  const position = typeof marker.getPosition === 'function' ? marker.getPosition() : marker.position
  if (!position) return null
  const resolvedLat = typeof position.lat === 'function' ? position.lat() : position.lat
  const resolvedLng = typeof position.lng === 'function' ? position.lng() : position.lng
  if (!Number.isFinite(Number(resolvedLat)) || !Number.isFinite(Number(resolvedLng))) return null
  return { lat: Number(resolvedLat), lng: Number(resolvedLng) }
}

const emitSelection = (payload) => {
  const nextSelection = {
    lat: Number(payload.lat),
    lng: Number(payload.lng),
    address: String(payload.address || '').trim(),
    city: String(payload.city || '').trim(),
    barangay: String(payload.barangay || '').trim(),
    province: String(payload.province || '').trim(),
    postalCode: String(payload.postalCode || '').trim(),
    components: payload.components || [],
    formattedAddress: String(payload.formattedAddress || '').trim(),
  }

  lat.value = String(nextSelection.lat)
  lng.value = String(nextSelection.lng)
  displayAddress.value = nextSelection.address || nextSelection.formattedAddress || displayAddress.value
  searchQuery.value = nextSelection.address || nextSelection.formattedAddress || searchQuery.value
  lastValidSelection = nextSelection
  error.value = ''
  emit('selection-change', nextSelection)
}

const revertMarker = () => {
  const fallback = lastValidSelection
    ? { lat: lastValidSelection.lat, lng: lastValidSelection.lng }
    : regionConfig.value.defaultCenter
  if (map?.setCenter) {
    map.setCenter(fallback)
  }
  setMarkerPosition(fallback)
  if (lastValidSelection) {
    lat.value = String(lastValidSelection.lat)
    lng.value = String(lastValidSelection.lng)
    displayAddress.value = lastValidSelection.address || displayAddress.value
  }
}

const resolveSelection = ({ lat: selectedLat, lng: selectedLng, results = [], fallbackText = '' }) => {
  const place = results[0] || {}
  const components = flattenAddressComponents(results)
  const formattedAddress = String(place.formatted_address || place.formattedAddress || place.name || fallbackText || '').trim()
  const validation = regionConfig.value.validate({
    lat: selectedLat,
    lng: selectedLng,
    components,
    formattedAddress,
    fallbackText,
  })

  if (!validation.ok) {
    error.value = validation.reason
    emit('error', validation.reason)
    revertMarker()
    return false
  }

  const getComponentValue = (types, mode = 'long') => {
    const preferredTypes = Array.isArray(types) ? types : [types]
    const match = (components || []).find((component) =>
      preferredTypes.some((preferredType) => component.types?.includes(preferredType))
    )
    if (!match) return ''
    return mode === 'short'
      ? String(match.short_name || match.shortName || '').trim()
      : String(match.long_name || match.longName || '').trim()
  }

  const city =
    getComponentValue('locality') ||
    getComponentValue('administrative_area_level_3') ||
    getComponentValue('administrative_area_level_2')
  const barangay =
    getComponentValue([
      'sublocality_level_1',
      'sublocality_level_2',
      'sublocality',
      'administrative_area_level_4',
      'neighborhood',
    ])
  const province =
    getComponentValue('administrative_area_level_2') ||
    getComponentValue('administrative_area_level_1')
  const postalCode = getComponentValue('postal_code')

  emitSelection({
    lat: selectedLat,
    lng: selectedLng,
    address: formattedAddress || fallbackText || `${selectedLat}, ${selectedLng}`,
    city,
    barangay,
    province,
    postalCode,
    components,
    formattedAddress,
  })
  return true
}

const reverseGeocodeLocation = (selectedLat, selectedLng, fallbackText = '') =>
  new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) {
      error.value = 'Geocoding is not available right now.'
      emit('error', error.value)
      resolve(false)
      return
    }

    const geocoderInstance = ensureGeocoder() || new window.google.maps.Geocoder()
    geocoderInstance.geocode({ location: { lat: selectedLat, lng: selectedLng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) {
        error.value = props.region === 'philippines'
          ? 'Unable to resolve an address for the selected pin.'
          : 'Unable to verify this pin. Please choose a land location in Cavite.'
        emit('error', error.value)
        revertMarker()
        resolve(false)
        return
      }

      resolve(resolveSelection({
        lat: selectedLat,
        lng: selectedLng,
        results,
        fallbackText,
      }))
    })
  })

const searchLocation = async () => {
  const query = String(searchQuery.value || '').trim()
  if (!query) {
    error.value = 'Enter a location to search.'
    emit('error', error.value)
    return
  }

  try {
    loading.value = true
    await loadMapsScript()
  } catch (loadError) {
    console.error(loadError)
    error.value = 'Search is not available right now.'
    emit('error', error.value)
    loading.value = false
    return
  }

  const geocoderInstance = ensureGeocoder()
  if (!geocoderInstance) {
    error.value = 'Search is not available right now.'
    emit('error', error.value)
    loading.value = false
    return
  }

  geocoderInstance.geocode(
    {
      address: query,
      bounds: regionConfig.value.bounds,
      componentRestrictions: { country: 'PH' },
    },
    (results, status) => {
      if (status !== 'OK' || !results?.length) {
        error.value = props.region === 'philippines'
          ? 'No matching address was found.'
          : 'No matching address was found in Cavite.'
        emit('error', error.value)
        loading.value = false
        return
      }

      const place = results[0]
      const position = place?.geometry?.location
      if (!position) {
        error.value = 'The selected address did not return a map location.'
        emit('error', error.value)
        loading.value = false
        return
      }

      const selectedLat = typeof position.lat === 'function' ? position.lat() : position.lat
      const selectedLng = typeof position.lng === 'function' ? position.lng() : position.lng
      const ok = resolveSelection({
        lat: selectedLat,
        lng: selectedLng,
        results,
        fallbackText: place.formatted_address || query,
      })
      if (ok) {
        if (map?.setCenter) map.setCenter({ lat: selectedLat, lng: selectedLng })
        if (map?.setZoom) map.setZoom(16)
        setMarkerPosition({ lat: selectedLat, lng: selectedLng })
      }
      loading.value = false
    }
  )
}

const initMap = async () => {
  if (!mapCanvas.value) return

  loading.value = true
  error.value = ''

  try {
    await loadMapsScript()
  } catch (loadError) {
    console.error(loadError)
    error.value = 'Failed to load Google Maps.'
    emit('error', error.value)
    loading.value = false
    return
  }

  let MapCtor = window.google?.maps?.Map
  let AdvancedMarkerElement = window.google?.maps?.marker?.AdvancedMarkerElement
  if (window.google?.maps?.importLibrary) {
    try {
      const mapsLib = await window.google.maps.importLibrary('maps')
      MapCtor = mapsLib?.Map || MapCtor
      const markerLib = await window.google.maps.importLibrary('marker')
      AdvancedMarkerElement = markerLib?.AdvancedMarkerElement || AdvancedMarkerElement
    } catch (importError) {
      console.error('Failed to import Google Maps libraries:', importError)
    }
  }

  if (!MapCtor) {
    console.error('Google Maps failed to initialize: Map constructor is unavailable after loading the Maps libraries.')
    error.value = 'Google Maps failed to initialize.'
    emit('error', error.value)
    loading.value = false
    return
  }

  if (isCaviteRegion.value && !hasOfficialCaviteBoundary.value) {
    caviteBoundaryNotice.value = 'Loading the official Cavite boundary...'
    const officialBoundary = await getOfficialCaviteBoundary()
    if (officialBoundary) {
      caviteBoundaryGeometry.value = officialBoundary
      caviteBoundaryNotice.value = ''
    } else {
      caviteBoundaryNotice.value = 'Official Cavite boundary is unavailable right now. Using the fallback boundary until the official source is configured.'
    }
  }

  const initialLat = Number(props.initialLat)
  const initialLng = Number(props.initialLng)
  const hasInitialCoords = Number.isFinite(initialLat) && Number.isFinite(initialLng)
  const center = hasInitialCoords ? { lat: initialLat, lng: initialLng } : regionConfig.value.defaultCenter

  if (!map) {
    map = new MapCtor(mapCanvas.value, {
      center,
      zoom: hasInitialCoords ? 15 : 12,
      restriction: { latLngBounds: regionConfig.value.bounds, strictBounds: true },
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
    })
  } else {
    map.setCenter(center)
  }

  if (isCaviteRegion.value && hasOfficialCaviteBoundary.value) {
    applyBoundaryOverlays()
  } else {
    clearBoundaryOverlays()
  }

  if (marker?.setMap) {
    marker.setMap(null)
  }
  marker = null

  if (AdvancedMarkerElement) {
    marker = new AdvancedMarkerElement({
      map,
      position: center,
      gmpDraggable: true,
    })
  } else if (window.google?.maps?.Marker) {
    marker = new window.google.maps.Marker({
      map,
      position: center,
      draggable: true,
    })
  }

  geocoder = ensureGeocoder()

  const handlePosition = async (positionLike) => {
    if (!positionLike) return
    const nextLat = typeof positionLike.lat === 'function' ? positionLike.lat() : positionLike.lat
    const nextLng = typeof positionLike.lng === 'function' ? positionLike.lng() : positionLike.lng
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return
    await reverseGeocodeLocation(nextLat, nextLng, searchQuery.value || displayAddress.value)
  }

  if (marker?.addListener) {
    marker.addListener('dragend', (event) => handlePosition(event?.latLng))
  } else if (marker?.addEventListener) {
    marker.addEventListener('dragend', (event) => handlePosition(event?.latLng))
  }

  map.addListener?.('click', (event) => {
    if (!event?.latLng) return
    const nextLat = event.latLng.lat()
    const nextLng = event.latLng.lng()
    setMarkerPosition({ lat: nextLat, lng: nextLng })
    handlePosition(event.latLng)
  })

  if (hasInitialCoords) {
    const initialSelection = {
      lat: initialLat,
      lng: initialLng,
      address: props.initialAddress || '',
      city: '',
      barangay: '',
      province: '',
      postalCode: '',
      components: [],
      formattedAddress: props.initialAddress || '',
    }
    lastValidSelection = initialSelection
    lat.value = String(initialLat)
    lng.value = String(initialLng)
    displayAddress.value = props.initialAddress || displayAddress.value
  }

  if (props.initialAddress && !searchQuery.value) {
    searchQuery.value = props.initialAddress
  }

  loading.value = false
}

const confirmPin = () => {
  if (!hasPin.value) {
    error.value = props.region === 'philippines'
      ? 'Pin a valid location in the Philippines first.'
      : 'Pin a valid land location in Cavite first.'
    emit('error', error.value)
    return
  }
  emit('confirm', lastValidSelection)
}

watch(
  () => [props.initialAddress, props.initialLat, props.initialLng],
  async () => {
    searchQuery.value = props.initialAddress || ''
    lat.value = String(props.initialLat || '')
    lng.value = String(props.initialLng || '')
    displayAddress.value = props.initialAddress || ''
    await nextTick()
    if (mapCanvas.value) {
      await initMap()
    }
  }
)

onMounted(async () => {
  await nextTick()
  await initMap()
})

onBeforeUnmount(() => {
  clearBoundaryOverlays()
  if (marker?.setMap) {
    marker.setMap(null)
  }
  marker = null
  map = null
  geocoder = null
})
</script>

<style scoped>
.location-picker__cavite-map--fallback {
  clip-path: polygon(
    8% 10%,
    22% 7%,
    36% 8%,
    48% 12%,
    61% 10%,
    74% 14%,
    87% 24%,
    93% 38%,
    91% 52%,
    84% 66%,
    74% 78%,
    63% 88%,
    50% 92%,
    38% 90%,
    27% 83%,
    18% 72%,
    11% 60%,
    8% 47%,
    7% 33%,
    8% 20%
  );
  box-shadow:
    0 18px 36px rgba(54, 34, 22, 0.12),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}
</style>
