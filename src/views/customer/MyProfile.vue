<template>
  <div class="profile-shell">
    <CustomerSidebar />

    <main class="profile-main">
      <div class="profile-content">
        <section class="profile-panel">
          <template v-if="loading">
            <div class="profile-header">
              <div class="profile-skeleton-line profile-skeleton-title"></div>
              <div class="profile-skeleton-line profile-skeleton-subtitle"></div>
            </div>

            <div class="profile-avatar-block">
              <div class="profile-avatar profile-avatar-skeleton"></div>
              <div class="profile-skeleton-line profile-skeleton-pill"></div>
            </div>

            <div class="profile-form">
              <div v-for="field in 6" :key="field" class="profile-skeleton-field">
                <div class="profile-skeleton-line profile-skeleton-label"></div>
                <div class="profile-skeleton-input"></div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="profile-header">
              <h1 class="profile-title">My Profile</h1>
              <p class="profile-subtitle">Keep your customer details updated for smoother orders and appointments.</p>
            </div>

            <div class="profile-avatar-block">
              <div class="profile-avatar">
                <img v-if="customer.profilePicture" :src="customer.profilePicture" alt="Customer profile" class="w-full h-full object-cover" />
                <span v-else class="profile-avatar-fallback">{{ fullName ? fullName.charAt(0) : 'U' }}</span>
              </div>
              <label class="profile-upload-label">
                Upload Profile Picture
                <input type="file" @change="handleFileUpload" class="hidden" />
              </label>
            </div>

            <form @submit.prevent="saveCustomerProfile" class="profile-form">
              <div>
                <label class="profile-field-label">First Name</label>
                <input v-model="customer.firstName" type="text" class="profile-input" />
              </div>

              <div>
                <label class="profile-field-label">Last Name</label>
                <input v-model="customer.lastName" type="text" class="profile-input" />
              </div>

              <div>
                <label class="profile-field-label">Email</label>
                <input v-model="customer.email" type="email" class="profile-input" />
              </div>

              <div>
                <label class="profile-field-label">Phone Number</label>
                <input v-model="customer.contactNumber" type="tel" class="profile-input" />
              </div>

              <div>
                <label class="profile-field-label">Address Search</label>
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="profile-search-wrap flex-1">
                    <Icon icon="mdi:magnify" class="profile-search-icon h-4 w-4" />
                    <input
                      v-model="locationSearchQuery"
                      type="text"
                      class="profile-input profile-search-input"
                      placeholder="Search a city, barangay, or address"
                      @keyup.enter.prevent="searchLocation"
                    />
                  </div>
                  <button type="button" class="profile-search-button" @click="searchLocation">
                    Search
                  </button>
                </div>
                <p class="mt-2 text-xs text-[#8b6a4d]">
                  Search first, then fine-tune the exact spot by dragging or clicking the pin.
                </p>
                <div class="mt-4 rounded-2xl border border-[#e0c09a] bg-[rgba(255,250,243,0.92)] p-3">
                  <div ref="locationMapEl" class="profile-location-map"></div>
                  <p v-if="!hasLocationCoords" class="mt-2 text-xs text-[#8b6a4d]">
                    Pin a location on the map to save it.
                  </p>
                  <p v-if="locationError" class="mt-2 text-xs text-[#9a563f]">
                    {{ locationError }}
                  </p>
                  <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="profile-location-box">
                      <p class="profile-location-label">City / Municipality</p>
                      <p class="profile-location-value mt-1">{{ customer.addressCity || '-' }}</p>
                    </div>
                    <div class="profile-location-box">
                      <p class="profile-location-label">Barangay</p>
                      <p class="profile-location-value mt-1">{{ customer.addressBarangay || '-' }}</p>
                    </div>
                    <div class="profile-location-box">
                      <p class="profile-location-label">Actual Location</p>
                      <p class="profile-location-value mt-1">{{ customer.address || '-' }}</p>
                    </div>
                    <div class="profile-location-box">
                      <p class="profile-location-label">Postal Code</p>
                      <p class="profile-location-value mt-1">{{ customer.addressPostalCode || '-' }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="profile-field-label">Bio</label>
                <textarea v-model="customer.bio" rows="4" class="profile-input profile-textarea"></textarea>
              </div>

              <button type="submit" class="profile-save-button">
                Save Changes
              </button>
            </form>
          </template>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import { toast } from 'vue3-toastify'

const customer = ref({
  firstName: '',
  lastName: '',
  email: '',
  contactNumber: '',
  address: '',
  addressCity: '',
  addressBarangay: '',
  addressPostalCode: '',
  addressLat: '',
  addressLng: '',
  bio: '',
  profilePicture: '',
})
const loading = ref(true)
const locationMapEl = ref(null)
const locationSearchQuery = ref('')
const locationError = ref('')
let mapsReady = false
let locationMap = null
let locationMarker = null
let geocoder = null
let unsubscribeProfile = null
let unsubscribeAuth = null
const philippinesBounds = { north: 21.5, south: 4.3, east: 127.5, west: 116.0 }
const defaultPhilippinesCenter = { lat: 12.8797, lng: 121.774 }

const fullName = computed(() => `${customer.value.firstName || ''} ${customer.value.lastName || ''}`.trim())

const hasLocationCoords = computed(() => {
  const lat = Number(customer.value.addressLat || 0)
  const lng = Number(customer.value.addressLng || 0)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001
})

const buildLocationSearchQuery = () =>
  [
    customer.value.address,
    customer.value.addressBarangay,
    customer.value.addressCity,
    customer.value.addressPostalCode,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ')

const flattenAddressComponents = (results = []) =>
  (results || []).flatMap((entry) => entry?.address_components || [])

const getAddressComponentValue = (components, type) => {
  const preferredTypes = Array.isArray(type) ? type : [type]
  const match = (components || []).find((component) =>
    preferredTypes.some((preferredType) => component.types?.includes(preferredType))
  )
  return String(match?.long_name || '').trim()
}

const ensureGeocoder = () => {
  if (!geocoder && window.google?.maps?.Geocoder) {
    geocoder = new window.google.maps.Geocoder()
  }
  return geocoder
}

const loadMapsScript = () => {
  if (window.google?.maps?.Map || window.google?.maps?.importLibrary) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-js')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
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
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

const syncLocationFromGeocode = (result, position) => {
  const components = flattenAddressComponents([result])
  const country = getAddressComponentValue(components, 'country')
  if (!/philippines/i.test(country) && String(country || '').toLowerCase() !== 'ph') {
    locationError.value = 'Please select a location in the Philippines.'
    return false
  }

  const cityComponent =
    components.find((comp) => comp.types?.includes('locality')) ||
    components.find((comp) => comp.types?.includes('administrative_area_level_2')) ||
    components.find((comp) => comp.types?.includes('administrative_area_level_1'))
  const barangayComponent =
    components.find((comp) => comp.types?.includes('sublocality_level_1')) ||
    components.find((comp) => comp.types?.includes('sublocality')) ||
    components.find((comp) => comp.types?.includes('neighborhood')) ||
    components.find((comp) => comp.types?.includes('political'))
  const postalComponent = components.find((comp) => comp.types?.includes('postal_code'))

  if (cityComponent?.long_name) {
    customer.value.addressCity = cityComponent.long_name
  }
  customer.value.addressBarangay = barangayComponent?.long_name || customer.value.addressBarangay || ''
  customer.value.address = String(result?.formatted_address || '').trim()
  customer.value.addressPostalCode = postalComponent?.long_name || customer.value.addressPostalCode || ''
  customer.value.addressLat = Number(position?.lat?.() ?? position?.lat ?? '') || ''
  customer.value.addressLng = Number(position?.lng?.() ?? position?.lng ?? '') || ''
  locationError.value = ''
  locationSearchQuery.value = customer.value.address || buildLocationSearchQuery()
  return true
}

const searchLocation = async () => {
  const queryText = String(locationSearchQuery.value || '').trim()
  if (!queryText) {
    toast.error('Please enter an address to search.')
    return
  }

  try {
    await loadMapsScript()
  } catch (err) {
    console.error(err)
    toast.error('Google Maps could not be loaded.')
    return
  }

  const geocoderInstance = ensureGeocoder()
  if (!geocoderInstance) {
    toast.error('Address search is not available right now.')
    return
  }

  geocoderInstance.geocode(
    {
      address: queryText,
      bounds: philippinesBounds,
      componentRestrictions: { country: 'PH' },
    },
    (results, status) => {
      if (status !== 'OK' || !results?.length) {
        locationError.value = 'No matching address was found.'
        toast.error(locationError.value)
        return
      }

      const result = results[0]
      const position = result?.geometry?.location
      if (!position) {
        locationError.value = 'The selected address did not return a map location.'
        toast.error(locationError.value)
        return
      }

      if (!syncLocationFromGeocode(result, position)) {
        toast.error(locationError.value)
        return
      }

      if (locationMap?.setCenter) {
        locationMap.setCenter(position)
      }
      if (locationMarker?.setPosition) {
        locationMarker.setPosition(position)
      } else if (locationMarker) {
        locationMarker.position = position
      }
    }
  )
}

const initLocationMap = async () => {
  if (!locationMapEl.value) return

  try {
    if (!mapsReady) {
      await loadMapsScript()
      mapsReady = true
    }
  } catch (err) {
    console.error(err)
    locationError.value = 'Failed to load Google Maps.'
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
    } catch (err) {
      console.error('Failed to import Google Maps libraries:', err)
    }
  }

  if (!MapCtor) return

  const lat = Number(customer.value.addressLat)
  const lng = Number(customer.value.addressLng)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
  const center = hasCoords ? { lat, lng } : defaultPhilippinesCenter

  if (!locationMap) {
    locationMap = new MapCtor(locationMapEl.value, {
      center,
      zoom: hasCoords ? 15 : 6,
      restriction: { latLngBounds: philippinesBounds, strictBounds: true },
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
    })
  } else {
    locationMap.setCenter(center)
  }

  if (locationMarker?.setMap) {
    locationMarker.setMap(null)
  }
  locationMarker = null

  if (AdvancedMarkerElement) {
    locationMarker = new AdvancedMarkerElement({
      map: locationMap,
      position: center,
      gmpDraggable: true,
    })
  } else if (window.google?.maps?.Marker) {
    locationMarker = new window.google.maps.Marker({
      map: locationMap,
      position: center,
      draggable: true,
    })
  }

  const updateFromPosition = (pos) => {
    if (!pos) return
    const nextLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
    const nextLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return

    const geocoderInstance = ensureGeocoder()
    if (!geocoderInstance) return

    geocoderInstance.geocode({ location: { lat: nextLat, lng: nextLng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) return
      syncLocationFromGeocode(results[0], { lat: nextLat, lng: nextLng })
    })
  }

  if (locationMarker?.addListener) {
    locationMarker.addListener('dragend', (event) => updateFromPosition(event?.latLng))
  } else if (locationMarker?.addEventListener) {
    locationMarker.addEventListener('dragend', (event) => updateFromPosition(event?.latLng))
  }

  locationMap.addListener?.('click', (event) => {
    if (!event?.latLng) return
    if (locationMarker?.setPosition) {
      locationMarker.setPosition(event.latLng)
    } else if (locationMarker?.position) {
      locationMarker.position = event.latLng
    }
    updateFromPosition(event.latLng)
  })
}

const handleFileUpload = (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (loadEvent) => {
    customer.value.profilePicture = loadEvent.target?.result || ''
  }
  reader.readAsDataURL(file)
}

const loadCustomerProfile = () => {
  const user = auth.currentUser
  if (!user) {
    loading.value = false
    return
  }

  loading.value = true
  const userRef = doc(db, 'users', user.uid)
  if (unsubscribeProfile) {
    unsubscribeProfile()
    unsubscribeProfile = null
  }

  unsubscribeProfile = onSnapshot(
    userRef,
    async (userSnap) => {
      if (userSnap.exists()) {
        customer.value = { ...customer.value, ...userSnap.data(), email: user.email || '' }
      } else {
        await setDoc(userRef, {
          ...customer.value,
          email: user.email || '',
          role: 'Customer',
          createdAt: serverTimestamp(),
        })
        customer.value.email = user.email || ''
      }
      locationSearchQuery.value = buildLocationSearchQuery()
      await nextTick()
      await initLocationMap()
      loading.value = false
    },
    (error) => {
      console.error(error)
      toast.error('Failed to load profile.')
      loading.value = false
    }
  )
}

const saveCustomerProfile = async () => {
  const user = auth.currentUser
  if (!user) {
    toast.error('User not authenticated.')
    return
  }

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      firstName: customer.value.firstName || '',
      lastName: customer.value.lastName || '',
      email: customer.value.email || '',
      contactNumber: customer.value.contactNumber || '',
      address: customer.value.address || '',
      addressCity: customer.value.addressCity || '',
      addressBarangay: customer.value.addressBarangay || '',
      addressPostalCode: customer.value.addressPostalCode || '',
      addressLat: customer.value.addressLat || '',
      addressLng: customer.value.addressLng || '',
      bio: customer.value.bio || '',
      profilePicture: customer.value.profilePicture || '',
      updatedAt: serverTimestamp(),
    })
    toast.success('Profile updated successfully.')
  } catch (error) {
    console.error(error)
    toast.error('Failed to save profile.')
  }
}

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (!user) {
      loading.value = false
      return
    }
    loadCustomerProfile()
  })
})

onUnmounted(() => {
  if (unsubscribeProfile) unsubscribeProfile()
  if (unsubscribeAuth) unsubscribeAuth()
  if (locationMarker?.setMap) locationMarker.setMap(null)
  locationMap = null
  locationMarker = null
})
</script>

<style scoped>
input[type="file"]::file-selector-button {
  display: none;
}

.profile-shell {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.profile-main {
  flex: 1;
  min-width: 0;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.profile-content {
  display: flex;
  justify-content: center;
  padding: 1.5rem 1.4rem 2rem;
}

.profile-panel {
  width: 100%;
  max-width: 52rem;
  padding: 1.35rem;
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.profile-skeleton-line,
.profile-skeleton-input,
.profile-avatar-skeleton {
  background: linear-gradient(90deg, rgba(230, 193, 150, 0.48), rgba(244, 228, 205, 0.98), rgba(230, 193, 150, 0.48));
  background-size: 200% 100%;
  animation: profile-skeleton-shimmer 1.4s ease-in-out infinite;
}

.profile-skeleton-line {
  border-radius: 999px;
}

.profile-skeleton-title {
  width: 12rem;
  height: 2.6rem;
}

.profile-skeleton-subtitle {
  width: min(100%, 28rem);
  height: 1rem;
  margin-top: 0.8rem;
}

.profile-avatar-skeleton {
  border-radius: 999px;
}

.profile-skeleton-pill {
  width: 10rem;
  height: 1.8rem;
  margin-top: 1rem;
}

.profile-skeleton-field {
  display: grid;
  gap: 0.55rem;
}

.profile-skeleton-label {
  width: 6rem;
  height: 0.9rem;
}

.profile-skeleton-input {
  height: 3rem;
  border-radius: 1rem;
}

@keyframes profile-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.profile-title {
  margin: 0;
  color: #3d281d;
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1;
}

.profile-subtitle {
  margin: 0.75rem 0 0;
  color: rgba(76, 54, 40, 0.76);
  line-height: 1.7;
}

.profile-avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1.5rem 0;
}

.profile-avatar {
  width: 8rem;
  height: 8rem;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(135deg, #ead6b8 0%, #dcb489 48%, #c6946c 100%);
  border: 1px solid rgba(230, 193, 150, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-avatar-fallback {
  color: #fff8eb;
  font-size: 2rem;
  font-weight: 700;
}

.profile-upload-label {
  margin-top: 0.9rem;
  cursor: pointer;
  color: #8d5a3b;
  font-size: 0.9rem;
  font-weight: 600;
}

.profile-form {
  display: grid;
  gap: 1rem;
}

.profile-field-label {
  display: block;
  margin-bottom: 0.45rem;
  color: #8c6d55;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-input {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.9);
  background: rgba(255, 255, 255, 0.92);
  color: #342419;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.profile-textarea {
  resize: none;
}

.profile-input:focus {
  border-color: rgba(198, 148, 108, 0.9);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.profile-save-button {
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.95rem 1.15rem;
  border-radius: 1rem;
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
  font-weight: 700;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.profile-save-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.profile-search-wrap {
  position: relative;
  min-width: 0;
}

.profile-search-icon {
  position: absolute;
  left: 0.95rem;
  top: 50%;
  transform: translateY(-50%);
  color: #a77d57;
  pointer-events: none;
}

.profile-search-input {
  padding-left: 2.5rem;
}

.profile-search-button {
  border-radius: 1rem;
  border: 1px solid rgba(141, 90, 59, 0.9);
  background: linear-gradient(135deg, #8d5a3b 0%, #6f4329 100%);
  padding: 0.9rem 1.15rem;
  font-weight: 700;
  color: #fff8eb;
  transition: transform 0.16s ease, filter 0.16s ease;
}

.profile-search-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.profile-location-map {
  height: 18rem;
  width: 100%;
  overflow: hidden;
  border-radius: 1.15rem;
  border: 1px solid rgba(224, 192, 154, 0.9);
  background: #fffaf3;
}

.profile-location-box {
  border: 1px solid rgba(224, 192, 154, 0.9);
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(255, 249, 240, 0.98), rgba(250, 238, 220, 0.96));
  padding: 0.85rem 0.9rem;
}

.profile-location-label {
  color: #8b6a4d;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-location-value {
  color: #3d281d;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.35;
}

@media (min-width: 1280px) {
  .profile-content {
    padding: 1.7rem 2rem 2.2rem;
  }
}

@media (max-width: 767px) {
  .profile-content {
    padding: 1rem 1rem 1.5rem;
  }

  .profile-panel {
    padding: 1.1rem;
  }
}
</style>
