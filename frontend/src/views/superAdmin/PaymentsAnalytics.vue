<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />
    <main v-page-loading="{ active: pageLoading, blocks: [{ variant: 'form', fields: 2, sections: 1 }, { variant: 'cards', cardStyle: 'stat', cards: 3 }, { variant: 'charts', panels: 2 }, { variant: 'table', columns: 4, rows: 5 }] }" class="flex-1 p-8">
      <div class="mb-6"><h1 class="text-3xl font-bold text-white mb-2">Payments — Analytics</h1><p class="text-slate-400">Subscription revenue and payment activity. Use the date filter to scope payment results.</p></div>
      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <div class="flex gap-3 items-end"><div><label class="text-xs text-slate-400">From</label><input v-model="fromDate" type="date" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"></div><div><label class="text-xs text-slate-400">To</label><input v-model="toDate" type="date" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"></div><button type="button" class="inline-flex h-10 w-10 items-center justify-center rounded bg-sky-600 text-white" aria-label="Refresh payment analytics" @click="refresh">↻</button></div>
        <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4"><p class="text-sm text-slate-400">Subscription Revenue</p><p class="text-2xl font-semibold text-white">₱{{ totals.revenue.toLocaleString() }}</p></div>
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4"><p class="text-sm text-slate-400">Active Subscriptions</p><p class="text-2xl font-semibold text-white">{{ totals.activeSubscriptions.toLocaleString() }}</p></div>
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-4"><p class="text-sm text-slate-400">Successful Payments</p><p class="text-2xl font-semibold text-white">{{ totals.paymentCount.toLocaleString() }}</p></div>
        </div>
      </section>
      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6"><h2 class="text-xl text-white mb-4">Subscription Charts</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-slate-900 border border-slate-700 rounded-lg p-4"><p class="text-sm text-slate-400 mb-2">Daily Subscription Revenue (selected range)</p><div class="h-60"><canvas v-show="transactions.length" ref="dailyChart"></canvas><p v-if="!transactions.length" class="flex h-full items-center justify-center text-sm text-slate-500">No successful subscription payments in this period.</p></div></div>
        <div class="bg-slate-900 border border-slate-700 rounded-lg p-4"><p class="text-sm text-slate-400 mb-2">Revenue by Subscription Plan</p><div class="h-60"><canvas v-show="transactions.length" ref="breakdownChart"></canvas><p v-if="!transactions.length" class="flex h-full items-center justify-center text-sm text-slate-500">No plan revenue to display for this period.</p></div></div>
      </div></section>
      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6"><h2 class="text-xl text-white mb-4">Subscription Payments</h2>
        <div class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div class="flex gap-3 items-center"><input v-model="searchFilter" placeholder="Search reference, plan, or date" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"><button type="button" class="inline-flex h-10 w-10 items-center justify-center rounded bg-sky-600 text-white" aria-label="Refresh payment analytics" @click="refresh">↻</button></div><div class="text-slate-400 text-sm">Page {{ currentPage }} / {{ totalPages }}</div></div>
        <div v-if="loading" class="text-slate-300">Loading payments...</div>
        <table v-else class="w-full text-sm text-left"><thead class="text-slate-300 border-b border-slate-700"><tr><th class="px-3 py-2">Date</th><th class="px-3 py-2">Plan</th><th class="px-3 py-2">Reference</th><th class="px-3 py-2">Amount</th></tr></thead><tbody><tr v-for="payment in pagedTransactions" :key="payment.id" class="border-b border-slate-700/40"><td class="px-3 py-2 text-slate-200">{{ payment.date }}</td><td class="px-3 py-2 text-slate-200">{{ payment.plan }}</td><td class="px-3 py-2 text-slate-300">{{ payment.ref }}</td><td class="px-3 py-2 text-slate-200">₱{{ payment.amount.toLocaleString() }}</td></tr><tr v-if="!filteredCount"><td class="px-3 py-4 text-slate-400" colspan="4">No subscription payments found for the selected range.</td></tr></tbody></table>
        <div class="mt-4 flex items-center justify-between"><div class="text-slate-400 text-sm">Showing {{ startIndex }} – {{ endIndex }} of {{ filteredCount }}</div><div class="flex gap-2"><button class="px-3 py-1 rounded bg-slate-700 text-white" :disabled="currentPage <= 1" @click="prevPage">Prev</button><button class="px-3 py-1 rounded bg-slate-700 text-white" :disabled="currentPage >= totalPages" @click="nextPage">Next</button></div></div>
      </section>
    </main>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { usePageLoading } from '@/composables/usePageLoading'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { db } from '@/config/firebaseConfig'

export default {
  name: 'PaymentsAnalytics',
  components: { SuperAdminSidebar },
  setup() {
    const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fromDate = ref(thirtyDaysAgo.toISOString().slice(0, 10))
    const toDate = ref(new Date().toISOString().slice(0, 10))
    const loading = ref(false)
    const transactions = ref([])
    const totals = ref({ revenue: 0, activeSubscriptions: 0, paymentCount: 0 })
    const dailyChart = ref(null)
    const breakdownChart = ref(null)
    const currentPage = ref(1)
    const searchFilter = ref('')
    const pageSize = 10
    let unsubscribePayments = null
    let dailyChartInstance = null
    let breakdownChartInstance = null
    const asDate = (value) => {
      if (!value) return null
      if (typeof value.toDate === 'function') return value.toDate()
      if (value?.seconds) return new Date(value.seconds * 1000)
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? null : date
    }
    const isPaid = (payment) => !payment.status || String(payment.status).toLowerCase() === 'paid'
    const renderCharts = async () => {
      await nextTick()
      dailyChartInstance?.destroy()
      breakdownChartInstance?.destroy()
      if (!transactions.value.length) return
      const dailyRevenue = new Map()
      const planRevenue = new Map()
      transactions.value.forEach((payment) => {
        const dateKey = payment.timestamp.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
        dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + payment.amount)
        planRevenue.set(payment.plan, (planRevenue.get(payment.plan) || 0) + payment.amount)
      })
      const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1' } } } }
      dailyChartInstance = new Chart(dailyChart.value, { type: 'line', data: { labels: [...dailyRevenue.keys()], datasets: [{ label: 'Revenue (PHP)', data: [...dailyRevenue.values()], borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, .18)', fill: true, tension: 0.3 }] }, options: { ...options, scales: { x: { ticks: { color: '#94a3b8' } }, y: { beginAtZero: true, ticks: { color: '#94a3b8' } } } } })
      breakdownChartInstance = new Chart(breakdownChart.value, { type: 'doughnut', data: { labels: [...planRevenue.keys()], datasets: [{ data: [...planRevenue.values()], backgroundColor: ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#fb7185'] }] }, options })
    }
    const refresh = trackPageLoad(async () => {
      loading.value = true
      transactions.value = []
      totals.value = { revenue: 0, activeSubscriptions: 0, paymentCount: 0 }
      try {
        const start = new Date(fromDate.value); start.setHours(0, 0, 0, 0)
        const end = new Date(toDate.value); end.setHours(23, 59, 59, 999)
        const [snapshot, usersSnapshot] = await Promise.all([
          getDocs(collection(db, 'planPayments')),
          getDocs(collection(db, 'users')),
        ])
        const rows = []
        snapshot.forEach((document) => {
          const payment = document.data() || {}
          const timestamp = asDate(payment.paymongoPaidAt || payment.paidAt || payment.createdAt)
          if (!timestamp || !isPaid(payment)) return
          if (timestamp < start || timestamp > end) return
          const amount = Number(payment.amount || payment.total || 0)
          rows.push({ id: document.id, date: timestamp.toLocaleString(), timestamp, plan: payment.planName || payment.planId || 'Subscription', ref: payment.referenceNumber || payment.paymongoPaymentId || payment.payerEmail || '', amount })
          totals.value.revenue += amount
          totals.value.paymentCount += 1
        })
        totals.value.activeSubscriptions = usersSnapshot.docs.filter((document) => {
          const subscription = document.data() || {}
          const plan = String(subscription.subscriptionPlan || '').toLowerCase()
          const status = String(subscription.subscriptionAccessStatus || '').toLowerCase()
          const expiresAt = asDate(subscription.subscriptionExpiresAt)
          return ['basic', 'premium'].includes(plan) && status !== 'expired' && (!expiresAt || expiresAt >= new Date())
        }).length
        transactions.value = rows.sort((first, second) => second.timestamp - first.timestamp)
        currentPage.value = 1
        await renderCharts()
      } catch (error) {
        console.error('Failed to load subscription payment analytics', error)
      } finally { loading.value = false }
    })
    const filteredTransactions = computed(() => {
      const keyword = String(searchFilter.value || '').trim().toLowerCase()
      return keyword ? transactions.value.filter((payment) => `${payment.ref} ${payment.date} ${payment.plan}`.toLowerCase().includes(keyword)) : transactions.value
    })
    const filteredCount = computed(() => filteredTransactions.value.length)
    const totalPages = computed(() => Math.max(1, Math.ceil(filteredCount.value / pageSize)))
    const pagedTransactions = computed(() => filteredTransactions.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize))
    const startIndex = computed(() => filteredCount.value ? (currentPage.value - 1) * pageSize + 1 : 0)
    const endIndex = computed(() => Math.min(currentPage.value * pageSize, filteredCount.value))
    const prevPage = () => { if (currentPage.value > 1) currentPage.value-- }
    const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++ }
    watch([searchFilter, fromDate, toDate], () => { currentPage.value = 1 })
    onMounted(trackPageLoad(() => {
      refresh()
      unsubscribePayments = pageListener(onSnapshot, collection(db, 'planPayments'), refresh, (error) => console.error('Failed to listen to subscription payments:', error))
    }))
    onUnmounted(() => { unsubscribePayments?.(); dailyChartInstance?.destroy(); breakdownChartInstance?.destroy() })
    return { pageLoading, fromDate, toDate, refresh, loading, transactions, totals, dailyChart, breakdownChart, currentPage, searchFilter, pagedTransactions, totalPages, prevPage, nextPage, filteredCount, startIndex, endIndex }
  }
}
</script>
