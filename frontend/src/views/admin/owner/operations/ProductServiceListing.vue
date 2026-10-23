<template>
  <div class="flex module-theme service-listings-page bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: activeListingTab === 'create' ? 'form' : 'cards', cards: 6, fields: 8 }" class="min-w-0 flex-1 p-4 md:p-8 text-white">
      <div class="listing-page-heading mb-6">
        <div><p class="listing-eyebrow">Clinic services</p>
        <h1 class="text-2xl md:text-3xl font-bold mb-1">Service Listings</h1>
        <p class="text-slate-400">{{ isFreePlan ? 'Publish service listings directly for customer booking.' : 'Save drafts, submit financial terms to Finance, then publish approved listings.' }}</p>
        </div><button v-if="activeListingTab === 'listings'" type="button" class="listing-primary-button" @click="activeListingTab = 'create'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg><span>Create listing</span></button>
      </div>

      <div v-if="activeListingTab === 'listings'" class="listing-overview"><article><span>Total listings</span><strong>{{ posts.length }}</strong></article><article><span>Published</span><strong>{{ posts.filter(post => post.isPublished).length }}</strong></article><article><span>Unpublished</span><strong>{{ posts.filter(post => !post.isPublished).length }}</strong></article></div>
      <nav class="listing-tabs" aria-label="Service listing sections"><button type="button" :class="{ 'is-active': activeListingTab === 'listings' }" :aria-pressed="activeListingTab === 'listings'" @click="activeListingTab = 'listings'">Listings</button><button type="button" :class="{ 'is-active': activeListingTab === 'create' }" :aria-pressed="activeListingTab === 'create'" @click="activeListingTab = 'create'">Create Listing</button></nav>

      <div v-if="activeListingTab === 'listings' && isFreePlan" class="mb-6 rounded-xl border border-amber-500/35 bg-amber-950/20 p-4 text-sm text-amber-100">
        Free Plan includes up to <strong>{{ freePlanPostLimit }} service listings</strong>. Services publish directly and can be booked online. Upgrade to Basic for consultations, packages, and Finance workflows.
      </div>

      <details v-if="activeListingTab === 'listings' && applicablePolicies.length" class="listing-policy-panel">
        <summary class="listing-disclosure-trigger"><span>Applicable branch policies <small>{{ applicablePolicies.length }} enabled</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" /></svg></summary>
        <div class="listing-policy-content"><p class="listing-policy-description">These rules are configured in Policy &amp; Contract Management and apply automatically when this listing is booked. Branch policy links determine which rules apply. They cannot be edited per listing.</p>
        <div class="listing-policy-grid"><article v-for="policy in applicablePolicies" :key="policy.key"><h3>{{ policy.label }}</h3><p>{{ policy.text }}</p></article></div></div>
      </details>

      <section v-if="activeListingTab === 'listings'" class="listing-client-contract">
        <h2>Client Contract</h2>
        <p v-if="hasClientContract">Your clinic's saved Client Contract applies automatically to services, consultations, and packages booked online or as walk-ins. Each booking includes the applicable branch policies, additional clinic terms, and saved appearance. You do not need to create a separate contract for each listing.</p>
        <p v-else>Save a Client Contract in Policy &amp; Contract Management to apply it automatically to online and walk-in bookings for your listings.</p>
        <details v-if="hasClientContract" class="listing-contract-disclosure"><summary class="listing-disclosure-trigger"><span>Preview applied contract</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" /></svg></summary><div class="listing-contract-preview-body"><p class="listing-contract-preview-note">This preview uses this branch's linked policies. The Walk-In Policy applies to walk-ins. The booked service details are added to each customer's agreement. Existing agreements retain their saved content and design.</p><ClientContractDocument :document="listingContractPreview" /></div></details>
      </section>

      <div v-show="activeListingTab === 'create'" class="listing-create-panel bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
        <h2 class="text-lg font-semibold mb-2">Create listing</h2><p class="listing-section-description">Add the service details, booking rules, and resources needed for each appointment.</p>

        <ServiceListingFields :model="form" :disabled="loading" :is-free-plan="isFreePlan" :inventory-products="inventoryProducts" :posts="posts" :image-file-name="imageFileName" @image-change="handleImageUpload" />

        <div class="flex gap-2">
          <button
            @click="createPost"
            :disabled="loading"
            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Posting...' : 'Save Draft' }}
          </button>
          <button
            @click="resetForm"
            :disabled="loading"
            class="bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>
      </div>

      <div v-show="activeListingTab === 'listings'" class="listing-records-panel bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
        <div class="listing-records-heading"><div><h2 class="text-lg font-semibold">Your listings</h2><p>{{ filteredListings.length }} of {{ posts.length }} listings</p></div><input v-model="listingSearch" type="search" aria-label="Search service listings" placeholder="Search by name, type, or description..." /></div>

        <div v-if="!filteredListings.length" class="listing-empty-state"><h3>{{ posts.length ? 'No matching listings' : 'No listings yet' }}</h3><p>{{ posts.length ? 'Try a different name, type, or description.' : 'Create your first listing to make a service available for booking.' }}</p><button v-if="!posts.length" type="button" class="listing-primary-button" @click="activeListingTab = 'create'">Create listing</button></div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <article v-for="post in filteredListings" :key="post.id" class="listing-card bg-slate-900/70 border border-slate-700 rounded-lg overflow-hidden">
            <img v-if="post.imageUrl" :src="post.imageUrl" :alt="post.title || 'Service image'" class="w-full h-40 object-cover" />
            <div v-else class="listing-image-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6" stroke-linecap="round" /></svg><span>{{ post.postType }}</span></div>
            <div class="listing-card-body p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="listing-detail-badge listing-type-badge">{{ post.postType }}</span>
                <span class="text-xs text-slate-400">{{ formatDate(post.createdAt) }}</span>
              </div>
              <h3 class="font-semibold mb-1">{{ post.title }}</h3>
              <p class="listing-publication-status mb-2 text-sm font-semibold" :class="{ 'is-published': post.isPublished }">{{ isFreePlan ? (post.isPublished ? 'Published' : 'Draft') : (post.isPublished && post.financeStatus === 'approved' ? 'Published' : post.financeStatus === 'approved' ? 'Finance approved - awaiting publication' : post.financeStatus === 'pending' ? 'Awaiting Finance review' : post.financeStatus === 'rejected' ? 'Changes requested' : 'Draft') }}</p>
              <p v-if="!isFreePlan && post.financeReview?.note" class="mb-2 text-sm">Finance: {{ post.financeReview.note }}</p>
              <div v-if="canManageListingWorkflow && isFreePlan && !post.isPublished" class="mb-3 flex flex-wrap gap-2">
                <button :disabled="!!actionLoadingId" @click="listingAction(post, 'publish')" class="rounded bg-emerald-700 px-3 py-2 text-sm">Publish</button>
              </div>
              <div v-if="!isFreePlan" class="mb-3 flex flex-wrap gap-2">
                <button v-if="canManageListingWorkflow && (!post.financeStatus || ['draft', 'rejected'].includes(post.financeStatus))" :disabled="!!actionLoadingId" @click="listingAction(post, 'submit')" class="rounded bg-blue-700 px-3 py-2 text-sm">{{ actionLoadingId === post.id ? 'Submitting…' : 'Submit to Finance' }}</button>
                <button v-if="canManageListingWorkflow && post.financeStatus === 'approved' && !post.isPublished" :disabled="!!actionLoadingId" @click="listingAction(post, 'publish')" class="rounded bg-emerald-700 px-3 py-2 text-sm">{{ actionLoadingId === post.id ? 'Publishing…' : 'Publish' }}</button>
                <button v-if="canManageListingWorkflow && post.isPublished" :disabled="!!actionLoadingId" @click="listingAction(post, 'unpublish')" class="rounded bg-slate-700 px-3 py-2 text-sm">{{ actionLoadingId === post.id ? 'Unpublishing…' : 'Unpublish' }}</button>
              </div>
              <p class="text-sm text-slate-300 mb-1">{{ post.productName || post.serviceName || post.consultationName || post.packageName }}</p>
              <p v-if="post.postType === 'Package'" class="mb-2 text-xs text-amber-200">
                Includes {{ (post.packageServiceIds || []).length }} consultation/service component(s).
              </p>
              <p class="listing-card-description text-sm text-slate-400 mb-2">{{ post.description }}</p>
              <div v-if="post.postType === 'Service' || post.postType === 'Consultation'" class="mb-2 flex flex-wrap gap-2">
                <span
                  v-if="post.postType === 'Service' && post.requiresConsultationFirst"
                  class="listing-detail-badge"
                >
                  Consultation required
                </span>
                <span
                  v-if="post.postType === 'Consultation' || (post.postType === 'Service' && post.requiresConsultationFirst)"
                  class="listing-detail-badge"
                >
                  Fee PHP {{ Number(post.consultationFee || post.price || 0).toFixed(2) }}
                </span>
                <span
                  v-if="post.postType === 'Service' && post.followUpAllowed"
                  class="listing-detail-badge listing-follow-up-badge"
                >
                  Follow-up allowed
                </span>
                <span
                  v-if="post.durationMinutes"
                  class="listing-detail-badge"
                >
                  {{ post.durationMinutes }} mins
                </span>
              </div>
              <p v-if="post.postType === 'Service' && post.requiresConsultationFirst" class="mb-2 text-xs font-semibold text-amber-200">
                A completed linked consultation or clinic-approved clearance is required before booking this service.
              </p>
              <p v-if="post.postType === 'Consultation'" class="mb-2 text-xs font-semibold text-orange-200">
                Standalone consultation post. Customers book this separately before any follow-up service.
              </p>
              <p class="listing-card-price text-sm font-semibold text-green-400">{{ formatCurrency(post.price) }}</p>
              <div class="listing-card-actions mt-3 flex flex-wrap gap-2">
                <button
                  @click="openEditPost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {{ actionLoadingId === post.id ? 'Processing…' : 'Edit' }}
                </button>
                <button
                  @click="archivePost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="px-3 py-1 text-xs rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  {{ actionLoadingId === post.id ? 'Archiving…' : 'Archive' }}
                </button>
                <button
                  @click="deletePost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {{ actionLoadingId === post.id ? 'Deleting…' : 'Delete' }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div v-if="showEditModal" class="fixed inset-0 z-50 bg-black/60 p-4 flex items-start md:items-center justify-center overflow-y-auto">
        <div class="w-full max-w-2xl rounded-xl bg-slate-800 border border-slate-700 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
          <div class="listing-edit-heading px-6 pt-6 pb-4 border-b border-slate-700">
            <h3 class="text-lg font-semibold">Edit listing</h3><button type="button" aria-label="Close edit listing" @click="closeEditModal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" /></svg></button>
            <p class="text-sm text-amber-300">{{ isFreePlan ? 'Update the listing details below. The listing type stays the same.' : 'Price or booking changes may require Finance review before publishing. The listing type stays the same.' }}</p>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <ServiceListingFields :model="editForm" editing :disabled="loading" :is-free-plan="isFreePlan" :inventory-products="inventoryProducts" :posts="posts" :image-file-name="editImageFileName" @image-change="handleEditImageUpload" />
          </div>

          <div class="border-t border-slate-700 px-6 py-4">
            <div class="flex justify-end gap-2">
              <button
                @click="closeEditModal"
                :disabled="loading"
                class="px-4 py-2 rounded bg-slate-600 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                @click="saveEditedPost"
                :disabled="loading"
                class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {{ loading ? 'Saving changes…' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { draftListing, financialTermsChanged, validateListingNumbers, updateListingApproval } from '@/utils/listingApproval'
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'
import { getClinicPolicyOwnerId } from '@/utils/clinicPolicies'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import ServiceListingFields from '@/components/common/ServiceListingFields.vue'
import { normalizeServiceCategory } from '../../../../../../shared/serviceCategories.js'
import { buildClientContractDocument, clientContractPolicies } from '../../../../../../shared/clientContract.js'

const FREE_PLAN_POST_LIMIT = 5

export default {
  name: 'ProductServiceListing',
  components: { OwnerSidebar, ClientContractDocument, ServiceListingFields },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const storage = getStorage(getApp())
    const auth = getAuth(getApp())
    const { userRole, isClinicAdminOwner } = usePermissions()
    const { activePlan } = useSubscription()
    const isFreePlan = computed(() => String(activePlan.value || 'free').trim().toLowerCase() === 'free')
    const canManageListingWorkflow = computed(() =>
      isClinicAdminOwner.value || String(userRole.value || '').trim().toLowerCase() === 'manager'
    )

    const loading = ref(false)
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const clinicPolicies = ref({})
    const contractBranch = ref({})
    const hasClientContract = computed(() => clinicPolicies.value.clientContract?.configured === true)
    const listingContractPreview = computed(() => buildClientContractDocument(clinicPolicies.value, { branch: contractBranch.value }))
    const applicablePolicies = computed(() => clientContractPolicies(clinicPolicies.value, { branch: contractBranch.value })
      .map(policy => ({ ...policy, label: policy.title })))

    const inventoryProducts = ref([])

    const posts = ref([])
    const activeListingTab = ref('listings')
    const listingSearch = ref('')
    const filteredListings = computed(() => {
      const search = listingSearch.value.trim().toLowerCase()
      return posts.value.filter(post => !search || [post.title, post.serviceName, post.consultationName, post.packageName, post.postType, post.description].some(value => String(value || '').toLowerCase().includes(search)))
    })
    const imageFile = ref(null)
    const imageFileName = ref('')
    const fdaApprovalFile = ref(null)
    const fdaApprovalFileName = ref('')
    const actionLoadingId = ref('')

    const newListingState = () => {
      if (!isFreePlan.value) return draftListing()
      return {
        financeStatus: 'approved',
        isPublished: true,
        financeReview: null,
        publishedBy: currentUserId.value,
        publishedAt: serverTimestamp(),
      }
    }

    const showEditModal = ref(false)
    const editTargetId = ref('')
    const editForm = ref({
      postType: 'Service',
      serviceCategory: 'Other',
      name: '',
      title: '',
      description: '',
      price: 0,
      discountPercent: 0,
      requiresConsultationFirst: false,
        linkedConsultationId: '',
      consultationFee: 0,
      consultationModes: ['on-site'], consultationGraceMinutes: 10, consultationBufferMinutes: 15,
      followUpAllowed: false,
      followUpWindowDays: 14,
      staffingRequirements: [],
      sessionCount: 1,
      sessionIntervalDays: 0,
      durationMinutes: 60,
      productVolume: '',
      productUnit: '',
      fdaRegistrationNumber: '',
      termsAndConditions: '',
      requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
      packageServiceIds: []
    })
    const editImageFile = ref(null)
    const editImageFileName = ref('')
    const editFdaApprovalFile = ref(null)
    const editFdaApprovalFileName = ref('')

    const form = ref({
      postType: 'Service',
      serviceCategory: 'Other',
      productName: '',
      serviceName: '',
      consultationName: '',
      packageName: '',
      packageServiceIds: [],
      title: '',
      description: '',
      price: 0,
      discountPercent: 0,
      requiresConsultationFirst: false,
        linkedConsultationId: '',
      consultationFee: 0,
      consultationModes: ['on-site'],
      followUpAllowed: false,
      followUpWindowDays: 14,
      staffingRequirements: [],
      sessionCount: 1,
      sessionIntervalDays: 0,
      durationMinutes: 60,
      productVolume: '',
      productUnit: '',
      fdaRegistrationNumber: '',
      termsAndConditions: ''
      , requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50
    })

    const formatCurrency = (value) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP', currencyDisplay: 'code'
      }).format(Number(value) || 0)
    }

    const formatDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleDateString('en-PH')
      if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-PH')
      return '-'
    }

    const normalizeConsultationMode = (value) =>
      String(value || '').trim().toLowerCase() === 'on-site' ? 'on-site' : 'online'
    const normalizeConsultationModes = (modes, legacyMode = 'online') => {
      const normalized = Array.isArray(modes)
        ? [...new Set(modes.map(normalizeConsultationMode).filter(mode => ['online', 'on-site'].includes(mode)))]
        : []
      return normalized.length ? normalized : [normalizeConsultationMode(legacyMode)]
    }

    const handleImageUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      imageFile.value = file
      imageFileName.value = file.name
    }

    const handleFdaDocumentUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      fdaApprovalFile.value = file
      fdaApprovalFileName.value = file.name
    }

    const savedBodyOverflow = ref('')
    const savedHtmlOverflow = ref('')
    let bodyScrollLockCount = 0

    const lockBodyScroll = (shouldLock) => {
      if (typeof document === 'undefined') return
      if (shouldLock) {
        if (bodyScrollLockCount === 0) {
          savedBodyOverflow.value = document.body.style.overflow
          savedHtmlOverflow.value = document.documentElement.style.overflow
        }
        bodyScrollLockCount += 1
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
        return
      }

      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow.value || ''
        document.documentElement.style.overflow = savedHtmlOverflow.value || ''
      }
    }

    const resetForm = () => {
      form.value = {
        postType: 'Service',
      serviceCategory: 'Other',
        productName: '',
      serviceName: '',
      consultationName: '',
      packageName: '',
      packageServiceIds: [],
        title: '',
        description: '',
        price: 0,
        discountPercent: 0,
        requiresConsultationFirst: false,
        linkedConsultationId: '',
        consultationFee: 0,
        consultationModes: ['on-site'],
        followUpAllowed: false,
        followUpWindowDays: 14,
        staffingRequirements: [],
      sessionCount: 1,
        durationMinutes: 60,
        productVolume: '',
        productUnit: '',
        fdaRegistrationNumber: '',
        termsAndConditions: '',
        requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
        packageServiceIds: []
      }
      imageFile.value = null
      imageFileName.value = ''
      fdaApprovalFile.value = null
      fdaApprovalFileName.value = ''
    }

    const resetEditState = () => {
      editTargetId.value = ''
      editForm.value = {
        postType: 'Service',
      serviceCategory: 'Other',
        name: '',
        title: '',
        description: '',
        price: 0,
        discountPercent: 0,
        requiresConsultationFirst: false,
        linkedConsultationId: '',
        consultationFee: 0,
        consultationModes: ['on-site'],
        followUpAllowed: false,
        followUpWindowDays: 14,
        durationMinutes: 60,
        productVolume: '',
        productUnit: '',
        fdaRegistrationNumber: '',
        termsAndConditions: '',
        requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
        packageServiceIds: []
      }
      editImageFile.value = null
      editImageFileName.value = ''
      editFdaApprovalFile.value = null
      editFdaApprovalFileName.value = ''
    }

    const listingAction = async (post, action) => {
      if (!canManageListingWorkflow.value) {
        toast.error('Only the clinic owner or a manager can submit or publish listings.')
        return
      }
      actionLoadingId.value = post.id
      try { await updateListingApproval(post.id, action); await loadPosts(); toast.success('Listing updated.') }
      catch (error) { toast.error(error.message) }
      finally { actionLoadingId.value = '' }
    }
    const loadPosts = trackPageLoad(async () => {
      if (!currentBranchId.value) {
        posts.value = []
        return
      }

      const postQuery = query(
        collection(db, 'productServicePosts'),
        where('branchId', '==', currentBranchId.value)
      )

      const snapshot = await getDocs(postQuery)
      posts.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((post) => post.archived !== true && (!isFreePlan.value || post.postType === 'Service'))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    })

    const loadInventoryProducts = trackPageLoad(async () => {
      if (!currentBranchId.value) {
        inventoryProducts.value = []
        return
      }

      const itemQuery = query(
        collection(db, 'inventoryItems'),
        where('branchId', '==', currentBranchId.value)
      )
      const snapshot = await getDocs(itemQuery)
      inventoryProducts.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((item) => Boolean(item.name))
    })

    const findSelectedProduct = () => {
      return inventoryProducts.value.find((item) => item.name === form.value.productName) || null
    }

    watch(
      () => [form.value.postType, form.value.productName],
      () => {
        if (form.value.postType !== 'Product') return
        const selected = findSelectedProduct()
      form.value.price = Number(selected?.unitPrice || 0)
      form.value.productVolume = String(selected?.volume || selected?.quantityLabel || '').trim()
      form.value.productUnit = String(selected?.unit || '').trim()
      }
    )

    watch(
      () => form.value.postType,
      (postType) => {
        if (postType === 'Service') {
          form.value.consultationName = ''
          return
        }
        if (postType === 'Consultation') {
          form.value.productName = ''
          form.value.serviceName = ''
          form.value.requiresConsultationFirst = false
          form.value.followUpAllowed = false
          form.value.followUpWindowDays = 14
          form.value.consultationFee = Math.max(0.01, Number(form.value.consultationFee || form.value.price || 0))
          form.value.durationMinutes = Math.max(1, Number(form.value.durationMinutes || 30))
          return
        }
        form.value.requiresConsultationFirst = false
        form.value.consultationFee = 0
        form.value.followUpAllowed = false
        form.value.followUpWindowDays = 14
        form.value.durationMinutes = 60
        form.value.consultationName = ''
      }
    )

    watch(
      () => [form.value.postType, form.value.requiresConsultationFirst],
      () => {
        if (form.value.postType !== 'Service' || form.value.requiresConsultationFirst) return
        form.value.consultationFee = 0
      }
    )

    watch(
      () => [form.value.postType, form.value.consultationFee],
      () => {
        if (form.value.postType !== 'Consultation') return
        form.value.price = Number(form.value.consultationFee || 0)
      }
    )

    watch(
      () => [editForm.value.postType, editForm.value.requiresConsultationFirst],
      () => {
        if (editForm.value.postType !== 'Service' || editForm.value.requiresConsultationFirst) return
        editForm.value.consultationFee = 0
      }
    )

    watch(
      () => [editForm.value.postType, editForm.value.consultationFee],
      () => {
        if (editForm.value.postType !== 'Consultation') return
        editForm.value.price = Number(editForm.value.consultationFee || 0)
      }
    )

    watch(isFreePlan, (free) => {
      if (free && form.value.postType !== 'Service') resetForm()
      if (free) form.value.requiresConsultationFirst = false
    }, { immediate: true })

    const createPost = async () => {
      const postType = form.value.postType
      const selectedName = postType === 'Product'
        ? form.value.productName
        : postType === 'Service'
          ? form.value.serviceName
          : postType === 'Consultation'
            ? form.value.consultationName
            : form.value.packageName
      const selectedProduct = postType === 'Product' ? findSelectedProduct() : null
      const packageComponents = postType === 'Package'
        ? (form.value.packageServiceIds || []).map((id) => posts.value.find((post) => post.id === id)).filter(Boolean)
        : []
      const packageFollowUpComponents = packageComponents.filter((post) => post.followUpAllowed === true)

      if (isFreePlan.value && postType !== 'Service') {
        toast.error('Free Plan supports service listings only. Upgrade to Basic to list products, consultations, or packages.')
        return
      }

      if (isFreePlan.value && form.value.requiresConsultationFirst) {
        toast.error('Free Plan supports direct service bookings only. Consultations and packages require Basic.')
        return
      }

      const postsCreated = 1
      if (isFreePlan.value && posts.value.length + postsCreated > FREE_PLAN_POST_LIMIT) {
        toast.error(`Free Plan allows up to ${FREE_PLAN_POST_LIMIT} listings. Archive a listing or upgrade to Basic to add more.`)
        return
      }

      if (!selectedName?.trim() || !form.value.description?.trim()) {
        toast.error('Please complete all required fields.')
        return
      }
      if (postType === 'Product' && !selectedProduct) {
        toast.error('Please select a valid product from inventory.')
        return
      }
      const numericError = validateListingNumbers(form.value)
      if (numericError) { toast.error(numericError); return }
      if (!imageFile.value) {
        toast.error('Please upload one image.')
        return
      }
      if (!currentBranchId.value || !currentUserId.value) {
        toast.error('User branch is not available.')
        return
      }
      if (form.value.postType === 'Consultation' && (!Array.isArray(form.value.consultationModes) || !form.value.consultationModes.length)) { toast.error('Choose at least one consultation mode.'); return }
      if (form.value.postType === 'Consultation' && normalizeConsultationModes(form.value.consultationModes).includes('online') && (!Number.isInteger(Number(form.value.durationMinutes)) || Number(form.value.durationMinutes) < 5 || Number(form.value.durationMinutes) > 240)) { toast.error('Online consultation duration must be a whole number from 5 to 240 minutes.'); return }
      if (postType !== 'Product' && Number(form.value.durationMinutes) <= 0) {
        toast.error('Please enter a valid duration.')
        return
      }
      if (postType === 'Package') {
        const selectedComponents = (form.value.packageServiceIds || [])
          .map((id) => posts.value.find((post) => post.id === id))
          .filter(Boolean)
        const consultationCount = selectedComponents.filter((post) => post.postType === 'Consultation').length
        const serviceCount = selectedComponents.filter((post) => post.postType === 'Service').length
        const packageVisits = Math.max(1, Number(form.value.sessionCount || 1))
        const validPackage = consultationCount <= 1 && ((consultationCount === 1 && serviceCount >= 1) || serviceCount >= 2 || (serviceCount === 1 && packageVisits > 1))
        if (!validPackage) {
          toast.error('A package must combine two services, pair a consultation with a service, or repeat one service across at least two package visits.')
          return
        }
        const packageSubtotal = packageComponents.reduce((sum, post) => sum + Number(post.price || post.consultationFee || 0) * Math.max(1, Number(post.sessionCount || 1)), 0) * Math.max(1, Number(form.value.sessionCount || 1))
        const packageDiscountPercent = Math.min(90, Math.max(0, Number(form.value.discountPercent || 0)))
        if (packageSubtotal <= 0 || packageSubtotal * (1 - packageDiscountPercent / 100) <= 0) {
          toast.error('Enter a package price greater than zero.')
          return
        }
      }
      if (postType === 'Service' && form.value.requiresConsultationFirst && !posts.value.some(post => post.id === form.value.linkedConsultationId && post.postType === 'Consultation' && post.isPublished === true && post.financeStatus === 'approved' && !post.archived)) {
        toast.error('Link an existing published online or on-site consultation before saving this service.');
        return
      }
      if (postType === 'Consultation' && Number(form.value.consultationFee) <= 0) {
        toast.error('Please enter a valid consultation fee.')
        return
      }

      loading.value = true
      try {
        const fileExt = imageFile.value.name.split('.').pop() || 'jpg'
        const path = `product-service-posts/${currentBranchId.value}/${Date.now()}.${fileExt}`
        const imageRef = storageRef(storage, path)
        await uploadBytes(imageRef, imageFile.value)
        const imageUrl = await getDownloadURL(imageRef)

        const postPayload = {
          ...newListingState(),
          inventoryItemId: selectedProduct?.id || null,
          postType,
          productName: postType === 'Product' ? selectedName.trim() : '',
          serviceName: postType === 'Service' ? selectedName.trim() : '',
          consultationName: postType === 'Consultation' ? selectedName.trim() : '',
          packageName: postType === 'Package' ? String(form.value.packageName || selectedName || '').trim() : '',
          packageServiceIds: postType === 'Package' ? [...(form.value.packageServiceIds || [])] : [],
          consultationModes: postType === 'Consultation'
            ? normalizeConsultationModes(form.value.consultationModes)
            : postType === 'Package'
              ? normalizeConsultationModes(packageComponents.filter(post => post.postType === 'Consultation').flatMap(post => normalizeConsultationModes(post.consultationModes, post.consultationMode)), 'on-site')
              : [],
          consultationMode: postType === 'Consultation'
            ? normalizeConsultationModes(form.value.consultationModes)[0]
            : postType === 'Package'
              ? normalizeConsultationModes(packageComponents.filter(post => post.postType === 'Consultation').flatMap(post => normalizeConsultationModes(post.consultationModes, post.consultationMode)), 'on-site')[0]
              : null,
          title: selectedName.trim(),
          description: form.value.description.trim(),
          serviceCategory: ['Service', 'Package'].includes(postType) ? normalizeServiceCategory(form.value.serviceCategory) : null,
          price: postType === 'Product'
            ? Number(selectedProduct?.unitPrice || 0)
            : postType === 'Package'
              ? Math.round(packageSubtotal * (1 - packageDiscountPercent / 100) * 100) / 100
              : Number(form.value.price || form.value.consultationFee || 0),
          discountPercent: postType === 'Package' ? packageDiscountPercent : 0,
          discountAmount: postType === 'Package' ? Math.round((packageSubtotal - packageSubtotal * (1 - packageDiscountPercent / 100)) * 100) / 100 : 0,
          requiresConsultationFirst: postType === 'Service' ? Boolean(form.value.requiresConsultationFirst) : false,
          linkedConsultationId: postType === 'Service' && form.value.requiresConsultationFirst ? form.value.linkedConsultationId : null,
          consultationFee: postType === 'Consultation' ? Number(form.value.consultationFee || 0) : null,
          followUpAllowed: postType === 'Service'
            ? Boolean(form.value.followUpAllowed)
            : postType === 'Package'
              ? packageFollowUpComponents.length > 0
              : false,
          followUpWindowDays: postType === 'Service' && form.value.followUpAllowed
            ? Math.max(1, Number(form.value.followUpWindowDays || 14))
            : postType === 'Package' && packageFollowUpComponents.length
              ? Math.min(...packageFollowUpComponents.map((post) => Number(post.followUpWindowDays || 14)))
              : null,
          consultationPolicy: { version: 2, graceMinutes: Math.min(30, Math.max(0, Number(form.value.consultationGraceMinutes ?? 10))), bufferMinutes: Math.min(45, Math.max(Number(form.value.consultationGraceMinutes ?? 10) + 5, Number(form.value.consultationBufferMinutes ?? 15))) },
          staffingRequirements: JSON.parse(JSON.stringify(form.value.staffingRequirements || [])),
          sessionCount: postType === 'Package' ? Math.min(50, Math.max(1, Number(form.value.sessionCount || 1))) : 1,
          sessionIntervalDays: postType === 'Package' && Number(form.value.sessionCount || 1) > 1 ? Math.min(365, Math.max(0, Number(form.value.sessionIntervalDays || 0))) : 0,
          durationMinutes: postType === 'Product' ? null : postType === 'Package'
            ? Math.max(1, (form.value.packageServiceIds || []).reduce((total, id) => total + Number(posts.value.find((post) => post.id === id)?.durationMinutes || 0), 0))
            : Math.max(1, Number(form.value.durationMinutes || 60)),
          productVolume: postType === 'Product' ? String(form.value.productVolume || '').trim() : '',
          productUnit: postType === 'Product' ? String(form.value.productUnit || '').trim() : '',
          fdaRegistrationNumber: postType === 'Product' ? String(selectedProduct?.fdaRegistrationNumber || '').trim() : '',
          fdaApprovalDocument: postType === 'Product' ? (selectedProduct?.fdaApprovalDocument || null) : null,
          termsAndConditions: '',
          allowInstallments: false,
          depositPercent: 100,
          requiredEquipmentIds: [...(form.value.requiredEquipmentIds || [])],
          requiredSupplyIds: postType === 'Service' ? [...(form.value.requiredSupplyIds || [])] : postType === 'Package'
            ? [...new Set((form.value.packageServiceIds || []).flatMap((id) => posts.value.find((post) => post.id === id)?.requiredSupplyIds || []))]
            : [],
          imageUrl,
          branchId: currentBranchId.value,
          createdBy: currentUserId.value,
          createdAt: serverTimestamp(),
        }

        await addDoc(collection(db, 'productServicePosts'), postPayload)
        await logActivity(db, {
          module: 'Manager',
          action: 'Created product/service post',
          details: `Created ${postType.toLowerCase()} post: ${selectedName.trim()}.`
        })

        toast.success(isFreePlan.value ? 'Service published and ready for online booking.' : 'Draft saved. Submit it for Finance review when ready.')
        resetForm()
        await loadPosts()
        listingSearch.value = ''
        activeListingTab.value = 'listings'
      } catch (error) {
        console.error(error)
        toast.error('Failed to create post.')
      } finally {
        loading.value = false
      }
    }

    const openEditPost = (post) => {
      editTargetId.value = post.id
      editForm.value = {
        postType: post.postType || 'Service',
        serviceCategory: normalizeServiceCategory(post.serviceCategory),
        name: post.productName || post.serviceName || post.consultationName || post.packageName || '',
        title: post.title || '',
        description: post.description || '',
        price: Number(post.price || 0),
        discountPercent: Number(post.discountPercent || 0),
        requiresConsultationFirst: Boolean(post.requiresConsultationFirst),
        linkedConsultationId: String(post.linkedConsultationId || ''),
        consultationFee: Number(post.consultationFee || post.price || 0),
        consultationModes: normalizeConsultationModes(post.consultationModes, post.consultationMode), consultationGraceMinutes: post.consultationPolicy?.graceMinutes ?? 10, consultationBufferMinutes: post.consultationPolicy?.bufferMinutes ?? 15,
        followUpAllowed: Boolean(post.followUpAllowed),
        followUpWindowDays: Number(post.followUpWindowDays || 14),
        staffingRequirements: JSON.parse(JSON.stringify(post.staffingRequirements || [])),
        sessionCount: Math.min(50, Math.max(1, Number(post.sessionCount || 1))),
        sessionIntervalDays: Math.min(365, Math.max(0, Number(post.sessionIntervalDays || 0))),
        durationMinutes: Number(post.durationMinutes || 60)
        , productVolume: String(post.productVolume || '').trim()
        , productUnit: String(post.productUnit || '').trim()
        , fdaRegistrationNumber: String(post.fdaRegistrationNumber || '').trim()
        , termsAndConditions: String(post.termsAndConditions || '').trim()
        , requiredEquipmentIds: post.requiredEquipmentIds || [], allowInstallments: post.allowInstallments === true, depositPercent: Number(post.depositPercent || 50), requiredSupplyIds: Array.isArray(post.requiredSupplyIds) ? [...post.requiredSupplyIds] : []
        , packageServiceIds: Array.isArray(post.packageServiceIds) ? [...post.packageServiceIds] : []
      }
      editImageFile.value = null
      editImageFileName.value = ''
      editFdaApprovalFile.value = null
      editFdaApprovalFileName.value = ''
      showEditModal.value = true
    }

    const closeEditModal = () => {
      showEditModal.value = false
      resetEditState()
    }

    const handleEditImageUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      editImageFile.value = file
      editImageFileName.value = file.name
    }

    const handleEditFdaDocumentUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      editFdaApprovalFile.value = file
      editFdaApprovalFileName.value = file.name
    }

    const saveEditedPost = async () => {
      if (!editTargetId.value) return
      if (!currentBranchId.value) {
        toast.error('User branch is not available.')
        return
      }
      if (isFreePlan.value && editForm.value.postType !== 'Service') {
        toast.error('Free Plan supports service listings only.')
        return
      }
      if (isFreePlan.value) editForm.value.requiresConsultationFirst = false
      if (!editForm.value.description?.trim() || !editForm.value.name?.trim()) {
        toast.error('Please complete all required fields.')
        return
      }
      const numericError = validateListingNumbers(editForm.value)
      if (numericError) { toast.error(numericError); return }
      if (editForm.value.postType === 'Package') {
        const selectedComponents = (editForm.value.packageServiceIds || [])
          .map((id) => posts.value.find((post) => post.id === id))
          .filter(Boolean)
        const consultationCount = selectedComponents.filter((post) => post.postType === 'Consultation').length
        const serviceCount = selectedComponents.filter((post) => post.postType === 'Service').length
        const packageVisits = Math.max(1, Number(editForm.value.sessionCount || 1))
        const validPackage = consultationCount <= 1 && ((consultationCount === 1 && serviceCount >= 1) || serviceCount >= 2 || (serviceCount === 1 && packageVisits > 1))
        if (!validPackage) {
          toast.error('A package must combine two services, pair a consultation with a service, or repeat one service across at least two package visits.')
          return
        }
        if (Number(editForm.value.price) <= 0) {
          toast.error('Enter a package price greater than zero.')
          return
        }
      }
      const editPackageComponents = editForm.value.postType === 'Package'
        ? (editForm.value.packageServiceIds || []).map((id) => posts.value.find((post) => post.id === id)).filter(Boolean)
        : []
      const editPackageFollowUpComponents = editPackageComponents.filter((post) => post.followUpAllowed === true)
      if (editForm.value.postType === 'Service' && editForm.value.requiresConsultationFirst && !posts.value.some(post => post.id === editForm.value.linkedConsultationId && post.postType === 'Consultation' && post.isPublished === true && post.financeStatus === 'approved' && !post.archived)) {
        toast.error('Link an existing published online or on-site consultation before saving this service.');
        return
      }
      if (editForm.value.postType === 'Consultation' && Number(editForm.value.consultationFee) <= 0) {
        toast.error('Please enter a valid consultation fee.')
        return
      }
      if (editForm.value.postType === 'Consultation' && (!Array.isArray(editForm.value.consultationModes) || !editForm.value.consultationModes.length)) { toast.error('Choose at least one consultation mode.'); return }
      if (editForm.value.postType === 'Consultation' && normalizeConsultationModes(editForm.value.consultationModes).includes('online') && (!Number.isInteger(Number(editForm.value.durationMinutes)) || Number(editForm.value.durationMinutes) < 5 || Number(editForm.value.durationMinutes) > 240)) { toast.error('Online consultation duration must be a whole number from 5 to 240 minutes.'); return }
      if (editForm.value.postType !== 'Product' && Number(editForm.value.durationMinutes) <= 0) {
        toast.error('Please enter a valid duration.')
        return
      }

      loading.value = true
      try {
        let nextImageUrl = ''
        const currentPost = posts.value.find((post) => post.id === editTargetId.value)
        if (currentPost) nextImageUrl = currentPost.imageUrl || ''

        if (editImageFile.value) {
          const fileExt = editImageFile.value.name.split('.').pop() || 'jpg'
          const path = `product-service-posts/${currentBranchId.value}/${Date.now()}.${fileExt}`
          const imageRef = storageRef(storage, path)
          await uploadBytes(imageRef, editImageFile.value)
          nextImageUrl = await getDownloadURL(imageRef)
        }

        const selectedProduct = inventoryProducts.value.find((item) => item.name === editForm.value.name) || null
        const payload = {
          title: editForm.value.name.trim(),
          description: editForm.value.description.trim(),
          serviceCategory: ['Service', 'Package'].includes(editForm.value.postType) ? normalizeServiceCategory(editForm.value.serviceCategory) : null,
          productName: editForm.value.postType === 'Product' ? editForm.value.name.trim() : '',
          serviceName: editForm.value.postType === 'Service' ? editForm.value.name.trim() : '',
          consultationName: editForm.value.postType === 'Consultation' ? editForm.value.name.trim() : '',
          packageName: editForm.value.postType === 'Package' ? editForm.value.name.trim() : '',
          packageServiceIds: editForm.value.postType === 'Package' ? [...(editForm.value.packageServiceIds || [])] : [],
          consultationModes: editForm.value.postType === 'Consultation'
            ? normalizeConsultationModes(editForm.value.consultationModes)
            : editForm.value.postType === 'Package'
              ? normalizeConsultationModes(editPackageComponents.filter(post => post.postType === 'Consultation').flatMap(post => normalizeConsultationModes(post.consultationModes, post.consultationMode)), 'on-site')
              : [],
          consultationMode: editForm.value.postType === 'Consultation'
            ? normalizeConsultationModes(editForm.value.consultationModes)[0]
            : editForm.value.postType === 'Package'
              ? normalizeConsultationModes(editPackageComponents.filter(post => post.postType === 'Consultation').flatMap(post => normalizeConsultationModes(post.consultationModes, post.consultationMode)), 'on-site')[0]
              : null,
          price: editForm.value.postType === 'Product'
            ? Number(selectedProduct?.unitPrice || editForm.value.price || 0)
            : editForm.value.postType === 'Package'
              ? Math.round(editPackageComponents.reduce((sum, post) => sum + Number(post.price || post.consultationFee || 0) * Math.max(1, Number(post.sessionCount || 1)), 0) * Math.max(1, Number(editForm.value.sessionCount || 1)) * (1 - Math.min(90, Math.max(0, Number(editForm.value.discountPercent || 0))) / 100) * 100) / 100
              : Number(editForm.value.price || editForm.value.consultationFee || 0),
          discountPercent: editForm.value.postType === 'Package' ? Math.min(90, Math.max(0, Number(editForm.value.discountPercent || 0))) : 0,
          discountAmount: editForm.value.postType === 'Package' ? Math.round((editPackageComponents.reduce((sum, post) => sum + Number(post.price || post.consultationFee || 0) * Math.max(1, Number(post.sessionCount || 1)), 0) * Math.max(1, Number(editForm.value.sessionCount || 1)) * Math.min(90, Math.max(0, Number(editForm.value.discountPercent || 0))) / 100) * 100) / 100 : 0,
          requiresConsultationFirst: editForm.value.postType === 'Service' && !isFreePlan.value ? Boolean(editForm.value.requiresConsultationFirst) : false,
          linkedConsultationId: editForm.value.postType === 'Service' && !isFreePlan.value && editForm.value.requiresConsultationFirst ? editForm.value.linkedConsultationId : null,
          consultationFee: editForm.value.postType === 'Consultation' ? Number(editForm.value.consultationFee || 0) : null,
          followUpAllowed: editForm.value.postType === 'Service'
            ? Boolean(editForm.value.followUpAllowed)
            : editForm.value.postType === 'Package'
              ? editPackageFollowUpComponents.length > 0
              : false,
          followUpWindowDays: editForm.value.postType === 'Service' && editForm.value.followUpAllowed
            ? Math.max(1, Number(editForm.value.followUpWindowDays || 14))
            : editForm.value.postType === 'Package' && editPackageFollowUpComponents.length
              ? Math.min(...editPackageFollowUpComponents.map((post) => Number(post.followUpWindowDays || 14)))
              : null,
          consultationPolicy: { version: 2, graceMinutes: Math.min(30, Math.max(0, Number(editForm.value.consultationGraceMinutes ?? 10))), bufferMinutes: Math.min(45, Math.max(Number(editForm.value.consultationGraceMinutes ?? 10) + 5, Number(editForm.value.consultationBufferMinutes ?? 15))) },
          staffingRequirements: JSON.parse(JSON.stringify(editForm.value.staffingRequirements || [])),
          sessionCount: ['Service', 'Package'].includes(editForm.value.postType)
            ? Math.min(50, Math.max(1, Number(editForm.value.sessionCount || 1)))
            : 1,
          sessionIntervalDays: ['Service', 'Package'].includes(editForm.value.postType) && Number(editForm.value.sessionCount || 1) > 1
            ? Math.min(365, Math.max(0, Number(editForm.value.sessionIntervalDays || 0)))
            : 0,
          durationMinutes: editForm.value.postType === 'Product'
            ? null
            : editForm.value.postType === 'Package'
              ? Math.max(1, editForm.value.packageServiceIds.reduce((total, id) => total + Number(posts.value.find((post) => post.id === id)?.durationMinutes || 0), 0))
              : Math.max(1, Number(editForm.value.durationMinutes || (editForm.value.postType === 'Consultation' ? 30 : 60))),
          productVolume: editForm.value.postType === 'Product' ? String(editForm.value.productVolume || '').trim() : '',
          productUnit: editForm.value.postType === 'Product' ? String(editForm.value.productUnit || '').trim() : '',
          fdaRegistrationNumber: editForm.value.postType === 'Product'
            ? String(selectedProduct?.fdaRegistrationNumber || currentPost?.fdaRegistrationNumber || '').trim()
            : '',
          fdaApprovalDocument: editForm.value.postType === 'Product'
            ? (selectedProduct?.fdaApprovalDocument || currentPost?.fdaApprovalDocument || null)
            : null,
          termsAndConditions: '',
          allowInstallments: false,
          depositPercent: 100,
          requiredEquipmentIds: [...(editForm.value.requiredEquipmentIds || [])],
          requiredSupplyIds: editForm.value.postType === 'Service' ? [...(editForm.value.requiredSupplyIds || [])] : editForm.value.postType === 'Package'
            ? [...new Set(editForm.value.packageServiceIds.flatMap((id) => posts.value.find((post) => post.id === id)?.requiredSupplyIds || []))]
            : [],
          updatedAt: serverTimestamp()
        }
        if (editForm.value.postType === 'Product') payload.inventoryItemId = selectedProduct?.id || currentPost?.inventoryItemId || null
        if (nextImageUrl) payload.imageUrl = nextImageUrl

        const existing = posts.value.find((post) => post.id === editTargetId.value) || {}
        if (financialTermsChanged(existing, { ...existing, ...payload })) Object.assign(payload, newListingState())
        await updateDoc(doc(db, 'productServicePosts', editTargetId.value), payload)
        await logActivity(db, {
          module: 'Manager',
          action: 'Updated product/service post',
          details: `Updated ${editForm.value.postType.toLowerCase()} post: ${editForm.value.name.trim()}.`
        })
        toast.success('Post updated successfully.')
        closeEditModal()
        await loadPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to update post.')
      } finally {
        loading.value = false
      }
    }

    const archivePost = async (post) => {
      const result = await Swal.fire({
        title: 'Archive Post?',
        text: `Archive "${post.title || 'this post'}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Archive',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      actionLoadingId.value = post.id
      try {
        const { id, ...postPayload } = post
        await setDoc(doc(db, 'archivedProductServicePosts', post.id), {
          ...postPayload,
          originalPostId: post.id,
          archivedAt: serverTimestamp(),
          archivedBy: currentUserId.value,
          updatedAt: serverTimestamp()
        })
        await deleteDoc(doc(db, 'productServicePosts', post.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Archived product/service post',
          details: `Archived post: ${post.title || post.id}.`
        })
        toast.success('Post archived.')
        await loadPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to archive post.')
      } finally {
        actionLoadingId.value = ''
      }
    }

    const deletePost = async (post) => {
      const result = await Swal.fire({
        title: 'Delete listing?',
        text: `Delete "${post.title || 'this listing'}"? This permanently removes the listing and cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete listing',
        cancelButtonText: 'Cancel',
        focusCancel: true,
        reverseButtons: true,
      })
      if (!result.isConfirmed) return

      actionLoadingId.value = post.id
      try {
        await deleteDoc(doc(db, 'productServicePosts', post.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Deleted product/service post',
          details: `Deleted post: ${post.title || post.id}.`
        })
        toast.success('Post deleted.')
        await loadPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to delete post.')
      } finally {
        actionLoadingId.value = ''
      }
    }

    let unsubscribeAuth = null
    let unsubscribePolicies = null

    watch(
      () => showEditModal.value,
      (isOpen) => {
        lockBodyScroll(isOpen)
      }
    )

    onMounted(trackPageLoad(() => {
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          clinicPolicies.value = {}
          contractBranch.value = {}
          unsubscribePolicies?.()
          unsubscribePolicies = null
          posts.value = []
          return
        }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        const currentClinic = await getDoc(doc(db, 'clinics', currentBranchId.value))
        contractBranch.value = currentClinic.exists() ? currentClinic.data() : {}
        const policyOwnerId = getClinicPolicyOwnerId(currentClinic.exists() ? currentClinic.data() : null, currentUserId.value)
        unsubscribePolicies?.()
        unsubscribePolicies = pageListener(onSnapshot, doc(db, 'clinicPolicies', policyOwnerId), (snapshot) => {
          clinicPolicies.value = snapshot.exists() ? snapshot.data() || {} : {}
        }, (error) => console.error('Unable to load active clinic policies:', error))

        await loadInventoryProducts()
        await loadPosts()
      })
    }))

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      unsubscribePolicies?.()
      lockBodyScroll(false)
    })

    return {
      pageLoading,
      listingAction,
      canManageListingWorkflow,
      loading,
      form,
      applicablePolicies,
      hasClientContract,
      listingContractPreview,
      isFreePlan,
      freePlanPostLimit: FREE_PLAN_POST_LIMIT,
      posts,
      activeListingTab,
      listingSearch,
      filteredListings,
      actionLoadingId,
      showEditModal,
      editForm,
      editImageFileName,
      editFdaApprovalFileName,
      imageFileName,
      fdaApprovalFileName,
      inventoryProducts,
      handleImageUpload,
      handleFdaDocumentUpload,
      handleEditImageUpload,
      handleEditFdaDocumentUpload,
      createPost,
      openEditPost,
      closeEditModal,
      saveEditedPost,
      archivePost,
      deletePost,
      resetForm,
      formatCurrency,
      formatDate
    }
  }
}
</script>

<style scoped>
.listing-page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.listing-eyebrow { margin-bottom: 8px; color: #b78055; font-size: 11px; letter-spacing: .15em; text-transform: uppercase; }
.service-listings-page .listing-primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; padding: 11px 18px; border: 1px solid #8d5a3b; border-radius: 10px; background: #8d5a3b; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 3px 8px #75482e1a; transition: background-color 150ms ease, box-shadow 150ms ease; }
.listing-primary-button svg { width: 18px; height: 18px; flex-shrink: 0; }
.service-listings-page .listing-primary-button:hover { background: #75482e; box-shadow: 0 4px 12px #75482e26; }
.service-listings-page .listing-primary-button:focus-visible { outline: 2px solid #b78055; outline-offset: 3px; }
.listing-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.listing-overview article { padding: 18px 20px; border: 1px solid #ead2b2; border-radius: 12px; background: #fffdf9; }
.listing-overview span { color: #8a725f; font-size: 12px; }
.listing-overview strong { display: block; margin-top: 8px; color: #3d281d; font-size: 26px; }
.listing-tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #ead2b2; }
.service-listings-page .listing-tabs button { padding: 12px 18px; border: 0; border-bottom: 3px solid transparent; border-radius: 0; background: transparent; color: #a58a73; font-size: 14px; font-weight: 600; }
.service-listings-page .listing-tabs button.is-active { color: #91643f; border-bottom-color: #b78055; }
.listing-policy-panel { margin-bottom: 24px; border: 1px solid #ead2b2; border-radius: 12px; background: #fffdf9; color: #3d281d; overflow: hidden; }
.service-listings-page .listing-disclosure-trigger { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; margin: 0; padding: 16px 20px; list-style: none; background: #fffaf3; color: #543a29; font-size: 14px; font-weight: 600; cursor: pointer; }
.listing-disclosure-trigger::-webkit-details-marker { display: none; }
.listing-disclosure-trigger::marker { content: ''; }
.listing-disclosure-trigger small { display: inline-block; margin-left: 8px; padding: 3px 8px; border-radius: 999px; background: #eee1d0; color: #62432d; font-size: 11px; font-weight: 500; }
.listing-disclosure-trigger svg { width: 20px; height: 20px; flex-shrink: 0; color: #91643f; transition: transform 150ms ease; }
details[open] > .listing-disclosure-trigger { border-bottom: 1px solid #ead2b2; }
details[open] > .listing-disclosure-trigger svg { transform: rotate(180deg); }
.listing-disclosure-trigger:hover { background: #f7ead7; }
.listing-disclosure-trigger:focus-visible { outline: 2px solid #b78055; outline-offset: -3px; }
.listing-policy-content { padding: 20px; }
.listing-policy-description { color: #6b5342; font-size: 13px; line-height: 1.7; }
.listing-policy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.listing-policy-grid article { padding: 16px; border: 1px solid #ead2b2; border-radius: 10px; background: #fffaf3; }
.listing-policy-grid h3 { color: #543a29; font-size: 14px; font-weight: 600; }
.listing-policy-grid p { margin-top: 8px; color: #6b5342; font-size: 13px; line-height: 1.7; }
.listing-contract-disclosure { border: 1px solid #ead2b2; border-radius: 10px; background: #fffdf9; overflow: hidden; }
.listing-contract-preview-body { padding: 20px; }
@media (max-width: 640px) { .listing-policy-grid { grid-template-columns: minmax(0, 1fr); }.listing-policy-content, .listing-contract-preview-body { padding: 16px; }.service-listings-page .listing-disclosure-trigger { padding: 16px; } }
.listing-create-panel, .listing-records-panel { border-color: #ead2b2 !important; box-shadow: 0 4px 16px #3d281d05; }
.listing-section-description { margin-bottom: 24px; color: #8a725f; font-size: 13px; line-height: 1.6; }
.listing-create-panel label, .listing-edit-heading ~ div label { font-size: 13px; }
.listing-post-type { margin: 0; }
.listing-post-type :deep(label) { margin-bottom: 4px; color: #6b5342; font-weight: 400; }
.service-listings-page main :is(input:not([type=checkbox]), select, textarea) { min-height: 44px; font-size: 13px; color-scheme: light; }
.service-listings-page main textarea { line-height: 1.7; resize: vertical; }
.service-listings-page main select[multiple] { min-height: 130px; background: #fffdf9 !important; color: #3d281d !important; padding: 6px; }
.service-listings-page main select option { padding: 8px 10px; background: #fffdf9; color: #3d281d; }
.service-listings-page main input[type=checkbox] { accent-color: #97603c; }
.service-listings-page main input[type=file] { padding: 8px; border-style: dashed; }
.service-listings-page main input[type=file]::file-selector-button { padding: 7px 12px; border: 0; border-radius: 6px; background: #f4e7d5; color: #805432; cursor: pointer; }
.service-listings-page main button[class*="bg-blue-"] { background: #8d5a3b !important; border-color: #8d5a3b !important; color: #fff !important; }
.service-listings-page main button[class*="bg-blue-"]:hover:not(:disabled) { background: #75482e !important; }
.service-listings-page main button[class*="bg-slate-"] { background: #fffaf3 !important; color: #73533d !important; border: 1px solid #dec19e; }
.service-listings-page main button[class*="bg-amber-"] { background: #f4e7d5 !important; color: #805432 !important; border: 1px solid #dec19e; }
.service-listings-page main button[class*="bg-red-"] { background: #fbe9e6 !important; color: #a12d22 !important; border: 1px solid #e8b9ae; }
.service-listings-page main button[class*="bg-emerald-"] { background: #e4f2e9; color: #28765c; border: 1px solid #bbd8c6; }
.listing-records-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.listing-records-heading p { margin-top: 6px; color: #8a725f; font-size: 12px; }
.listing-records-heading input { width: min(100%, 360px); padding: 10px 12px; border: 1px solid #dec19e; border-radius: 10px; }
.listing-card { display: flex; flex-direction: column; border-color: #ead2b2 !important; border-radius: 14px; transition: box-shadow 150ms ease; }
.listing-card:hover { box-shadow: 0 8px 24px #3d281d0d; }
.listing-card > img { height: 180px; }
.listing-image-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 180px; background: #f7ead7; color: #b78055; }
.listing-image-placeholder svg { width: 40px; height: 40px; }
.listing-image-placeholder span { font-size: 12px; }
.listing-card-body { display: flex; flex-direction: column; flex: 1; padding: 20px; }
.listing-card-body h3 { color: #3d281d; font-size: 18px; }
.listing-detail-badge { display: inline-flex; align-items: center; padding: 5px 10px; border: 1px solid #dfc7a9; border-radius: 999px; background: #f7ead7; color: #62432d; font-size: 12px; font-weight: 600; line-height: 1.4; }
.listing-type-badge { background: #eee1d0; color: #543a29; border-color: #d9bfa0; }
.listing-follow-up-badge { background: #e4f2e9; color: #235b45; border-color: #b8d6c4; }
.listing-card .listing-card-body :is(.text-slate-400, .text-slate-300) { color: #6b5342 !important; }
.listing-card .listing-card-body p.text-sm { font-size: 14px; }
.listing-card .listing-card-body p.listing-card-price { font-size: 20px; }
.listing-card .listing-card-body span.text-xs { font-size: 12px; }
.listing-card .listing-card-body p:is(.text-amber-200, .text-orange-200) { color: #765032 !important; line-height: 1.6; }
.listing-card .listing-card-body .listing-publication-status { font-size: 12px; color: #684329; }
.listing-card .listing-card-body .listing-publication-status.is-published { color: #235b45; }
.listing-publication-status { width: fit-content; padding: 5px 9px; border-radius: 999px; background: #f4e7d5; color: #805432; font-size: 11px; }
.listing-publication-status.is-published { background: #e4f2e9; color: #28765c; }
.listing-card-description { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6; }
.listing-card .listing-card-price { color: #28765c !important; font-size: 20px; margin-top: auto; padding-top: 12px; }
.listing-card-actions { padding-top: 16px; border-top: 1px solid #ead2b2; }
.listing-card-actions button { min-height: 36px; padding: 7px 12px; font-size: 12px; }
.listing-empty-state { padding: 48px 20px; border: 1px dashed #dec19e; border-radius: 12px; text-align: center; background: #fffaf3; }
.listing-empty-state h3 { color: #3d281d; font-size: 18px; font-weight: 600; }
.listing-empty-state p { margin: 8px 0 20px; color: #8a725f; font-size: 13px; }
.listing-edit-heading { position: relative; padding-right: 64px; }
.listing-edit-heading > button { position: absolute; top: 20px; right: 20px; padding: 8px; border-radius: 8px; color: #73533d; background: #fffaf3; border: 1px solid #dec19e; }
.listing-edit-heading > button svg { width: 18px; height: 18px; }
.listing-edit-heading > p { margin-top: 8px; color: #8a725f; font-size: 12px; line-height: 1.6; }
@media (max-width: 640px) { .listing-overview { gap: 8px; }.listing-overview article { padding: 14px 10px; }.listing-overview strong { font-size: 22px; }.listing-records-heading input { width: 100%; }.listing-page-heading > button { width: 100%; }.listing-card-body { padding: 16px; } }
.listing-client-contract { margin-bottom: 24px; padding: 20px; border: 1px solid #ead2b2; border-radius: 12px; background: #fffaf3; color: #3d281d; }
.listing-client-contract h2 { font-size: 18px; font-weight: 700; }
.listing-client-contract p { margin-top: 8px; color: #6b5342; font-size: 13px; line-height: 1.7; }
.listing-client-contract details { margin-top: 16px; }
.listing-client-contract .listing-contract-preview-note { margin-bottom: 16px; font-size: 12px; }
</style>
