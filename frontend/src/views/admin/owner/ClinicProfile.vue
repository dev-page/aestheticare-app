<template>
  <div class="clinic-profile-layout owner-theme">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'profile', fields: 6, sections: 2 }" class="clinic-profile-main">
      <div class="clinic-profile-heading">
        <div>
          <p class="clinic-profile-eyebrow">CLINIC SETUP</p>
          <h1>Clinic Profile</h1>
          <p class="clinic-profile-subtitle">Manage the information customers see on your clinic page.</p>
        </div>
        <span v-if="branchScopeLabel" class="clinic-branch-chip">{{ branchScopeLabel }}</span>
      </div>

      <form class="clinic-profile-form" @submit.prevent="saveClinicProfile">
        <section class="clinic-profile-card clinic-branding-card">
          <div class="clinic-card-heading">
            <div><h2>Clinic branding</h2><p>Choose the logo and banner customers will see on your public clinic page.</p></div>
          </div>
          <div class="clinic-banner-preview" :style="bannerPreview ? { backgroundImage: `url('${bannerPreview}')` } : undefined">
            <div v-if="!bannerPreview" class="clinic-banner-placeholder"><span>Clinic banner preview</span></div>
            <label class="clinic-upload-button clinic-banner-upload">{{ bannerFile ? 'Change banner' : 'Upload banner' }}<input ref="bannerInput" type="file" accept="image/jpeg,image/png,image/webp" @change="handleBannerUpload" /></label>
          </div>
          <div class="clinic-branding-footer">
            <div class="clinic-logo-preview">
              <img v-if="logoPreview" :src="logoPreview" alt="Clinic logo preview" />
              <span v-else>{{ clinicDisplayName ? clinicDisplayName.charAt(0) : 'C' }}</span>
            </div>
            <div class="clinic-logo-copy"><strong>Clinic logo</strong><small>Square image, JPG, PNG, or WebP. Maximum 5 MB.</small></div>
            <label class="clinic-upload-button">{{ logoFile ? 'Change logo' : 'Upload logo' }}<input ref="logoInput" type="file" accept="image/jpeg,image/png,image/webp" @change="handleLogoUpload" /></label>
          </div>
          <p class="clinic-upload-hint">Banner: JPG, PNG, or WebP, maximum 5 MB. Use a wide image for the best fit.</p>
        </section>

        <section class="clinic-profile-card">
          <div class="clinic-card-heading"><div><h2>Clinic information</h2><p>Keep your public contact details and description up to date.</p></div></div>
          <div class="clinic-form-grid">
            <label class="clinic-field clinic-field-full"><span>Clinic name <small>Registered name</small></span><input :value="clinic.clinicName" type="text" readonly /><small class="clinic-field-note">The registered clinic name is protected from changes here.</small></label>
            <label class="clinic-field"><span>Clinic email address</span><input v-model="clinic.businessEmail" type="email" placeholder="clinic@example.com" autocomplete="email" /></label>
            <label class="clinic-field"><span>Clinic phone number</span><div class="clinic-phone-input"><b>+63</b><input :value="clinic.contactNumber" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="9XXXXXXXXX" @input="handleContactNumberInput" @blur="validateContactNumber" /></div><small v-if="contactNumberError" class="clinic-error">{{ contactNumberError }}</small></label>
            <label class="clinic-field clinic-field-full"><span>About the clinic</span><textarea v-model="clinic.description" rows="4" maxlength="1200" placeholder="Introduce your clinic, its approach, and what customers can expect."></textarea><small class="clinic-field-note">{{ (clinic.description || '').length }}/1200 characters</small></label>
          </div>
        </section>

        <section class="clinic-profile-card">
          <div class="clinic-card-heading"><div><h2>Clinic location</h2><p>View the saved clinic location customers will use.</p></div></div>
          <LocationPicker
            v-if="hasLocationCoords"
            region="cavite"
            allowed-area-label="Cavite, Philippines"
            pinned-address-label="Pinned Address"
            map-height="440px"
            map-class="clinic-profile-location-map"
            :initial-address="clinic.clinicLocationAddress || buildLocationSearchQuery()"
            :initial-lat="clinic.clinicLocationLat"
            :initial-lng="clinic.clinicLocationLng"
            readonly
            :show-actions="false"
            @error="locationError = $event"
          />
          <p v-else class="clinic-location-empty">No saved map location is available for this clinic.</p>
          <p v-if="locationError" class="clinic-error clinic-location-error">{{ locationError }}</p>
        </section>

        <div class="clinic-profile-actions">
          <p>Changes are saved to the selected clinic branch.</p>
          <button type="submit" :disabled="saving">{{ saving ? 'Saving clinic profile…' : 'Save Clinic Profile' }}</button>
        </div>
      </form>
    </main>
  </div>
</template>


<script>
import { usePageLoading } from '@/composables/usePageLoading'

import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { getFirestore, doc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { auth, storage } from '@/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { toast } from 'vue3-toastify';
import LocationPicker from '@/components/common/LocationPicker.vue';

export default {
  name: 'ClinicProfile',
  components: { OwnerSidebar, LocationPicker },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp());
    const clinic = ref({
      clinicName: '',
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
      bannerPicture: null,
    });
    const locationSearchQuery = ref('');
    const branchScopeLabel = ref('');
    const activeClinicId = ref('');
    const locationError = ref('');
    const contactNumberError = ref('');
    const saving = ref(false);
    const logoInput = ref(null);
    const bannerInput = ref(null);
    const logoFile = ref(null);
    const bannerFile = ref(null);
    const logoPreview = ref('');
    const bannerPreview = ref('');

    const isOwnerLikeRole = (role) => {
      const normalized = String(role || '').trim().toLowerCase();
      return ['owner', 'clinic owner', 'clinicowner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(normalized);
    };

    const normalizePhilippineMobile = (value) => {
      let digits = String(value || '').replace(/\D/g, '');
      if (digits.startsWith('63')) digits = digits.slice(2);
      if (digits.startsWith('0')) digits = digits.slice(1);
      return digits.slice(0, 10);
    };
    const validateContactNumber = () => {
      contactNumberError.value = /^9\d{9}$/.test(String(clinic.value.contactNumber || '').trim()) ? '' : 'Enter exactly 10 digits starting with 9.';
      return !contactNumberError.value;
    };
    const handleContactNumberInput = (event) => {
      clinic.value.contactNumber = normalizePhilippineMobile(event?.target?.value);
      if (contactNumberError.value) validateContactNumber();
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

    const chooseImage = (event, kind) => {
      const file = event?.target?.files?.[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size >= 5 * 1024 * 1024) {
        toast.error('Choose a JPG, PNG, or WebP image smaller than 5 MB.');
        event.target.value = '';
        return;
      }
      const preview = URL.createObjectURL(file);
      if (kind === 'logo') {
        if (logoPreview.value.startsWith('blob:')) URL.revokeObjectURL(logoPreview.value);
        logoFile.value = file;
        logoPreview.value = preview;
      } else {
        if (bannerPreview.value.startsWith('blob:')) URL.revokeObjectURL(bannerPreview.value);
        bannerFile.value = file;
        bannerPreview.value = preview;
      }
      event.target.value = '';
    };

    const handleLogoUpload = (event) => chooseImage(event, 'logo');
    const handleBannerUpload = (event) => chooseImage(event, 'banner');

    const loadOwnerInfo = trackPageLoad(async (user) => {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        clinic.value.email = data.email;
        clinic.value.contactNumber = normalizePhilippineMobile(data.contactNumber);
        tutorialEnabled.value = data.preferences?.onboarding?.owner?.disabled !== true;
      }
    });

    const saveTutorialPreference = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const disabled = !tutorialEnabled.value;
      try {
        localStorage.setItem(`onboarding:disabled:v2:${user.uid}:owner`, disabled ? '1' : '');
        await updateDoc(doc(db, 'users', user.uid), {
          'preferences.onboarding.owner': { disabled, version: 2, updatedAt: new Date().toISOString() },
        });
        toast.success(disabled ? 'Workspace tutorial disabled.' : 'Workspace tutorial enabled.');
      } catch (error) {
        console.error('Failed to save tutorial preference:', error);
        tutorialEnabled.value = !tutorialEnabled.value;
        toast.error('Unable to update the tutorial setting right now.');
      }
    };

    const sanitizeExportValue = (value, key = '') => {
      const blockedKeys = new Set(['password', 'passwordHash', 'otp', 'otpCode', 'resetToken', 'verificationToken', 'token']);
      if (blockedKeys.has(key)) return undefined;
      if (value?.toDate) return value.toDate().toISOString();
      if (Array.isArray(value)) return value.map((item) => sanitizeExportValue(item)).filter((item) => item !== undefined);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeExportValue(entryValue, entryKey)]).filter(([, entryValue]) => entryValue !== undefined));
      }
      return value;
    };

    const exportAccountData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      exporting.value = true;
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const clinicSnap = activeClinicId.value ? await getDoc(doc(db, 'clinics', activeClinicId.value)) : null;
        const payload = sanitizeExportValue({
          exportedAt: new Date().toISOString(),
          account: userSnap.exists() ? userSnap.data() : {},
          clinic: clinicSnap?.exists() ? clinicSnap.data() : clinic.value,
        });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `aestheticare-clinic-data-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Your clinic data export is ready.');
      } catch (error) {
        console.error('Failed to export clinic data:', error);
        toast.error('Unable to export your data right now.');
      } finally {
        exporting.value = false;
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

    const loadClinicProfile = trackPageLoad(async () => {
      pageListener(onAuthStateChanged, auth, async (user) => {
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
          clinic.value.contactNumber = normalizePhilippineMobile(clinic.value.contactNumber);
          logoPreview.value = String(clinic.value.profilePicture || '');
          bannerPreview.value = String(clinic.value.bannerPicture || '');
          if (!locationSearchQuery.value) {
            locationSearchQuery.value = buildLocationSearchQuery();
          }
        }
      });
    });

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
        toast.error('Sign in to edit the clinic profile.');
        return;
      }
      if (!validateContactNumber()) {
        toast.error('Enter a valid Philippine mobile number before saving.');
        return;
      }

      saving.value = true;
      try {
        const clinicId = activeClinicId.value || user.uid;
        let profilePicture = String(clinic.value.profilePicture || '');
        let bannerPicture = String(clinic.value.bannerPicture || '');
        const uploadImage = async (file, prefix) => {
          if (!file) return '';
          const extension = (file.name?.split('.').pop() || 'jpg').toLowerCase();
          const imageRef = storageRef(storage, `clinicMedia/${clinicId}/${prefix}-${Date.now()}.${extension}`);
          await uploadBytes(imageRef, file, { contentType: file.type });
          return getDownloadURL(imageRef);
        };

        if (logoFile.value) profilePicture = await uploadImage(logoFile.value, 'profile');
        if (bannerFile.value) bannerPicture = await uploadImage(bannerFile.value, 'banner');

        const payload = {
          businessEmail: String(clinic.value.businessEmail || '').trim(),
          contactNumber: `+63${clinic.value.contactNumber}`,
          description: String(clinic.value.description || '').trim(),
          profilePicture,
          bannerPicture,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(doc(db, 'clinics', clinicId), payload);
        if (logoPreview.value.startsWith('blob:')) URL.revokeObjectURL(logoPreview.value);
        if (bannerPreview.value.startsWith('blob:')) URL.revokeObjectURL(bannerPreview.value);
        clinic.value = { ...clinic.value, ...payload, contactNumber: normalizePhilippineMobile(payload.contactNumber) };
        logoFile.value = null;
        bannerFile.value = null;
        logoPreview.value = profilePicture;
        bannerPreview.value = bannerPicture;
        toast.success('Clinic profile saved.');
      } catch (error) {
        console.error('Unable to save clinic profile:', error);
        toast.error('Unable to save the clinic profile. Please try again.');
      } finally {
        saving.value = false;
      }
    };

    onMounted(loadClinicProfile);
    onUnmounted(() => {
      if (logoPreview.value.startsWith('blob:')) URL.revokeObjectURL(logoPreview.value);
      if (bannerPreview.value.startsWith('blob:')) URL.revokeObjectURL(bannerPreview.value);
    });

    return {
      pageLoading,
      clinic,
      contactNumberError,
      handleContactNumberInput,
      handleLogoUpload,
      handleBannerUpload,
      logoInput,
      bannerInput,
      logoFile,
      bannerFile,
      logoPreview,
      bannerPreview,
      saving,
      saveClinicProfile,
      locationError,
      branchScopeLabel,
      clinicDisplayName,
      buildLocationSearchQuery,
      hasLocationCoords,
      validateContactNumber,
    };
  },
};
</script>

<style scoped>
.clinic-profile-layout {
  display: flex;
  min-height: 100vh;
  color: #493021;
  background: #fffaf4;
}

.clinic-profile-main {
  flex: 1;
  min-width: 0;
  padding: clamp(1.25rem, 3vw, 2.75rem);
}

.clinic-profile-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  max-width: 1040px;
  margin: 0 auto 1.5rem;
}

.clinic-profile-eyebrow {
  margin: 0 0 .35rem;
  color: #a66d43;
  font-size: .7rem;
  font-weight: 800;
  letter-spacing: .17em;
}

.clinic-profile-heading h1 {
  margin: 0;
  color: #4a2e1f;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  line-height: 1.15;
}

.clinic-profile-subtitle,
.clinic-card-heading p {
  margin: .45rem 0 0;
  color: #7e6758;
  font-size: .92rem;
  line-height: 1.55;
}

.clinic-branch-chip {
  flex: none;
  border: 1px solid #ead0b3;
  border-radius: 999px;
  background: #fff5e8;
  padding: .5rem .85rem;
  color: #80512f;
  font-size: .78rem;
  font-weight: 700;
}

.clinic-profile-form {
  display: grid;
  gap: 1rem;
  max-width: 1040px;
  margin: 0 auto;
}

.clinic-profile-card {
  min-width: 0;
  border: 1px solid #ecd7be;
  border-radius: 1.15rem;
  background: #fffdf9;
  padding: clamp(1rem, 2.5vw, 1.5rem);
  box-shadow: 0 12px 28px rgb(88 55 31 / 5%);
}

.clinic-card-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.1rem;
}

.clinic-card-heading h2 {
  margin: 0;
  color: #4a2e1f;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.2rem;
  font-weight: 700;
}

.clinic-banner-preview {
  position: relative;
  display: flex;
  min-height: 190px;
  align-items: flex-end;
  justify-content: flex-end;
  overflow: hidden;
  border: 1px solid #ead4bb;
  border-radius: .9rem;
  background-color: #f1e2d0;
  background-image: linear-gradient(115deg, #ead4bb, #f8ede0 55%, #e4c6a7);
  background-position: center;
  background-size: cover;
}

.clinic-banner-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #8c6c54;
  font-size: .9rem;
  font-weight: 650;
}

.clinic-banner-upload {
  position: relative;
  z-index: 1;
  margin: .8rem;
}

.clinic-branding-footer {
  display: flex;
  align-items: center;
  gap: .9rem;
  padding-top: 1rem;
}

.clinic-logo-preview {
  display: grid;
  width: 64px;
  height: 64px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #f2e2d0;
  box-shadow: 0 0 0 1px #e4c6a7;
  color: #7b4b2d;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.4rem;
  font-weight: 700;
}

.clinic-logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.clinic-logo-copy {
  display: grid;
  flex: 1;
  gap: .2rem;
  color: #533927;
  font-size: .9rem;
}

.clinic-logo-copy small,
.clinic-upload-hint,
.clinic-field-note {
  color: #897463;
  font-size: .75rem;
  line-height: 1.45;
}

.clinic-upload-hint {
  margin: .7rem 0 0;
}

.clinic-upload-button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9ae7c;
  border-radius: .65rem;
  background: #fff9f0;
  padding: .55rem .85rem;
  color: #754a2b;
  cursor: pointer;
  font-size: .8rem;
  font-weight: 700;
  transition: background .15s ease, border-color .15s ease;
}

.clinic-upload-button:hover {
  border-color: #b9824f;
  background: #f9eddd;
}

.clinic-upload-button input {
  display: none;
}

.clinic-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.clinic-field {
  display: grid;
  align-content: start;
  gap: .45rem;
  min-width: 0;
  color: #664b39;
  font-size: .82rem;
  font-weight: 650;
}

.clinic-field > span small {
  margin-left: .25rem;
  color: #927d6b;
  font-size: .72rem;
  font-weight: 500;
}

.clinic-field-full {
  grid-column: 1 / -1;
}

.clinic-field input,
.clinic-field textarea,
.clinic-phone-input {
  width: 100%;
  min-height: 46px;
  border: 1px solid #e2c5a4;
  border-radius: .65rem;
  background: #fff;
  color: #493021;
  font: inherit;
  font-size: .9rem;
}

.clinic-field input,
.clinic-field textarea {
  padding: .75rem .85rem;
}

.clinic-field textarea {
  min-height: 112px;
  resize: vertical;
}

.clinic-field input:focus,
.clinic-field textarea:focus,
.clinic-phone-input:focus-within {
  border-color: #b9824f;
  outline: 3px solid rgb(185 130 79 / 17%);
}

.clinic-field input[readonly] {
  background: #f7f0e7;
  color: #796856;
}

.clinic-phone-input {
  display: flex;
  align-items: center;
  overflow: hidden;
}

.clinic-phone-input b {
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  border-right: 1px solid #e2c5a4;
  padding: 0 .8rem;
  color: #73543d;
  font-weight: 700;
}

.clinic-phone-input input {
  min-width: 0;
  border: 0;
  outline: 0;
}

.clinic-field-note {
  font-weight: 400;
}

.clinic-error {
  color: #b42318;
  font-size: .75rem;
  font-weight: 600;
}

.clinic-location-error {
  display: block;
  margin-top: .75rem;
}

.clinic-location-empty {
  margin: 0;
  border: 1px solid #ead4bb;
  border-radius: .9rem;
  background: #fbf4e9;
  padding: 1rem;
  color: #897463;
  font-size: .875rem;
}

.clinic-profile-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
  padding: .25rem 0 1.5rem;
}

.clinic-profile-actions p {
  margin: 0;
  color: #806b58;
  font-size: .8rem;
}

.clinic-profile-actions button {
  min-height: 46px;
  border: 1px solid #74462b;
  border-radius: .7rem;
  background: #74462b;
  padding: .7rem 1.2rem;
  color: #fff;
  cursor: pointer;
  font-size: .9rem;
  font-weight: 750;
  transition: background .15s ease, transform .15s ease;
}

.clinic-profile-actions button:hover:not(:disabled) {
  background: #5d3824;
  transform: translateY(-1px);
}

.clinic-profile-actions button:disabled {
  cursor: wait;
  opacity: .65;
}

@media (max-width: 680px) {
  .clinic-profile-main { padding: 1rem; }
  .clinic-profile-heading { align-items: flex-start; flex-direction: column; }
  .clinic-form-grid { grid-template-columns: minmax(0, 1fr); }
  .clinic-field-full { grid-column: auto; }
  .clinic-branding-footer { flex-wrap: wrap; }
  .clinic-profile-actions { align-items: stretch; flex-direction: column; }
  .clinic-profile-actions button { width: 100%; }
}
</style>
