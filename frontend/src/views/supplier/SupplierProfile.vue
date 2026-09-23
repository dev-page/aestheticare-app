<template>
  <div class="supplier-theme flex min-h-screen">
    <SupplierSidebar />

    <main class="flex-1 p-6 md:p-8">
      <section class="mx-auto max-w-6xl">
        <div class="overflow-hidden rounded-[2rem] border border-[#e4c7a1] bg-white/85 shadow-[0_18px_44px_rgba(77,52,31,0.08)] backdrop-blur">
          <div class="border-b border-[#ead6b8] px-6 py-5 md:px-8">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Supplier Profile</p>
            <h1 class="mt-2 text-3xl font-bold text-[#40261a]">Business details and location</h1>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-[#6f503d]">
              Keep your organization name, full address, map pin, and profile photo updated so procurement and logistics always see the right information.
            </p>
          </div>

          <div v-if="loading" class="space-y-4 px-6 py-8 md:px-8">
            <div class="mx-auto h-28 w-28 rounded-full bg-amber-100 animate-pulse"></div>
            <div class="grid gap-4 md:grid-cols-2">
              <div v-for="index in 8" :key="index" class="h-16 rounded-2xl bg-amber-50 animate-pulse"></div>
            </div>
          </div>

          <div v-else class="grid gap-6 px-6 py-8 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div class="space-y-5">
              <div class="rounded-3xl border border-dashed border-[#dfb98d] bg-[#fff8ef] p-6">
                <div class="flex flex-col items-center gap-4">
                  <div class="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#f0d4b2] to-[#c88f63] text-4xl font-bold text-white shadow-lg">
                    <img v-if="profile.profilePicture" :src="profile.profilePicture" alt="Supplier profile picture" class="h-full w-full object-cover" />
                    <span v-else>{{ businessInitial }}</span>
                  </div>

                  <label class="cursor-pointer rounded-xl border border-[#d8b289] bg-white px-4 py-2 text-sm font-semibold text-[#7b4a2f] transition hover:bg-[#f6eadc]">
                    Upload Profile Picture
                    <input type="file" accept="image/*" class="hidden" @change="handleProfilePictureChange" />
                  </label>

                  <div class="text-center">
                    <p class="text-xl font-bold text-[#40261a]">{{ profile.businessName || 'Supplier Business' }}</p>
                    <p class="mt-1 text-sm text-[#755643]">{{ profile.email || userEmail || '-' }}</p>
                    <p class="mt-1 text-sm text-[#755643]">{{ profile.status || profile.approvalStatus || 'Pending' }}</p>
                  </div>
                </div>
              </div>

              <div class="rounded-3xl border border-[#ead1b0] bg-[#fffaf4] p-5">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Location Summary</p>
                <p class="mt-2 text-sm leading-6 text-[#5a402f]">{{ locationSummary || 'Pin your business location on the map.' }}</p>
                <p class="mt-3 text-sm text-[#6c4b35]">Lat: {{ profile.businessAddressLat || '-' }}</p>
                <p class="text-sm text-[#6c4b35]">Lng: {{ profile.businessAddressLng || '-' }}</p>
              </div>
            </div>

            <form class="space-y-5" :aria-busy="saving" @submit.prevent="saveProfile">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="md:col-span-2">
                  <label class="profile-label">Business Name</label>
                  <input v-model="profile.businessName" type="text" class="profile-input" placeholder="Enter your business name" />
                </div>

                <div>
                  <label class="profile-label">Email</label>
                  <input v-model="profile.email" type="email" class="profile-input" placeholder="supplier@example.com" />
                </div>

                <div>
                  <label class="profile-label">Contact Number</label>
                  <div class="phone-input-shell" :class="{ 'phone-input-invalid': contactNumberError }">
                    <span>+63</span>
                    <input
                      :value="profile.contactNumber"
                      type="tel"
                      inputmode="numeric"
                      autocomplete="tel-national"
                      maxlength="10"
                      class="profile-input"
                      placeholder="9XXXXXXXXX"
                      @input="handleContactNumberInput"
                      @blur="validateContactNumber"
                    />
                  </div>
                  <p v-if="contactNumberError" class="field-error">{{ contactNumberError }}</p>
                </div>

                <div>
                  <label class="profile-label">Business Type</label>
                  <select v-model="profile.businessType" class="profile-input">
                    <option value="" disabled>Select business type</option>
                    <option v-for="type in SUPPLIER_BUSINESS_TYPES" :key="type" :value="type">
                      {{ type }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="profile-label">TIN</label>
                  <input
                    :value="formatTinDisplay(profile.taxRegistrationNumber)"
                    type="text"
                    inputmode="numeric"
                    maxlength="15"
                    class="profile-input"
                    placeholder="XXX-XXX-XXX-XXX"
                    @input="handleTinInput"
                  />
                  <p class="mt-2 text-xs text-[#7b5f4a]">Enter the registered TIN of the taxpayer or business entity.</p>
                </div>

                <div class="md:col-span-2">
                  <label class="profile-label">Full Address</label>
                  <textarea v-model="profile.businessAddress" rows="3" class="profile-input profile-textarea" placeholder="Street, barangay, city, province, postal code"></textarea>
                </div>

                <div>
                  <label class="profile-label">Street</label>
                  <input v-model="profile.businessAddressStreet" type="text" class="profile-input" placeholder="Street / building / landmark" />
                </div>

                <div>
                  <label class="profile-label">Barangay</label>
                  <input v-model="profile.businessAddressBarangay" type="text" class="profile-input" placeholder="Barangay" />
                </div>

                <div>
                  <label class="profile-label">City / Municipality</label>
                  <input v-model="profile.businessAddressCity" type="text" class="profile-input" placeholder="City or municipality" />
                </div>

                <div>
                  <label class="profile-label">Province</label>
                  <input v-model="profile.businessAddressProvince" type="text" class="profile-input" placeholder="Province" />
                </div>

                <div>
                  <label class="profile-label">Postal Code</label>
                  <input v-model="profile.businessAddressPostalCode" type="text" class="profile-input" placeholder="Postal code" />
                </div>

                <div>
                  <label class="profile-label">Map Coordinates</label>
                  <div class="grid grid-cols-2 gap-2">
                    <input v-model="profile.businessAddressLat" type="text" class="profile-input" placeholder="Latitude" />
                    <input v-model="profile.businessAddressLng" type="text" class="profile-input" placeholder="Longitude" />
                  </div>
                </div>

                <div class="md:col-span-2">
                  <label class="profile-label">Pin Your Business Location</label>
                  <LocationPicker
                    region="cavite"
                    title="Select Business Location in Cavite"
                    instruction-title="Cavite only"
                    instruction-text="Pin the exact location of your business inside Cavite."
                    search-placeholder="Search your business address in Cavite"
                    search-hint="Search first, then fine-tune the exact spot by dragging or clicking the pin."
                    allowed-area-label="Cavite, Philippines"
                    pinned-address-label="Pinned Business Address"
                    :show-actions="false"
                    :initial-address="locationSearchValue"
                    :initial-lat="profile.businessAddressLat"
                    :initial-lng="profile.businessAddressLng"
                    @selection-change="handleLocationSelection"
                    @error="locationError = $event"
                  />
                </div>
              </div>

              <div v-if="locationError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {{ locationError }}
              </div>

              <button type="submit" class="w-full rounded-2xl bg-[#8d5a3b] px-5 py-3.5 font-semibold text-white transition hover:bg-[#6f4329]" :disabled="saving">
                {{ saving ? 'Saving profile…' : 'Save Supplier Profile' }}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import './supplierTheme.css'
import { computed, onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { getStorage, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import { db } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import LocationPicker from '@/components/common/LocationPicker.vue'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'
import {
  SUPPLIER_BUSINESS_TYPES,
  formatTinDisplay,
  normalizeTinDigits,
} from '@/utils/supplierTin'

const auth = getAuth()
const storage = getStorage()
const loading = ref(true)
const saving = ref(false)
const locationError = ref('')
const userEmail = ref('')
const supplierDocId = ref('')
const locationSearchValue = ref('')
const profilePictureFile = ref(null)
const contactNumberError = ref('')

const profile = ref({
  businessName: '',
  email: '',
  contactNumber: '',
  businessAddress: '',
  businessAddressStreet: '',
  businessAddressBarangay: '',
  businessAddressCity: '',
  businessAddressProvince: '',
  businessAddressPostalCode: '',
  businessAddressLat: '',
  businessAddressLng: '',
  businessType: '',
  taxRegistrationNumber: '',
  profilePicture: '',
  status: '',
  approvalStatus: '',
})

const buildLocationSearchQuery = () =>
  [
    profile.value.businessAddressStreet,
    profile.value.businessAddressBarangay,
    profile.value.businessAddressCity,
    profile.value.businessAddressProvince,
    profile.value.businessAddressPostalCode,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ') || String(profile.value.businessAddress || '').trim()

const locationSummary = computed(() => buildLocationSearchQuery())

const businessInitial = computed(() => {
  const source = String(profile.value.businessName || userEmail.value || 'S').trim()
  return source ? source.charAt(0).toUpperCase() : 'S'
})

const handleTinInput = (event) => {
  profile.value.taxRegistrationNumber = normalizeTinDigits(event?.target?.value || '')
}

const normalizePhilippineMobile = (value) => {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('63')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

const validateContactNumber = () => {
  const number = String(profile.value.contactNumber || '').trim()
  contactNumberError.value = /^9\d{9}$/.test(number)
    ? ''
    : 'Enter exactly 10 digits starting with 9.'
  return !contactNumberError.value
}

const handleContactNumberInput = (event) => {
  profile.value.contactNumber = normalizePhilippineMobile(event?.target?.value)
  if (contactNumberError.value) validateContactNumber()
}

const resolveSupplierDocument = async (uid) => {
  const existing = await getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', uid), limit(1)))
  if (!existing.empty) {
    const snap = existing.docs[0]
    supplierDocId.value = snap.id
    return snap.data() || {}
  }
  supplierDocId.value = uid
  return {}
}

const handleLocationSelection = ({ lat, lng, address, street, barangay, city, province, postalCode }) => {
  profile.value.businessAddressLat = String(lat || '').trim()
  profile.value.businessAddressLng = String(lng || '').trim()
  profile.value.businessAddress = String(address || profile.value.businessAddress || '').trim()
  profile.value.businessAddressStreet = String(street || profile.value.businessAddressStreet || '').trim()
  profile.value.businessAddressBarangay = String(barangay || profile.value.businessAddressBarangay || '').trim()
  profile.value.businessAddressCity = String(city || profile.value.businessAddressCity || '').trim()
  profile.value.businessAddressProvince = String(province || profile.value.businessAddressProvince || '').trim()
  profile.value.businessAddressPostalCode = String(postalCode || profile.value.businessAddressPostalCode || '').trim()
  locationSearchValue.value = buildLocationSearchQuery()
}

const handleProfilePictureChange = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  if (!file.type?.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    toast.error('Please upload an image smaller than 5 MB.')
    return
  }
  profilePictureFile.value = file
  profile.value.profilePicture = URL.createObjectURL(file)
}

const loadProfile = async (user) => {
  if (!user) return

  loading.value = true
  try {
    userEmail.value = user.email || ''
    const [userSnap, appSnap, supplierData] = await Promise.all([
      getDoc(doc(db, 'users', user.uid)),
      getDoc(doc(db, 'supplierApplications', user.uid)),
      resolveSupplierDocument(user.uid),
    ])

    const merged = {
      ...(appSnap.exists() ? appSnap.data() : {}),
      ...(userSnap.exists() ? userSnap.data() : {}),
      ...supplierData,
    }

    profile.value = {
      ...profile.value,
      businessName:
        merged.businessName ||
        merged.name ||
        '',
      email: merged.email || user.email || '',
      contactNumber: normalizePhilippineMobile(merged.contactNumber || merged.phone || ''),
      businessAddress: merged.businessAddress || merged.address || '',
      businessAddressStreet: merged.businessAddressStreet || merged.addressStreet || '',
      businessAddressBarangay: merged.businessAddressBarangay || merged.addressBarangay || '',
      businessAddressCity: merged.businessAddressCity || merged.addressCity || '',
      businessAddressProvince: merged.businessAddressProvince || merged.addressProvince || '',
      businessAddressPostalCode: merged.businessAddressPostalCode || merged.addressPostalCode || '',
      businessAddressLat: merged.businessAddressLat || merged.addressLat || '',
      businessAddressLng: merged.businessAddressLng || merged.addressLng || '',
      businessType: merged.businessType || '',
      taxRegistrationNumber: normalizeTinDigits(merged.taxRegistrationNumber || merged.tinNumber || ''),
      profilePicture: merged.profilePicture || '',
      status: merged.status || '',
      approvalStatus: merged.approvalStatus || '',
    }

    locationSearchValue.value = buildLocationSearchQuery()
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  if (saving.value) return
  const user = auth.currentUser
  if (!user) {
    toast.error('You are not signed in.')
    return
  }

  if (!validateContactNumber()) {
    toast.error('Enter a valid Philippine mobile number before saving.')
    return
  }

  saving.value = true
  try {
    let profilePicture = profile.value.profilePicture || ''
    if (profilePictureFile.value) {
      const ref = storageRef(storage, `supplier-profile-images/${user.uid}/${Date.now()}-${profilePictureFile.value.name}`)
      const snapshot = await uploadBytes(ref, profilePictureFile.value)
      profilePicture = await getDownloadURL(snapshot.ref)
      profilePictureFile.value = null
      profile.value.profilePicture = profilePicture
    }
    const payload = {
      businessName: profile.value.businessName || '', email: profile.value.email || '', contactNumber: `+63${profile.value.contactNumber}`,
      businessAddress: profile.value.businessAddress || '', businessAddressStreet: profile.value.businessAddressStreet || '',
      businessAddressBarangay: profile.value.businessAddressBarangay || '', businessAddressCity: profile.value.businessAddressCity || '',
      businessAddressProvince: profile.value.businessAddressProvince || '', businessAddressPostalCode: profile.value.businessAddressPostalCode || '',
      businessAddressLat: profile.value.businessAddressLat || '', businessAddressLng: profile.value.businessAddressLng || '',
      businessType: profile.value.businessType || '', taxRegistrationNumber: normalizeTinDigits(profile.value.taxRegistrationNumber || ''), profilePicture,
    }
    const token = await user.getIdToken()
    let result
    for (const base of OTP_BACKEND_CANDIDATES) {
      const response = await fetch(`${base}/supply/supplier-profile`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      result = await response.json().catch(() => null)
      if (response.ok && result?.success) break
      if (!response.ok) throw new Error(result?.error || 'Unable to update the supplier profile.')
    }
    if (!result?.success) throw new Error(result?.error || 'Supplier profile service is unavailable.')
    supplierDocId.value = result.data.id || supplierDocId.value

    toast.success('Supplier profile updated successfully.')
  } catch (error) {
    console.error('Failed to save supplier profile:', error)
    toast.error('Failed to save supplier profile.')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      loading.value = false
      return
    }
    loadProfile(user)
  })
})
</script>

<style scoped>
.profile-label {
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
  border-radius: 1rem;
  border: 1px solid rgba(224, 192, 154, 0.95);
  background: rgba(255, 255, 255, 0.95);
  padding: 0.9rem 1rem;
  color: #342419;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.profile-textarea {
  resize: vertical;
  min-height: 5.5rem;
}

.profile-input:focus {
  border-color: rgba(198, 148, 108, 0.95);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.phone-input-shell {
  display: flex;
  overflow: hidden;
  border: 1px solid rgba(224, 192, 154, 0.95);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.95);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.phone-input-shell:focus-within {
  border-color: rgba(198, 148, 108, 0.95);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.phone-input-shell > span {
  display: inline-flex;
  align-items: center;
  border-right: 1px solid rgba(224, 192, 154, 0.95);
  padding: 0 1rem;
  color: #6f503d;
  font-size: 0.9rem;
  font-weight: 700;
}

.phone-input-shell .profile-input {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.phone-input-invalid { border-color: #c2413a; }
.field-error { margin-top: 0.35rem; color: #b8322b; font-size: 0.75rem; }
</style>
