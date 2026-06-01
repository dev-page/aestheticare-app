<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Finance Sales</h1>
        <p class="text-slate-400">Track transaction accuracy, refunds, package sales, and daily reconciliation.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">From</label>
            <input
              v-model="dateFrom"
              type="date"
              class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">To</label>
            <input
              v-model="dateTo"
              type="date"
              class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Staff</label>
            <select v-model="selectedStaff" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All Staff</option>
              <option v-for="staff in staffOptions" :key="staff.id" :value="staff.id">{{ staff.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Service / Item</label>
            <input
              v-model="serviceFilter"
              type="text"
              placeholder="Search service or item..."
              class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Payment Method</label>
            <select v-model="selectedMethod" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Filtered Revenue</p>
          <p class="text-2xl font-bold text-green-400">{{ formatCurrency(filteredRevenue) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Transactions</p>
          <p class="text-2xl font-bold text-white">{{ filteredTransactions.length }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Refund Count</p>
          <p class="text-2xl font-bold text-rose-400">{{ refundCount }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Package Sales</p>
          <p class="text-2xl font-bold text-indigo-400">{{ packageSalesCount }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-white">Daily Reconciliation (Today)</h2>
          <p class="text-slate-400 text-sm">{{ new Date().toLocaleDateString('en-PH') }}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Cash</p>
            <p class="text-white font-semibold text-lg mt-1">{{ formatCurrency(reconciliation.cash) }}</p>
          </div>
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">GCash</p>
            <p class="text-white font-semibold text-lg mt-1">{{ formatCurrency(reconciliation.gcash) }}</p>
          </div>
          <div class="bg-slate-700 rounded-lg p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Card</p>
            <p class="text-white font-semibold text-lg mt-1">{{ formatCurrency(reconciliation.card) }}</p>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Staff</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Category</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Method</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Amount</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Refund</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="tx in filteredTransactions" :key="tx.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-slate-300">{{ formatDate(tx.createdAt) }}</td>
                <td class="px-6 py-4 text-white">{{ tx.clientName || 'Walk-in Client' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ getStaffName(tx.receptionistId) }}</td>
                <td class="px-6 py-4 text-slate-300">{{ inferLabel(tx) }}</td>
                <td class="px-6 py-4 text-slate-300">{{ tx.method || '-' }}</td>
                <td class="px-6 py-4 text-green-400 font-medium">{{ formatCurrency(tx.amount) }}</td>
                <td class="px-6 py-4">
                  <span :class="isRefund(tx) ? 'px-3 py-1 rounded-full text-xs font-medium bg-rose-500/20 text-rose-400' : 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400'">
                    {{ isRefund(tx) ? 'Refunded' : 'None' }}
                  </span>
                </td>
              </tr>
              <tr v-if="transactions.length === 0">
                <td colspan="7" class="px-6 py-8 text-center text-slate-400">No transactions yet.</td>
              </tr>
              <tr v-else-if="filteredTransactions.length === 0">
                <td colspan="7" class="px-6 py-8 text-center text-slate-400">No transactions matched your filters.</td>
              </tr>
            </tbody>
          </table>
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
  name: 'FinanceSales',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const transactions = ref([])
    const staffOptions = ref([])

    const dateFrom = ref('')
    const dateTo = ref('')
    const selectedStaff = ref('')
    const selectedMethod = ref('')
    const serviceFilter = ref('')

    const toDate = (timestamp) => (timestamp?.toDate ? timestamp.toDate() : null)
    const formatDate = (timestamp) => {
      const date = toDate(timestamp)
      return date ? date.toLocaleString() : '-'
    }
    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))

    const isRefund = (tx) => String(tx.status || '').toLowerCase().includes('refund')

    const inferLabel = (tx) => {
      if (tx.type === 'appointment_payment') return 'Treatment'
      const itemNames = Array.isArray(tx.items) ? tx.items.map((item) => item.name || '').join(' ').toLowerCase() : ''
      if (itemNames.includes('package')) return 'Package Sale'
      if (itemNames.includes('inject') || itemNames.includes('botox') || itemNames.includes('filler')) return 'Injectable'
      if (
        itemNames.includes('serum') ||
        itemNames.includes('cleanser') ||
        itemNames.includes('moisturizer') ||
        itemNames.includes('sunscreen')
      ) {
        return 'Skincare Retail'
      }
      return tx.type === 'product_sale' ? 'Product Sale' : 'Other'
    }

    const getStaffName = (uid) => {
      const match = staffOptions.value.find((staff) => staff.id === uid)
      return match ? match.label : uid || '-'
    }

    const filteredTransactions = computed(() => {
      return [...transactions.value]
        .filter((tx) => {
          const date = toDate(tx.createdAt)
          if (dateFrom.value) {
            const from = new Date(`${dateFrom.value}T00:00:00`)
            if (!date || date < from) return false
          }
          if (dateTo.value) {
            const to = new Date(`${dateTo.value}T23:59:59`)
            if (!date || date > to) return false
          }
          if (selectedStaff.value && tx.receptionistId !== selectedStaff.value) return false
          if (selectedMethod.value && tx.method !== selectedMethod.value) return false
          if (serviceFilter.value.trim()) {
            const queryText = serviceFilter.value.toLowerCase()
            const service = String(tx.service || '').toLowerCase()
            const itemsText = Array.isArray(tx.items)
              ? tx.items.map((item) => String(item.name || '')).join(' ').toLowerCase()
              : ''
            if (!service.includes(queryText) && !itemsText.includes(queryText)) return false
          }
          return true
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    })

    const filteredRevenue = computed(() =>
      filteredTransactions.value.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    )
    const refundCount = computed(() => filteredTransactions.value.filter((tx) => isRefund(tx)).length)
    const packageSalesCount = computed(() =>
      filteredTransactions.value.filter((tx) => {
        const itemNames = Array.isArray(tx.items) ? tx.items.map((item) => item.name || '').join(' ').toLowerCase() : ''
        return tx.type === 'package_sale' || itemNames.includes('package')
      }).length
    )

    const reconciliation = computed(() => {
      const today = new Date()
      const rows = transactions.value.filter((tx) => {
        const date = toDate(tx.createdAt)
        return (
          date &&
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate() &&
          !isRefund(tx)
        )
      })

      return rows.reduce(
        (acc, tx) => {
          const method = String(tx.method || '').toLowerCase()
          const amount = Number(tx.amount || 0)
          if (method === 'cash') acc.cash += amount
          else if (method === 'gcash') acc.gcash += amount
          else if (method === 'card') acc.card += amount
          return acc
        },
        { cash: 0, gcash: 0, card: 0 }
      )
    })

    const loadSalesData = async () => {
      if (!currentBranchId.value) return

      const [txSnap, staffSnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'users'), where('branchId', '==', currentBranchId.value), where('userType', '==', 'Staff')))
      ])

      transactions.value = txSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      staffOptions.value = staffSnap.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((staff) => !staff.archived && ['receptionist', 'cashier', 'manager'].includes(String(staff.role || '').toLowerCase()))
        .map((staff) => ({
          id: staff.id,
          label: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || staff.id
        }))
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          transactions.value = []
          staffOptions.value = []
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadSalesData()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      transactions,
      staffOptions,
      dateFrom,
      dateTo,
      selectedStaff,
      selectedMethod,
      serviceFilter,
      filteredTransactions,
      filteredRevenue,
      refundCount,
      packageSalesCount,
      reconciliation,
      formatDate,
      formatCurrency,
      inferLabel,
      getStaffName,
      isRefund
    }
  }
}
</script>

