<script>
import { ref, computed, onMounted, nextTick } from 'vue'
import { getFirestore, collection, addDoc, getDocs, getDoc, query, serverTimestamp, where, writeBatch, doc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/vue'
import Modal from '@/components/common/Modal.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'AddBranch',
  components: { OwnerSidebar, Modal, Icon },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const branches = ref([])
    const branchAdmins = ref([])
    const ownerProfile = ref({
      branchAdminId: '',
      branchAdminName: ''
    })

    const currentBranch = ref({
      id: null,
      name: '',
      revenue: 0,
      status: 'Active',
      location: '',
      clinicLocationLat: '',
      clinicLocationLng: '',
      clinicLocationAddress: '',
      clinicBarangay: '',
      clinicProvince: '',
      clinicPostalCode: '',
      isMainBranch: false,
      branchAdminId: '',
      branchAdminName: ''
    })
    const showLocationModal = ref(false)
    const locationMapCanvas = ref(null)
    const locationError = ref('')
    let mapsReady = false
    let locationMap = null
    let locationMarker = null

    const caviteLocations = [
      'Bacoor',
      'Cavite City',
      'Dasmarinas City',
      'General Trias',
      'Imus',
      'Tagaytay',
      'Trece Martires',
      'Alfonso',
      'Amadeo',
      'Carmona',
      'General Emilio Aguinaldo',
      'General Mariano Alvarez',
      'Indang',
      'Kawit',
      'Magallanes',
      'Maragondon',
      'Mendez',
      'Naic',
      'Noveleta',
      'Rosario',
      'Silang',
      'Tanza',
      'Ternate'
    ]

    const caviteBounds = {
      north: 14.459,
      south: 13.709,
      east: 121.199,
      west: 120.626
    }

    const defaultCaviteCenter = { lat: 14.3294, lng: 120.9367 }

    const normalizeLocationName = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/^city of\s+/, '')
      .replace(/\s+city$/, '')
      .replace(/\s+municipality$/, '')
      .replace(/\s+province$/, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const caviteLocationSet = new Set(caviteLocations.map(normalizeLocationName))

    const formatFullName = (data = {}) =>
      String(data.fullName || '').trim() ||
      `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() ||
      data.email ||
      'Owner'

    const refreshOwnerProfile = async () => {
      const user = auth.currentUser
      if (!user) return

      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const data = userSnap.exists() ? userSnap.data() || {} : {}
      ownerProfile.value = {
        branchAdminId: user.uid,
        branchAdminName: formatFullName(data)
      }
    }

    const loadBranchAdmins = async () => {
      const user = auth.currentUser
      if (!user) {
        branchAdmins.value = []
        return
      }

      const branchIds = branches.value.map((branch) => branch.id).filter(Boolean)
      const results = []

      results.push({
        id: ownerProfile.value.branchAdminId || user.uid,
        fullName: ownerProfile.value.branchAdminName || 'Owner',
        role: 'Clinic Admin',
        branchId: '',
        isOwner: true
      })

      for (let index = 0; index < branchIds.length; index += 10) {
        const chunk = branchIds.slice(index, index + 10)
        const staffQuery = query(
          collection(db, 'users'),
          where('branchId', 'in', chunk),
          where('userType', '==', 'Staff')
        )
        const staffSnapshot = await getDocs(staffQuery)
        results.push(
          ...staffSnapshot.docs.map((staffDoc) => {
            const data = staffDoc.data() || {}
            return {
              id: staffDoc.id,
              fullName: formatFullName(data),
              role: String(data.customRoleName || data.role || 'Staff').trim(),
              branchId: String(data.branchId || '').trim(),
              isOwner: false
            }
          })
        )
      }

      branchAdmins.value = results
        .filter((admin, index, array) => array.findIndex((entry) => entry.id === admin.id) === index)
        .sort((left, right) => left.fullName.localeCompare(right.fullName))
    }

    const resetForm = () => {
      showLocationModal.value = false
      locationError.value = ''
      currentBranch.value = {
        id: null,
        name: '',
        revenue: 0,
        status: 'Active',
        location: '',
        clinicLocationLat: '',
        clinicLocationLng: '',
        clinicLocationAddress: '',
        clinicBarangay: '',
        clinicProvince: '',
        clinicPostalCode: '',
        isMainBranch: false,
        branchAdminId: '',
        branchAdminName: ''
      }
    }

    const isFormEmpty = computed(() => {
      const branch = currentBranch.value
      return !branch.name?.trim() &&
             !branch.location?.trim() &&
             (branch.revenue || branch.revenue === 0)
    })

    const branchNameError = computed(() => {
      const rawName = currentBranch.value.name || ''
      const trimmed = rawName.trim()
      if (!trimmed) return 'Branch name is required.'
      if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(trimmed)) return 'Only letters, spaces, apostrophes, periods, and hyphens are allowed.'
      return ''
    })

    const selectedBranchLocationLabel = computed(() => currentBranch.value.location || 'Select city/municipality')
    const branchFullAddressLabel = computed(() => currentBranch.value.clinicLocationAddress || '')
    const modalPinnedAddressLabel = computed(() => currentBranch.value.clinicLocationAddress || 'Pin a location inside Cavite to preview the resolved address.')
    const isOutsideCaviteLocationError = computed(() => /outside cavite|within cavite/i.test(locationError.value))
    const locationErrorTitle = computed(() => isOutsideCaviteLocationError.value ? 'Location Outside Cavite' : 'Map Selection Issue')
    const locationErrorHint = computed(() => (
      isOutsideCaviteLocationError.value
        ? 'Choose a pin within Cavite to continue branch creation.'
        : 'Adjust the pin or try selecting a nearby location again.'
    ))

    const handleBranchNameInput = (event) => {
      const value = event?.target?.value ?? ''
      const sanitized = value.replace(/[^A-Za-z\s'.-]/g, '')
      currentBranch.value.name = sanitized
    }

    const syncBranchAdminName = () => {
      if (currentBranch.value.isMainBranch && !String(currentBranch.value.branchAdminId || '').trim()) {
        currentBranch.value.branchAdminId = ownerProfile.value.branchAdminId
        currentBranch.value.branchAdminName = ownerProfile.value.branchAdminName
        return
      }

      const selected = branchAdmins.value.find((admin) => admin.id === currentBranch.value.branchAdminId)
      currentBranch.value.branchAdminName = selected?.fullName || ''
    }

    const loadMapsScript = (apiKey) =>
      new Promise((resolve, reject) => {
        if (window.google?.maps) {
          resolve()
          return
        }

        const existing = document.getElementById('google-maps-js')
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true })
          existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps JS API.')), { once: true })
          return
        }

        const script = document.createElement('script')
        script.id = 'google-maps-js'
        script.async = true
        script.defer = true
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async&v=weekly`
        script.onload = () => {
          const start = Date.now()
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
          waitForMaps()
        }
        script.onerror = () => reject(new Error('Failed to load Google Maps JS API.'))
        document.head.appendChild(script)
      })

    const flattenAddressComponents = (entries = []) => (entries || []).flatMap((entry) => entry?.address_components || [])

    const getAddressComponentValue = (components, type, mode = 'long') => {
      const preferredTypes = Array.isArray(type) ? type : [type]
      const match = (components || []).find((component) =>
        preferredTypes.some((preferredType) => component.types?.includes(preferredType))
      )
      if (!match) return ''
      return mode === 'short'
        ? String(match.short_name || match.shortName || '')
        : String(match.long_name || match.longName || '')
    }

    const extractPostalCode = (components = [], ...fallbackTexts) => {
      const componentPostalCode = getAddressComponentValue(components, 'postal_code')
      if (componentPostalCode) return componentPostalCode

      for (const text of fallbackTexts) {
        const match = String(text || '').match(/\b\d{4}\b/)
        if (match) return match[0]
      }

      return ''
    }

    const isWithinCavite = (components = []) => {
      const province = getAddressComponentValue(components, 'administrative_area_level_2')
      return /cavite/i.test(province)
    }

    const applyResolvedBranchLocation = ({ lat, lng, components = [], formattedAddress = '', fallbackName = '' }) => {
      const cityName =
        getAddressComponentValue(components, 'locality') ||
        getAddressComponentValue(components, 'administrative_area_level_3') ||
        getAddressComponentValue(components, 'administrative_area_level_2')
      const barangayName =
        getAddressComponentValue(components, [
          'sublocality_level_1',
          'sublocality_level_2',
          'sublocality',
          'administrative_area_level_4'
        ]) ||
        getAddressComponentValue(components, 'neighborhood')
      const provinceName =
        getAddressComponentValue(components, 'administrative_area_level_2') ||
        getAddressComponentValue(components, 'administrative_area_level_1')
      const postalCode = extractPostalCode(components, formattedAddress, fallbackName)
      const streetNumber = getAddressComponentValue(components, 'street_number')
      const routeName = getAddressComponentValue(components, 'route')
      const streetAddress = [streetNumber, routeName].filter(Boolean).join(' ').trim()

      currentBranch.value.clinicLocationLat = String(lat)
      currentBranch.value.clinicLocationLng = String(lng)
      currentBranch.value.location = cityName || fallbackName || ''
      currentBranch.value.clinicLocationAddress = formattedAddress || fallbackName || ''
      currentBranch.value.clinicBarangay = barangayName || ''
      currentBranch.value.clinicProvince = provinceName || 'Cavite'
      currentBranch.value.clinicPostalCode = postalCode || ''

      if (!currentBranch.value.clinicLocationAddress && streetAddress) {
        currentBranch.value.clinicLocationAddress = streetAddress
      }
    }

    const reverseGeocodeLocation = (lat, lng) => {
      if (!window.google?.maps?.Geocoder) return Promise.resolve(false)
      const geocoder = new window.google.maps.Geocoder()
      return new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status !== 'OK' || !results?.length) {
            locationError.value = 'Unable to resolve a place name for the pinned location.'
            resolve(false)
            return
          }
          const components = flattenAddressComponents(results)
          if (!isWithinCavite(components)) {
            locationError.value = 'Pinned location is outside Cavite.'
            if (locationMap) {
              locationMap.setCenter(defaultCaviteCenter)
            }
            resolve(false)
            return
          }
          applyResolvedBranchLocation({
            lat,
            lng,
            components,
            formattedAddress: results[0].formatted_address || '',
            fallbackName: results[0].formatted_address || ''
          })
          locationError.value = ''
          resolve(true)
        })
      })
    }

    const initLocationMap = async () => {
      if (!locationMapCanvas.value) return
      locationError.value = ''

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        locationError.value = 'Missing Google Maps API key in frontend env.'
        return
      }

      if (!mapsReady) {
        try {
          await loadMapsScript(apiKey)
          mapsReady = true
        } catch (error) {
          console.error(error)
          const existing = document.getElementById('google-maps-js')
          if (existing) existing.remove()
          try {
            await loadMapsScript(apiKey)
            mapsReady = true
          } catch (retryError) {
            console.error(retryError)
            locationError.value = 'Failed to load Google Maps. Check API key and referrer restrictions.'
            return
          }
        }
      }

      if (!window.google?.maps?.Map) {
        locationError.value = 'Google Maps failed to initialize.'
        return
      }

      locationMap = new window.google.maps.Map(locationMapCanvas.value, {
        center: defaultCaviteCenter,
        zoom: 12,
        restriction: { latLngBounds: caviteBounds, strictBounds: true },
        mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false
      })

      if (window.google.maps.importLibrary) {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
        locationMarker = new AdvancedMarkerElement({
          position: defaultCaviteCenter,
          map: locationMap,
          gmpDraggable: true
        })
      } else if (window.google.maps.Marker) {
        locationMarker = new window.google.maps.Marker({
          position: defaultCaviteCenter,
          map: locationMap,
          draggable: true
        })
      }

      const restoreMarkerToSavedLocation = () => {
        const lat = Number(currentBranch.value.clinicLocationLat)
        const lng = Number(currentBranch.value.clinicLocationLng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        const savedLocation = { lat, lng }
        if (locationMarker?.position) {
          locationMarker.position = savedLocation
        } else if (locationMarker?.setPosition) {
          locationMarker.setPosition(savedLocation)
        }
        locationMap?.setCenter(savedLocation)
      }

      restoreMarkerToSavedLocation()

      locationMap.addListener('click', (event) => {
        const latLng = event?.latLng
        if (!latLng) return
        const lat = latLng.lat()
        const lng = latLng.lng()
        if (locationMarker?.position) {
          locationMarker.position = { lat, lng }
        } else if (locationMarker?.setPosition) {
          locationMarker.setPosition({ lat, lng })
        }
        reverseGeocodeLocation(lat, lng)
      })

      if (locationMarker?.addListener) {
        locationMarker.addListener('dragend', () => {
          const pos = locationMarker?.getPosition ? locationMarker.getPosition() : locationMarker?.position
          if (!pos) return
          const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
          const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
          reverseGeocodeLocation(lat, lng)
        })
      }
    }

    const openLocationModal = async () => {
      showLocationModal.value = true
      await nextTick()
      await initLocationMap()
    }

    const closeLocationModal = () => {
      showLocationModal.value = false
      locationError.value = ''
    }

    const usePinnedLocation = async () => {
      if (!locationMarker) {
        locationError.value = 'Pin a location on the map first.'
        return
      }
      const pos = locationMarker?.position || (locationMarker?.getPosition ? locationMarker.getPosition() : null)
      if (!pos) {
        locationError.value = 'Pin a location on the map first.'
        return
      }
      const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
      const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
      const resolved = await reverseGeocodeLocation(lat, lng)
      if (!resolved) return

      closeLocationModal()
      toast.success('Branch location selected successfully.')
    }

    const saveBranch = async () => {
      if (branchNameError.value) {
        toast.error(branchNameError.value)
        return
      }
      if (!currentBranch.value.location || !currentBranch.value.location.trim()) {
        toast.error('Please select a location in Cavite.')
        return
      }
      if (!currentBranch.value.clinicLocationLat || !currentBranch.value.clinicLocationLng) {
        toast.error('Please pin the exact branch location on the map.')
        return
      }
      if (!caviteLocationSet.has(normalizeLocationName(currentBranch.value.location))) {
        toast.error('Only branches located in Cavite can be added.')
        return
      }
      if (currentBranch.value.revenue < 0) {
        toast.error('Revenue cannot be negative.')
        return
      }
      if (!String(currentBranch.value.branchAdminId || '').trim()) {
        if (currentBranch.value.isMainBranch) {
          currentBranch.value.branchAdminId = ownerProfile.value.branchAdminId
          currentBranch.value.branchAdminName = ownerProfile.value.branchAdminName
        } else {
          toast.error('Please select a branch admin before activating this branch.')
          return
        }
      }
      if (!String(currentBranch.value.branchAdminName || '').trim()) {
        syncBranchAdminName()
      }

      try {
        const result = await Swal.fire({
          title: 'Confirm Addition',
          text: `Are you sure you want to add the branch "${currentBranch.value.name.trim()}"?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, add!',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info('Branch addition cancelled')
          return
        }

        const ownerId = auth.currentUser?.uid
        if (!ownerId) {
          toast.error('No logged-in owner found.')
          return
        }

        if (currentBranch.value.isMainBranch) {
          const ownerBranchesQuery = query(collection(db, 'clinics'), where('ownerId', '==', ownerId))
          const existingBranches = await getDocs(ownerBranchesQuery)
          const batch = writeBatch(db)
          existingBranches.docs.forEach((branchDoc) => {
            batch.update(branchDoc.ref, { isMainBranch: false })
          })
          await batch.commit()
        }

        const docRef = await addDoc(collection(db, 'clinics'), {
          clinicBranch: currentBranch.value.name.trim(),
          clinicLocation: currentBranch.value.location.trim(),
          clinicLocationLat: currentBranch.value.clinicLocationLat,
          clinicLocationLng: currentBranch.value.clinicLocationLng,
          clinicLocationAddress: currentBranch.value.clinicLocationAddress,
          clinicBarangay: currentBranch.value.clinicBarangay,
          clinicProvince: currentBranch.value.clinicProvince,
          clinicPostalCode: currentBranch.value.clinicPostalCode,
          revenue: currentBranch.value.revenue,
          status: 'Active',
          isMainBranch: Boolean(currentBranch.value.isMainBranch),
          isPublished: true,
          ownerId,
          branchAdminId: currentBranch.value.branchAdminId,
          branchAdminName: currentBranch.value.branchAdminName,
          createdAt: serverTimestamp()
        })

        branches.value.push({
          id: docRef.id,
          ...currentBranch.value,
          clinicBranch: currentBranch.value.name.trim(),
          clinicLocation: currentBranch.value.location.trim(),
          clinicLocationLat: currentBranch.value.clinicLocationLat,
          clinicLocationLng: currentBranch.value.clinicLocationLng,
          clinicLocationAddress: currentBranch.value.clinicLocationAddress,
          clinicBarangay: currentBranch.value.clinicBarangay,
          clinicProvince: currentBranch.value.clinicProvince,
          clinicPostalCode: currentBranch.value.clinicPostalCode,
          isMainBranch: Boolean(currentBranch.value.isMainBranch),
          isPublished: true,
          ownerId,
          branchAdminId: currentBranch.value.branchAdminId,
          branchAdminName: currentBranch.value.branchAdminName,
          status: 'Active'
        })

        toast.success('Branch added successfully.')
        resetForm()
      } catch (error) {
        console.error('Error saving branch:', error)
        toast.error('Failed to save branch. Please try again.')
      }
    }

    onMounted(async () => {
      await refreshOwnerProfile()
      await loadBranches()
      await loadBranchAdmins()
      if (ownerProfile.value.branchAdminId) {
        currentBranch.value.branchAdminId = ownerProfile.value.branchAdminId
        currentBranch.value.branchAdminName = ownerProfile.value.branchAdminName
      }
    })

    return {
      branches,
      branchAdmins,
      currentBranch,
      caviteLocations,
      showLocationModal,
      locationMapCanvas,
      locationError,
      selectedBranchLocationLabel,
      branchFullAddressLabel,
      modalPinnedAddressLabel,
      isOutsideCaviteLocationError,
      locationErrorTitle,
      locationErrorHint,
      branchNameError,
      handleBranchNameInput,
      syncBranchAdminName,
      openLocationModal,
      closeLocationModal,
      usePinnedLocation,
      saveBranch,
      resetForm,
      isFormEmpty
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="mx-auto max-w-2xl flex-1 p-6 text-white">
      <h1 class="mb-6 text-2xl font-bold">Add Branch</h1>

      <div class="mx-auto max-w-2xl rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg md:p-8">
        <form class="space-y-4">
          <div>
            <label class="mb-1 block text-slate-400">Branch Name</label>
            <input
              v-model="currentBranch.name"
              type="text"
              placeholder="Enter branch name"
              @input="handleBranchNameInput"
              :class="[
                'w-full rounded-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                branchNameError ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
              ]"
            />
            <p v-if="branchNameError" class="mt-1 text-xs text-red-400">{{ branchNameError }}</p>
          </div>

          <div>
            <label class="mb-1 block text-slate-400">Location</label>
            <div class="flex flex-col gap-3 sm:flex-row">
              <select
                v-model="currentBranch.location"
                class="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Select city/municipality in Cavite</option>
                <option v-for="location in caviteLocations" :key="location" :value="location">
                  {{ location }}
                </option>
              </select>
              <button
                type="button"
                @click="openLocationModal"
                class="rounded-lg border border-gold-500/50 bg-gold-500/10 px-4 py-2 text-sm font-medium text-gold-200 transition hover:bg-gold-500/20"
              >
                Pick on Map
              </button>
            </div>
            <p class="mt-1 text-xs text-slate-400">Choose the city or municipality, then pin the exact branch location on the map.</p>
          </div>

          <div>
            <label class="mb-1 block text-slate-400">Exact Address</label>
            <input
              :value="branchFullAddressLabel"
              readonly
              class="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white"
            />
            <p class="mt-1 text-xs text-slate-400">
              {{ currentBranch.clinicLocationAddress ? 'Address resolved from the map pin.' : 'This will be filled after pinning the branch location.' }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-slate-400">Barangay</label>
              <input
                :value="currentBranch.clinicBarangay"
                readonly
                class="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label class="mb-1 block text-slate-400">Province</label>
              <input
                :value="currentBranch.clinicProvince"
                readonly
                class="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label class="mb-1 block text-slate-400">Postal Code</label>
              <input
                v-model="currentBranch.clinicPostalCode"
                type="text"
                inputmode="numeric"
                maxlength="4"
                readonly
                class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0000"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-slate-400">Revenue</label>
            <input
              v-model.number="currentBranch.revenue"
              type="number"
              min="0"
              step="0.01"
              placeholder="Revenue"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="mb-1 block text-slate-400">Status</label>
            <input
              v-model="currentBranch.status"
              type="text"
              readonly
              class="w-full cursor-not-allowed rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label class="mb-1 block text-slate-400">Branch Admin</label>
            <select
              v-model="currentBranch.branchAdminId"
              @change="syncBranchAdminName"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select branch admin</option>
              <option v-for="admin in branchAdmins" :key="admin.id" :value="admin.id">
                {{ admin.fullName }}{{ admin.role ? ` - ${admin.role}` : '' }}{{ admin.isOwner ? ' (Clinic Admin)' : '' }}
              </option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Choose who will manage this branch before it is activated.</p>
          </div>

          <div class="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3">
            <label class="flex items-center gap-3 text-white">
              <input
                v-model="currentBranch.isMainBranch"
                type="checkbox"
                @change="syncBranchAdminName"
                class="h-4 w-4 rounded border-slate-500 bg-slate-800 text-amber-500"
              />
              <span>Set this as the main branch</span>
            </label>
            <p class="mt-2 text-xs text-slate-400">The main branch can serve as the central branch reference for clinic-wide reporting.</p>
          </div>

          <div v-if="locationError" class="rounded-lg border px-4 py-3" :class="isOutsideCaviteLocationError ? 'border-rose-500/40 bg-rose-500/10 text-rose-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'">
            <p class="text-sm font-semibold uppercase tracking-[0.14em]">{{ locationErrorTitle }}</p>
            <p class="mt-1 text-sm">{{ locationError }}</p>
            <p class="mt-2 text-xs text-slate-300">{{ locationErrorHint }}</p>
          </div>

          <div class="flex justify-end space-x-2 pt-4">
            <button
              type="reset"
              :disabled="isFormEmpty"
              @click="resetForm"
              class="rounded bg-slate-600 px-4 py-2 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="saveBranch"
              class="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              Add Branch
            </button>
          </div>
        </form>
      </div>

      <Modal
        panelClass="bg-slate-900 text-white w-full max-w-4xl"
        :isOpen="showLocationModal"
        :title="'Select Branch Location'"
        @close="closeLocationModal"
        :showConfirm="false"
      >
        <div class="space-y-4">
          <div ref="locationMapCanvas" class="w-full h-[380px] rounded-xl border border-slate-700"></div>
          <div
            v-if="locationError"
            class="rounded-2xl border px-4 py-3 shadow-lg"
            :class="isOutsideCaviteLocationError ? 'border-rose-400/50 bg-rose-500/12' : 'border-amber-400/50 bg-amber-500/12'"
          >
            <div class="flex items-start gap-3">
              <div
                class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                :class="isOutsideCaviteLocationError ? 'bg-rose-500/20 text-rose-200' : 'bg-amber-500/20 text-amber-200'"
              >
                <Icon :icon="isOutsideCaviteLocationError ? 'mdi:map-marker-off-outline' : 'mdi:alert-circle-outline'" class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <p
                  class="text-sm font-semibold uppercase tracking-[0.14em]"
                  :class="isOutsideCaviteLocationError ? 'text-rose-200' : 'text-amber-200'"
                >
                  {{ locationErrorTitle }}
                </p>
                <p class="mt-1 text-sm text-white">{{ locationError }}</p>
                <p class="mt-2 text-xs text-slate-300">{{ locationErrorHint }}</p>
              </div>
            </div>
          </div>
          <div class="rounded-xl border border-slate-700 bg-slate-800/70 p-4 space-y-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Pinned Full Address</p>
              <p class="mt-1 text-sm text-white">{{ modalPinnedAddressLabel }}</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p class="text-slate-400 text-xs uppercase tracking-wide">Barangay</p>
                <p class="mt-1 text-slate-200">{{ currentBranch.clinicBarangay || '-' }}</p>
              </div>
              <div>
                <p class="text-slate-400 text-xs uppercase tracking-wide">City/Municipality</p>
                <p class="mt-1 text-slate-200">{{ currentBranch.location || '-' }}</p>
              </div>
              <div>
                <p class="text-slate-400 text-xs uppercase tracking-wide">Postal Code</p>
                <p class="mt-1 text-slate-200">{{ currentBranch.clinicPostalCode || '-' }}</p>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              @click="closeLocationModal"
            >
              Close
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-gold-700 hover:bg-gold-800 text-white"
              @click="usePinnedLocation"
            >
              Use Pin
            </button>
          </div>
        </div>
      </Modal>
    </main>
  </div>
</template>
