<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    
    <main class="flex-1 p-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Sales Report</h1>
        <p class="text-slate-400">Compare sales performance across branches</p>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Total Revenue</h3>
          <p class="text-3xl font-bold text-white">{{ formatCurrency(totalRevenue) }}</p>
          <p class="text-xs text-slate-500 mt-2">{{ growthLabel }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Average per Branch</h3>
          <p class="text-3xl font-bold text-white">{{ formatCurrency(averagePerBranch) }}</p>
          <p class="text-xs text-slate-500 mt-2">Across {{ branchCount }} branch(es)</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Top Performer</h3>
          <p class="text-2xl font-bold text-purple-500">{{ topPerformerName }}</p>
          <p class="text-xs text-slate-500 mt-2">{{ formatCurrency(topPerformerRevenue) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Growth Rate</h3>
          <p class="text-3xl font-bold text-white">{{ growthRateLabel }}</p>
          <p class="text-xs text-slate-500 mt-2">{{ periodLabel }}</p>
        </div>
      </div>

      <!-- Branch Comparison Chart -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-white">Branch Sales Comparison</h2>
          <select 
            v-model="selectedPeriod"
            class="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
        
        <!-- Bar Chart -->
        <div class="space-y-6">
          <div v-for="branch in branchSales" :key="branch.name" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-white font-medium">{{ branch.name }}</span>
              <span class="text-slate-400">{{ formatCurrency(branch.revenue) }}</span>
            </div>
            <div class="relative">
              <div class="w-full bg-slate-700 rounded-full h-8">
                <div
                  class="bg-gradient-to-r from-purple-500 to-purple-600 h-8 rounded-full flex items-center justify-end px-4 transition-all duration-500"
                  :style="{ width: `${branch.barPercent}%` }"
                >
                  <span class="text-white text-sm font-medium">{{ branch.sharePercent }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Expenses Section -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-white mb-6">Expenses by Branch</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="expense in branchExpenses" :key="expense.branch" class="bg-slate-700 rounded-lg p-4">
            <h3 class="text-white font-medium mb-3">{{ expense.branch }}</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-slate-400">Payroll</span>
                <span class="text-white">{{ formatCurrency(expense.payroll) }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-slate-400">Inventory Purchases</span>
                <span class="text-white">{{ formatCurrency(expense.supplies) }}</span>
              </div>
              <div class="flex items-center justify-between text-sm pt-2 border-t border-slate-600">
                <span class="text-slate-300 font-medium">Total</span>
                <span class="text-purple-500 font-semibold">{{ formatCurrency(expense.total) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Profit Margin -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 class="text-xl font-semibold text-white mb-6">Profit Margin by Branch</h2>
        <div class="space-y-4">
          <div v-for="profit in profitMargins" :key="profit.branch" class="flex items-center gap-4">
            <div class="flex-1">
              <div class="flex items-center justify-between mb-2">
                <span class="text-white font-medium">{{ profit.branch }}</span>
                <div class="flex items-center gap-4">
                  <span class="text-slate-400 text-sm">Revenue: {{ formatCurrency(profit.revenue) }}</span>
                  <span class="text-slate-400 text-sm">Expenses: {{ formatCurrency(profit.expenses) }}</span>
                  <span 
                    :class="[
                      'text-sm font-semibold',
                      profit.margin >= 30 ? 'text-green-500' : profit.margin >= 20 ? 'text-yellow-500' : 'text-red-500'
                    ]"
                  >
                    {{ profit.margin }}% margin
                  </span>
                </div>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-2">
                <div 
                  :class="[
                    'h-2 rounded-full transition-all duration-500',
                    profit.margin >= 30 ? 'bg-green-500' : profit.margin >= 20 ? 'bg-yellow-500' : 'bg-red-500'
                  ]"
                  :style="{ width: `${profit.margin}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { auth } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'HRSales',
  components: {
    OwnerSidebar
  },
  setup() {
    const selectedPeriod = ref('month')
    const db = getFirestore(getApp())

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const branches = ref([])
    const transactions = ref([])
    const payrolls = ref([])
    const purchases = ref([])

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))

    const toDate = (value) => {
      if (!value) return null
      if (value?.toDate) return value.toDate()
      if (value?.seconds) return new Date(value.seconds * 1000)
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const getPeriodRange = (anchorDate, period) => {
      const date = new Date(anchorDate)
      if (period === 'month') {
        const start = new Date(date.getFullYear(), date.getMonth(), 1)
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
        return { start, end }
      }
      if (period === 'quarter') {
        const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3
        const start = new Date(date.getFullYear(), quarterStartMonth, 1)
        const end = new Date(date.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999)
        return { start, end }
      }
      const start = new Date(date.getFullYear(), 0, 1)
      const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
      return { start, end }
    }

    const getPreviousRange = (currentRange, period) => {
      const { start } = currentRange
      if (period === 'month') {
        const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
        const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999)
        return { start: prevStart, end: prevEnd }
      }
      if (period === 'quarter') {
        const prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1)
        const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999)
        return { start: prevStart, end: prevEnd }
      }
      const prevStart = new Date(start.getFullYear() - 1, 0, 1)
      const prevEnd = new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
      return { start: prevStart, end: prevEnd }
    }

    const isWithinRange = (value, range) => {
      const date = toDate(value)
      if (!date) return false
      return date >= range.start && date <= range.end
    }

    const branchCount = computed(() => branches.value.length)

    const currentRange = computed(() => getPeriodRange(new Date(), selectedPeriod.value))
    const previousRange = computed(() => getPreviousRange(currentRange.value, selectedPeriod.value))

    const currentTransactions = computed(() =>
      transactions.value.filter((tx) => {
        if (String(tx.status || '').toLowerCase() !== 'paid') return false
        return isWithinRange(tx.createdAt, currentRange.value)
      })
    )

    const previousTransactions = computed(() =>
      transactions.value.filter((tx) => {
        if (String(tx.status || '').toLowerCase() !== 'paid') return false
        return isWithinRange(tx.createdAt, previousRange.value)
      })
    )

    const currentPayrolls = computed(() =>
      payrolls.value.filter((entry) => isWithinRange(entry.createdAt || entry.date, currentRange.value))
    )

    const currentPurchases = computed(() =>
      purchases.value.filter((entry) => {
        const status = String(entry.status || '').toLowerCase()
        if (!['delivered', 'completed', 'complete'].includes(status)) return false
        return isWithinRange(entry.deliveredAt || entry.updatedAt || entry.createdAt, currentRange.value)
      })
    )

    const purchaseTotal = (entry) => {
      const directTotal = Number(entry.totalCost || entry.total || entry.grandTotal || 0)
      if (directTotal > 0) return directTotal
      if (Array.isArray(entry.items) && entry.items.length) {
        return entry.items.reduce((sum, item) => {
          const itemTotal = Number(item.totalCost || item.total || 0)
          if (itemTotal > 0) return sum + itemTotal
          return sum + Number(item.quantity || 0) * Number(item.unitCost || item.costPerUnit || item.price || 0)
        }, 0)
      }
      return (
        Number(entry.quantity || 0) *
        Number(entry.unitCost || entry.costPerUnit || entry.costPrice || entry.unitPrice || entry.price || 0)
      )
    }

    const payrollTotal = (entry) => {
      const candidates = [
        entry.totalPay,
        entry.netPay,
        entry.totalEarnings,
        entry.total,
        entry.amount
      ]
      for (const value of candidates) {
        const numeric = Number(value)
        if (Number.isFinite(numeric) && numeric > 0) return numeric
      }
      return 0
    }

    const totalRevenue = computed(() =>
      currentTransactions.value.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    )

    const previousRevenue = computed(() =>
      previousTransactions.value.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    )

    const growthRate = computed(() => {
      if (previousRevenue.value <= 0) return null
      return ((totalRevenue.value - previousRevenue.value) / previousRevenue.value) * 100
    })

    const growthRateLabel = computed(() => {
      if (growthRate.value === null) return 'N/A'
      const sign = growthRate.value >= 0 ? '+' : ''
      return `${sign}${growthRate.value.toFixed(1)}%`
    })

    const periodLabel = computed(() => {
      if (selectedPeriod.value === 'month') return 'Month over month'
      if (selectedPeriod.value === 'quarter') return 'Quarter over quarter'
      return 'Year over year'
    })

    const growthLabel = computed(() => {
      if (growthRate.value === null) return 'No prior period data'
      return `${growthRate.value >= 0 ? 'Up' : 'Down'} vs previous period`
    })

    const revenueByBranch = computed(() => {
      const map = new Map()
      branches.value.forEach((branch) => {
        map.set(branch.id, { id: branch.id, name: branch.name, revenue: 0 })
      })
      currentTransactions.value.forEach((tx) => {
        const entry = map.get(tx.branchId)
        if (entry) entry.revenue += Number(tx.amount || 0)
      })
      return Array.from(map.values())
    })

    const maxRevenue = computed(() => Math.max(...revenueByBranch.value.map((b) => b.revenue), 0))

    const branchSales = computed(() => {
      const total = totalRevenue.value || 0
      return revenueByBranch.value
        .map((branch) => ({
          ...branch,
          barPercent: maxRevenue.value > 0 ? Math.max((branch.revenue / maxRevenue.value) * 100, 4) : 0,
          sharePercent: total > 0 ? Math.round((branch.revenue / total) * 100) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
    })

    const averagePerBranch = computed(() => {
      if (!branchCount.value) return 0
      return totalRevenue.value / branchCount.value
    })

    const topPerformer = computed(() => branchSales.value[0] || { name: 'N/A', revenue: 0 })
    const topPerformerName = computed(() => topPerformer.value.name || 'N/A')
    const topPerformerRevenue = computed(() => topPerformer.value.revenue || 0)

    const branchExpenses = computed(() => {
      const map = new Map()
      branches.value.forEach((branch) => {
        map.set(branch.id, {
          branch: branch.name,
          payroll: 0,
          supplies: 0,
          total: 0
        })
      })

      currentPayrolls.value.forEach((entry) => {
        const row = map.get(entry.branchId)
        if (row) row.payroll += payrollTotal(entry)
      })

      currentPurchases.value.forEach((entry) => {
        const row = map.get(entry.branchId)
        if (row) row.supplies += purchaseTotal(entry)
      })

      map.forEach((row) => {
        row.total = row.payroll + row.supplies
      })

      return Array.from(map.values())
    })

    const profitMargins = computed(() => {
      return branchSales.value.map((branch) => {
        const expense = branchExpenses.value.find((row) => row.branch === branch.name)
        const expenses = expense ? expense.total : 0
        const revenue = branch.revenue
        const margin = revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0
        return { branch: branch.name, revenue, expenses, margin }
      })
    })

    const loadBranches = async (user) => {
      if (!user) {
        branches.value = []
        currentBranchId.value = ''
        return
      }

      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (!userSnap.exists()) {
        branches.value = []
        currentBranchId.value = ''
        return
      }

      currentBranchId.value = userSnap.data().branchId || ''
      if (!currentBranchId.value) {
        branches.value = []
        toast.error('Your account has no branch assignment.')
        return
      }

      const branchSnap = await getDoc(doc(db, 'clinics', currentBranchId.value))
      const ownerId = branchSnap.exists() ? branchSnap.data().ownerId || '' : ''
      if (!ownerId) {
        branches.value = []
        toast.error('Owner mapping not found for this branch.')
        return
      }

      const ownerClinicsSnapshot = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', ownerId)))
      branches.value = ownerClinicsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {}
        return {
          id: docSnap.id,
          name: data.clinicBranch || data.clinicName || 'Branch'
        }
      })
    }

    const chunkArray = (arr, size) => {
      const chunks = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    }

    const loadCollectionByBranches = async (collectionName, branchIds) => {
      if (!branchIds.length) return []
      const chunks = chunkArray(branchIds, 10)
      const results = []
      for (const chunk of chunks) {
        const snapshot = await getDocs(query(collection(db, collectionName), where('branchId', 'in', chunk)))
        snapshot.docs.forEach((docSnap) => results.push({ id: docSnap.id, ...docSnap.data() }))
      }
      return results
    }

    const loadReports = async () => {
      const branchIds = branches.value.map((branch) => branch.id)
      if (!branchIds.length) {
        transactions.value = []
        payrolls.value = []
        purchases.value = []
        return
      }

      try {
        const [txData, payrollData, purchaseData] = await Promise.all([
          loadCollectionByBranches('transactions', branchIds),
          loadCollectionByBranches('payrolls', branchIds),
          loadCollectionByBranches('purchaseRequests', branchIds)
        ])

        transactions.value = txData
        payrolls.value = payrollData
        purchases.value = purchaseData
      } catch (error) {
        console.error('Failed to load HR reports:', error)
        toast.error('Failed to load reports data.')
      }
    }

    let unsubscribeAuth = null
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        currentUserId.value = user?.uid || ''
        await loadBranches(user)
        await loadReports()
      })
    })

    watch(selectedPeriod, async () => {
      await loadReports()
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      selectedPeriod,
      branchSales,
      branchExpenses,
      totalRevenue,
      averagePerBranch,
      topPerformerRevenue,
      topPerformerName,
      profitMargins,
      formatCurrency,
      growthRateLabel,
      periodLabel,
      growthLabel,
      branchCount
    }
  }
}
</script>

