<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 flex items-center justify-center p-8">
      <!-- Centered Card -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-3xl">
        <div v-if="branchScopeLabel" class="mb-4 inline-flex rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-200">
          Viewing: {{ branchScopeLabel }}
        </div>
        <div class="flex flex-col items-center mb-6">
          <div class="relative w-32 h-32 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
            <img v-if="clinic.profilePicture" :src="clinic.profilePicture" alt="Clinic Profile" class="w-full h-full object-cover" />
            <span v-else class="text-white font-bold text-3xl">{{ clinicDisplayName ? clinicDisplayName.charAt(0) : 'C' }}</span>
          </div>
          <p class="mt-4 text-lg font-semibold text-white">{{ clinicDisplayName }}</p>
        </div>

        <!-- Clinic Details Form -->
        <form @submit.prevent="saveClinicProfile" class="space-y-4">
          <div>
            <label class="block text-slate-400 text-sm mb-1">Clinic Name</label>
            <input
              v-model="clinic.clinicName"
              type="text"
              placeholder="Enter clinic name"
              class="w-full rounded-lg p-3 bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-1">Owner Email</label>
            <input
              v-model="clinic.email"
              type="email"
              placeholder="owner@example.com"
              class="w-full rounded-lg p-3 bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-1">Business Email Address</label>
            <input
              v-model="clinic.businessEmail"
              type="email"
              placeholder="clinic@example.com"
              class="w-full rounded-lg p-3 bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-1">Phone Number</label>
            <input
              v-model="clinic.contactNumber"
              type="tel"
              placeholder="+1 234 567 890"
              class="w-full rounded-lg p-3 bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-1">Address Search</label>
            <LocationPicker
              region="cavite"
              title="Select Address in Cavite"
              instruction-title="Cavite only"
              instruction-text="Pinning is limited to land locations inside Cavite. Pins in the ocean, water, or outside Cavite are blocked."
              search-placeholder="Search a city, barangay, or address in Cavite"
              search-hint="Search first, then drag or click the pin to fine-tune the exact location."
              allowed-area-label="Cavite, Philippines"
              pinned-address-label="Pinned Address"
              :show-actions="false"
              :initial-address="clinic.clinicLocationAddress || buildLocationSearchQuery()"
              :initial-lat="clinic.clinicLocationLat"
              :initial-lng="clinic.clinicLocationLng"
              @selection-change="handleLocationSelection"
              @error="locationError = $event"
            />
          </div>
          <button
            type="submit"
            class="w-full bg-gold-700 hover:bg-yellow-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </form>
      </div>
    </main>
  </div>
</template>


<script>
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue';
import { ref, onMounted, computed } from 'vue';
import { getFirestore, doc, getDoc, getDocs, updateDoc, collection, query, where } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { auth } from '@/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'vue3-toastify';
import { flattenAddressComponents, validateCavitePinSelection } from '@/utils/locationValidation';
import LocationPicker from '@/components/common/LocationPicker.vue';

export default {
  name: 'ClinicProfile',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp());
    const clinic = ref({
      clinicName: '',
      email: '',
      businessEmail: '',
      contactNumber: '',
      clinicLocation: '',
      clinicLocationAddress: '',
      clinicBarangay: '',
      clinicPostalCode: '',
      clinicLocationLat: '',
      clinicLocationLng: '',
      description: '',
      profilePicture: null,
    });
    const locationMapEl = ref(null);
    let locationMap = null;
    let locationMarker = null;
    let geocoder = null;
    let lastValidLocation = null;
    const locationSearchQuery = ref('');
    const branchScopeLabel = ref('');
    const activeClinicId = ref('');
    const caviteBounds = {
      north: 14.459,
      south: 13.709,
      east: 121.199,
      west: 120.626,
    };
    const defaultCaviteCenter = { lat: 14.3294, lng: 120.9367 };
    const locationError = ref('');

    const isOwnerLikeRole = (role) => {
      const normalized = String(role || '').trim().toLowerCase();
      return ['owner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(normalized);
    };

    const hasLocationCoords = computed(() => {
      const lat = Number(clinic.value.clinicLocationLat || 0);
      const lng = Number(clinic.value.clinicLocationLng || 0);
      return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001;
    });

    const clinicDisplayName = computed(() =>
      String(clinic.value.clinicName || clinic.value.clinicBranch || 'Clinic').trim()
    );

    const buildLocationSearchQuery = () =>
      [
        clinic.value.clinicLocationAddress,
        clinic.value.clinicBarangay,
        clinic.value.clinicLocation,
        clinic.value.clinicPostalCode,
      ]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(', ') || clinicDisplayName.value || '';

    const loadOwnerInfo = async (user) => {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        clinic.value.email = data.email;
        clinic.value.contactNumber = data.contactNumber;
      }
    };

    const ensureGeocoder = () => {
      if (!geocoder && window.google?.maps?.Geocoder) {
        geocoder = new window.google.maps.Geocoder();
      }
      return geocoder;
    };

    const getMarkerPosition = () => {
      if (!locationMarker) return null;
      if (typeof locationMarker.getPosition === 'function') {
        return locationMarker.getPosition();
      }
      return locationMarker.position || null;
    };

    const setLocationMarkerPosition = (position) => {
      if (!position || !locationMarker) return;
      if (typeof locationMarker.setPosition === 'function') {
        locationMarker.setPosition(position);
      } else {
        locationMarker.position = position;
      }
    };

    const revertLocationMarker = () => {
      const fallback = lastValidLocation || defaultCaviteCenter;
      if (locationMap?.setCenter) {
        locationMap.setCenter(fallback);
      }
      setLocationMarkerPosition(fallback);
    };

    const handleLocationSelection = ({ lat, lng, address, city, barangay, province, postalCode }) => {
      clinic.value.clinicLocationLat = String(lat || '');
      clinic.value.clinicLocationLng = String(lng || '');
      clinic.value.clinicLocationAddress = String(address || '').trim();
      clinic.value.clinicLocation = String(city || clinic.value.clinicLocation || '').trim();
      clinic.value.clinicBarangay = String(barangay || clinic.value.clinicBarangay || '').trim();
      clinic.value.clinicProvince = String(province || clinic.value.clinicProvince || 'Cavite').trim() || 'Cavite';
      clinic.value.clinicPostalCode = String(postalCode || clinic.value.clinicPostalCode || '').trim();
      locationSearchQuery.value = clinic.value.clinicLocationAddress || buildLocationSearchQuery();
    };

    const syncLocationFromGeocode = (result, position) => {
      const components = flattenAddressComponents([result]);
      const validation = validateCavitePinSelection({
        components,
        formattedAddress: result?.formatted_address || '',
        fallbackText: position ? `${position.lat}, ${position.lng}` : '',
      });
      if (!validation.ok) {
        locationError.value = validation.reason;
        revertLocationMarker();
        return false;
      }

      const cityComponent =
        components.find((comp) => comp.types?.includes('locality')) ||
        components.find((comp) => comp.types?.includes('administrative_area_level_2')) ||
        components.find((comp) => comp.types?.includes('administrative_area_level_1'));
      const barangayComponent =
        components.find((comp) => comp.types?.includes('sublocality_level_1')) ||
        components.find((comp) => comp.types?.includes('sublocality')) ||
        components.find((comp) => comp.types?.includes('neighborhood')) ||
        components.find((comp) => comp.types?.includes('political'));
      const postalComponent = components.find((comp) => comp.types?.includes('postal_code'));

      if (cityComponent?.long_name) {
        clinic.value.clinicLocation = cityComponent.long_name;
      }
      clinic.value.clinicBarangay = barangayComponent?.long_name || clinic.value.clinicBarangay || '';
      clinic.value.clinicLocationAddress = String(result?.formatted_address || '').trim();
      clinic.value.clinicPostalCode = postalComponent?.long_name || clinic.value.clinicPostalCode || '';
      clinic.value.clinicLocationLat = Number(position?.lat?.() ?? position?.lat ?? '') || '';
      clinic.value.clinicLocationLng = Number(position?.lng?.() ?? position?.lng ?? '') || '';
      lastValidLocation = {
        lat: Number(clinic.value.clinicLocationLat) || defaultCaviteCenter.lat,
        lng: Number(clinic.value.clinicLocationLng) || defaultCaviteCenter.lng,
      };
      locationError.value = '';
      locationSearchQuery.value = clinic.value.clinicLocationAddress || buildLocationSearchQuery();
      return true;
    };

    const searchLocation = async () => {
      const queryText = String(locationSearchQuery.value || '').trim();
      if (!queryText) {
        toast.error('Please enter an address to search.');
        return;
      }

      try {
        await loadMapsScript();
      } catch (err) {
        console.error(err);
        toast.error('Google Maps could not be loaded.');
        return;
      }

      const geocoderInstance = ensureGeocoder();
      if (!geocoderInstance) {
        toast.error('Address search is not available right now.');
        return;
      }

      geocoderInstance.geocode(
        {
          address: queryText,
          bounds: caviteBounds,
          componentRestrictions: { country: 'PH' },
        },
        (results, status) => {
          if (status !== 'OK' || !results?.length) {
            locationError.value = 'No matching address was found in Cavite.';
            toast.error(locationError.value);
            return;
          }

          const result = results[0];
          const position = result?.geometry?.location;
          if (!position) {
            locationError.value = 'The selected address did not return a map location.';
            toast.error(locationError.value);
            return;
          }

          if (!syncLocationFromGeocode(result, position)) {
            toast.error(locationError.value);
            return;
          }

          if (locationMap?.setCenter) {
            locationMap.setCenter(position);
          }
          if (locationMap?.setZoom) {
            locationMap.setZoom(16);
          }
          setLocationMarkerPosition(position);
        }
      );
    };

    const loadClinicProfile = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          const userData = userSnap.exists() ? userSnap.data() || {} : {};

          if (isOwnerLikeRole(userData.role || userData.customRoleName)) {
            const clinicRef = doc(db, 'clinics', user.uid);
            const clinicSnap = await getDoc(clinicRef);
            if (clinicSnap.exists()) {
              clinic.value = { ...clinic.value, ...clinicSnap.data() };
              clinic.value.clinicName = String(clinic.value.clinicName || clinic.value.clinicBranch || '').trim();
              activeClinicId.value = clinicSnap.id;
              branchScopeLabel.value = clinic.value.clinicBranch || clinic.value.clinicName || 'Main clinic';
              locationSearchQuery.value = buildLocationSearchQuery();
            }
          } else {
            const assignedBranchId = String(userData.branchId || userData.clinicBranch || '').trim();
            if (assignedBranchId) {
              const clinicSnap = await getDoc(doc(db, 'clinics', assignedBranchId));
              if (clinicSnap.exists()) {
                clinic.value = { ...clinic.value, ...clinicSnap.data() };
                clinic.value.clinicName = String(clinic.value.clinicName || clinic.value.clinicBranch || '').trim();
                activeClinicId.value = clinicSnap.id;
                branchScopeLabel.value = clinic.value.clinicBranch || clinic.value.clinicName || 'Assigned branch';
                locationSearchQuery.value = buildLocationSearchQuery();
              }
            }

            if (!branchScopeLabel.value) {
              const branchAdminSnapshot = await getDocs(
                query(collection(db, 'clinics'), where('branchAdminId', '==', user.uid))
              );
              if (branchAdminSnapshot.docs.length) {
                const clinicSnap = branchAdminSnapshot.docs[0];
                clinic.value = { ...clinic.value, ...clinicSnap.data() };
                clinic.value.clinicName = String(clinic.value.clinicName || clinic.value.clinicBranch || '').trim();
                activeClinicId.value = clinicSnap.id;
                branchScopeLabel.value = clinic.value.clinicBranch || clinic.value.clinicName || 'Assigned branch';
                locationSearchQuery.value = buildLocationSearchQuery();
              }
            }
          }
          await loadOwnerInfo(user);
          if (!locationSearchQuery.value) {
            locationSearchQuery.value = buildLocationSearchQuery();
          }
          await initLocationMap();
        }
      });
    };

    const loadMapsScript = () => {
      if (window.google?.maps?.Map || window.google?.maps?.importLibrary) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const existing = document.getElementById('google-maps-js');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
          return;
        }
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY in environment.'));
          return;
        }
        const script = document.createElement('script');
        script.id = 'google-maps-js';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&loading=async&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Maps failed to load'));
        document.head.appendChild(script);
      });
    };

    const initLocationMap = async () => {
      if (!locationMapEl.value) return;

      try {
        await loadMapsScript();
        if (!window.google?.maps?.Map && !window.google?.maps?.importLibrary) {
          await new Promise((resolve) => {
            const start = Date.now();
            const timer = setInterval(() => {
              if (window.google?.maps?.Map || window.google?.maps?.importLibrary) {
                clearInterval(timer);
                resolve();
              } else if (Date.now() - start > 2000) {
                clearInterval(timer);
                resolve();
              }
            }, 50);
          });
        }
      } catch (err) {
        console.error(err);
        return;
      }

      const lat = Number(clinic.value.clinicLocationLat);
      const lng = Number(clinic.value.clinicLocationLng);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const center = hasCoords ? { lat, lng } : defaultCaviteCenter;
      let MapCtor = window.google?.maps?.Map;
      let AdvancedMarkerElement = window.google?.maps?.marker?.AdvancedMarkerElement;
      if (window.google?.maps?.importLibrary) {
        try {
          const mapsLib = await window.google.maps.importLibrary('maps');
          MapCtor = mapsLib?.Map || MapCtor;
          const markerLib = await window.google.maps.importLibrary('marker');
          AdvancedMarkerElement = markerLib?.AdvancedMarkerElement || AdvancedMarkerElement;
        } catch (err) {
          console.error('Failed to import Google Maps libraries:', err);
        }
      }

      if (!MapCtor) {
        console.error('Google Maps API did not provide a Map constructor.');
        return;
      }

      if (!locationMap) {
        locationMap = new MapCtor(locationMapEl.value, {
          center,
          zoom: 15,
          restriction: { latLngBounds: caviteBounds, strictBounds: true },
          mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
        });
      } else {
        locationMap.setCenter(center);
      }

      if (hasCoords) {
        lastValidLocation = center;
      }

      const attachMarker = () => {
        if (locationMarker?.setPosition) {
          locationMarker.setPosition(center);
          return;
        }

        if (AdvancedMarkerElement) {
          locationMarker = new AdvancedMarkerElement({
            map: locationMap,
            position: center,
            gmpDraggable: true,
          });
        } else if (window.google?.maps?.Marker) {
          locationMarker = new window.google.maps.Marker({
            map: locationMap,
            position: center,
            draggable: true,
          });
        }
      };

      attachMarker();

      geocoder = ensureGeocoder();

      const updateFromPosition = (pos) => {
        if (!pos) return;
        const nextLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
        const nextLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
        if (!geocoder) return;

        geocoder.geocode({ location: { lat: nextLat, lng: nextLng } }, (results, status) => {
          if (status !== 'OK' || !results?.length) return;
          const result = results[0];
          if (!syncLocationFromGeocode(result, { lat: nextLat, lng: nextLng })) {
            return;
          }
          lastValidLocation = { lat: nextLat, lng: nextLng };
        });
      };

      if (locationMarker?.addListener) {
        locationMarker.addListener('dragend', (event) => updateFromPosition(event?.latLng));
      } else if (locationMarker?.addEventListener) {
        locationMarker.addEventListener('dragend', (event) => updateFromPosition(event?.latLng));
      }

      locationMap.addListener?.('click', (event) => {
        if (!event?.latLng) return;
        setLocationMarkerPosition(event.latLng);
        updateFromPosition(event.latLng);
      });
    };

    const saveClinicProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      const lat = Number(clinic.value.clinicLocationLat);
      const lng = Number(clinic.value.clinicLocationLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        toast.error('Please pin the clinic location on the Cavite map first.');
        return;
      }
      if (locationError.value) {
        toast.error(locationError.value);
        return;
      }

      const clinicRef = doc(db, 'clinics', activeClinicId.value || user.uid);
      await updateDoc(clinicRef, {
        ...clinic.value,
        clinicName: String(clinic.value.clinicName || clinic.value.clinicBranch || '').trim()
      });
      toast.success('Clinic profile updated successfully!');
    };

    onMounted(loadClinicProfile);

    return {
      clinic,
      saveClinicProfile,
      locationMapEl,
      hasLocationCoords,
      locationError,
      branchScopeLabel,
      clinicDisplayName,
      locationSearchQuery,
      searchLocation,
    };
  },
};
</script>

<style scoped>
</style>
