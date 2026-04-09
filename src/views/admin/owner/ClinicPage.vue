<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-1">Clinic Page</h1>
          <p class="text-slate-400">Manage public-facing page content per clinic branch.</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="branch in branches"
            :key="branch.id"
            @click="selectBranch(branch.id)"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedBranchId === branch.id
                ? 'bg-gold-700 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            ]"
          >
            {{ branch.clinicBranch || branch.clinicName || 'Unnamed Branch' }}
          </button>
        </div>
      </div>

      <OwnerPageSkeleton v-if="loading" />

      <div v-else-if="!selectedBranch" class="bg-slate-800 rounded-xl border border-slate-700 p-8 text-slate-300">
        No branches found for this owner account.
      </div>

      <div v-else class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="relative h-64 bg-gradient-to-r from-slate-700 to-slate-600">
          <img
            v-if="selectedBranch.bannerPicture"
            :src="selectedBranch.bannerPicture"
            alt="Clinic banner"
            class="w-full h-full object-cover"
          />
          <div v-else class="absolute inset-0 bg-gradient-to-r from-indigo-500/40 via-sky-400/30 to-emerald-400/30"></div>
        </div>

        <div class="px-8 pb-8">
          <div class="relative -mt-20 z-20 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div class="flex flex-col md:flex-row md:items-end gap-4">
              <div class="h-36 w-36 rounded-full border-4 border-slate-800 bg-slate-700 overflow-hidden flex items-center justify-center shadow-xl">
                <img
                  v-if="selectedBranch.profilePicture"
                  :src="selectedBranch.profilePicture"
                  alt="Clinic profile"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-4xl font-bold text-white">{{ clinicInitial }}</span>
              </div>
              <div class="pt-10 md:pt-0">
                <h2 class="text-3xl font-bold text-white">{{ displayClinicName }}</h2>
                <p class="text-slate-300 mt-1">{{ selectedBranch.clinicLocation || 'Location not set' }}</p>
              </div>
            </div>
            <div class="md:pb-2">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="!isEditing"
                  @click="startEdit"
                  :disabled="isExpired"
                  class="px-4 py-2 rounded-lg bg-gold-700 hover:bg-gold-800 text-white text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Edit Info
                </button>
                <button
                  @click="togglePublish"
                  :disabled="saving || isExpired"
                  :class="[
                    'px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed',
                    selectedBranch.isPublished ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  ]"
                >
                  {{ selectedBranch.isPublished ? 'Unpublish Page' : 'Publish Page' }}
                </button>
                <span v-if="isExpired" class="text-xs text-amber-300">Publishing is disabled when the plan is expired.</span>
              </div>
            </div>
          </div>

          <div class="mt-8 border-t border-slate-700 pt-4">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-gold-700 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                ]"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div class="mt-6">
            <section v-if="activeTab === 'about'" class="space-y-4">
              <div v-if="isEditing" class="bg-slate-700/60 rounded-xl p-5 border border-slate-600 space-y-4">
                <h3 class="text-white font-semibold">Edit Branch Page</h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Clinic Name</label>
                    <input
                      v-model="editForm.clinicName"
                      class="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Business Email</label>
                    <input
                      v-model="editForm.businessEmail"
                      class="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Contact Number</label>
                    <input
                      v-model="editForm.contactNumber"
                      class="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-slate-300 text-sm mb-1">About Us (Description)</label>
                  <textarea
                    v-model="editForm.description"
                    rows="4"
                    class="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  ></textarea>
                </div>

                <div>
                  <label class="block text-slate-300 text-sm mb-1">Offered Services</label>
                  <div class="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-500 focus-within:ring-2 focus-within:ring-gold-500">
                    <div v-if="editForm.services.length" class="flex flex-wrap gap-2 mb-2">
                      <span
                        v-for="(service, index) in editForm.services"
                        :key="`${service}-${index}`"
                        class="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-200 text-xs"
                      >
                        {{ service }}
                        <button
                          type="button"
                          @click="removeServiceTag(index)"
                          class="text-gold-300 hover:text-white leading-none"
                          aria-label="Remove service"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                    <input
                      v-model="serviceInput"
                      type="text"
                      placeholder="Type a service then press Enter"
                      class="w-full bg-transparent text-white placeholder-slate-400 focus:outline-none"
                      @keydown="handleServiceKeydown"
                      @blur="commitServiceInput"
                    />
                  </div>
                  <p class="text-slate-400 text-xs mt-1">Press Enter or comma to add. Click × to remove.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Profile Picture</label>
                    <input
                      type="file"
                      accept="image/*"
                      @change="handleProfileUpload"
                      class="block w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-gold-700 file:px-3 file:py-2 file:text-white hover:file:bg-gold-800"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Banner Picture</label>
                    <input
                      type="file"
                      accept="image/*"
                      @change="handleBannerUpload"
                      class="block w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-gold-700 file:px-3 file:py-2 file:text-white hover:file:bg-gold-800"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="bg-slate-800 border border-slate-600 rounded-lg p-3">
                    <p class="text-slate-300 text-xs mb-2">Profile Preview</p>
                    <div class="h-20 w-20 rounded-full overflow-hidden bg-slate-700 border border-slate-500">
                      <img v-if="editForm.profilePicture" :src="editForm.profilePicture" class="w-full h-full object-cover" alt="Profile preview" />
                    </div>
                  </div>
                  <div class="bg-slate-800 border border-slate-600 rounded-lg p-3">
                    <p class="text-slate-300 text-xs mb-2">Banner Preview</p>
                    <div class="h-20 rounded overflow-hidden bg-slate-700 border border-slate-500">
                      <img v-if="editForm.bannerPicture" :src="editForm.bannerPicture" class="w-full h-full object-cover" alt="Banner preview" />
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <button
                    @click="saveEdit"
                    :disabled="saving"
                    class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm"
                  >
                    {{ saving ? 'Saving...' : 'Save Changes' }}
                  </button>
                  <button
                    @click="cancelEdit"
                    class="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                <h3 class="text-white font-semibold mb-2">About Us</h3>
                <p class="text-slate-300 leading-relaxed">
                  {{ selectedBranch.description || 'No clinic description available yet.' }}
                </p>
              </div>

              <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                <h3 class="text-white font-semibold mb-2">Offered Services</h3>
                <div v-if="Array.isArray(selectedBranch.services) && selectedBranch.services.length" class="flex flex-wrap gap-2">
                  <span
                    v-for="(service, index) in selectedBranch.services"
                    :key="`saved-service-${index}-${service}`"
                    class="inline-flex items-center px-2.5 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-200 text-xs"
                  >
                    {{ service }}
                  </span>
                </div>
                <p v-else class="text-slate-400 text-sm">No services added yet.</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                  <h4 class="text-slate-200 font-medium mb-2">Contact</h4>
                  <p class="text-slate-300 text-sm">Email: {{ selectedBranch.businessEmail || 'Not set' }}</p>
                  <p class="text-slate-300 text-sm mt-1">Phone: {{ selectedBranch.contactNumber || 'Not set' }}</p>
                </div>
                <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                  <h4 class="text-slate-200 font-medium mb-2">Address</h4>
                  <p class="text-slate-300 text-sm">{{ selectedBranch.clinicLocation || 'Not set' }}</p>
                </div>
              </div>
            </section>

            <section v-else-if="activeTab === 'products'" class="space-y-4">
              <div v-if="products.length === 0" class="bg-slate-700/60 rounded-xl p-5 border border-slate-600 text-slate-300">
                No products or services posted yet for this branch.
              </div>

              <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <article
                  v-for="item in products"
                  :key="item.id"
                  class="bg-slate-700/60 rounded-xl border border-slate-600 overflow-hidden"
                >
                  <div class="h-40 bg-slate-600">
                    <img v-if="item.imageUrl" :src="item.imageUrl" alt="Service image" class="w-full h-full object-cover" />
                  </div>
                  <div class="p-4">
                    <h3 class="text-white font-semibold">{{ item.title || item.productName || 'Untitled Service' }}</h3>
                    <p class="text-slate-300 text-sm mt-2 line-clamp-3">{{ item.description || 'No description.' }}</p>
                    <p class="text-gold-400 text-sm font-semibold mt-3">{{ formatAmount(item.price) }}</p>
                  </div>
                </article>
              </div>
            </section>

            <section v-else class="space-y-4">
              <div v-if="reviews.length === 0" class="bg-slate-700/60 rounded-xl p-5 border border-slate-600 text-slate-300">
                No reviews yet for this branch.
              </div>

              <div v-else class="space-y-3">
                <article
                  v-for="review in reviews"
                  :key="review.id"
                  class="bg-slate-700/60 rounded-xl border border-slate-600 p-5"
                >
                  <div class="flex items-center justify-between">
                    <p class="text-white font-medium">{{ review.reviewerName || 'Anonymous' }}</p>
                    <p class="text-yellow-400 text-sm">{{ renderStars(review.rating) }}</p>
                  </div>
                  <p class="text-slate-300 text-sm mt-2">{{ review.comment || 'No comment' }}</p>
                  <p class="text-slate-400 text-xs mt-2">{{ formatDate(review.createdAt) }}</p>
                </article>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, storage } from '@/config/firebaseConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'
import { toast } from 'vue3-toastify'
import { useSubscription } from '@/composables/useSubscription'
import { hasExpiredSuspension, restoreExpiredSuspension } from '@/utils/centerSuspension'

export default {
  name: 'ClinicPage',
  components: { OwnerSidebar, OwnerPageSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const { isExpired, initSubscription } = useSubscription()

    const loading = ref(true)
    const branches = ref([])
    const selectedBranchId = ref('')
    const products = ref([])
    const reviews = ref([])
    const ownerEmail = ref('')
    const activeTab = ref('about')
    const isEditing = ref(false)
    const saving = ref(false)

    const editForm = ref({
      clinicName: '',
      businessEmail: '',
      contactNumber: '',
      description: '',
      services: [],
      profilePicture: '',
      bannerPicture: ''
    })
    const serviceInput = ref('')
    const profileImageFile = ref(null)
    const bannerImageFile = ref(null)
    const profilePreviewUrl = ref('')
    const bannerPreviewUrl = ref('')

    const tabs = [
      { id: 'about', label: 'About Us' },
      { id: 'products', label: 'Products & Services' },
      { id: 'reviews', label: 'Reviews' }
    ]

    const selectedBranch = computed(() =>
      branches.value.find((branch) => branch.id === selectedBranchId.value) || null
    )

    const displayClinicName = computed(() => {
      if (isEditing.value && editForm.value.clinicName) return editForm.value.clinicName
      if (!selectedBranch.value) return 'Clinic Name'
      return selectedBranch.value.clinicName || selectedBranch.value.clinicBranch || 'Clinic Name'
    })

    const clinicInitial = computed(() => {
      const source = displayClinicName.value || 'C'
      return source.charAt(0).toUpperCase()
    })

    const formatAmount = (value) => {
      const numeric = Number(value || 0)
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(numeric)
    }

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return 'Unknown date'
      return timestamp.toDate().toLocaleDateString()
    }

    const renderStars = (rating) => {
      const numeric = Math.max(0, Math.min(5, Number(rating || 0)))
      return `Rating: ${Math.round(numeric)}/5`
    }

    const hydrateEditForm = () => {
      if (!selectedBranch.value) return

      if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
      if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
      profilePreviewUrl.value = ''
      bannerPreviewUrl.value = ''
      profileImageFile.value = null
      bannerImageFile.value = null

      editForm.value = {
        clinicName: selectedBranch.value.clinicName || selectedBranch.value.clinicBranch || '',
        businessEmail: selectedBranch.value.businessEmail || selectedBranch.value.email || '',
        contactNumber: selectedBranch.value.contactNumber || '',
        description: selectedBranch.value.description || '',
        services: Array.isArray(selectedBranch.value.services)
          ? selectedBranch.value.services.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
        profilePicture: selectedBranch.value.profilePicture || '',
        bannerPicture: selectedBranch.value.bannerPicture || ''
      }
      serviceInput.value = ''
    }

    const normalizeService = (value) => String(value || '').replace(/\s+/g, ' ').trim()

    const addServiceTag = (rawValue) => {
      const nextLabel = normalizeService(rawValue)
      if (!nextLabel) return
      const exists = editForm.value.services.some((service) => service.toLowerCase() === nextLabel.toLowerCase())
      if (exists) return
      editForm.value.services.push(nextLabel)
    }

    const commitServiceInput = () => {
      if (!serviceInput.value) return
      addServiceTag(serviceInput.value)
      serviceInput.value = ''
    }

    const handleServiceKeydown = (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault()
        commitServiceInput()
        return
      }
      if (event.key === 'Backspace' && !serviceInput.value && editForm.value.services.length > 0) {
        editForm.value.services.pop()
      }
    }

    const removeServiceTag = (index) => {
      if (index < 0 || index >= editForm.value.services.length) return
      editForm.value.services.splice(index, 1)
    }

    const loadBranchPostsAndReviews = async (branchId) => {
      if (!branchId) {
        products.value = []
        reviews.value = []
        return
      }

      const [productSnapshot, reviewSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'productServicePosts'), where('branchId', '==', branchId))),
        getDocs(query(collection(db, 'reviews'), where('branchId', '==', branchId)))
      ])

      products.value = productSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      reviews.value = reviewSnapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    }

    const selectBranch = async (branchId) => {
      if (!branchId || selectedBranchId.value === branchId) return
      selectedBranchId.value = branchId
      isEditing.value = false
      hydrateEditForm()
      await loadBranchPostsAndReviews(branchId)
    }

    const autoUnpublishExpiredBranches = async () => {
      const published = branches.value.filter((branch) => branch.isPublished === true)
      if (!published.length) return
      try {
        await Promise.all(
          published.map((branch) =>
            updateDoc(doc(db, 'clinics', branch.id), {
              isPublished: false,
              updatedAt: serverTimestamp()
            })
          )
        )
        branches.value = branches.value.map((branch) => ({ ...branch, isPublished: false }))
      } catch (error) {
        console.error('Failed to unpublish expired clinic pages:', error)
      }
    }

    const loadOwnerBranches = async (user) => {
      loading.value = true
      try {
        ownerEmail.value = user.email || ''
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (userSnap.exists()) {
          ownerEmail.value = userSnap.data().email || ownerEmail.value
        }

        const clinicsSnapshot = await getDocs(
          query(collection(db, 'clinics'), where('ownerId', '==', user.uid))
        )

        branches.value = await Promise.all(
          clinicsSnapshot.docs.map(async (snap) => {
            const data = snap.data()
            if (hasExpiredSuspension(data)) {
              await restoreExpiredSuspension(db, snap.id, data)
              return {
                id: snap.id,
                ...data,
                status: 'Active',
                moderationStatus: 'Resolved',
                isPublished: true,
                suspendedAt: null,
                suspensionEndsAt: null,
                suspensionReason: '',
                suspensionSource: ''
              }
            }
            return { id: snap.id, ...data, isPublished: data.isPublished === true }
          })
        )
        if (isExpired.value && branches.value.length) {
          await autoUnpublishExpiredBranches()
        }
        if (branches.value.length > 0) {
          selectedBranchId.value = branches.value[0].id
          hydrateEditForm()
          await loadBranchPostsAndReviews(selectedBranchId.value)
        } else {
          selectedBranchId.value = ''
          products.value = []
          reviews.value = []
        }
      } catch (error) {
        console.error('Failed to load clinic page:', error)
        branches.value = []
        selectedBranchId.value = ''
        products.value = []
        reviews.value = []
      } finally {
        loading.value = false
      }
    }

    const handleProfileUpload = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
        profileImageFile.value = file
        profilePreviewUrl.value = URL.createObjectURL(file)
        editForm.value.profilePicture = profilePreviewUrl.value
      } catch (error) {
        console.error(error)
        toast.error('Failed to process profile image.')
      } finally {
        event.target.value = ''
      }
    }

    const handleBannerUpload = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
        bannerImageFile.value = file
        bannerPreviewUrl.value = URL.createObjectURL(file)
        editForm.value.bannerPicture = bannerPreviewUrl.value
      } catch (error) {
        console.error(error)
        toast.error('Failed to process banner image.')
      } finally {
        event.target.value = ''
      }
    }

    const startEdit = () => {
      if (!selectedBranch.value) return
      activeTab.value = 'about'
      isEditing.value = true
      hydrateEditForm()
    }

    const cancelEdit = () => {
      isEditing.value = false
      hydrateEditForm()
    }

    const saveEdit = async () => {
      if (!selectedBranch.value?.id) return
      saving.value = true
      try {
        commitServiceInput()
        const clinicId = selectedBranch.value.id
        const sanitizeImageUrl = (value) => {
          const source = String(value || '').trim()
          if (!source) return ''
          if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('gs://')) {
            return source
          }
          return ''
        }

        let profilePictureUrl = sanitizeImageUrl(selectedBranch.value.profilePicture)
        let bannerPictureUrl = sanitizeImageUrl(selectedBranch.value.bannerPicture)

        if (profileImageFile.value) {
          const extension = (profileImageFile.value.name?.split('.').pop() || 'jpg').toLowerCase()
          const profilePath = `clinicMedia/${clinicId}/profile-${Date.now()}.${extension}`
          const profileRef = storageRef(storage, profilePath)
          await uploadBytes(profileRef, profileImageFile.value)
          profilePictureUrl = await getDownloadURL(profileRef)
        }

        if (bannerImageFile.value) {
          const extension = (bannerImageFile.value.name?.split('.').pop() || 'jpg').toLowerCase()
          const bannerPath = `clinicMedia/${clinicId}/banner-${Date.now()}.${extension}`
          const bannerRef = storageRef(storage, bannerPath)
          await uploadBytes(bannerRef, bannerImageFile.value)
          bannerPictureUrl = await getDownloadURL(bannerRef)
        }

        const uniqueServices = editForm.value.services
          .map((entry) => normalizeService(entry))
          .filter(Boolean)
          .filter((entry, index, list) => list.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index)

        const payload = {
          clinicName: (editForm.value.clinicName || '').trim(),
          businessEmail: (editForm.value.businessEmail || '').trim(),
          contactNumber: (editForm.value.contactNumber || '').trim(),
          description: (editForm.value.description || '').trim(),
          services: uniqueServices,
          profilePicture: profilePictureUrl,
          bannerPicture: bannerPictureUrl,
          updatedAt: serverTimestamp()
        }
        await updateDoc(doc(db, 'clinics', clinicId), payload)

        branches.value = branches.value.map((branch) =>
          branch.id === clinicId ? { ...branch, ...payload } : branch
        )

        if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
        if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
        profilePreviewUrl.value = ''
        bannerPreviewUrl.value = ''
        profileImageFile.value = null
        bannerImageFile.value = null

        isEditing.value = false
        toast.success('Branch clinic page updated.')
      } catch (error) {
        console.error('Failed to save clinic page info:', error)
        toast.error('Failed to save clinic info.')
      } finally {
        saving.value = false
      }
    }

    const togglePublish = async () => {
      if (!selectedBranch.value?.id || saving.value || isExpired.value) return
      const normalizedStatus = String(selectedBranch.value.status || '').trim().toLowerCase()
      const normalizedModerationStatus = String(selectedBranch.value.moderationStatus || '').trim().toLowerCase()
      const isSuspended = normalizedStatus.includes('suspend') || normalizedModerationStatus.includes('suspend')
      if (isSuspended) {
        toast.error('This center is suspended and cannot be published until super admin restores it.')
        return
      }
      saving.value = true
      try {
        const nextState = !(selectedBranch.value.isPublished === true)
        await updateDoc(doc(db, 'clinics', selectedBranch.value.id), {
          isPublished: nextState,
          updatedAt: serverTimestamp()
        })

        branches.value = branches.value.map((branch) =>
          branch.id === selectedBranch.value.id ? { ...branch, isPublished: nextState } : branch
        )

        toast.success(nextState ? 'Clinic page is now public.' : 'Clinic page is now hidden from public view.')
      } catch (error) {
        console.error('Failed to toggle publish state:', error)
        toast.error('Failed to update publish status.')
      } finally {
        saving.value = false
      }
    }

    let unsubscribeAuth = null
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          loading.value = false
          branches.value = []
          selectedBranchId.value = ''
          products.value = []
          reviews.value = []
          return
        }
        await initSubscription()
        await loadOwnerBranches(user)
      })
    })

    onUnmounted(() => {
      if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
      if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      loading,
      branches,
      selectedBranchId,
      selectedBranch,
      products,
      reviews,
      ownerEmail,
      activeTab,
      tabs,
      displayClinicName,
      clinicInitial,
      formatAmount,
      formatDate,
      renderStars,
      isEditing,
      saving,
      editForm,
      startEdit,
      cancelEdit,
      saveEdit,
      togglePublish,
      selectBranch,
      serviceInput,
      handleServiceKeydown,
      commitServiceInput,
      removeServiceTag,
      handleProfileUpload,
      handleBannerUpload,
      isExpired
    }
  }
}
</script>

