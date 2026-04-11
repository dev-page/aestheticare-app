<template>
  <Modal :isOpen="isOpen" @close="$emit('close')" :title="title" panelClass="bg-cream-50 border border-gold-200/80 w-[92vw] max-w-5xl">
    <div class="space-y-4 p-1">
      <p class="text-sm text-charcoal-600">Pin your address on the map. The picker is restricted to the Philippines only.</p>

      <div class="relative">
        <div ref="mapCanvas" class="h-[360px] overflow-hidden rounded-2xl border border-gold-200/80 bg-cream-100"></div>
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center rounded-2xl bg-[rgba(255,248,240,0.72)] text-sm font-semibold text-gold-800">Loading map...</div>
      </div>

      <div v-if="error" class="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</div>

      <div class="rounded-2xl border border-gold-200/80 bg-gradient-to-br from-cream-100 to-gold-100 p-4 space-y-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">Pinned Address</p>
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
            <p class="text-xs uppercase tracking-wide text-gold-700/80">Country</p>
            <p class="mt-1 text-charcoal-700">Philippines</p>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button type="button" class="rounded-lg border border-gold-300 bg-cream-100 px-4 py-2 text-charcoal-700" @click="$emit('close')">Close</button>
        <button type="button" class="rounded-lg bg-gold-700 px-4 py-2 text-white" :disabled="loading" @click="confirmPin">Use Pin</button>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import Modal from '@/components/common/Modal.vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  initialAddress: { type: String, default: '' },
  initialLat: { type: [String, Number], default: '' },
  initialLng: { type: [String, Number], default: '' },
  title: { type: String, default: 'Select Address in the Philippines' },
})

const emit = defineEmits(['close', 'update-location'])

const mapCanvas = ref(null)
const loading = ref(false)
const error = ref('')
let mapsReady = false
let map = null
let marker = null
const lat = ref(String(props.initialLat || ''))
const lng = ref(String(props.initialLng || ''))
const displayAddress = ref(props.initialAddress || 'Pinned location in the Philippines')

const philippinesBounds = { north: 21.5, south: 4.3, east: 127.5, west: 116.0 }
const defaultCenter = { lat: 12.8797, lng: 121.774 }

const loadMapsScript = (apiKey) => new Promise((resolve, reject) => {
  if (window.google?.maps) return resolve()
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
  script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=marker&v=weekly`
  script.onload = () => resolve()
  script.onerror = () => reject(new Error('Failed to load Google Maps'))
  document.head.appendChild(script)
})

const initMap = async () => {
  if (!mapCanvas.value) return
  loading.value = true
  error.value = ''
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) { error.value = 'Missing Google Maps API key.'; loading.value = false; return }
  if (!mapsReady) {
    try { await loadMapsScript(apiKey); mapsReady = true } catch (e) { error.value = 'Failed to load Google Maps.'; loading.value = false; return }
  }

  map = new window.google.maps.Map(mapCanvas.value, { center: defaultCenter, zoom: 6, restriction: { latLngBounds: philippinesBounds, strictBounds: true }, streetViewControl: false, fullscreenControl: false, mapTypeControl: false })

  if (window.google.maps.importLibrary) {
    const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
    marker = new AdvancedMarkerElement({ position: defaultCenter, map })
  } else {
    marker = new window.google.maps.Marker({ position: defaultCenter, map, draggable: true })
  }

  if (lat.value && lng.value && !isNaN(Number(lat.value)) && !isNaN(Number(lng.value))) {
    const pos = { lat: Number(lat.value), lng: Number(lng.value) }
    if (marker.setPosition) marker.setPosition(pos); else marker.position = pos
    if (map.setCenter) map.setCenter(pos)
  }

  map.addListener('click', (e) => { const pos = e.latLng; if (!pos) return; const _lat = pos.lat(); const _lng = pos.lng(); if (marker.setPosition) marker.setPosition({ lat: _lat, lng: _lng }); else marker.position = { lat: _lat, lng: _lng }; reverseGeocode(_lat, _lng) })

  if (marker.addListener) {
    marker.addListener('dragend', () => { const pos = marker.getPosition ? marker.getPosition() : marker.position; if (!pos) return; const _lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat; const _lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng; reverseGeocode(_lat, _lng) })
  }

  loading.value = false
}

const reverseGeocode = (latVal, lngVal) => {
  if (!window.google?.maps?.Geocoder) { error.value = 'Geocoding not available.'; return }
  const geocoder = new window.google.maps.Geocoder()
  geocoder.geocode({ location: { lat: latVal, lng: lngVal } }, (results, status) => {
    if (status !== 'OK' || !results?.length) { error.value = 'Unable to resolve address for the selected pin.'; return }
    const formatted = results[0].formatted_address || results[0].name || ''
    displayAddress.value = formatted
    lat.value = String(latVal)
    lng.value = String(lngVal)
    error.value = ''
  })
}

const confirmPin = () => {
  if (!lat.value || !lng.value) { error.value = 'Pin a location on the map first.'; return }
  emit('update-location', { address: displayAddress.value, lat: lat.value, lng: lng.value })
  emit('close')
}

watch(() => props.isOpen, (open) => { if (open) nextTick(() => initMap()) else { map = null; marker = null; loading.value = false; error.value = '' } })

onBeforeUnmount(() => { map = null; marker = null })
</script>

<style scoped>
.text-charcoal-600 { color: #3f2d24 }
.bg-cream-100 { background: #fffaf3 }
.bg-cream-50 { background: #fffdf9 }
</style>