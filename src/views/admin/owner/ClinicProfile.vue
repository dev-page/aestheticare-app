<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 flex items-center justify-center p-8">
      <!-- Centered Card -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-3xl">
        <div class="flex flex-col items-center mb-6">
          <div class="relative w-32 h-32 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
            <img v-if="clinic.profilePicture" :src="clinic.profilePicture" alt="Clinic Profile" class="w-full h-full object-cover" />
            <span v-else class="text-white font-bold text-3xl">{{ clinic.clinicName ? clinic.clinicName.charAt(0) : 'C' }}</span>
          </div>
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
            <label class="block text-slate-400 text-sm mb-1">Business Type</label>
            <input
              :value="businessTypeLabel"
              type="text"
              readonly
              class="w-full rounded-lg p-3 bg-slate-700/60 border border-slate-600 text-slate-200 focus:outline-none"
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
            <label class="block text-slate-400 text-sm mb-1">Address</label>
            <textarea
              v-model="clinic.clinicLocation"
              rows="3"
              placeholder="Enter clinic address"
              class="w-full rounded-lg p-3 bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            ></textarea>
            <div class="mt-3 rounded-xl border border-slate-600 bg-slate-700/60 p-3">
              <div ref="locationMapEl" class="h-64 w-full rounded-lg"></div>
              <p v-if="!hasLocationCoords" class="mt-2 text-xs text-slate-400">
                Clinic location coordinates not set yet.
              </p>
            </div>
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
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { auth } from '@/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'vue3-toastify';

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
      clinicLocationLat: '',
      clinicLocationLng: '',
      description: '',
      profilePicture: null,
    });
    const locationMapEl = ref(null);
    let locationMap = null;
    let locationMarker = null;
    let geocoder = null;

    const hasLocationCoords = computed(() => {
      const lat = Number(clinic.value.clinicLocationLat || 0);
      const lng = Number(clinic.value.clinicLocationLng || 0);
      return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001;
    });

    const businessTypeLabel = computed(() => {
      const raw = String(clinic.value.businessType || '').trim().toLowerCase();
      if (!raw) return 'Not set';
      if (raw === 'sole_proprietor') return 'Sole Proprietor';
      if (raw === 'company') return 'Company';
      return clinic.value.businessType;
    });

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

    const loadClinicProfile = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const clinicRef = doc(db, 'clinics', user.uid);
          const clinicSnap = await getDoc(clinicRef);
          if (clinicSnap.exists()) {
            clinic.value = { ...clinic.value, ...clinicSnap.data() };
          }
          await loadOwnerInfo(user);
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
      const defaultCenter = { lat: 14.3294, lng: 120.9367 };
      const center = hasCoords ? { lat, lng } : defaultCenter;
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
          mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
        });
      } else {
        locationMap.setCenter(center);
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

      geocoder = geocoder || (window.google?.maps?.Geocoder ? new window.google.maps.Geocoder() : null);

      const updateFromPosition = (pos) => {
        if (!pos) return;
        const nextLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
        const nextLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
        clinic.value.clinicLocationLat = nextLat;
        clinic.value.clinicLocationLng = nextLng;

        if (!geocoder) return;
        geocoder.geocode({ location: { lat: nextLat, lng: nextLng } }, (results, status) => {
          if (status !== 'OK' || !results?.length) return;
          const components = results[0].address_components || [];
          const cityComponent =
            components.find((comp) => comp.types?.includes('locality')) ||
            components.find((comp) => comp.types?.includes('administrative_area_level_2')) ||
            components.find((comp) => comp.types?.includes('administrative_area_level_1'));
          if (cityComponent?.long_name) {
            clinic.value.clinicLocation = cityComponent.long_name;
          }
        });
      };

      if (locationMarker?.addListener) {
        locationMarker.addListener('dragend', (event) => updateFromPosition(event?.latLng));
      } else if (locationMarker?.addEventListener) {
        locationMarker.addEventListener('dragend', (event) => updateFromPosition(event?.latLng));
      }

      locationMap.addListener?.('click', (event) => {
        if (!event?.latLng) return;
        if (locationMarker?.setPosition) {
          locationMarker.setPosition(event.latLng);
        } else if (locationMarker?.position) {
          locationMarker.position = event.latLng;
        }
        updateFromPosition(event.latLng);
      });
    };

    const saveClinicProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      const clinicRef = doc(db, 'clinics', user.uid);
      await updateDoc(clinicRef, { ...clinic.value });
      toast.success('Clinic profile updated successfully!');
    };

    onMounted(loadClinicProfile);

    return { clinic, saveClinicProfile, locationMapEl, hasLocationCoords, businessTypeLabel };
  },
};
</script>

<style scoped>
</style>
