<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6 text-white">
      <h1 class="text-2xl font-bold">Listing Financial Review</h1>
      <p class="mt-2 text-slate-400">Review prices and payment terms. Finance or the clinic owner may approve or request changes; the owner or manager publishes the listing afterward.</p>
      <p v-if="error" role="alert" class="my-4 text-red-400">{{ error }}</p>
      <label class="block my-5">Status
        <select v-model="filter" class="ml-3 rounded bg-slate-700 p-2"><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
      </label>
      <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
        <table class="w-full text-left text-sm">
          <thead><tr><th class="p-4">Listing</th><th class="p-4">Price</th><th class="p-4">Payment terms</th><th class="p-4">Review</th></tr></thead>
          <tbody>
            <tr v-for="post in visiblePosts" :key="post.id" class="border-t border-slate-700">
              <td class="p-4"><strong>{{ post.title }}</strong><p>{{ post.postType }}</p><details class="mt-2"><summary>View details</summary><p class="my-2 whitespace-pre-wrap">{{ post.description }}</p><p class="whitespace-pre-wrap">{{ post.termsAndConditions || 'No service contract terms provided.' }}</p><p v-if="post.financeReview?.note">Review note: {{ post.financeReview.note }}</p></details></td>
              <td class="p-4">PHP {{ Number(post.price || 0).toFixed(2) }}<p v-if="post.consultationFee">Consultation: PHP {{ Number(post.consultationFee).toFixed(2) }}</p><p v-if="post.discountPercent">Discount: {{ post.discountPercent }}%</p><p v-if="post.discountAmount">Discount: PHP {{ post.discountAmount }}</p></td>
              <td class="p-4">Governed by the clinic-wide Payment Policy</td>
              <td class="p-4"><div v-if="post.financeStatus === 'pending' && canReviewListings" class="flex flex-wrap gap-2"><button :disabled="!!busy" @click="review(post, 'approve')" class="rounded bg-emerald-700 px-3 py-2 disabled:opacity-50">Approve</button><button :disabled="!!busy" @click="review(post, 'reject')" class="rounded bg-red-800 px-3 py-2 disabled:opacity-50">Request changes</button></div><span v-else>{{ post.financeStatus === 'pending' ? 'Awaiting authorized review' : post.financeStatus }}</span></td>
            </tr>
            <tr v-if="!visiblePosts.length"><td colspan="4" class="p-6 text-slate-400">{{ loading ? 'Loading listings...' : 'No listings with this status.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { updateListingApproval } from '@/utils/listingApproval'
import Swal from 'sweetalert2'
import { toast } from 'vue3-toastify'
import { usePermissions } from '@/composables/usePermissions'
const posts = ref([]), filter = ref('pending'), error = ref(''), busy = ref(''), loading = ref(true)
const { userRole, isClinicAdminOwner } = usePermissions()
const canReviewListings = computed(() => isClinicAdminOwner.value || String(userRole.value || '').trim().toLowerCase() === 'finance')
const visiblePosts = computed(() => posts.value.filter((p) => p.financeStatus === filter.value))
let stopAuth, stopPosts
onMounted(() => { stopAuth = onAuthStateChanged(getAuth(), async (user) => {
  stopPosts?.(); posts.value = []
  if (!user) { loading.value = false; return }
  try {
    const db = getFirestore()
    const profile = (await getDoc(doc(db, 'users', user.uid))).data()
    if (!profile?.branchId) throw new Error('Your account has no branch assignment.')
    stopPosts = onSnapshot(query(collection(db, 'productServicePosts'), where('branchId', '==', profile.branchId)), (snapshot) => { posts.value = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })); loading.value = false }, (e) => { error.value = e.message; loading.value = false })
  } catch (e) { error.value = e.message; loading.value = false }
}) })
onUnmounted(() => { stopAuth?.(); stopPosts?.() })
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
