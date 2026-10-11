<template>
  <div class="flex module-theme finance-page listing-approvals-page min-h-screen">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, blocks: [{ variant: 'cards', cardStyle: 'stat', cards: 3 }, { variant: 'table', columns: 6, rows: 5 }] }" class="min-w-0 flex-1 p-6">
      <header class="listing-review-heading"><p>Finance</p><h1>Listing Approvals</h1><p class="listing-review-intro">Review listing prices and payment terms before the clinic publishes them.</p></header>
      <p v-if="error" role="alert" class="listing-review-error">{{ error }}</p>
      <div class="finance-summary listing-review-summary">
        <article><span><i class="review-dot is-pending" aria-hidden="true"></i>Pending</span><strong>{{ branchPosts.filter(post => listingStatus(post) === 'pending').length }}</strong><p>Awaiting a financial decision</p></article>
        <article><span><i class="review-dot is-approved" aria-hidden="true"></i>Approved</span><strong>{{ branchPosts.filter(post => listingStatus(post) === 'approved').length }}</strong><p>Financial terms accepted</p></article>
        <article><span><i class="review-dot is-rejected" aria-hidden="true"></i>Changes Requested</span><strong>{{ branchPosts.filter(post => listingStatus(post) === 'rejected').length }}</strong><p>Needs revision before approval</p></article>
      </div>
      <section class="listing-review-filters" aria-label="Filter listings">
        <label for="listing-review-search">Search listings<input id="listing-review-search" v-model.trim="search" type="search" placeholder="Search name or listing type..." /></label>
        <ContractAppearanceSelect id="finance-listing-branch" label="Branch" v-model="selectedBranchId" :options="[{ value: 'all', label: 'All assigned branches' }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]" />
        <ContractAppearanceSelect id="finance-listing-status" label="Review status" v-model="filter" :options="[{ value: 'all', label: 'All statuses' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Changes Requested' }]" />
      </section>
      <p class="listing-review-guidance">Review submitted listings. Approved listings are ready for the owner or manager to publish.</p>
      <section class="listing-review-records">
        <div class="listing-review-records-heading"><h2>Listings for review</h2><span>{{ visiblePosts.length }} of {{ branchPosts.length }} listings</span></div>
        <div class="listing-review-table-wrap overflow-x-auto">
          <table class="w-full text-left"><thead><tr><th scope="col">Listing</th><th scope="col">Branch</th><th scope="col" class="listing-review-price">Price</th><th scope="col">Payment terms</th><th scope="col">Review status</th><th scope="col">Action</th></tr></thead>
            <tbody><tr v-for="post in visiblePosts" :key="post.id">
              <td class="listing-review-name"><strong>{{ post.title || 'Untitled listing' }}</strong><span class="listing-review-type">{{ post.postType === 'Package' ? 'Service package' : post.postType }}</span></td>
              <td>{{ branchName(post.branchId) }}</td>
              <td class="listing-review-price"><strong>{{ formatPrice(post.price) }}</strong><small v-if="post.consultationFee">Consultation: {{ formatPrice(post.consultationFee) }}</small><small v-if="post.discountPercent">Discount: {{ post.discountPercent }}%</small><small v-if="post.discountAmount">Discount: {{ formatPrice(post.discountAmount) }}</small></td>
              <td><span class="listing-review-policy">Clinic payment policy</span><small class="listing-review-policy-note">Applies to this listing</small></td>
              <td><span class="listing-review-status" :class="'is-' + listingStatus(post)">{{ reviewStatusLabel(post) }}</span></td>
              <td><RowActionMenu :label="'Actions for ' + (post.title || 'listing')" :items="[{ action: 'view', label: 'View Details' }, { action: 'approve', label: 'Approve', disabled: !!busy || listingStatus(post) !== 'pending' || !canReviewListings, title: 'Available for pending listings reviewed by Finance or the owner' }, { action: 'reject', label: 'Request Change', disabled: !!busy || listingStatus(post) !== 'pending' || !canReviewListings, title: 'Available for pending listings reviewed by Finance or the owner' }]" @select="handleListingAction(post, $event)" /></td>
            </tr><tr v-if="!visiblePosts.length"><td colspan="6"><strong>{{ loading ? 'Loading listings...' : 'No listings found' }}</strong><p v-if="!loading">Try a different search, branch, or review status.</p><button v-if="!loading && (search || filter !== 'all' || selectedBranchId !== 'all')" @click="search = ''; filter = 'all'; selectedBranchId = 'all'">Clear filters</button></td></tr></tbody>
          </table>
        </div>
      </section>
    </main>
    <Modal :is-open="Boolean(selectedPost)" panel-class="finance-dialog listing-review-modal" body-class="listing-review-modal-body" @close="selectedPost = null">
      <template #header><div class="listing-review-modal-heading"><p>Listing details</p><h2>{{ selectedPost?.title || 'Untitled listing' }}</h2></div></template>
      <template #body><div v-if="selectedPost" class="listing-review-modal-content">
        <dl class="listing-review-modal-overview"><div><dt>Listing type</dt><dd>{{ selectedPost.postType === 'Package' ? 'Service package' : selectedPost.postType }}</dd></div><div><dt>Branch</dt><dd>{{ branchName(selectedPost.branchId) }}</dd></div><div><dt>Price</dt><dd>{{ formatPrice(selectedPost.price) }}</dd></div><div><dt>Review status</dt><dd><span class="listing-review-status" :class="'is-' + listingStatus(selectedPost)">{{ reviewStatusLabel(selectedPost) }}</span></dd></div></dl>
        <section><h3>Description</h3><p>{{ selectedPost.description || 'No description provided.' }}</p></section>
        <section v-if="selectedPost.termsAndConditions"><h3>Recorded contract terms</h3><p>{{ selectedPost.termsAndConditions }}</p></section>
        <section v-if="selectedPost.financeReview?.note"><h3>Review note</h3><p>{{ selectedPost.financeReview.note }}</p></section>
      </div></template>
    </Modal>
  </div>
</template>
<script setup>
import RowActionMenu from '@/components/common/RowActionMenu.vue'
import Modal from '@/components/common/Modal.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { updateListingApproval } from '@/utils/listingApproval'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import Swal from 'sweetalert2'
import { toast } from 'vue3-toastify'
import { usePermissions } from '@/composables/usePermissions'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

const posts = ref([]), branches = ref([]), selectedBranchId = ref('all'), filter = ref('all'), error = ref(''), busy = ref(''), loading = ref(true), search = ref('')
const selectedPost = ref(null)
const { userRole, isClinicAdminOwner } = usePermissions()
const canReviewListings = computed(() => isClinicAdminOwner.value || String(userRole.value || '').trim().toLowerCase() === 'finance')
const formatPrice = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))
const reviewStatusLabel = post => ({ pending: 'Pending', approved: 'Approved', rejected: 'Changes Requested' })[listingStatus(post)] || 'Not reviewed'
const listingStatus = (post) => String(post?.financeStatus || 'draft').trim().toLowerCase() || 'draft'
const branchName = (branchId) => branches.value.find((branch) => branch.id === String(branchId || '').trim())?.name || 'Branch'
const branchPosts = computed(() => posts.value.filter(post => ['pending', 'approved', 'rejected'].includes(listingStatus(post)) && (selectedBranchId.value === 'all' || post.branchId === selectedBranchId.value)))
const visiblePosts = computed(() => branchPosts.value.filter((post) =>
  (selectedBranchId.value === 'all' || post.branchId === selectedBranchId.value) &&
  (filter.value === 'all' || listingStatus(post) === filter.value) &&
  (!search.value || [post.title, post.postType, post.description].some(value => String(value || '').toLowerCase().includes(search.value.toLowerCase())))
))
let stopAuth, stopPostListeners = [], postsByBranch = new Map()
const stopPosts = () => { stopPostListeners.forEach((stop) => stop?.()); stopPostListeners = []; postsByBranch = new Map() }
const syncPosts = () => {
  posts.value = [...postsByBranch.values()].flat().sort((left, right) => {
    const leftTime = typeof left.createdAt?.toMillis === 'function' ? left.createdAt.toMillis() : Number(left.createdAt?.seconds || 0) * 1000
    const rightTime = typeof right.createdAt?.toMillis === 'function' ? right.createdAt.toMillis() : Number(right.createdAt?.seconds || 0) * 1000
    return rightTime - leftTime
  })
}
onMounted(trackPageLoad(() => { stopAuth = pageListener(onAuthStateChanged, getAuth(), async (user) => {
  stopPosts(); posts.value = []; branches.value = []; selectedBranchId.value = 'all'; error.value = ''; loading.value = true
  if (!user) { loading.value = false; return }
  try {
    const db = getFirestore()
    const scope = await loadOwnerBranchScope(db, user.uid)
    if (!scope.branchIds.length) throw new Error('Your account has no assigned clinic branch.')
    const clinicDocs = await loadClinicDocsByIds(db, scope.branchIds)
    branches.value = clinicDocs.map((clinic) => ({ id: clinic.id, name: String(clinic.clinicBranch || clinic.clinicName || 'Branch').trim() })).sort((a, b) => a.name.localeCompare(b.name))
    if (!branches.value.length) throw new Error('No authorized clinic branches are available.')
    branches.value.forEach((branch) => {
      stopPostListeners.push(pageListener(onSnapshot, query(collection(db, 'productServicePosts'), where('branchId', '==', branch.id)), (snapshot) => {
        postsByBranch.set(branch.id, snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })))
        syncPosts(); loading.value = false
      }, (listenerError) => { error.value = listenerError.message; loading.value = false }))
    })
  } catch (e) { error.value = e.message; loading.value = false }
}) }))
onUnmounted(() => { stopAuth?.(); stopPosts() })
const handleListingAction = (post, action) => { if (action === 'view') selectedPost.value = post; else if (action === 'approve' || action === 'reject') review(post, action) }
const review = async (post, action) => {
  if (!canReviewListings.value) {
    toast.error('Only Finance or the clinic owner can review listing financial terms.')
    return
  }
  const result = await Swal.fire({ title: action === 'approve' ? 'Approve financial terms?' : 'Request financial changes', text: post.title, input: 'textarea', inputLabel: action === 'approve' ? 'Review note (optional)' : 'Explain the changes needed', showCancelButton: true, confirmButtonColor: '#8d5c3c', cancelButtonColor: '#8a725f', background: '#fffdf9', color: '#3d281d', inputValidator: (value) => action === 'reject' && !value.trim() ? 'A reason is required.' : undefined })
  if (!result.isConfirmed) return
  busy.value = post.id
  try { await updateListingApproval(post.id, action, result.value || ''); toast.success(action === 'approve' ? 'Financial terms approved. Awaiting publication.' : 'Changes Requested.') } catch (e) { error.value = e.message } finally { busy.value = '' }
}
</script>
