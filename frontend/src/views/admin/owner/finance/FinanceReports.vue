<template>
  <div class="flex module-theme finance-page bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, blocks: [{ variant: 'cards', cardStyle: 'stat', cards: 4 }, { variant: 'summary', rows: 4 }, { variant: 'table', columns: 2, rows: 4 }, { variant: 'table', columns: 2, rows: 4 }, { variant: 'cards', cardStyle: 'stat', cards: 3 }] }" class="flex-1 p-8">
      <div class="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Finance Reports</h1>
            <p class="text-slate-400">Monthly financial activity: collections and refunds use transaction dates, payroll uses its pay period, and costs use invoice or expense dates.</p>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <label class="block text-slate-400 text-sm mb-2">Report Month</label>
          <input
            v-model="selectedMonth"
            type="month"
            class="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          />
          <button type="button" class="rounded-lg border border-amber-500/60 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10" @click="exportPdf">
            Export PDF
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Gross Collections</p>
          <p class="text-2xl font-bold text-green-400">{{ formatCurrency(report.grossCollections) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Refunds</p>
          <p class="text-2xl font-bold text-rose-400">{{ formatCurrency(report.refunds) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Net Collections</p>
          <p class="text-2xl font-bold text-green-300">{{ formatCurrency(report.netCollections) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Net Recorded Activity</p>
          <p class="text-2xl font-bold text-white">{{ formatCurrency(report.netRecordedActivity) }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4">Monthly Activity Summary</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between text-slate-300">
            <span>Gross collections</span>
            <span>{{ formatCurrency(report.grossCollections) }}</span>
          </div>
          <div class="flex justify-between text-slate-300">
            <span>Less: Refunds</span>
            <span>- {{ formatCurrency(report.refunds) }}</span>
          </div>
          <div class="flex justify-between text-slate-300">
            <span>Net collections</span>
            <span>{{ formatCurrency(report.netCollections) }}</span>
          </div>
          <div v-if="hasPayroll" class="flex justify-between text-slate-300">
            <span>Less: Payroll</span>
            <span>- {{ formatCurrency(report.payroll) }}</span>
          </div>
          <div class="flex justify-between text-slate-300">
            <span>Less: Supplier invoices</span>
            <span>- {{ formatCurrency(report.supplierCosts) }}</span>
          </div>
          <div class="flex justify-between text-slate-300">
            <span>Less: Operating Expenses</span>
            <span>- {{ formatCurrency(report.operatingExpenses) }}</span>
          </div>
          <div class="border-t border-slate-700 pt-2 flex justify-between text-white font-semibold">
            <span>Net recorded activity</span>
            <span>{{ formatCurrency(report.netRecordedActivity) }}</span>
          </div>
        </div>
        <p class="mt-4 text-xs text-slate-400">This operational summary groups each record by its financial event date. It is not an audited profit-and-loss statement.</p>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold text-white">Sales by Staff</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-700">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Staff</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Sales</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="row in salesByStaff" :key="row.id" class="hover:bg-slate-700/50 transition-colors">
                  <td class="px-6 py-4 text-white">{{ row.name }}</td>
                  <td class="px-6 py-4 text-green-400 font-semibold">{{ formatCurrency(row.total) }}</td>
                </tr>
                <tr v-if="salesByStaff.length === 0">
                  <td colspan="2" class="px-6 py-8 text-center text-slate-400">No sales data for selected month.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold text-white">Sales by Service</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-700">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Service / Category</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Sales</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="row in salesByService" :key="row.name" class="hover:bg-slate-700/50 transition-colors">
                  <td class="px-6 py-4 text-white">{{ row.name }}</td>
                  <td class="px-6 py-4 text-green-400 font-semibold">{{ formatCurrency(row.total) }}</td>
                </tr>
                <tr v-if="salesByService.length === 0">
                  <td colspan="2" class="px-6 py-8 text-center text-slate-400">No service sales data for selected month.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 class="text-lg font-semibold text-white mb-4">Cost Percentage Analysis</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div v-if="hasPayroll" class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Payroll % of Revenue</p>
            <p class="text-white text-xl font-semibold mt-1">{{ percent(report.payrollPercent) }}</p>
          </div>
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Supplier Costs % of Revenue</p>
            <p class="text-white text-xl font-semibold mt-1">{{ percent(report.inventoryPercent) }}</p>
          </div>
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Operating Expenses % of Revenue</p>
            <p class="text-white text-xl font-semibold mt-1">{{ percent(report.operatingExpensesPercent) }}</p>
          </div>
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Inventory Valuation</p>
            <p class="text-white text-xl font-semibold mt-1">{{ formatCurrency(report.inventoryValuation) }}</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { useSubscription } from '@/composables/useSubscription'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { summarizeFinanceMonth } from '../../../../../../shared/financeSummary.js'

export default {
  name: 'FinanceReports',
  components: { OwnerSidebar },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasFeature, initSubscription } = useSubscription()
    const hasPayroll = computed(() => hasFeature('payroll'))

    const currentBranchId = ref('')
    const transactions = ref([])
    const payrolls = ref([])
    const financialRecords = ref([])
    const inventoryItems = ref([])
    const users = ref([])
    const selectedMonth = ref(new Date().toISOString().slice(0, 7))

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'symbol' }).format(Number(value || 0))
    const percent = (value) => `${Number(value || 0).toFixed(2)}%`
    const exportPdf = () => window.print()

    const monthlySummary = computed(() => summarizeFinanceMonth({
      transactions: transactions.value,
      payrolls: payrolls.value,
      financialRecords: financialRecords.value,
      monthKey: selectedMonth.value,
    }))
    const monthlySalesTransactions = computed(() => monthlySummary.value.monthlyTransactions.filter(tx => Number(tx.amount || 0) > 0))

    const getInventoryUnitPrice = (item) =>
      Number(item.unitPrice || item.price || item.costPrice || item.unitCost || item.costPerUnit || 0)

    const report = computed(() => {
      const summary = monthlySummary.value
      const inventoryValuation = inventoryItems.value.reduce(
        (sum, item) => sum + Number(item.currentStock || 0) * getInventoryUnitPrice(item),
        0
      )
      return {
        ...summary,
        inventoryValuation,
        payrollPercent: summary.netCollections > 0 ? (summary.payroll / summary.netCollections) * 100 : 0,
        inventoryPercent: summary.netCollections > 0 ? (summary.supplierCosts / summary.netCollections) * 100 : 0,
        operatingExpensesPercent: summary.netCollections > 0 ? (summary.operatingExpenses / summary.netCollections) * 100 : 0
      }
    })

    const userMap = computed(() => {
      const map = {}
      users.value.forEach((user) => {
        const label = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.id
        map[user.id] = label
      })
      return map
    })

    const salesByStaff = computed(() => {
      const grouped = {}
      monthlySalesTransactions.value.forEach((tx) => {
        const key = tx.receptionistId || 'unassigned'
        if (!grouped[key]) {
          grouped[key] = { id: key, name: userMap.value[key] || 'Unassigned', total: 0 }
        }
        grouped[key].total += Number(tx.amount || 0)
      })
      return Object.values(grouped).sort((a, b) => b.total - a.total)
    })

    const salesByService = computed(() => {
      const grouped = {}
      monthlySalesTransactions.value.forEach((tx) => {
        const key =
          tx.service ||
          (tx.type === 'appointment_payment'
            ? 'Treatment'
            : tx.type === 'product_sale'
              ? 'Skincare Retail'
              : 'Other')
        if (!grouped[key]) grouped[key] = { name: key, total: 0 }
        grouped[key].total += Number(tx.amount || 0)
      })
      return Object.values(grouped).sort((a, b) => b.total - a.total)
    })

    const loadData = trackPageLoad(async () => {
      if (!currentBranchId.value) return
      const payrollRequest = hasPayroll.value
        ? getDocs(query(collection(db, 'payrollSummaries'), where('branchId', '==', currentBranchId.value)))
        : Promise.resolve({ docs: [] })
      const financeRecordsRequest = (async () => {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Sign in to load finance records.')
        let lastError
        for (const base of OTP_BACKEND_CANDIDATES) {
          try {
            const response = await fetch(`${base}/finance/records?branchId=${encodeURIComponent(currentBranchId.value)}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            const payload = await response.json()
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Finance records could not be loaded.')
            return Array.isArray(payload.data) ? payload.data : []
          } catch (error) { lastError = error }
        }
        throw lastError || new Error('Finance records could not be loaded.')
      })()
      const [txSnap, payrollSnap, financeRows, inventorySnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('branchId', '==', currentBranchId.value))),
        payrollRequest,
        financeRecordsRequest,
        getDocs(query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'users'), where('branchId', '==', currentBranchId.value), where('userType', '==', 'Staff')))
      ])

      transactions.value = txSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      payrolls.value = payrollSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      financialRecords.value = financeRows
      inventoryItems.value = inventorySnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      users.value = usersSnap.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((user) => !user.archived)
    })

    let unsubscribeAuth = null

    onMounted(trackPageLoad(async () => {
      await initSubscription()
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          transactions.value = []
          payrolls.value = []
          financialRecords.value = []
          inventoryItems.value = []
          users.value = []
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadData()
      })
    }))

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      pageLoading,
      selectedMonth,
      report,
      salesByStaff,
      salesByService,
      formatCurrency, hasPayroll,
      percent,
      exportPdf
    }
  }
}
</script>

