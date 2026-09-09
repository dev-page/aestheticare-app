<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />
    <main class="flex-1 p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">Payments — Analytics</h1>
        <p class="text-slate-400">Financial overview and income analytics. Use the date filter to scope results.</p>
      </div>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div class="flex gap-3 items-end">
          <div>
            <label class="text-xs text-slate-400">From</label>
            <input type="date" v-model="fromDate" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />
          </div>
          <div>
            <label class="text-xs text-slate-400">To</label>
            <input type="date" v-model="toDate" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />
          </div>
          <button class="px-4 py-2 rounded bg-sky-600 text-white" @click="refresh">Refresh</button>
        </div>

        <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <p class="text-sm text-slate-400">Total Income</p>
            <p class="text-2xl font-semibold text-white">₱{{ totals.totalIncome.toLocaleString() }}</p>
          </div>
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <p class="text-sm text-slate-400">Subscriptions Income</p>
            <p class="text-2xl font-semibold text-white">₱{{ totals.subscriptions.toLocaleString() }}</p>
          </div>
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <p class="text-sm text-slate-400">One-time Payments</p>
            <p class="text-2xl font-semibold text-white">₱{{ totals.oneTime.toLocaleString() }}</p>
          </div>
        </div>
      </section>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <h2 class="text-xl text-white mb-4">Income Charts</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <p class="text-sm text-slate-400 mb-2">Daily Income (selected range)</p>
            <canvas id="dailyIncomeChart" ref="dailyChart" style="height:240px; width:100%;"></canvas>
          </div>
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <p class="text-sm text-slate-400 mb-2">Income Breakdown</p>
            <canvas id="breakdownChart" ref="breakdownChart" style="height:240px; width:100%;"></canvas>
          </div>
        </div>
      </section>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 class="text-xl text-white mb-4">Transactions</h2>

        <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div class="flex gap-3 items-center">
            <input v-model="searchFilter" placeholder="Search reference or date" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />

            <select v-model="typeFilter" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100">
              <option value="">All</option>
              <option value="subscription">Subscriptions</option>
              <option value="oneTime">One-time</option>
            </select>

            <button class="px-3 py-2 rounded bg-sky-600 text-white" @click="refresh">Refresh</button>
          </div>

          <div class="flex items-center gap-3">
            <div class="text-slate-400 text-sm">Page {{ currentPage }} / {{ totalPages }}</div>
            <button class="px-3 py-1 rounded bg-slate-700 text-white" :disabled="currentPage <= 1" @click="prevPage">Prev</button>
            <button class="px-3 py-1 rounded bg-slate-700 text-white" :disabled="currentPage >= totalPages" @click="nextPage">Next</button>
          </div>
        </div>

        <div v-if="loading" class="text-slate-300">Loading transactions...</div>
        <table v-else class="w-full text-sm text-left">
          <thead class="text-slate-300 border-b border-slate-700">
            <tr>
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Reference</th>
              <th class="px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in pagedTransactions" :key="tx.id" class="border-b border-slate-700/40">
              <td class="px-3 py-2 text-slate-200">{{ tx.date }}</td>
              <td class="px-3 py-2 text-slate-200">{{ tx.type }}</td>
              <td class="px-3 py-2 text-slate-300">{{ tx.ref }}</td>
              <td class="px-3 py-2 text-slate-200">₱{{ tx.amount.toLocaleString() }}</td>
            </tr>
            <tr v-if="!filteredCount">
              <td class="px-3 py-4 text-slate-400" colspan="4">No transactions found for the selected range/filters.</td>
            </tr>
          </tbody>
        </table>

        <div class="mt-4 flex items-center justify-between">
          <div class="text-slate-400 text-sm">Showing {{ startIndex }} – {{ endIndex }} of {{ filteredCount }}</div>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 rounded bg-slate-700 text-white" :disabled="currentPage <= 1" @click="prevPage">Prev</button>
            <button class="px-3 py-1 rounded bg-slate-700 text-white" :disabled="currentPage >= totalPages" @click="nextPage">Next</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { db } from '@/config/firebaseConfig'
import { collection, query, getDocs } from 'firebase/firestore'

export default {
  name: 'PaymentsAnalytics',
  components: { SuperAdminSidebar },
  setup() {
    const fromDate = ref(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0,10))
    const toDate = ref(new Date().toISOString().slice(0,10))
    const loading = ref(false)
    const transactions = ref([])
    const totals = ref({ totalIncome: 0, subscriptions: 0, oneTime: 0 })

    // Pagination and filters
    const pageSize = 10
    const currentPage = ref(1)
    const typeFilter = ref('') // '', 'subscription', 'oneTime'
    const searchFilter = ref('')

    const refresh = async () => {
      loading.value = true
      transactions.value = []
      totals.value = { totalIncome: 0, subscriptions: 0, oneTime: 0 }

      try {
        // Simple client-side fetch of planPayments and orders; for production use server-side aggregation
        const start = new Date(fromDate.value)
        start.setHours(0,0,0,0)
        const end = new Date(toDate.value)
        end.setHours(23,59,59,999)

        // Example: fetch planPayments collection
        const paymentsRef = collection(db, 'planPayments')
        const q = query(paymentsRef)
        const snap = await getDocs(q)
        const rows = []
        snap.forEach((doc) => {
          const d = doc.data() || {}
          const ts = d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000) : null
          if (ts && ts >= start && ts <= end) {
            const amount = Number(d.amount || d.total || 0)
            rows.push({ id: doc.id, date: ts.toLocaleString(), type: 'Subscription', ref: d.paymentId || d.payerEmail || '', amount })
            totals.value.totalIncome += amount
            totals.value.subscriptions += amount
          }
        })

        // Note: also include order payments or other sources in production

        transactions.value = rows.sort((a,b) => new Date(b.date) - new Date(a.date))
        currentPage.value = 1
      } catch (e) {
        console.error('Failed to load payments analytics', e)
      } finally {
        loading.value = false
      }
    }

    const filteredTransactions = computed(() => {
      const q = String(searchFilter.value || '').trim().toLowerCase()
      return transactions.value.filter((t) => {
        if (typeFilter.value) {
          const isSub = String(t.type || '').toLowerCase().includes('subscription')
          if (typeFilter.value === 'subscription' && !isSub) return false
          if (typeFilter.value === 'oneTime' && isSub) return false
        }
        if (q) {
          const refStr = String(t.ref || '').toLowerCase()
          const dateStr = String(t.date || '').toLowerCase()
          if (!refStr.includes(q) && !dateStr.includes(q)) return false
        }
        return true
      })
    })

    const filteredCount = computed(() => filteredTransactions.value.length)
    const totalPages = computed(() => Math.max(1, Math.ceil(filteredCount.value / pageSize)))

    const pagedTransactions = computed(() => {
      const start = (currentPage.value - 1) * pageSize
      return filteredTransactions.value.slice(start, start + pageSize)
    })

    const startIndex = computed(() => (filteredCount.value === 0 ? 0 : (currentPage.value - 1) * pageSize + 1))
    const endIndex = computed(() => Math.min(currentPage.value * pageSize, filteredCount.value))

    const prevPage = () => { if (currentPage.value > 1) currentPage.value-- }
    const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++ }

    // Reset page when filters or date range change
    watch([searchFilter, typeFilter, fromDate, toDate], () => { currentPage.value = 1 })

    onMounted(() => refresh())

    return { fromDate, toDate, refresh, loading, transactions, totals, // pagination
      pageSize, currentPage, typeFilter, searchFilter, pagedTransactions, totalPages, prevPage, nextPage, filteredCount, startIndex, endIndex }
  }
}
</script>
