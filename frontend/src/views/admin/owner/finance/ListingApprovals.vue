<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6 text-white">
      <h1 class="text-2xl font-bold">Listing Financial Review</h1>
      <p class="mt-2 text-slate-400">Review prices and payment terms. Finance or the clinic owner may approve or request changes; the owner or manager publishes the listing afterward.</p>
      <p v-if="error" role="alert" class="my-4 text-red-400">{{ error }}</p>
      <div class="my-5 grid gap-3 sm:grid-cols-2">
        <label class="block">Branch
          <select v-model="selectedBranchId" class="mt-1 w-full rounded bg-slate-700 p-2"><option value="all">All assigned branches</option><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option></select>
        </label>
        <label class="block">Status
          <select v-model="filter" class="mt-1 w-full rounded bg-slate-700 p-2"><option value="all">All statuses</option><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Changes requested</option><option value="draft">Draft — not submitted</option></select>
        </label>
      </div>
      <p class="-mt-2 mb-5 text-sm text-slate-400">Only listings submitted to Finance require approval. Drafts are shown for reference and must be submitted by the owner or manager first.</p>
      <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
        <table class="w-full text-left text-sm">
          <thead><tr><th class="p-4">Listing</th><th class="p-4">Branch</th><th class="p-4">Price</th><th class="p-4">Payment terms</th><th class="p-4">Review</th></tr></thead>
          <tbody>
            <tr v-for="post in visiblePosts" :key="post.id" class="border-t border-slate-700">
              <td class="p-4"><strong>{{ post.title }}</strong><p>{{ post.postType }}</p><details class="mt-2"><summary>View details</summary><p class="my-2 whitespace-pre-wrap">{{ post.description }}</p><p class="whitespace-pre-wrap">{{ post.termsAndConditions || 'No service contract terms provided.' }}</p><p v-if="post.financeReview?.note">Review note: {{ post.financeReview.note }}</p></details></td>
              <td class="p-4 text-slate-300">{{ branchName(post.branchId) }}</td>
              <td class="p-4">PHP {{ Number(post.price || 0).toFixed(2) }}<p v-if="post.consultationFee">Consultation: PHP {{ Number(post.consultationFee).toFixed(2) }}</p><p v-if="post.discountPercent">Discount: {{ post.discountPercent }}%</p><p v-if="post.discountAmount">Discount: PHP {{ post.discountAmount }}</p></td>
              <td class="p-4">Governed by the clinic-wide Payment Policy</td>
              <td class="p-4"><div v-if="listingStatus(post) === 'pending' && canReviewListings" class="flex flex-wrap gap-2"><button :disabled="!!busy" @click="review(post, 'approve')" class="rounded bg-emerald-700 px-3 py-2 disabled:opacity-50">Approve</button><button :disabled="!!busy" @click="review(post, 'reject')" class="rounded bg-red-800 px-3 py-2 disabled:opacity-50">Request changes</button></div><span v-else>{{ listingStatus(post) === 'pending' ? 'Awaiting authorized review' : listingStatus(post) === 'draft' ? 'Not submitted to Finance' : listingStatus(post) }}</span></td>
            </tr>
            <tr v-if="!visiblePosts.length"><td colspan="5" class="p-6 text-slate-400">{{ loading ? 'Loading listings...' : 'No listings match these filters.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { updateListingApproval } from '@/utils/listingApproval'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import Swal from 'sweetalert2'
import { toast } from 'vue3-toastify'
import { usePermissions } from '@/composables/usePermissions'
const posts = ref([]), branches = ref([]), selectedBranchId = ref('all'), filter = ref('all'), error = ref(''), busy = ref(''), loading = ref(true)
const { userRole, isClinicAdminOwner } = usePermissions()
const canReviewListings = computed(() => isClinicAdminOwner.value || String(userRole.value || '').trim().toLowerCase() === 'finance')
const listingStatus = (post) => String(post?.financeStatus || 'draft').trim().toLowerCase() || 'draft'
const branchName = (branchId) => branches.value.find((branch) => branch.id === String(branchId || '').trim())?.name || 'Branch'
const visiblePosts = computed(() => posts.value.filter((post) =>
  (selectedBranchId.value === 'all' || post.branchId === selectedBranchId.value) &&
  (filter.value === 'all' || listingStatus(post) === filter.value)
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
onMounted(() => { stopAuth = onAuthStateChanged(getAuth(), async (user) => {
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
      stopPostListeners.push(onSnapshot(query(collection(db, 'productServicePosts'), where('branchId', '==', branch.id)), (snapshot) => {
        postsByBranch.set(branch.id, snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })))
        syncPosts(); loading.value = false
      }, (listenerError) => { error.value = listenerError.message; loading.value = false }))
    })
  } catch (e) { error.value = e.message; loading.value = false }
}) })
onUnmounted(() => { stopAuth?.(); stopPosts() })
const review = async (post, action) => {
  if (!canReviewListings.value) {
    toast.error('Only Finance or the clinic owner can review listing financial terms.')
    return
  }
  const result = await Swal.fire({ title: action === 'approve' ? 'Approve financial terms?' : 'Request financial changes', text: post.title, input: 'textarea', inputLabel: action === 'approve' ? 'Review note (optional)' : 'Explain the changes needed', showCancelButton: true, inputValidator: (value) => action === 'reject' && !value.trim() ? 'A reason is required.' : undefined })
  if (!result.isConfirmed) return
  busy.value = post.id
  try { await updateListingApproval(post.id, action, result.value || ''); toast.success(action === 'approve' ? 'Financial terms approved. Awaiting publication.' : 'Changes requested.') } catch (e) { error.value = e.message } finally { busy.value = '' }
}
</script>
