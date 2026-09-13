<template>
  <div class="module-theme min-h-screen bg-slate-900">
    <OwnerSidebar />
    <main class="p-4 md:p-8">
      <div class="mx-auto max-w-7xl">
        <header class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Finance</p>
            <h1 class="mt-2 text-3xl font-bold text-white">Budget</h1>
            <p class="mt-2 text-slate-400">Monitor requested, approved, and committed purchase budgets for this branch.</p>
          </div>
          <label class="text-sm text-slate-300">
            <span class="mb-2 block text-slate-400">Status filter</span>
            <select v-model="statusFilter" class="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white">
              <option value="">All statuses</option>
              <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
            </select>
          </label>
        </header>

        <section class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div v-for="card in summaryCards" :key="card.label" class="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <p class="text-sm text-slate-400">{{ card.label }}</p>
            <p class="mt-2 text-2xl font-bold" :class="card.className">{{ card.label === 'Request Count' ? card.value : formatCurrency(card.value) }}</p>
          </div>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <div class="border-b border-slate-700 px-5 py-4">
            <h2 class="font-semibold text-white">Purchase Budget Requests</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[850px] text-left text-sm">
              <thead class="bg-slate-700 text-xs uppercase text-slate-300">
                <tr><th class="px-5 py-3">Request</th><th class="px-5 py-3">Requester</th><th class="px-5 py-3">Amount</th><th class="px-5 py-3">Budget Status</th><th class="px-5 py-3">Workflow</th><th class="px-5 py-3">Date</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="request in filteredRequests" :key="request.id">
                  <td class="px-5 py-4 text-white">{{ request.title || request.item || request.description || 'Purchase request' }}</td>
                  <td class="px-5 py-4 text-slate-300">{{ request.requesterName || request.createdByName || '-' }}</td>
                  <td class="px-5 py-4 font-semibold text-amber-300">{{ formatCurrency(request.totalCost || request.total || request.amount) }}</td>
                  <td class="px-5 py-4 text-slate-300">{{ request.budgetStatus || 'Not submitted' }}</td>
                  <td class="px-5 py-4 text-slate-300">{{ request.workflowStage || request.status || '-' }}</td>
                  <td class="px-5 py-4 text-slate-400">{{ formatDate(request.createdAt || request.updatedAt) }}</td>
                </tr>
                <tr v-if="!loading && !filteredRequests.length"><td colspan="6" class="px-5 py-10 text-center text-slate-400">No budget requests found.</td></tr>
                <tr v-if="loading"><td colspan="6" class="px-5 py-10 text-center text-slate-400">Loading budget requests...</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'

const requests = ref([])
const loading = ref(true)
const statusFilter = ref('')
const statuses = ['Requested', 'Approved', 'Rejected', 'Delivered', 'Settled']
const branchId = ref('')
const filteredRequests = computed(() => requests.value.filter((request) => !statusFilter.value || String(request.budgetStatus || request.status || '').toLowerCase() === statusFilter.value.toLowerCase()))
const amountOf = (request) => Number(request.totalCost || request.total || request.amount || 0)
const summaryCards = computed(() => [
  { label: 'Requested', value: requests.value.filter((r) => String(r.budgetStatus || r.status).toLowerCase() === 'requested').reduce((sum, r) => sum + amountOf(r), 0), className: 'text-amber-300' },
  { label: 'Approved', value: requests.value.filter((r) => String(r.budgetStatus || r.status).toLowerCase() === 'approved').reduce((sum, r) => sum + amountOf(r), 0), className: 'text-emerald-300' },
  { label: 'Committed', value: requests.value.filter((r) => ['approved', 'delivered', 'settled'].includes(String(r.budgetStatus || r.status).toLowerCase())).reduce((sum, r) => sum + amountOf(r), 0), className: 'text-cyan-300' },
  { label: 'Request Count', value: requests.value.length, className: 'text-white' }
])
const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const formatDate = (value) => value?.toDate ? value.toDate().toLocaleDateString('en-PH') : value ? new Date(value).toLocaleDateString('en-PH') : '-'

async function loadRequests() {
  if (!branchId.value) return
  const snapshot = await getDocs(query(collection(db, 'purchaseRequests'), where('branchId', '==', branchId.value)))
  requests.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

onMounted(() => onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) return
    const snapshot = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)))
    branchId.value = snapshot.docs[0]?.data()?.branchId || ''
    await loadRequests()
  } finally {
    loading.value = false
  }
}))
</script>
