<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div class="max-w-xl mx-auto bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h1 class="text-2xl font-bold mb-2">Google Maps API Test</h1>
      <p class="text-slate-400 text-sm mb-4">Type a location to test Places Autocomplete.</p>

      <label class="block text-slate-400 mb-1">Location</label>
      <div
        ref="autocompleteHost"
        class="w-full rounded-lg bg-slate-700 text-white border border-slate-600 focus-within:ring-2 focus-within:ring-blue-500 px-2 py-1"
      ></div>
      <input type="hidden" :value="pinnedLat" />
      <input type="hidden" :value="pinnedLng" />

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
          @click="openMap"
        >
          Open Map
        </button>
        <span class="text-xs text-slate-400" v-if="pinLabel">{{ pinLabel }}</span>
      </div>

      <p v-if="loadError" class="mt-3 text-sm text-rose-400">{{ loadError }}</p>
      <p v-else class="mt-3 text-xs text-slate-500">Using Places Autocomplete.</p>
    </div>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'

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

      const caviteBounds = {
        north: 14.459,
        south: 13.709,
        east: 121.199,
        west: 120.626
      }

      if (window.google.maps.places?.PlaceAutocompleteElement) {
        autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
          locationRestriction: caviteBounds
        })
        autocompleteElement.style.width = '100%'
        autocompleteHost.value.innerHTML = ''
        autocompleteHost.value.appendChild(autocompleteElement)

        autocompleteElement.addEventListener('gmp-select', async ({ placePrediction }) => {
          const place = placePrediction.toPlace()
          await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'] })

          const components = place.addressComponents || []
          const isCavite =
            components.some((comp) => comp.types?.includes('administrative_area_level_2') && /cavite/i.test(comp.longName)) ||
            components.some((comp) => comp.types?.includes('administrative_area_level_1') && /calabarzon/i.test(comp.longName))
          if (!isCavite) {
            loadError.value = 'Please select a location within Cavite.'
            return
          }

          const location = place.location
          if (!location) return
          const lat = location.lat()
          const lng = location.lng()
          pinnedLat.value = String(lat)
          pinnedLng.value = String(lng)

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
          pinLabel.value = `Pinned: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
          loadError.value = ''
        })
        return
      }

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'Search a location'
      input.className =
        'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
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
        strictBounds: true
      })

      autocompleteElement.addListener('place_changed', () => {
        const place = autocompleteElement.getPlace()
        const location = place?.geometry?.location
        if (!location) return
        const components = place.address_components || []
        const isCavite =
          components.some((comp) => comp.types?.includes('administrative_area_level_2') && /cavite/i.test(comp.long_name)) ||
          components.some((comp) => comp.types?.includes('administrative_area_level_1') && /calabarzon/i.test(comp.long_name))
        if (!isCavite) {
          loadError.value = 'Please select a location within Cavite.'
          return
        }
        const lat = location.lat()
        const lng = location.lng()
        pinnedLat.value = String(lat)
        pinnedLng.value = String(lng)
        locationValue.value = place.formatted_address || place.name || ''
        pinLabel.value = `Pinned: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
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
      mapModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60'
      mapModal.innerHTML = `
        <div class="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl mx-4 p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-white font-semibold">Pin Location</h2>
            <button id="close-map" class="text-slate-300 hover:text-white text-sm">Close</button>
          </div>
          <div id="map-canvas" style="height: 360px; border-radius: 12px;"></div>
          <div class="flex items-center justify-end gap-2 mt-3">
            <button id="use-pin" class="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">Use Pin</button>
          </div>
        </div>
      `

      document.body.appendChild(mapModal)
      const closeBtn = mapModal.querySelector('#close-map')
      const useBtn = mapModal.querySelector('#use-pin')
      const canvas = mapModal.querySelector('#map-canvas')

      const caviteBounds = {
        north: 14.459,
        south: 13.709,
        east: 121.199,
        west: 120.626
      }
      const defaultCenter = { lat: 14.3294, lng: 120.9367 }
      mapInstance = new window.google.maps.Map(canvas, {
        center: defaultCenter,
        zoom: 12,
        restriction: { latLngBounds: caviteBounds, strictBounds: true },
        mapId: import.meta.env.VITE_GOOGLE_MAP_ID
      })
      if (window.google.maps.importLibrary) {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
        markerInstance = new AdvancedMarkerElement({
          position: defaultCenter,
          map: mapInstance,
          gmpDraggable: true
        })
      } else if (window.google.maps.Marker) {
        markerInstance = new window.google.maps.Marker({
          position: defaultCenter,
          map: mapInstance,
          draggable: true
        })
      }

      closeBtn.addEventListener('click', () => {
        document.body.removeChild(mapModal)
        mapModal = null
      })

      useBtn.addEventListener('click', () => {
        if (!markerInstance) return
        const position = markerInstance?.getPosition ? markerInstance.getPosition() : markerInstance?.position
        if (position) {
          const lat = typeof position.lat === 'function' ? position.lat() : position.lat
          const lng = typeof position.lng === 'function' ? position.lng() : position.lng
          pinnedLat.value = String(lat)
          pinnedLng.value = String(lng)
          reverseGeocode(lat, lng)
          pinLabel.value = `Pinned: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        }
        document.body.removeChild(mapModal)
        mapModal = null
      })
    }

    const reverseGeocode = (lat, lng) => {
      if (!window.google?.maps?.Geocoder) return
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== 'OK' || !results?.length) {
          loadError.value = 'Unable to resolve a place name for the pinned location.'
          return
        }
        const components = results[0].address_components || []
        const isCavite =
          components.some((comp) => comp.types.includes('administrative_area_level_2') && /cavite/i.test(comp.long_name)) ||
          components.some((comp) => comp.types.includes('administrative_area_level_1') && /calabarzon/i.test(comp.long_name))
        if (!isCavite) {
          loadError.value = 'Pinned location is outside Cavite.'
          return
        }
        const cityComponent =
          components.find((comp) => comp.types.includes('locality')) ||
          components.find((comp) => comp.types.includes('administrative_area_level_2')) ||
          components.find((comp) => comp.types.includes('administrative_area_level_1'))
        const cityName = cityComponent?.long_name
        if (cityName) {
          locationValue.value = cityName
        } else {
          locationValue.value = results[0].formatted_address || results[0].name || ''
        }
        if (locationValue.value && autocompleteElement && 'value' in autocompleteElement) {
          autocompleteElement.value = locationValue.value
        }
        loadError.value = ''
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
      openMap
    }
  }
}
</script>
