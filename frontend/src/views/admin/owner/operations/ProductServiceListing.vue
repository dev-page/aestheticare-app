<template>
  <div class="flex module-theme service-listings-page bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: activeListingTab === 'create' ? 'form' : 'cards', cards: 6, fields: 8 }" class="min-w-0 flex-1 p-4 md:p-8 text-white">
      <div class="listing-page-heading mb-6">
        <div><p class="listing-eyebrow">Clinic services</p>
        <h1 class="text-2xl md:text-3xl font-bold mb-1">Service Listings</h1>
        <p class="text-slate-400">{{ canDirectPublishListings ? 'Publish your own listings directly. Employee-created listings still need Finance review.' : 'Save drafts and submit financial terms to Finance for review before publishing.' }}</p>
        </div><button v-if="activeListingTab === 'listings' && canCreateListing" type="button" class="listing-primary-button" @click="activeListingTab = 'create'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg><span>Create listing</span></button>
      </div>

      <p v-if="!canViewListings && !canCreateListing" class="listing-empty-state">You do not have permission to view or create service listings.</p>
      <div v-if="activeListingTab === 'listings' && canViewListings" class="listing-overview"><article><span>Total listings</span><strong>{{ posts.length }}</strong></article><article><span>Published</span><strong>{{ posts.filter(post => post.isPublished).length }}</strong></article><article><span>Unpublished</span><strong>{{ posts.filter(post => !post.isPublished).length }}</strong></article></div>
      <nav v-if="canViewListings || canCreateListing" class="listing-tabs" aria-label="Service listing sections"><button v-if="canViewListings" type="button" :class="{ 'is-active': activeListingTab === 'listings' }" :aria-pressed="activeListingTab === 'listings'" @click="activeListingTab = 'listings'">Listings</button><button v-if="canCreateListing" type="button" :class="{ 'is-active': activeListingTab === 'create' }" :aria-pressed="activeListingTab === 'create'" @click="activeListingTab = 'create'">Create Listing</button></nav>

      <details v-if="activeListingTab === 'listings' && canViewListings && applicablePolicies.length" class="listing-policy-panel">
        <summary class="listing-disclosure-trigger"><span>Applicable branch policies <small>{{ applicablePolicies.length }} enabled</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" /></svg></summary>
        <div class="listing-policy-content"><p class="listing-policy-description">These rules are configured in Policy &amp; Contract Management and apply automatically when this listing is booked. Branch policy links determine which rules apply. They cannot be edited per listing.</p>
        <div class="listing-policy-grid"><article v-for="policy in applicablePolicies" :key="policy.key"><h3>{{ policy.label }}</h3><p>{{ policy.text }}</p></article></div></div>
      </details>

      <section v-if="activeListingTab === 'listings' && canViewListings" class="listing-client-contract">
        <div class="listing-client-contract-heading">
          <div>
            <h2>Client Contract</h2>
            <p v-if="hasClientContract">Your clinic's saved Client Contract applies automatically to services, consultations, and packages booked online or as walk-ins. Each booking includes the applicable branch policies, additional clinic terms, and saved appearance. You do not need to create a separate contract for each listing.</p>
            <p v-else>Save a Client Contract in Policy &amp; Contract Management to apply it automatically to online and walk-in bookings for your listings.</p>
          </div>
          <button v-if="hasClientContract" type="button" class="listing-contract-pdf-button" :disabled="contractPdfLoading" @click="openContractPdf">
            {{ contractPdfLoading ? 'Preparing PDF...' : 'Open contract PDF' }}
          </button>
        </div>
        <details v-if="hasClientContract" class="listing-contract-disclosure"><summary class="listing-disclosure-trigger"><span>Preview applied contract</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" /></svg></summary><div class="listing-contract-preview-body"><p class="listing-contract-preview-note">This preview uses this branch's linked clinic service policies. The booked service details are added to each customer's agreement. Existing agreements retain their saved content and design.</p><ClientContractDocument :document="listingContractPreview" /></div></details>
      </section>

      <div v-if="activeListingTab === 'create' && canCreateListing" class="listing-create-panel bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
        <h2 class="text-lg font-semibold mb-2">Create listing</h2><p class="listing-section-description">Add the service details, booking rules, and resources needed for each appointment.</p>

        <ServiceListingFields :model="form" :disabled="loading" :inventory-products="inventoryProducts" :posts="posts" :image-file-name="imageFileName" @image-change="handleImageUpload" />

        <div class="flex gap-2">
          <button
            @click="createPost(false)"
            :disabled="loading"
            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Posting...' : 'Save Draft' }}
          </button>
          <button
            v-if="canDirectPublishListings"
            type="button"
            @click="createPost(true)"
            :disabled="loading"
            class="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Publishing...' : 'Save & Publish' }}
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

      <div v-if="activeListingTab === 'listings' && canViewListings" class="listing-records-panel bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
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
              <p class="listing-publication-status mb-2 text-sm font-semibold" :class="{ 'is-published': post.isPublished }">{{ post.isPublished && post.financeStatus === 'approved' ? 'Published' : post.financeStatus === 'approved' ? (post.approvalMethod === 'owner_direct' ? 'Owner/Admin approved - awaiting publication' : 'Finance approved - awaiting publication') : post.financeStatus === 'pending' ? 'Awaiting Finance review' : post.financeStatus === 'rejected' ? 'Changes requested' : 'Draft' }}</p>
              <p v-if="post.financeReview?.note" class="mb-2 text-sm">Finance: {{ post.financeReview.note }}</p>
              <div class="mb-3 flex flex-wrap gap-2">
                <button v-if="canDirectPublishPost(post)" :disabled="!!actionLoadingId" @click="listingAction(post, 'publish')" class="rounded bg-emerald-700 px-3 py-2 text-sm">{{ actionLoadingId === post.id ? 'Publishing...' : 'Publish' }}</button>
                <button v-else-if="canManageListingWorkflow && (!post.financeStatus || ['draft', 'rejected'].includes(post.financeStatus))" :disabled="!!actionLoadingId" @click="listingAction(post, 'submit')" class="rounded bg-blue-700 px-3 py-2 text-sm">{{ actionLoadingId === post.id ? 'Submitting...' : 'Submit to Finance' }}</button>
                <button v-if="canManageListingWorkflow && post.financeStatus === 'approved' && !post.isPublished" :disabled="!!actionLoadingId" @click="listingAction(post, 'publish')" class="rounded bg-emerald-700 px-3 py-2 text-sm">{{ actionLoadingId === post.id ? 'Publishing...' : 'Publish' }}</button>
                <button v-if="canManageListingWorkflow && post.isPublished" :disabled="!!actionLoadingId" @click="listingAction(post, 'unpublish')" class="rounded bg-slate-700 px-3 py-2 text-sm">{{ actionLoadingId === post.id ? 'Unpublishing...' : 'Unpublish' }}</button>
              </div>
              <p class="text-sm text-slate-300 mb-1">{{ post.productName || post.serviceName || post.consultationName || post.packageName }}</p>
              <p v-if="post.postType === 'Package'" class="mb-2 text-xs text-amber-200">
                {{ post.packageKind === 'treatment-course' ? 'Multi-session treatment' : post.packageKind === 'consultation-service' ? 'Consultation + service' : post.packageKind === 'service-combo' ? 'Service combo' : 'Treatment course' }} · {{ listingVisitCount(post) }} visits.
              </p>
              <ol v-if="post.postType === 'Package' && post.treatmentCourseSteps?.length" class="mb-2 list-inside list-decimal space-y-1 text-xs text-slate-400"><li v-for="(step, index) in post.treatmentCourseSteps" :key="`${step.serviceId}-${index}`">{{ posts.find(item => item.id === step.serviceId)?.title || posts.find(item => item.id === step.serviceId)?.serviceName || posts.find(item => item.id === step.serviceId)?.consultationName || 'Unavailable listing' }} Â· {{ step.visitCount }} visit(s)</li></ol>
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
                  Fee â‚±{{ Number(post.consultationFee || post.price || 0).toFixed(2) }}
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
              <p v-if="['Service', 'Consultation', 'Package'].includes(post.postType)" class="mt-1 text-xs text-emerald-300">{{ post.vatPriceMode === 'inclusive' ? 'Includes 12% VAT' : '+12% VAT at checkout' }}</p>
              <div class="listing-card-actions mt-3">
                <button v-if="canUpdateListing"
                  @click="openEditPost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="listing-action-button listing-action-edit"
                >
                  {{ actionLoadingId === post.id ? 'Processing...' : 'Edit' }}
                </button>
                <button v-if="canDisableListing"
                  @click="archivePost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="listing-action-button listing-action-archive"
                >
                  {{ actionLoadingId === post.id ? 'Archiving...' : 'Archive' }}
                </button>
                <button v-if="canDisableListing"
                  @click="deletePost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="listing-action-button listing-action-delete"
                >
                  {{ actionLoadingId === post.id ? 'Deleting...' : 'Delete' }}
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
            <p class="text-sm text-amber-300">Price or booking changes may require Finance review before publishing. The listing type stays the same.</p>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <ServiceListingFields :model="editForm" editing :disabled="loading" :inventory-products="inventoryProducts" :posts="posts" :image-file-name="editImageFileName" @image-change="handleEditImageUpload" />
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
                {{ loading ? 'Saving changes...' : 'Save Changes' }}
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
import { getClinicPolicyOwnerId } from '@/utils/clinicPolicies'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import ServiceListingFields from '@/components/common/ServiceListingFields.vue'
import { normalizeServiceCategory } from '../../../../../../shared/serviceCategories.js'
import { normalizeTreatmentCourseSteps, treatmentCourseVisitCount, validateServicePackageComposition, SERVICE_PACKAGE_KINDS } from '../../../../../../shared/treatmentCourse.js'
import { onlinePolicy } from '../../../../../../shared/onlineConsultation.js'
import { buildClientContractDocument, clientContractPolicies } from '../../../../../../shared/clientContract.js'
import { createClientContractPdf } from '@/utils/clientContractPdf'

export default {
  name: 'ProductServiceListing',
  components: { OwnerSidebar, ClientContractDocument, ServiceListingFields },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const storage = getStorage(getApp())
    const auth = getAuth(getApp())
    const { hasPermission, isClinicAdminOwner, userRole } = usePermissions()
    const canViewListings = computed(() => hasPermission('services:view'))
    const canCreateListing = computed(() => hasPermission('services:create'))
    const canUpdateListing = computed(() => hasPermission('services:update'))
    const canDisableListing = computed(() => hasPermission('services:disable'))
    const canManageListingWorkflow = computed(() => isClinicAdminOwner.value || canUpdateListing.value)
    const canDirectPublishListings = computed(() => canManageListingWorkflow.value && (isClinicAdminOwner.value || userRole.value === 'Clinic Admin'))
    const canDirectPublishPost = (post) => canDirectPublishListings.value
      && post?.createdBy === currentUserId.value
      && post?.requiresFinanceReview !== true
      && ['draft', ''].includes(String(post?.financeStatus || 'draft'))

    const loading = ref(false)
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const clinicPolicies = ref({})
    const contractBranch = ref({})
    const contractPdfLoading = ref(false)
    const hasClientContract = computed(() => clinicPolicies.value.clientContract?.configured === true)
    const listingContractPreview = computed(() => buildClientContractDocument(clinicPolicies.value, { branch: contractBranch.value }))
    const applicablePolicies = computed(() => clientContractPolicies(clinicPolicies.value, { branch: contractBranch.value })
      .map(policy => ({ ...policy, label: policy.title })))

    const inventoryProducts = ref([])

    const posts = ref([])
    const activeListingTab = ref(canViewListings.value ? 'listings' : 'create')
    watch([canViewListings, canCreateListing], ([canView, canCreate]) => {
      if (activeListingTab.value === 'listings' && !canView && canCreate) activeListingTab.value = 'create'
      if (activeListingTab.value === 'create' && !canCreate && canView) activeListingTab.value = 'listings'
    })
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
      return draftListing()
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
      vatApplicable: false,
      vatPriceMode: 'exclusive',
      discountPercent: 0,
      packageKind: SERVICE_PACKAGE_KINDS.TREATMENT_COURSE,
      packageConsultationId: '',
      packageServiceId: '',
      requiresConsultationFirst: false,
        linkedConsultationId: '',
      sameDayConsultationAllowed: false,
      sameDayConsultationBufferMinutes: 15,
      consultationFee: 0,
      consultationModes: ['on-site'], consultationGraceMinutes: 15,
      followUpAllowed: false,
      followUpWindowDays: 14,
      staffingRequirements: [],
      sessionCount: 1,
      sessionIntervalDays: 1,
      durationMinutes: 60,
      productVolume: '',
      productUnit: '',
      fdaRegistrationNumber: '',
      termsAndConditions: '',
      requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
      packageServiceIds: []
      , treatmentCourseSteps: [], legacyMultiSessionService: false
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
      packageKind: SERVICE_PACKAGE_KINDS.TREATMENT_COURSE,
      packageConsultationId: '',
      packageServiceId: '',
      treatmentCourseSteps: [],
      title: '',
      description: '',
      price: 0,
      vatApplicable: false,
      vatPriceMode: 'exclusive',
      discountPercent: 0,
      requiresConsultationFirst: false,
        linkedConsultationId: '',
      sameDayConsultationAllowed: false,
      sameDayConsultationBufferMinutes: 15,
      consultationFee: 0,
      consultationModes: ['on-site'],
      consultationGraceMinutes: 15,
      followUpAllowed: false,
      followUpWindowDays: 14,
      staffingRequirements: [],
      sessionCount: 1,
      sessionIntervalDays: 1,
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
        currency: 'PHP', currencyDisplay: 'symbol'
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
    const validConsultationModes = (modes) => Array.isArray(modes)
      ? [...new Set(modes.map(value => String(value || '').trim().toLowerCase()).filter(mode => ['online', 'on-site'].includes(mode)))]
      : []
    const normalizeConsultationModes = (modes, legacyMode = 'online') => {
      const normalized = validConsultationModes(modes)
      return normalized.length ? normalized : [normalizeConsultationMode(legacyMode)]
    }
    const consultationPolicyForGrace = (values) => {
      const rawGrace = values?.consultationGraceMinutes
      const graceMinutes = rawGrace === '' || rawGrace === null || rawGrace === undefined ? 15 : Number(rawGrace)
      const policy = onlinePolicy({ graceMinutes })
      return { version: policy.version, graceMinutes: policy.graceMinutes }
    }
    const validateRequiredListingFields = (values, { name, selectedProduct = null, imageReady = true, requiresNewImage = false } = {}) => {
      const postType = values?.postType
      if (!['Product', 'Service', 'Consultation', 'Package'].includes(postType)) return 'Choose a post type.'
      if (!String(name || '').trim()) return 'Enter a listing name.'
      if (!String(values.description || '').trim()) return 'Enter a description.'
      if (postType === 'Product' && !selectedProduct) return 'Select a valid product from inventory.'
      if (requiresNewImage && !imageReady) return 'Upload one image.'
      if (postType === 'Consultation') {
        const modes = validConsultationModes(values.consultationModes)
        if (!modes.length) return 'Choose at least one consultation mode.'
        const fee = Number(values.consultationFee)
        if (!Number.isFinite(fee) || fee <= 0) return 'Enter a consultation fee greater than zero.'
        const duration = Number(values.durationMinutes)
        if (!Number.isInteger(duration) || duration <= 0) return 'Enter a whole-number consultation duration greater than zero.'
        if (modes.includes('online') && (duration < 5 || duration > 240)) return 'Online consultation duration must be a whole number from 5 to 240 minutes.'
        const rawGrace = values.consultationGraceMinutes
        if (rawGrace !== '' && rawGrace !== null && rawGrace !== undefined && (!Number.isInteger(Number(rawGrace)) || Number(rawGrace) < 0 || Number(rawGrace) > 30)) return 'Arrival grace must be a whole number from 0 to 30 minutes.'
      }
      if (postType === 'Service') {
        const duration = Number(values.durationMinutes)
        if (!Number.isInteger(duration) || duration <= 0) return 'Enter a whole-number service duration greater than zero.'
      }
      return ''
    }
    const sameDayConfigurationError = values => {
      if (values.sameDayConsultationAllowed !== true) return ''
      const buffer = Number(values.sameDayConsultationBufferMinutes ?? 15)
      if (!Number.isInteger(buffer) || buffer < 0 || buffer > 60) return 'Set the same-day buffer to a whole number from 0 to 60 minutes.'
      if (values.postType !== 'Service' || values.requiresConsultationFirst !== true) return 'Same-day requests require a service with a required consultation.'
      const linked = posts.value.find(post => post.id === values.linkedConsultationId)
      if (!linked || linked.postType !== 'Consultation' || linked.isPublished !== true || linked.financeStatus !== 'approved' || linked.archived || !normalizeConsultationModes(linked.consultationModes, linked.consultationMode).includes('on-site')) {
        return 'Choose a published linked consultation that supports on-site appointments.'
      }
      return ''
    }
    const courseStepsForListing = (listing) => {
      if (Array.isArray(listing?.treatmentCourseSteps) && listing.treatmentCourseSteps.length) {
        return normalizeTreatmentCourseSteps(listing.treatmentCourseSteps)
      }
      const ids = Array.isArray(listing?.packageServiceIds) ? listing.packageServiceIds : []
      const cycles = Math.min(50, Math.max(1, Number(listing?.sessionCount || 1)))
      const steps = []
      for (let cycle = 0; cycle < cycles; cycle += 1) for (const id of ids) {
        const component = posts.value.find(post => post.id === id)
        steps.push({
          serviceId: id,
          visitCount: Math.min(50, Math.max(1, Number(component?.sessionCount || 1))),
          minimumGapDays: Math.min(365, Math.max(1, Number(component?.sessionIntervalDays || listing.sessionIntervalDays || 1))),
        })
      }
      return steps
    }
    const packageStepsForValues = (values) => {
      const kind = String(values?.packageKind || '').trim()
      const gap = Math.max(1, Math.min(365, Number(values?.sessionIntervalDays || 1)))
      if (kind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE) return []
      if (kind === SERVICE_PACKAGE_KINDS.CONSULTATION_SERVICE) {
        return [values?.packageConsultationId, values?.packageServiceId]
          .filter(Boolean)
          .map(serviceId => ({ serviceId: String(serviceId), visitCount: 1, minimumGapDays: gap }))
      }
      if (kind === SERVICE_PACKAGE_KINDS.SERVICE_COMBO) {
        return [...new Set((values?.packageServiceIds || []).map(id => String(id || '').trim()).filter(Boolean))]
          .map(serviceId => ({ serviceId, visitCount: 1, minimumGapDays: gap }))
      }
      return normalizeTreatmentCourseSteps(values?.treatmentCourseSteps)
    }
    const packageComponentsForValues = (values, steps = packageStepsForValues(values)) =>
      values?.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
        ? [{ ...values, id: 'treatment-course', postType: 'Service' }]
        : courseComponentsForSteps(steps)
    const packageCourseErrorForValues = (values, steps = packageStepsForValues(values)) =>
      validateServicePackageComposition({
        packageKind: values?.packageKind,
        steps,
        servicesById: new Map(packageComponentsForValues(values, steps).map(component => [component.id, component])),
        sessionCount: values?.sessionCount,
        sessionIntervalDays: values?.sessionIntervalDays,
      })
    const inferPackageKind = (post, steps = courseStepsForListing(post)) => {
      const savedKind = String(post?.packageKind || '').trim()
      if (Object.values(SERVICE_PACKAGE_KINDS).includes(savedKind)) return savedKind
      const ids = [...new Set((post?.packageServiceIds || steps.map(step => step.serviceId)).filter(Boolean).map(String))]
      const components = ids.map(id => posts.value.find(item => item.id === id)).filter(Boolean)
      if (ids.length === 1 && components[0]?.postType === 'Service') return SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
      const normalizedSteps = normalizeTreatmentCourseSteps(steps)
      if (normalizedSteps.length === 2 && normalizedSteps.every(step => step.visitCount === 1)
        && components.find(item => item.id === normalizedSteps[0].serviceId)?.postType === 'Consultation'
        && components.find(item => item.id === normalizedSteps[1].serviceId)?.postType === 'Service') return SERVICE_PACKAGE_KINDS.CONSULTATION_SERVICE
      if (components.length >= 2 && components.every(item => item.postType === 'Service')) return SERVICE_PACKAGE_KINDS.SERVICE_COMBO
      return 'legacy-course'
    }
    const courseComponentsForSteps = (steps) => [...new Set((steps || []).map(step => String(step.serviceId || '').trim()).filter(Boolean))]
      .map(id => posts.value.find(post => post.id === id)).filter(Boolean)
    const packageSubtotalForSteps = (steps) => (steps || []).reduce((sum, step) => {
      const component = posts.value.find(post => post.id === step.serviceId)
      return sum + Number(component?.price || component?.consultationFee || 0) * Math.max(0, Number(step.visitCount) || 0)
    }, 0)
    const listingVisitCount = (listing) => listing?.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
      ? Math.max(1, Number(listing.sessionCount || 1))
      : Array.isArray(listing?.treatmentCourseSteps) && listing.treatmentCourseSteps.length
      ? treatmentCourseVisitCount(listing.treatmentCourseSteps)
      : Math.max(1, Number(listing?.sessionCount || 1)) * (listing?.packageServiceIds || []).reduce((sum, id) => sum + Math.max(1, Number(posts.value.find(post => post.id === id)?.sessionCount || 1)), 0)

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
        vatApplicable: false,
        vatPriceMode: 'exclusive',
        discountPercent: 0,
        packageKind: SERVICE_PACKAGE_KINDS.TREATMENT_COURSE,
        packageConsultationId: '',
        packageServiceId: '',
        requiresConsultationFirst: false,
        linkedConsultationId: '',
        sameDayConsultationAllowed: false,
        sameDayConsultationBufferMinutes: 15,
        consultationFee: 0,
        consultationModes: ['on-site'],
        consultationGraceMinutes: 15,
        followUpAllowed: false,
        followUpWindowDays: 14,
        staffingRequirements: [],
      sessionCount: 1,
        sessionIntervalDays: 1,
        durationMinutes: 60,
        productVolume: '',
        productUnit: '',
        fdaRegistrationNumber: '',
        termsAndConditions: '',
        requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
        packageServiceIds: [], treatmentCourseSteps: []
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
        vatApplicable: false,
        vatPriceMode: 'exclusive',
        discountPercent: 0,
        packageKind: SERVICE_PACKAGE_KINDS.TREATMENT_COURSE,
        packageConsultationId: '',
        packageServiceId: '',
        requiresConsultationFirst: false,
        linkedConsultationId: '',
        sameDayConsultationAllowed: false,
        sameDayConsultationBufferMinutes: 15,
        consultationFee: 0,
        consultationModes: ['on-site'],
        consultationGraceMinutes: 15,
        followUpAllowed: false,
        followUpWindowDays: 14,
        sessionCount: 1,
        sessionIntervalDays: 1,
        durationMinutes: 60,
        productVolume: '',
        productUnit: '',
        fdaRegistrationNumber: '',
        termsAndConditions: '',
        requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
        packageServiceIds: [], treatmentCourseSteps: []
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
        .filter((post) => post.archived !== true)
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
        if (form.value.postType === 'Service' && form.value.requiresConsultationFirst) return
        form.value.sameDayConsultationAllowed = false
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
        if (editForm.value.postType === 'Service' && editForm.value.requiresConsultationFirst) return
        editForm.value.sameDayConsultationAllowed = false
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

    const createPost = async (publishAfterSave = false) => {
      if (!canCreateListing.value) {
        toast.error('You do not have permission to create service listings.')
        return
      }
      if (publishAfterSave && !canDirectPublishListings.value) {
        toast.error('Only a clinic owner or Clinic Admin can publish their own listing directly.')
        return
      }
      const postType = form.value.postType
      const selectedName = postType === 'Product'
        ? form.value.productName
        : postType === 'Service'
          ? form.value.serviceName
          : postType === 'Consultation'
            ? form.value.consultationName
            : form.value.packageName
      const selectedProduct = postType === 'Product' ? findSelectedProduct() : null
      const courseSteps = postType === 'Package' ? packageStepsForValues(form.value) : []
      const packageComponents = postType === 'Package' ? packageComponentsForValues(form.value, courseSteps) : []
      const packageSubtotal = postType === 'Package'
        ? form.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Number(form.value.price || 0) : packageSubtotalForSteps(courseSteps)
        : 0
      const packageDiscountPercent = postType === 'Package' && form.value.packageKind !== SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Math.min(90, Math.max(0, Number(form.value.discountPercent || 0))) : 0
      const packageFollowUpComponents = packageComponents.filter((post) => post.followUpAllowed === true)

      const requiredFieldsError = validateRequiredListingFields(form.value, { name: selectedName, selectedProduct, imageReady: Boolean(imageFile.value), requiresNewImage: true })
      if (requiredFieldsError) { toast.error(requiredFieldsError); return }
      const numericError = validateListingNumbers(form.value)
      if (numericError) { toast.error(numericError); return }
      if (!currentBranchId.value || !currentUserId.value) {
        toast.error('User branch is not available.')
        return
      }
      if (postType === 'Package') {
        const courseError = packageCourseErrorForValues(form.value, courseSteps)
        if (courseError) {
          toast.error(courseError)
          return
        }
        if (packageSubtotal <= 0 || packageSubtotal * (1 - packageDiscountPercent / 100) <= 0) {
          toast.error('Enter a package price greater than zero.')
          return
        }
      }
      if (postType === 'Service' && form.value.requiresConsultationFirst && !posts.value.some(post => post.id === form.value.linkedConsultationId && post.postType === 'Consultation' && post.isPublished === true && post.financeStatus === 'approved' && !post.archived)) {
        toast.error('Link an existing published online or on-site consultation before saving this service.');
        return
      }
      const sameDayError = sameDayConfigurationError(form.value)
      if (sameDayError) { toast.error(sameDayError); return }

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
          packageKind: postType === 'Package' ? form.value.packageKind : null,
          packageServiceIds: postType === 'Package' ? [...new Set(courseSteps.map(step => step.serviceId))] : [],
          treatmentCourseSteps: postType === 'Package' && form.value.packageKind !== SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? courseSteps : null,
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
              ? form.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
                ? Math.round(packageSubtotal * 100) / 100
                : Math.round(packageSubtotal * (1 - packageDiscountPercent / 100) * 100) / 100
              : Number(form.value.price || form.value.consultationFee || 0),
          vatApplicable: postType !== 'Product',
          vatPriceMode: 'exclusive',
          discountPercent: postType === 'Package' ? packageDiscountPercent : 0,
          discountAmount: postType === 'Package' ? Math.round((packageSubtotal - packageSubtotal * (1 - packageDiscountPercent / 100)) * 100) / 100 : 0,
          requiresConsultationFirst: postType === 'Service' ? Boolean(form.value.requiresConsultationFirst) : false,
          linkedConsultationId: postType === 'Service' && form.value.requiresConsultationFirst ? form.value.linkedConsultationId : null,
          sameDayConsultationAllowed: postType === 'Service' ? Boolean(form.value.sameDayConsultationAllowed) : false,
          sameDayConsultationBufferMinutes: postType === 'Service' && form.value.sameDayConsultationAllowed ? Number(form.value.sameDayConsultationBufferMinutes ?? 15) : 15,
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
          consultationPolicy: consultationPolicyForGrace(form.value),
          staffingRequirements: JSON.parse(JSON.stringify((form.value.staffingRequirements || []).filter(row => row.responsibility === 'lead').slice(0, 1).map(row => ({ ...row, count: 1 })))),
          sessionCount: postType === 'Package' ? form.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Number(form.value.sessionCount || 0) : treatmentCourseVisitCount(courseSteps) : 1,
          sessionIntervalDays: postType === 'Package' ? form.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Number(form.value.sessionIntervalDays || 0) : Math.max(1, ...courseSteps.map(step => step.minimumGapDays)) : 0,
          durationMinutes: postType === 'Product' ? null : postType === 'Package'
            ? form.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
              ? Math.max(1, Number(form.value.durationMinutes || 60))
              : Math.max(1, Number(posts.value.find(post => post.id === courseSteps[0]?.serviceId)?.durationMinutes || 60))
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
            ? [...new Set(packageComponents.flatMap(post => post.requiredSupplyIds || []))]
            : [],
          imageUrl,
          branchId: currentBranchId.value,
          createdBy: currentUserId.value,
          createdAt: serverTimestamp(),
        }

        const createdPost = await addDoc(collection(db, 'productServicePosts'), postPayload)
        let publishError = ''
        if (publishAfterSave) {
          try {
            await updateListingApproval(createdPost.id, 'publish')
          } catch (error) {
            publishError = error?.message || 'The listing could not be published yet.'
          }
        }
        await logActivity(db, {
          module: 'Manager',
          action: 'Created product/service post',
          details: `Created ${postType.toLowerCase()} post: ${selectedName.trim()}.`
        })

        if (publishError) toast.error(`Draft saved, but it could not be published: ${publishError}`)
        else toast.success(publishAfterSave
          ? 'Listing published.'
          : canDirectPublishListings.value
            ? 'Draft saved. Publish it directly or submit it for Finance review when ready.'
            : 'Draft saved. Submit it for Finance review when ready.')
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
      if (!canUpdateListing.value) return
      editTargetId.value = post.id
      const savedCourseSteps = post.postType === 'Package' ? courseStepsForListing(post) : []
      const packageKind = post.postType === 'Package' ? inferPackageKind(post, savedCourseSteps) : SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
      editForm.value = {
        postType: post.postType || 'Service',
        serviceCategory: normalizeServiceCategory(post.serviceCategory),
        name: post.productName || post.serviceName || post.consultationName || post.packageName || '',
        title: post.title || '',
        description: post.description || '',
        price: Number(post.price || 0),
        vatApplicable: post.vatApplicable === true,
        vatPriceMode: post.vatPriceMode === 'inclusive' ? 'inclusive' : 'exclusive',
        discountPercent: Number(post.discountPercent || 0),
        requiresConsultationFirst: Boolean(post.requiresConsultationFirst),
        linkedConsultationId: String(post.linkedConsultationId || ''),
        sameDayConsultationAllowed: post.sameDayConsultationAllowed === true,
        sameDayConsultationBufferMinutes: Number.isInteger(Number(post.sameDayConsultationBufferMinutes)) ? Number(post.sameDayConsultationBufferMinutes) : 15,
        consultationFee: Number(post.consultationFee || post.price || 0),
        consultationModes: normalizeConsultationModes(post.consultationModes, post.consultationMode), consultationGraceMinutes: post.consultationPolicy?.graceMinutes ?? 15,
        followUpAllowed: Boolean(post.followUpAllowed),
        followUpWindowDays: Number(post.followUpWindowDays || 14),
        staffingRequirements: JSON.parse(JSON.stringify(post.staffingRequirements || [])),
        sessionCount: post.postType === 'Package' ? packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Math.max(2, treatmentCourseVisitCount(savedCourseSteps) || Number(post.sessionCount || 2)) : treatmentCourseVisitCount(savedCourseSteps) : 1,
        sessionIntervalDays: post.postType === 'Package' ? Math.max(1, Number(post.sessionIntervalDays || 0), ...savedCourseSteps.map(step => step.minimumGapDays)) : 0,
        legacyMultiSessionService: post.postType === 'Service' && Number(post.sessionCount || 1) > 1,
        durationMinutes: Number(post.durationMinutes || 60)
        , productVolume: String(post.productVolume || '').trim()
        , productUnit: String(post.productUnit || '').trim()
        , fdaRegistrationNumber: String(post.fdaRegistrationNumber || '').trim()
        , termsAndConditions: String(post.termsAndConditions || '').trim()
        , requiredEquipmentIds: post.requiredEquipmentIds || [], allowInstallments: post.allowInstallments === true, depositPercent: Number(post.depositPercent || 50), requiredSupplyIds: Array.isArray(post.requiredSupplyIds) ? [...post.requiredSupplyIds] : []
        , packageKind
        , packageConsultationId: packageKind === SERVICE_PACKAGE_KINDS.CONSULTATION_SERVICE ? String(savedCourseSteps[0]?.serviceId || '') : ''
        , packageServiceId: packageKind === SERVICE_PACKAGE_KINDS.CONSULTATION_SERVICE ? String(savedCourseSteps[1]?.serviceId || '') : ''
        , packageServiceIds: post.postType === 'Package'
          ? (packageKind === SERVICE_PACKAGE_KINDS.SERVICE_COMBO ? [...new Set((post.packageServiceIds || savedCourseSteps.map(step => step.serviceId)).filter(Boolean))] : [...new Set(savedCourseSteps.map(step => step.serviceId))])
          : (Array.isArray(post.packageServiceIds) ? [...post.packageServiceIds] : [])
        , treatmentCourseSteps: post.postType === 'Package' ? savedCourseSteps : []
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
      if (!canUpdateListing.value) return
      if (!editTargetId.value) return
      if (!currentBranchId.value) {
        toast.error('User branch is not available.')
        return
      }
      const selectedProduct = editForm.value.postType === 'Product'
        ? inventoryProducts.value.find(item => item.name === editForm.value.name) || null
        : null
      const currentPost = posts.value.find(post => post.id === editTargetId.value)
      const requiredFieldsError = validateRequiredListingFields(editForm.value, { name: editForm.value.name, selectedProduct })
      if (requiredFieldsError) { toast.error(requiredFieldsError); return }
      const editCourseSteps = editForm.value.postType === 'Package' ? packageStepsForValues(editForm.value) : []
      const editPackageComponents = editForm.value.postType === 'Package' ? packageComponentsForValues(editForm.value, editCourseSteps) : []
      const editPackageSubtotal = editForm.value.postType === 'Package'
        ? editForm.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Number(editForm.value.price || 0) : packageSubtotalForSteps(editCourseSteps)
        : 0
      const editPackageDiscountPercent = editForm.value.postType === 'Package' && editForm.value.packageKind !== SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Math.min(90, Math.max(0, Number(editForm.value.discountPercent || 0))) : 0
      const numericError = validateListingNumbers(editForm.value)
      if (numericError) { toast.error(numericError); return }
      if (editForm.value.postType === 'Package') {
        const courseError = packageCourseErrorForValues(editForm.value, editCourseSteps)
        if (courseError) {
          toast.error(courseError)
          return
        }
        if (editPackageSubtotal <= 0 || editPackageSubtotal * (1 - editPackageDiscountPercent / 100) <= 0) {
          toast.error('Enter a package price greater than zero.')
          return
        }
      }
      const editPackageFollowUpComponents = editPackageComponents.filter((post) => post.followUpAllowed === true)
      if (editForm.value.postType === 'Service' && editForm.value.requiresConsultationFirst && !posts.value.some(post => post.id === editForm.value.linkedConsultationId && post.postType === 'Consultation' && post.isPublished === true && post.financeStatus === 'approved' && !post.archived)) {
        toast.error('Link an existing published online or on-site consultation before saving this service.');
        return
      }
      const sameDayError = sameDayConfigurationError(editForm.value)
      if (sameDayError) { toast.error(sameDayError); return }
      loading.value = true
      try {
        let nextImageUrl = ''
        if (currentPost) nextImageUrl = currentPost.imageUrl || ''

        if (editImageFile.value) {
          const fileExt = editImageFile.value.name.split('.').pop() || 'jpg'
          const path = `product-service-posts/${currentBranchId.value}/${Date.now()}.${fileExt}`
          const imageRef = storageRef(storage, path)
          await uploadBytes(imageRef, editImageFile.value)
          nextImageUrl = await getDownloadURL(imageRef)
        }

        const payload = {
          title: editForm.value.name.trim(),
          description: editForm.value.description.trim(),
          serviceCategory: ['Service', 'Package'].includes(editForm.value.postType) ? normalizeServiceCategory(editForm.value.serviceCategory) : null,
          productName: editForm.value.postType === 'Product' ? editForm.value.name.trim() : '',
          serviceName: editForm.value.postType === 'Service' ? editForm.value.name.trim() : '',
          consultationName: editForm.value.postType === 'Consultation' ? editForm.value.name.trim() : '',
          packageName: editForm.value.postType === 'Package' ? editForm.value.name.trim() : '',
          packageKind: editForm.value.postType === 'Package' ? editForm.value.packageKind : null,
          packageServiceIds: editForm.value.postType === 'Package' ? [...new Set(editCourseSteps.map(step => step.serviceId))] : [],
          treatmentCourseSteps: editForm.value.postType === 'Package' && editForm.value.packageKind !== SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? editCourseSteps : null,
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
              ? editForm.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
                ? Math.round(editPackageSubtotal * 100) / 100
                : Math.round(editPackageSubtotal * (1 - editPackageDiscountPercent / 100) * 100) / 100
              : Number(editForm.value.price || editForm.value.consultationFee || 0),
          vatApplicable: editForm.value.postType !== 'Product',
          vatPriceMode: editForm.value.vatPriceMode === 'inclusive' ? 'inclusive' : 'exclusive',
          discountPercent: editPackageDiscountPercent,
          discountAmount: editForm.value.postType === 'Package' ? Math.round(editPackageSubtotal * editPackageDiscountPercent / 100 * 100) / 100 : 0,
          requiresConsultationFirst: editForm.value.postType === 'Service' ? Boolean(editForm.value.requiresConsultationFirst) : false,
          linkedConsultationId: editForm.value.postType === 'Service' && editForm.value.requiresConsultationFirst ? editForm.value.linkedConsultationId : null,
          sameDayConsultationAllowed: editForm.value.postType === 'Service' ? Boolean(editForm.value.sameDayConsultationAllowed) : false,
          sameDayConsultationBufferMinutes: editForm.value.postType === 'Service' && editForm.value.sameDayConsultationAllowed ? Number(editForm.value.sameDayConsultationBufferMinutes ?? 15) : 15,
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
          consultationPolicy: consultationPolicyForGrace(editForm.value),
          staffingRequirements: JSON.parse(JSON.stringify((editForm.value.staffingRequirements || []).filter(row => row.responsibility === 'lead').slice(0, 1).map(row => ({ ...row, count: 1 })))),
          sessionCount: editForm.value.postType === 'Package' ? editForm.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Number(editForm.value.sessionCount || 0) : treatmentCourseVisitCount(editCourseSteps) : 1,
          sessionIntervalDays: editForm.value.postType === 'Package' ? editForm.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE ? Number(editForm.value.sessionIntervalDays || 0) : Math.max(1, ...editCourseSteps.map(step => step.minimumGapDays)) : 0,
          durationMinutes: editForm.value.postType === 'Product'
            ? null
            : editForm.value.postType === 'Package'
              ? editForm.value.packageKind === SERVICE_PACKAGE_KINDS.TREATMENT_COURSE
                ? Math.max(1, Number(editForm.value.durationMinutes || 60))
                : Math.max(1, Number(posts.value.find(post => post.id === editCourseSteps[0]?.serviceId)?.durationMinutes || 60))
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
            ? [...new Set(editPackageComponents.flatMap(post => post.requiredSupplyIds || []))]
            : [],
          updatedAt: serverTimestamp()
        }
        if (editForm.value.postType === 'Product') payload.inventoryItemId = selectedProduct?.id || currentPost?.inventoryItemId || null
        if (nextImageUrl) payload.imageUrl = nextImageUrl

        const existing = posts.value.find((post) => post.id === editTargetId.value) || {}
        if (financialTermsChanged(existing, { ...existing, ...payload })) Object.assign(payload, newListingState(), { requiresFinanceReview: true })
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
      if (!canDisableListing.value) return
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
      if (!canDisableListing.value) return
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

    const openContractPdf = async () => {
      const pdfTab = window.open('about:blank', '_blank')
      if (!pdfTab) {
        toast.error('Allow pop-ups to open the contract PDF.')
        return
      }

      pdfTab.opener = null
      contractPdfLoading.value = true
      try {
        const blob = await createClientContractPdf(listingContractPreview.value)
        const pdfUrl = URL.createObjectURL(blob)
        pdfTab.location.replace(pdfUrl)
        window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
      } catch (error) {
        console.error('Unable to create client contract PDF:', error)
        pdfTab.close()
        toast.error('Unable to open the contract PDF right now.')
      } finally {
        contractPdfLoading.value = false
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
      canDirectPublishListings,
      canDirectPublishPost,
      canViewListings,
      canCreateListing,
      canUpdateListing,
      canDisableListing,
      loading,
      form,
      applicablePolicies,
      hasClientContract,
      listingContractPreview,
      contractPdfLoading,
      openContractPdf,
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
      formatDate,
      listingVisitCount
    }
  }
}
</script>

<style scoped>
.service-listings-page { background: var(--ac-bg) !important; color: var(--ac-text) !important; }
.service-listings-page main { color: var(--ac-text) !important; }
.listing-page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.listing-page-heading h1 { color: var(--ac-text) !important; }
.listing-eyebrow { margin-bottom: 8px; color: var(--ac-accent) !important; font-size: 11px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }

.service-listings-page .listing-primary-button,
.service-listings-page .listing-contract-pdf-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  min-height: 44px; padding: 10px 16px; border: 1px solid var(--ac-primary);
  border-radius: var(--ac-radius-md); background: var(--ac-primary); color: var(--ac-on-primary);
  font-size: 13px; font-weight: 650; cursor: pointer; box-shadow: var(--ac-shadow-sm);
  transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}
.listing-primary-button svg { width: 18px; height: 18px; flex-shrink: 0; }
.service-listings-page .listing-primary-button:hover:not(:disabled),
.service-listings-page .listing-contract-pdf-button:hover:not(:disabled) {
  border-color: var(--ac-primary-hover); background: var(--ac-primary-hover); transform: translateY(-1px);
}
.service-listings-page :is(.listing-primary-button, .listing-contract-pdf-button):focus-visible { outline: 2px solid var(--ac-accent); outline-offset: 3px; }
.service-listings-page :is(.listing-primary-button, .listing-contract-pdf-button):disabled { cursor: wait; opacity: .65; }

.listing-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.listing-overview article { padding: 18px 20px; border: 1px solid var(--ac-border); border-radius: var(--ac-radius-md); background: var(--ac-surface) !important; color: var(--ac-text); }
.listing-overview span { color: var(--ac-text-muted) !important; font-size: 12px; }
.listing-overview strong { display: block; margin-top: 8px; color: var(--ac-text) !important; font-size: 26px; }
.listing-tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid var(--ac-border); }
.service-listings-page .listing-tabs button { min-height: 44px; padding: 12px 18px; border: 0; border-bottom: 3px solid transparent; border-radius: 0; background: transparent; color: var(--ac-text-muted); font-size: 14px; font-weight: 600; }
.service-listings-page .listing-tabs button:hover { color: var(--ac-text) !important; background: var(--ac-surface-muted); }
.service-listings-page .listing-tabs button.is-active { color: var(--ac-primary) !important; border-bottom-color: var(--ac-accent); }

.listing-policy-panel,
.listing-client-contract,
.listing-create-panel,
.listing-records-panel {
  border: 1px solid var(--ac-border) !important; border-radius: var(--ac-radius-lg);
  background: var(--ac-surface) !important; color: var(--ac-text) !important; box-shadow: var(--ac-shadow-sm);
}
.listing-policy-panel { margin-bottom: 24px; overflow: hidden; }
.service-listings-page .listing-disclosure-trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; margin: 0;
  padding: 16px 20px; list-style: none; border: 0; background: var(--ac-surface-soft); color: var(--ac-text-secondary) !important;
  font-size: 14px; font-weight: 650; text-align: left; cursor: pointer;
}
.listing-disclosure-trigger::-webkit-details-marker { display: none; }
.listing-disclosure-trigger::marker { content: ''; }
.listing-disclosure-trigger small { display: inline-block; margin-left: 8px; padding: 3px 8px; border-radius: 999px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 11px; font-weight: 600; }
.listing-disclosure-trigger svg { width: 20px; height: 20px; flex-shrink: 0; color: var(--ac-accent); transition: transform 150ms ease; }
details[open] > .listing-disclosure-trigger { border-bottom: 1px solid var(--ac-border); }
details[open] > .listing-disclosure-trigger svg { transform: rotate(180deg); }
.listing-disclosure-trigger:hover { background: var(--ac-surface-muted); }
.listing-disclosure-trigger:focus-visible { outline: 2px solid var(--ac-accent); outline-offset: -3px; }
.listing-policy-content { padding: 20px; }
.listing-policy-description { color: var(--ac-text-muted) !important; font-size: 13px; line-height: 1.7; }
.listing-policy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.listing-policy-grid article { padding: 16px; border: 1px solid var(--ac-border); border-radius: var(--ac-radius-md); background: var(--ac-surface-soft) !important; }
.listing-policy-grid h3 { color: var(--ac-text-secondary) !important; font-size: 14px; font-weight: 650; }
.listing-policy-grid p { margin-top: 8px; color: var(--ac-text-muted) !important; font-size: 13px; line-height: 1.7; }

.listing-client-contract { margin-bottom: 24px; padding: 20px; }
.listing-client-contract-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.listing-client-contract h2 { color: var(--ac-text) !important; font-size: 18px; font-weight: 700; }
.listing-client-contract p { margin-top: 8px; color: var(--ac-text-muted) !important; font-size: 13px; line-height: 1.7; }
.listing-client-contract details { margin-top: 16px; border: 1px solid var(--ac-border); border-radius: var(--ac-radius-md); background: var(--ac-surface); overflow: hidden; }
.listing-contract-preview-body { padding: 20px; }
.listing-client-contract .listing-contract-preview-note { margin: 0 0 16px; font-size: 12px; }

.listing-create-panel, .listing-records-panel { padding: 20px; }
.listing-section-description { margin-bottom: 24px; color: var(--ac-text-muted) !important; font-size: 13px; line-height: 1.6; }
.listing-create-panel h2, .listing-records-panel h2 { color: var(--ac-text) !important; }
.listing-create-panel label, .listing-edit-heading ~ div label { font-size: 13px; }
.listing-post-type { margin: 0; }
.listing-post-type :deep(label) { margin-bottom: 4px; color: var(--ac-text-muted) !important; font-weight: 400; }
.service-listings-page main :is(input:not([type="checkbox"]), select, textarea) {
  min-height: 44px; border-color: var(--ac-border-strong) !important; background-color: var(--ac-surface) !important;
  color: var(--ac-text) !important; font-size: 13px;
}
.service-listings-page main textarea { line-height: 1.7; resize: vertical; }
.service-listings-page main select[multiple] { min-height: 130px; padding: 6px; }
.service-listings-page main select option { padding: 8px 10px; background: var(--ac-surface); color: var(--ac-text); }
.service-listings-page main input[type="checkbox"] { accent-color: var(--ac-accent); }
.service-listings-page main input[type="file"] { padding: 8px; border-style: dashed; }
.service-listings-page main input[type="file"]::file-selector-button { padding: 7px 12px; border: 1px solid var(--ac-border); border-radius: 6px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); cursor: pointer; }
.listing-records-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.listing-records-heading p { margin-top: 6px; color: var(--ac-text-muted) !important; font-size: 12px; }
.listing-records-heading input { width: min(100%, 360px); padding: 10px 12px; border-radius: var(--ac-radius-md); }

.listing-card { display: flex; flex-direction: column; border: 1px solid var(--ac-border) !important; border-radius: var(--ac-radius-lg); background: var(--ac-surface) !important; color: var(--ac-text) !important; overflow: hidden; transition: box-shadow 150ms ease, transform 150ms ease; }
.listing-card:hover { box-shadow: var(--ac-shadow-md); transform: translateY(-1px); }
.listing-card > img { height: 180px; }
.listing-image-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 180px; background: var(--ac-surface-muted); color: var(--ac-accent); }
.listing-image-placeholder svg { width: 40px; height: 40px; }
.listing-image-placeholder span { font-size: 12px; }
.listing-card-body { display: flex; flex-direction: column; flex: 1; padding: 20px; }
.listing-card .listing-card-body h3 { color: var(--ac-text) !important; font-size: 18px; }
.listing-detail-badge { display: inline-flex; align-items: center; padding: 5px 10px; border: 1px solid var(--ac-border); border-radius: 999px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 12px; font-weight: 650; line-height: 1.4; }
.listing-type-badge { background: var(--ac-surface-muted); color: var(--ac-text-secondary); }
.listing-follow-up-badge { background: var(--ac-success-bg); color: var(--ac-success); border-color: color-mix(in srgb, var(--ac-success) 40%, var(--ac-border)); }
.listing-card .listing-card-body :is(.text-slate-400, .text-slate-300) { color: var(--ac-text-muted) !important; }
.listing-card .listing-card-body p.text-sm { font-size: 14px; }
.listing-card .listing-card-body span.text-xs { font-size: 12px; }
.listing-card .listing-card-body p:is(.text-amber-200, .text-orange-200) { color: var(--ac-warning-text) !important; line-height: 1.6; }
.listing-card .listing-publication-status { font-size: 12px; color: var(--ac-text-secondary) !important; }
.listing-publication-status { width: fit-content; padding: 5px 9px; border-radius: 999px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 11px; }
.listing-publication-status.is-published { background: var(--ac-success-bg); color: var(--ac-success); }
.listing-card .listing-card-price { color: var(--ac-success) !important; font-size: 20px; margin-top: auto; padding-top: 12px; }
.listing-card-actions { display: flex; gap: 8px; width: 100%; padding-top: 16px; border-top: 1px solid var(--ac-border); }
.listing-card-actions .listing-action-button {
  display: inline-flex; flex: 1 1 0; min-width: 0; min-height: 40px; align-items: center; justify-content: center;
  padding: 7px 6px; border: 1px solid var(--ac-border); border-radius: var(--ac-radius-sm); background: var(--ac-surface-muted);
  color: var(--ac-text-secondary); font-size: 12px; font-weight: 650; white-space: nowrap; cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, transform 150ms ease;
}
.listing-card-actions .listing-action-edit:hover:not(:disabled) { border-color: var(--ac-border-strong); background: var(--ac-surface-soft); color: var(--ac-text); }
.listing-card-actions .listing-action-archive { border-color: color-mix(in srgb, var(--ac-warning) 45%, var(--ac-border)); background: var(--ac-warning-bg); color: var(--ac-warning-text); }
.listing-card-actions .listing-action-archive:hover:not(:disabled) { border-color: var(--ac-warning); background: color-mix(in srgb, var(--ac-warning-bg) 82%, var(--ac-warning) 18%); }
.listing-card-actions .listing-action-delete { border-color: color-mix(in srgb, var(--ac-danger) 48%, var(--ac-border)); background: var(--ac-danger-bg); color: var(--ac-danger); }
.listing-card-actions .listing-action-delete:hover:not(:disabled) { border-color: var(--ac-danger); background: color-mix(in srgb, var(--ac-danger-bg) 82%, var(--ac-danger) 18%); }
.listing-card-actions .listing-action-button:disabled { cursor: not-allowed; opacity: .55; }
.listing-card-actions .listing-action-button:focus-visible { outline: 2px solid var(--ac-accent); outline-offset: 2px; }

.listing-empty-state { padding: 48px 20px; border: 1px dashed var(--ac-border-strong); border-radius: var(--ac-radius-md); background: var(--ac-surface-soft) !important; color: var(--ac-text); text-align: center; }
.listing-empty-state h3 { color: var(--ac-text) !important; font-size: 18px; font-weight: 650; }
.listing-empty-state p { margin: 8px 0 20px; color: var(--ac-text-muted) !important; font-size: 13px; }
.listing-edit-modal { background: var(--ac-surface) !important; border-color: var(--ac-border) !important; color: var(--ac-text) !important; }
.listing-edit-heading { position: relative; padding-right: 64px; border-color: var(--ac-border) !important; }
.listing-edit-heading h3 { color: var(--ac-text) !important; }
.listing-edit-heading > button { position: absolute; top: 20px; right: 20px; padding: 8px; border-radius: 8px; color: var(--ac-text-secondary); background: var(--ac-surface-soft); border: 1px solid var(--ac-border); }
.listing-edit-heading > button svg { width: 18px; height: 18px; }
.listing-edit-heading > p { margin-top: 8px; color: var(--ac-warning-text) !important; font-size: 12px; line-height: 1.6; }
.listing-edit-modal > :last-child { border-color: var(--ac-border) !important; }

:global(html[data-ac-theme="dark"] .aestheticare-app) .service-listings-page .listing-contract-disclosure :deep(.client-agreement) {
  background: #fff !important; color: #352a24 !important;
}
:global(html[data-ac-theme="dark"] .aestheticare-app) .service-listings-page .listing-contract-disclosure :deep(.client-agreement :is(p, li, strong, em)) {
  color: #352a24 !important;
}
:global(html[data-ac-theme="dark"] .aestheticare-app) .service-listings-page .listing-contract-disclosure :deep(.client-agreement :is(h2, h3)) {
  color: var(--agreement-heading) !important;
}

@media (max-width: 640px) {
  .listing-overview { gap: 8px; }
  .listing-overview article { padding: 14px 10px; }
  .listing-overview strong { font-size: 22px; }
  .listing-records-heading input { width: 100%; }
  .listing-page-heading > button { width: 100%; }
  .listing-client-contract-heading { flex-direction: column; align-items: stretch; }
  .listing-client-contract-heading .listing-contract-pdf-button { width: 100%; }
  .listing-policy-grid { grid-template-columns: minmax(0, 1fr); }
  .listing-policy-content, .listing-contract-preview-body { padding: 16px; }
  .service-listings-page .listing-disclosure-trigger { padding: 16px; }
  .listing-card-body, .listing-create-panel, .listing-records-panel { padding: 16px; }
}

@media (max-width: 360px) {
  .listing-card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .listing-card-actions .listing-action-button { width: 100%; }
}
</style>
