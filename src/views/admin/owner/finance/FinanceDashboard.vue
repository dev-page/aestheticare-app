<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" />
      <div v-else>
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Finance Dashboard</h1>
        <p class="text-slate-400">Revenue, expenses, and profitability snapshot for this branch.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Today's Revenue</h3>
          <p class="text-3xl font-bold text-green-400">{{ formatCurrency(todaysRevenue) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Total Revenue</h3>
          <p class="text-3xl font-bold text-green-400">{{ formatCurrency(monthlyRevenue) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Monthly Payroll</h3>
          <p class="text-3xl font-bold text-rose-400">{{ formatCurrency(monthlyPayrollExpense) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Monthly Inventory Cost</h3>
          <p class="text-3xl font-bold text-amber-400">{{ formatCurrency(monthlyInventoryExpense) }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-white mb-1">My Shift Assignment</h2>
        <p class="text-slate-400 text-sm mb-4">My Work Schedule</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Today</p>
            <p class="text-lg font-semibold text-white mt-1">{{ todayDayName }}</p>
            <p class="text-emerald-300 text-sm mt-1">{{ todayShiftLabel }}</p>
          </div>

          <div class="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide mb-2">This Week</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="entry in weeklyShiftAssignments"
                :key="entry.day"
                class="rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
              >
                <p class="text-slate-300 text-xs">{{ entry.day }}</p>
                <p class="text-white text-sm font-medium">{{ entry.shift }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-5">Revenue by Category (Month)</h2>
          <div class="space-y-4">
            <div v-for="row in revenueByCategoryRows" :key="row.key">
              <div class="flex items-center justify-between mb-1">
                <p class="text-slate-200 text-sm">{{ row.label }}</p>
                <p class="text-slate-200 text-sm font-medium">{{ formatCurrency(row.value) }}</p>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-2">
                <div class="h-2 rounded-full bg-emerald-500" :style="{ width: `${row.percent}%` }"></div>
              </div>
            </div>
            <p v-if="monthlyRevenue <= 0" class="text-slate-400 text-sm">No revenue records yet.</p>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-5">Profit Overview (Month)</h2>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-slate-300">Gross Profit</span>
              <span class="text-white font-semibold">{{ formatCurrency(grossProfit) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-300">Net Profit</span>
              <span class="text-white font-semibold">{{ formatCurrency(netProfit) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-300">Payroll as % of Revenue</span>
              <span class="text-white font-semibold">{{ formatPercent(payrollPercentage) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-300">Inventory Cost as % of Revenue</span>
              <span class="text-white font-semibold">{{ formatPercent(inventoryPercentage) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold text-white mb-2">Inventory Value</h2>
          <p class="text-3xl font-bold text-cyan-400">{{ formatCurrency(totalStockValue) }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold text-white mb-2">Low Stock Alerts</h2>
          <p class="text-3xl font-bold text-yellow-400">{{ lowStockCount }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold text-white mb-2">Expiring Items (30 days)</h2>
          <p class="text-3xl font-bold text-orange-400">{{ expiringSoonCount }}</p>
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
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'

export default {
  name: 'FinanceDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const loading = ref(true)

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const transactions = ref([])
    const payrolls = ref([])
    const purchases = ref([])
    const inventoryItems = ref([])
    const todayShiftLabel = ref('Off')
    const weeklyShiftAssignments = ref([])

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const todayDayName = computed(() =>
      new Date().toLocaleDateString('en-US', { weekday: 'long' })
    )

    const toDate = (timestamp) => (timestamp?.toDate ? timestamp.toDate() : null)
    const isSameDay = (left, right) =>
      left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    const isCurrentMonth = (date) => {
      if (!date) return false
      const now = new Date()
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    }

    const classifyRevenueCategory = (tx) => {
      const serviceText = String(tx.service || '').toLowerCase()
      const joinedItemNames = Array.isArray(tx.items)
        ? tx.items.map((i) => String(i.name || '')).join(' ').toLowerCase()
        : ''
      const searchable = `${serviceText} ${joinedItemNames}`

      if (searchable.includes('botox') || searchable.includes('filler') || searchable.includes('inject')) {
        return 'injectables'
      }
      if (
        searchable.includes('serum') ||
        searchable.includes('cleanser') ||
        searchable.includes('sunscreen') ||
        searchable.includes('moisturizer') ||
        searchable.includes('retail') ||
        tx.type === 'product_sale'
      ) {
        return 'skincare'
      }
      return 'treatments'
    }

    const getPurchaseTotal = (purchase) => {
      const totalCost = Number(purchase.totalCost || purchase.total || 0)
      if (totalCost > 0) return totalCost

      const unitCost = Number(
        purchase.unitCost || purchase.costPerUnit || purchase.costPrice || purchase.unitPrice || purchase.price || 0
      )
      const quantity = Number(purchase.quantity || 0)
      return unitCost > 0 && quantity > 0 ? unitCost * quantity : 0
    }

    const getInventoryUnitPrice = (item) =>
      Number(item.unitPrice || item.price || item.costPrice || item.unitCost || item.costPerUnit || 0)

    const todaysRevenue = computed(() => {
      const today = new Date()
      return transactions.value.reduce((sum, tx) => {
        const date = toDate(tx.createdAt)
        if (!isSameDay(date, today)) return sum
        return sum + Number(tx.amount || 0)
      }, 0)
    })

    const monthlyTransactions = computed(() =>
      transactions.value.filter((tx) => isCurrentMonth(toDate(tx.createdAt)))
    )

    const monthlyRevenue = computed(() =>
      monthlyTransactions.value.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    )

    const monthlyPayrollExpense = computed(() =>
      payrolls.value
        .filter((entry) => isCurrentMonth(toDate(entry.createdAt)))
        .reduce((sum, entry) => sum + Number(entry.totalPay || 0), 0)
    )

    const monthlyInventoryExpense = computed(() =>
      purchases.value
        .filter((entry) => {
          if (String(entry.status || '').toLowerCase() !== 'delivered') return false
          const sourceDate = toDate(entry.deliveredAt) || toDate(entry.updatedAt) || toDate(entry.createdAt)
          return isCurrentMonth(sourceDate)
        })
        .reduce((sum, entry) => sum + getPurchaseTotal(entry), 0)
    )

    const revenueByCategory = computed(() => {
      const totals = { injectables: 0, treatments: 0, skincare: 0 }
      monthlyTransactions.value.forEach((tx) => {
        const key = classifyRevenueCategory(tx)
        totals[key] += Number(tx.amount || 0)
      })
      return totals
    })

    const revenueByCategoryRows = computed(() => {
      const revenue = monthlyRevenue.value
      const rows = [
        { key: 'injectables', label: 'Injectables', value: revenueByCategory.value.injectables },
        { key: 'treatments', label: 'Treatments', value: revenueByCategory.value.treatments },
        { key: 'skincare', label: 'Skincare Retail', value: revenueByCategory.value.skincare }
      ]
      return rows.map((row) => ({
        ...row,
        percent: revenue > 0 ? Math.round((row.value / revenue) * 100) : 0
      }))
    })

    const grossProfit = computed(() => monthlyRevenue.value - monthlyInventoryExpense.value)
    const netProfit = computed(
      () => monthlyRevenue.value - monthlyInventoryExpense.value - monthlyPayrollExpense.value
    )
    const payrollPercentage = computed(() =>
      monthlyRevenue.value > 0 ? (monthlyPayrollExpense.value / monthlyRevenue.value) * 100 : 0
    )
    const inventoryPercentage = computed(() =>
      monthlyRevenue.value > 0 ? (monthlyInventoryExpense.value / monthlyRevenue.value) * 100 : 0
    )

    const totalStockValue = computed(() =>
      inventoryItems.value.reduce((sum, item) => {
        const stock = Number(item.currentStock || 0)
        const unitPrice = getInventoryUnitPrice(item)
        return sum + stock * unitPrice
      }, 0)
    )

    const lowStockCount = computed(() =>
      inventoryItems.value.filter((item) => {
        const stock = Number(item.currentStock || 0)
        const minStock = Number(item.minStock || 0)
        const explicitStatus = String(item.stockStatus || '').trim().toLowerCase()

        if (explicitStatus === 'low stock') return true
        if (explicitStatus === 'out of stock') return false

        // Only treat as low stock when thresholds are meaningful.
        return stock > 0 && minStock > 0 && stock < minStock
      }).length
    )

    const expiringSoonCount = computed(() => {
      const now = new Date()
      const cutoff = new Date()
      cutoff.setDate(now.getDate() + 30)

      return inventoryItems.value.filter((item) => {
        const source = item.expiryDate || item.expirationDate || item.expireAt
        const date = source?.toDate ? source.toDate() : source ? new Date(source) : null
        return date && !Number.isNaN(date.getTime()) && date >= now && date <= cutoff
      }).length
    })

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))
    const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`

    const getWeekStartKey = (baseDate = new Date()) => {
      const currentDay = baseDate.getDay()
      const diffToMonday = (currentDay + 6) % 7
      const monday = new Date(baseDate)
      monday.setDate(baseDate.getDate() - diffToMonday)
      const yyyy = monday.getFullYear()
      const mm = String(monday.getMonth() + 1).padStart(2, '0')
      const dd = String(monday.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const loadCurrentUserShift = async (profile = {}, userId = '') => {
      const fallbackShift =
        String(profile.shiftStart || '').trim() && String(profile.shiftEnd || '').trim()
          ? `${profile.shiftStart} - ${profile.shiftEnd}`
          : 'Off'

      try {
        const weekKey = getWeekStartKey(new Date())
        const schedulesSnap = await getDocs(collection(db, 'users', userId, 'schedules'))
        const weekMap = buildWeekScheduleMap(schedulesSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} })))
        const assignments = resolveWeekAssignments(weekMap, weekKey)

        weeklyShiftAssignments.value = daysOfWeek.map((day) => ({
          day,
          shift: String(assignments[day] || '').trim() || 'Off'
        }))

        const todayEntry = weeklyShiftAssignments.value.find((entry) => entry.day === todayDayName.value)
        todayShiftLabel.value = todayEntry?.shift || fallbackShift
      } catch {
        weeklyShiftAssignments.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
        todayShiftLabel.value = fallbackShift
      }
    }

    const loadFinanceData = async () => {
      if (!currentBranchId.value) return

      const [txSnap, payrollSnap, purchaseSnap, inventorySnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'payrolls'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value)))
      ])

      transactions.value = txSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      payrolls.value = payrollSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      purchases.value = purchaseSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      inventoryItems.value = inventorySnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        loading.value = true
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          transactions.value = []
          payrolls.value = []
          purchases.value = []
          inventoryItems.value = []
          todayShiftLabel.value = 'Off'
          weeklyShiftAssignments.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
          loading.value = false
          return
        }

        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid))
          const profile = userSnap.exists() ? userSnap.data() : {}
          currentUserId.value = user.uid
          currentBranchId.value = profile.branchId || ''
          await loadCurrentUserShift(profile, user.uid)

          if (!currentBranchId.value) {
            toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
            return
          }

          await loadFinanceData()
        } finally {
          loading.value = false
        }
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      loading,
      todaysRevenue,
      monthlyRevenue,
      monthlyPayrollExpense,
      monthlyInventoryExpense,
      revenueByCategoryRows,
      grossProfit,
      netProfit,
      payrollPercentage,
      inventoryPercentage,
      totalStockValue,
      lowStockCount,
      expiringSoonCount,
      todayDayName,
      todayShiftLabel,
      weeklyShiftAssignments,
      formatCurrency,
      formatPercent
    }
  }
}
</script>

