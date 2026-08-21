<template>
  <div class="flex min-h-screen bg-gradient-to-br from-[#f8f1e6] via-[#f4e6d1] to-[#efdbc0]">
    <SupplierSidebar />

    <main class="flex-1 p-6 md:p-8">
      <section class="mx-auto max-w-6xl space-y-6">
        <div class="rounded-3xl border border-amber-200/80 bg-white/80 p-6 shadow-[0_18px_40px_rgba(77,52,31,0.08)] backdrop-blur">
          <div v-if="loading" class="space-y-3">
            <div class="h-10 w-72 rounded-full bg-amber-100 animate-pulse"></div>
            <div class="h-4 w-full max-w-2xl rounded-full bg-amber-100 animate-pulse"></div>
            <div class="grid gap-4 md:grid-cols-3">
              <div v-for="index in 3" :key="index" class="h-28 rounded-2xl bg-amber-50 animate-pulse"></div>
            </div>
          </div>

          <div v-else>
            <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Supplier Dashboard</p>
                <h1 class="mt-2 text-3xl font-bold text-[#40261a] md:text-4xl">
                  {{ supplier.businessName || 'Your Supplier Panel' }}
                </h1>
                <p class="mt-2 max-w-3xl text-sm leading-6 text-[#6f503d]">
                  Keep your business profile, products, and fulfillment details updated so procurement and logistics can work with the latest information.
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <router-link to="/supplier/profile" class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329]">
                  Edit Profile
                </router-link>
                <router-link to="/supplier/supplies" class="rounded-xl border border-[#d9b38d] bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#6f4329] transition hover:bg-[#f7ead8]">
                  Manage Supplies
                </router-link>
              </div>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-3">
              <article class="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Approval Status</p>
                <p class="mt-2 text-2xl font-bold text-[#4b2f20]">{{ supplier.approvalStatus || supplier.status || 'Pending' }}</p>
                <p class="mt-2 text-sm text-[#775743]">Your approval state controls how procurement and logistics interact with your business.</p>
              </article>

              <article class="rounded-2xl border border-[#e4c6a4] bg-white/90 p-5">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Supply Items</p>
                <p class="mt-2 text-2xl font-bold text-[#4b2f20]">{{ itemCount }}</p>
                <p class="mt-2 text-sm text-[#775743]">Products, equipment, and medical supplies listed for procurement.</p>
              </article>

              <article class="rounded-2xl border border-[#e4c6a4] bg-white/90 p-5">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Business Location</p>
                <p class="mt-2 text-base font-semibold text-[#4b2f20]">{{ locationLabel }}</p>
                <p class="mt-2 text-sm text-[#775743]">Use the profile page to keep your map pin and address current.</p>
              </article>
            </div>

            <div class="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <article class="rounded-3xl border border-[#e7c9a6] bg-white/90 p-5">
                <div class="flex items-start gap-4">
                  <div class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#f0d4b2] to-[#c88f63] text-2xl font-bold text-white">
                    <img v-if="supplier.profilePicture" :src="supplier.profilePicture" alt="Supplier profile picture" class="h-full w-full object-cover" />
                    <span v-else>{{ businessInitial }}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Registered Business</p>
                    <h2 class="mt-1 truncate text-2xl font-bold text-[#40261a]">{{ supplier.businessName || 'Unnamed Supplier' }}</h2>
                    <p class="mt-1 text-sm text-[#755643]">{{ supplier.email || userEmail || 'No email on file' }}</p>
                    <p class="mt-1 text-sm text-[#755643]">{{ supplier.contactNumber || '-' }}</p>
                  </div>
                </div>

                <div class="mt-5 rounded-2xl border border-dashed border-[#e4c6a4] bg-[#fff8f0] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Address</p>
                  <p class="mt-2 text-sm leading-6 text-[#5a402f]">
                    {{ fullAddress || 'No business address saved yet.' }}
                  </p>
                </div>
              </article>

              <article class="rounded-3xl border border-[#e7c9a6] bg-gradient-to-br from-[#fff9f2] to-[#f6e5d0] p-5">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Quick Notes</p>
                <ul class="mt-4 space-y-3 text-sm text-[#5a402f]">
                  <li>Update your profile before changing your supply catalog.</li>
                  <li>Keep item photos and measurements clear for procurement review.</li>
                  <li>Use exact category names for custom items when choosing "Others".</li>
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'

const auth = getAuth()
const loading = ref(true)
const userEmail = ref('')
const supplier = ref({
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
  profilePicture: '',
  status: '',
  approvalStatus: '',
  offeredItems: [],
})

const supplierDocId = ref('')

const fullAddress = computed(() =>
  [
    supplier.value.businessAddressStreet,
    supplier.value.businessAddressBarangay,
    supplier.value.businessAddressCity,
    supplier.value.businessAddressProvince,
    supplier.value.businessAddressPostalCode,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ') || supplier.value.businessAddress || ''
)

const locationLabel = computed(() => {
  const lat = String(supplier.value.businessAddressLat || '').trim()
  const lng = String(supplier.value.businessAddressLng || '').trim()
  if (fullAddress.value) return fullAddress.value
  if (lat && lng) return `${lat}, ${lng}`
  return 'No pinned location yet'
})

const businessInitial = computed(() => {
  const source = String(supplier.value.businessName || userEmail.value || 'S').trim()
  return source ? source.charAt(0).toUpperCase() : 'S'
})

const itemCount = computed(() => Array.isArray(supplier.value.offeredItems) ? supplier.value.offeredItems.filter((item) => item?.name).length : 0)

const resolveSupplierDocument = async (uid) => {
  const existingQuery = await getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', uid), limit(1)))
  if (!existingQuery.empty) {
    const snap = existingQuery.docs[0]
    supplierDocId.value = snap.id
    return snap.data() || {}
  }
  supplierDocId.value = uid
  return {}
}

const loadSupplierDashboard = async (user) => {
  if (!user) return

  loading.value = true
  try {
    userEmail.value = user.email || ''
    const [userSnap, applicationSnap, supplierData] = await Promise.all([
      getDoc(doc(db, 'users', user.uid)),
      getDoc(doc(db, 'supplierApplications', user.uid)),
      resolveSupplierDocument(user.uid),
    ])

    supplier.value = {
      ...supplier.value,
      ...(applicationSnap.exists() ? applicationSnap.data() : {}),
      ...(userSnap.exists() ? userSnap.data() : {}),
      ...supplierData,
      email: user.email || applicationSnap.data()?.email || userSnap.data()?.email || supplier.value.email || '',
      businessName:
        supplierData.businessName ||
        applicationSnap.data()?.businessName ||
        userSnap.data()?.businessName ||
        supplierData.name ||
        '',
      offeredItems: Array.isArray(supplierData.offeredItems) ? supplierData.offeredItems : [],
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      loading.value = false
      return
    }
    loadSupplierDashboard(user)
  })
})
</script>
