<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Finance Reports</h1>
          <p class="text-slate-400">Monthly report view for profit, payroll, inventory valuation, and sales mix.</p>
        </div>
        <div>
          <label class="block text-slate-400 text-sm mb-2">Report Month</label>
          <input
            v-model="selectedMonth"
            type="month"
            class="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Revenue</p>
          <p class="text-2xl font-bold text-green-400">{{ formatCurrency(report.revenue) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Payroll</p>
          <p class="text-2xl font-bold text-rose-400">{{ formatCurrency(report.payroll) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Inventory Cost</p>
          <p class="text-2xl font-bold text-amber-400">{{ formatCurrency(report.inventoryCost) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Net Profit</p>
          <p class="text-2xl font-bold text-white">{{ formatCurrency(report.netProfit) }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4">Monthly Profit and Loss</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between text-slate-300">
            <span>Revenue</span>
            <span>{{ formatCurrency(report.revenue) }}</span>
          </div>
          <div class="flex justify-between text-slate-300">
            <span>Less: Payroll</span>
            <span>- {{ formatCurrency(report.payroll) }}</span>
          </div>
          <div class="flex justify-between text-slate-300">
            <span>Less: Inventory Purchases</span>
            <span>- {{ formatCurrency(report.inventoryCost) }}</span>
          </div>
          <div class="border-t border-slate-700 pt-2 flex justify-between text-white font-semibold">
            <span>Net Profit</span>
            <span>{{ formatCurrency(report.netProfit) }}</span>
          </div>
        </div>
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
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Payroll % of Revenue</p>
            <p class="text-white text-xl font-semibold mt-1">{{ percent(report.payrollPercent) }}</p>
          </div>
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Inventory % of Revenue</p>
            <p class="text-white text-xl font-semibold mt-1">{{ percent(report.inventoryPercent) }}</p>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'FinanceReports',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const transactions = ref([])
    const payrolls = ref([])
    const purchases = ref([])
    const inventoryItems = ref([])
    const users = ref([])
    const selectedMonth = ref(new Date().toISOString().slice(0, 7))

    const toDate = (timestamp) => (timestamp?.toDate ? timestamp.toDate() : null)
    const monthKey = (date) =>
      date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : ''
    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))
    const percent = (value) => `${Number(value || 0).toFixed(2)}%`

    const isInSelectedMonth = (timestamp) => monthKey(toDate(timestamp)) === selectedMonth.value

    const monthlyTransactions = computed(() => transactions.value.filter((tx) => isInSelectedMonth(tx.createdAt)))
    const monthlyPayrolls = computed(() => payrolls.value.filter((entry) => isInSelectedMonth(entry.createdAt)))
    const monthlyPurchases = computed(() =>
      purchases.value.filter((entry) => {
        if (String(entry.status || '').toLowerCase() !== 'delivered') return false
        return isInSelectedMonth(entry.deliveredAt || entry.updatedAt || entry.createdAt)
      })
    )

    const purchaseTotal = (entry) => {
      const directTotal = Number(entry.totalCost || entry.total || 0)
      if (directTotal > 0) return directTotal
      return (
        Number(entry.quantity || 0) *
        Number(entry.unitCost || entry.costPerUnit || entry.costPrice || entry.unitPrice || entry.price || 0)
      )
    }

    const getInventoryUnitPrice = (item) =>
      Number(item.unitPrice || item.price || item.costPrice || item.unitCost || item.costPerUnit || 0)

    const report = computed(() => {
      const revenue = monthlyTransactions.value.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      const payroll = monthlyPayrolls.value.reduce((sum, entry) => sum + Number(entry.totalPay || 0), 0)
      const inventoryCost = monthlyPurchases.value.reduce((sum, entry) => sum + purchaseTotal(entry), 0)
      const netProfit = revenue - payroll - inventoryCost
      const inventoryValuation = inventoryItems.value.reduce(
        (sum, item) => sum + Number(item.currentStock || 0) * getInventoryUnitPrice(item),
        0
      )
      return {
        revenue,
        payroll,
        inventoryCost,
        netProfit,
        inventoryValuation,
        payrollPercent: revenue > 0 ? (payroll / revenue) * 100 : 0,
        inventoryPercent: revenue > 0 ? (inventoryCost / revenue) * 100 : 0
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
      monthlyTransactions.value.forEach((tx) => {
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
      monthlyTransactions.value.forEach((tx) => {
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

    const loadData = async () => {
      if (!currentBranchId.value) return
      const [txSnap, payrollSnap, purchaseSnap, inventorySnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'payrolls'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'users'), where('branchId', '==', currentBranchId.value), where('userType', '==', 'Staff')))
      ])

      transactions.value = txSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      payrolls.value = payrollSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      purchases.value = purchaseSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      inventoryItems.value = inventorySnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      users.value = usersSnap.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((user) => !user.archived)
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          transactions.value = []
          payrolls.value = []
          purchases.value = []
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
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      selectedMonth,
      report,
      salesByStaff,
      salesByService,
      formatCurrency,
      percent
    }
  }
}
</script>

