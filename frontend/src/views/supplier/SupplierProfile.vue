<template>
  <div class="flex min-h-screen bg-gradient-to-br from-[#f9f1e5] via-[#f6e6d2] to-[#eed8be]">
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

            <form class="space-y-5" @submit.prevent="saveProfile">
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
                  <input v-model="profile.contactNumber" type="tel" class="profile-input" placeholder="+63..." />
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
                    region="philippines"
                    title="Select Business Location"
                    instruction-title="Philippines only"
                    instruction-text="Pin the exact location of your business in the Philippines."
                    search-placeholder="Search your business address"
                    search-hint="Search first, then fine-tune the exact spot by dragging or clicking the pin."
                    allowed-area-label="Philippines"
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

              <button type="submit" class="w-full rounded-2xl bg-[#8d5a3b] px-5 py-3.5 font-semibold text-white transition hover:bg-[#6f4329]">
                Save Supplier Profile
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import { db } from '@/config/firebaseConfig'
import LocationPicker from '@/components/common/LocationPicker.vue'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'
import {
  SUPPLIER_BUSINESS_TYPES,
  formatTinDisplay,
  normalizeTinDigits,
} from '@/utils/supplierTin'

const auth = getAuth()
const loading = ref(true)
const locationError = ref('')
const userEmail = ref('')
const supplierDocId = ref('')
const locationSearchValue = ref('')

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
  if (!file.type?.startsWith('image/')) {
    toast.error('Please upload an image file.')
    return
  }

  const reader = new FileReader()
  reader.onload = (loadEvent) => {
    profile.value.profilePicture = String(loadEvent.target?.result || '')
  }
  reader.readAsDataURL(file)
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
      contactNumber: merged.contactNumber || merged.phone || '',
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
  const user = auth.currentUser
  if (!user) {
    toast.error('You are not signed in.')
    return
  }

  try {
    const userPayload = {
      businessName: profile.value.businessName || '',
      email: profile.value.email || '',
      contactNumber: profile.value.contactNumber || '',
      address: profile.value.businessAddress || '',
      addressStreet: profile.value.businessAddressStreet || '',
      addressBarangay: profile.value.businessAddressBarangay || '',
      addressCity: profile.value.businessAddressCity || '',
      addressProvince: profile.value.businessAddressProvince || '',
      addressPostalCode: profile.value.businessAddressPostalCode || '',
      addressLat: profile.value.businessAddressLat || '',
      addressLng: profile.value.businessAddressLng || '',
      businessType: profile.value.businessType || '',
      taxRegistrationNumber: normalizeTinDigits(profile.value.taxRegistrationNumber || ''),
      profilePicture: profile.value.profilePicture || '',
      updatedAt: serverTimestamp(),
    }

    const supplierPayload = {
      ownerId: user.uid,
      name: profile.value.businessName || '',
      businessName: profile.value.businessName || '',
      email: profile.value.email || '',
      contactNumber: profile.value.contactNumber || '',
      contact: profile.value.contactNumber || '',
      phone: profile.value.contactNumber || '',
      address: profile.value.businessAddress || '',
      businessAddress: profile.value.businessAddress || '',
      businessAddressStreet: profile.value.businessAddressStreet || '',
      businessAddressBarangay: profile.value.businessAddressBarangay || '',
      businessAddressCity: profile.value.businessAddressCity || '',
      businessAddressProvince: profile.value.businessAddressProvince || '',
      businessAddressPostalCode: profile.value.businessAddressPostalCode || '',
      businessAddressLat: profile.value.businessAddressLat || '',
      businessAddressLng: profile.value.businessAddressLng || '',
      businessType: profile.value.businessType || '',
      taxRegistrationNumber: normalizeTinDigits(profile.value.taxRegistrationNumber || ''),
      profilePicture: profile.value.profilePicture || '',
      status: profile.value.status || 'Active',
      approvalStatus: profile.value.approvalStatus || 'Approved',
      updatedAt: serverTimestamp(),
    }

    await Promise.all([
      setDoc(doc(db, 'users', user.uid), userPayload, { merge: true }),
      setDoc(doc(db, 'supplierApplications', user.uid), {
        ...userPayload,
        role: 'Supplier',
        userType: 'supplier',
      }, { merge: true }),
      setDoc(doc(db, 'suppliers', supplierDocId.value || user.uid), supplierPayload, { merge: true }),
    ])

    toast.success('Supplier profile updated successfully.')
  } catch (error) {
    console.error('Failed to save supplier profile:', error)
    toast.error('Failed to save supplier profile.')
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
</style>
