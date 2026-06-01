<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div class="mx-auto w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
      <div class="mb-5 space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Map Validation Test</p>
        <h1 class="text-2xl font-bold">Google Maps location pinning</h1>
        <p class="max-w-2xl text-sm leading-relaxed text-slate-300">
          This picker only allows land locations inside Cavite. Pins on water, in the ocean, or outside Cavite are rejected.
        </p>
      </div>

      <div class="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        <span class="font-semibold">Instruction:</span>
        Choose a location in Cavite, then click <span class="font-semibold">Use Pin</span> only after the pin is verified.
      </div>

      <label class="mt-5 block text-sm font-medium text-slate-300">Location</label>
      <div
        ref="autocompleteHost"
        class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-white focus-within:ring-2 focus-within:ring-blue-500"
      ></div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          @click="openMap"
        >
          Open Map
        </button>
        <span v-if="pinLabel" class="text-xs text-slate-400">{{ pinLabel }}</span>
      </div>

      <p v-if="loadError" class="mt-3 text-sm text-rose-400">{{ loadError }}</p>
      <p v-else class="mt-3 text-xs text-slate-500">Using Places Autocomplete and Cavite-only validation.</p>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import {
  CAVITE_BOUNDS,
  DEFAULT_CAVITE_CENTER,
  flattenAddressComponents,
  validateCavitePinSelection,
} from '@/utils/locationValidation'

export default {
  name: 'MapTest',
  setup() {
    const autocompleteHost = ref(null)
    const locationValue = ref('')
    const loadError = ref('')
    const pinLabel = ref('')
    const pinnedLat = ref('')
    const pinnedLng = ref('')

    let autocompleteElement = null
    let mapInstance = null
    let markerInstance = null
    let mapModal = null
    let lastValidPin = null

    const loadMapsScript = (apiKey) =>
      new Promise((resolve, reject) => {
        if (window.google?.maps) {
          resolve()
          return
        }

        const existing = document.getElementById('google-maps-js')
        if (existing) {
          existing.addEventListener('load', resolve)
          existing.addEventListener('error', reject)
          return
        }

        const script = document.createElement('script')
        script.id = 'google-maps-js'
        script.async = true
        script.defer = true
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async&v=weekly`
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Google Maps JS API.'))
        document.head.appendChild(script)
      })

    const setMarkerPosition = (position) => {
      if (!markerInstance) return
      if (typeof markerInstance.setPosition === 'function') {
        markerInstance.setPosition(position)
        return
      }
      markerInstance.position = position
    }

    const getMarkerPosition = () => {
      if (!markerInstance) return null
      const position = typeof markerInstance.getPosition === 'function' ? markerInstance.getPosition() : markerInstance.position
      if (!position) return null
      const resolvedLat = typeof position.lat === 'function' ? position.lat() : position.lat
      const resolvedLng = typeof position.lng === 'function' ? position.lng() : position.lng
      if (!Number.isFinite(Number(resolvedLat)) || !Number.isFinite(Number(resolvedLng))) return null
      return { lat: Number(resolvedLat), lng: Number(resolvedLng) }
    }

    const setMapCenter = (position) => {
      if (!mapInstance?.setCenter) return
      mapInstance.setCenter(position)
    }

    const commitSelection = ({ lat, lng, address }) => {
      const position = { lat: Number(lat), lng: Number(lng) }
      setMarkerPosition(position)
      setMapCenter(position)
      lastValidPin = { ...position, address }
      pinnedLat.value = String(position.lat)
      pinnedLng.value = String(position.lng)
      locationValue.value = address
      pinLabel.value = `Pinned: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
      loadError.value = ''
    }

    const revertToLastValidPin = () => {
      if (!lastValidPin) return
      setMarkerPosition({ lat: lastValidPin.lat, lng: lastValidPin.lng })
      setMapCenter({ lat: lastValidPin.lat, lng: lastValidPin.lng })
      pinnedLat.value = String(lastValidPin.lat)
      pinnedLng.value = String(lastValidPin.lng)
      locationValue.value = lastValidPin.address || locationValue.value
      pinLabel.value = `Pinned: ${lastValidPin.lat.toFixed(6)}, ${lastValidPin.lng.toFixed(6)}`
    }

    const validateAndCommit = async ({ lat, lng, results = [], fallbackText = '' }) => {
      const place = results[0] || {}
      const components = flattenAddressComponents(results)
      const formattedAddress = String(place.formatted_address || place.formattedAddress || place.name || '').trim()
      const validation = validateCavitePinSelection({
        components,
        formattedAddress,
        fallbackText,
      })

      if (!validation.ok) {
        loadError.value = validation.reason
        revertToLastValidPin()
        return false
      }

      commitSelection({
        lat,
        lng,
        address: formattedAddress || fallbackText || 'Pinned location in Cavite',
      })
      return true
    }

    const loadLandPinFromGeocoder = async (lat, lng, fallbackText = '') =>
      new Promise((resolve) => {
        if (!window.google?.maps?.Geocoder) {
          loadError.value = 'Geocoding is not available right now.'
          resolve(false)
          return
        }

        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
          if (status !== 'OK' || !results?.length) {
            loadError.value = 'Unable to verify this pin. Choose a land location in Cavite.'
            revertToLastValidPin()
            resolve(false)
            return
          }

          const ok = await validateAndCommit({
            lat,
            lng,
            results,
            fallbackText,
          })
          resolve(ok)
        })
      })

    const initAutocomplete = async () => {
      if (!autocompleteHost.value) return

      await new Promise((resolve) => {
        const start = Date.now()
        const timer = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(timer)
            resolve()
          } else if (Date.now() - start > 5000) {
            clearInterval(timer)
            resolve()
          }
        }, 50)
      })

      if (!window.google?.maps) {
        loadError.value = 'Google Maps failed to initialize.'
        return
      }

      if (window.google.maps.importLibrary) {
        await window.google.maps.importLibrary('places')
      }

      const caviteBounds = CAVITE_BOUNDS

      if (window.google.maps.places?.PlaceAutocompleteElement) {
        autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
          locationRestriction: caviteBounds,
        })
        autocompleteElement.style.width = '100%'
        autocompleteHost.value.innerHTML = ''
        autocompleteHost.value.appendChild(autocompleteElement)

        autocompleteElement.addEventListener('gmp-select', async ({ placePrediction }) => {
          const place = placePrediction.toPlace()
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
          })

          const components = place.addressComponents || []
          const validation = validateCavitePinSelection({
            components,
            formattedAddress: place.formattedAddress || place.displayName || '',
            fallbackText: place.displayName || '',
          })
          if (!validation.ok) {
            loadError.value = validation.reason
            return
          }

          const location = place.location
          if (!location) return
          const lat = location.lat()
          const lng = location.lng()
          commitSelection({
            lat,
            lng,
            address: place.formattedAddress || place.displayName || 'Pinned location in Cavite',
          })

          const cityComponent =
            components.find((comp) => comp.types?.includes('locality')) ||
            components.find((comp) => comp.types?.includes('administrative_area_level_2')) ||
            components.find((comp) => comp.types?.includes('administrative_area_level_1'))
          const cityName = cityComponent?.longName
          const fallbackName = place.displayName || place.formattedAddress || ''
          locationValue.value = cityName || fallbackName
          if (locationValue.value && 'value' in autocompleteElement) {
            autocompleteElement.value = locationValue.value
          }
          loadError.value = ''
        })
        return
      }

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'Search a location in Cavite'
      input.className =
        'w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
      autocompleteHost.value.innerHTML = ''
      autocompleteHost.value.appendChild(input)

      if (!window.google.maps.places?.Autocomplete) {
        loadError.value = 'Places Autocomplete is unavailable.'
        return
      }

      autocompleteElement = new window.google.maps.places.Autocomplete(input, {
        fields: ['place_id', 'formatted_address', 'geometry', 'name', 'address_components'],
        componentRestrictions: { country: 'ph' },
        bounds: caviteBounds,
        strictBounds: true,
      })

      autocompleteElement.addListener('place_changed', () => {
        const place = autocompleteElement.getPlace()
        const location = place?.geometry?.location
        if (!location) return

        const components = place.address_components || []
        const validation = validateCavitePinSelection({
          components,
          formattedAddress: place.formatted_address || place.name || '',
          fallbackText: place.name || '',
        })
        if (!validation.ok) {
          loadError.value = validation.reason
          return
        }

        const lat = location.lat()
        const lng = location.lng()
        commitSelection({
          lat,
          lng,
          address: place.formatted_address || place.name || 'Pinned location in Cavite',
        })
        locationValue.value = place.formatted_address || place.name || ''
        loadError.value = ''
      })
    }

    const openMap = async () => {
      if (!window.google?.maps) return
      if (mapModal) {
        document.body.removeChild(mapModal)
        mapModal = null
      }

      mapModal = document.createElement('div')
      mapModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
      mapModal.innerHTML = `
        <div class="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold text-white">Pin Location</h2>
              <p class="text-xs text-slate-400">Only land locations inside Cavite are allowed.</p>
            </div>
            <button id="close-map" class="text-sm text-slate-300 hover:text-white">Close</button>
          </div>
          <div class="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-amber-100">
            Please drag the pin within Cavite only. Pins on water or outside Cavite will be rejected.
          </div>
          <div id="map-canvas" style="height: 360px; border-radius: 12px; margin-top: 12px;"></div>
          <div class="mt-3 flex items-center justify-end gap-2">
            <button id="use-pin" class="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Use Pin</button>
          </div>
        </div>
      `

      document.body.appendChild(mapModal)
      const closeBtn = mapModal.querySelector('#close-map')
      const useBtn = mapModal.querySelector('#use-pin')
      const canvas = mapModal.querySelector('#map-canvas')

      mapInstance = new window.google.maps.Map(canvas, {
        center: DEFAULT_CAVITE_CENTER,
        zoom: 12,
        restriction: { latLngBounds: CAVITE_BOUNDS, strictBounds: true },
        mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
      })

      if (window.google.maps.importLibrary) {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
        markerInstance = new AdvancedMarkerElement({
          position: DEFAULT_CAVITE_CENTER,
          map: mapInstance,
          gmpDraggable: true,
        })
      } else if (window.google.maps.Marker) {
        markerInstance = new window.google.maps.Marker({
          position: DEFAULT_CAVITE_CENTER,
          map: mapInstance,
          draggable: true,
        })
      }

      lastValidPin = {
        lat: DEFAULT_CAVITE_CENTER.lat,
        lng: DEFAULT_CAVITE_CENTER.lng,
        address: 'Pinned location in Cavite',
      }
      setMarkerPosition(DEFAULT_CAVITE_CENTER)
      setMapCenter(DEFAULT_CAVITE_CENTER)

      closeBtn.addEventListener('click', () => {
        document.body.removeChild(mapModal)
        mapModal = null
      })

      useBtn.addEventListener('click', async () => {
        if (!markerInstance) return
        const position = getMarkerPosition()
        if (!position) {
          loadError.value = 'Pin a valid land location in Cavite first.'
          return
        }

        const ok = await loadLandPinFromGeocoder(position.lat, position.lng, locationValue.value || '')
        if (!ok) return

        document.body.removeChild(mapModal)
        mapModal = null
      })
    }

    onMounted(async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        loadError.value = 'Missing VITE_GOOGLE_MAPS_API_KEY in your environment.'
        return
      }

      try {
        await loadMapsScript(apiKey)
        await initAutocomplete()
      } catch (error) {
        console.error(error)
        loadError.value = 'Failed to load Google Maps JavaScript API.'
      }
    })

    onUnmounted(() => {
      autocompleteElement = null
      if (mapModal) {
        document.body.removeChild(mapModal)
      }
    })

    return {
      autocompleteHost,
      locationValue,
      loadError,
      pinLabel,
      pinnedLat,
      pinnedLng,
      openMap,
    }
  },
}
</script>
