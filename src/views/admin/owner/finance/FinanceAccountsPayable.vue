<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Accounts Payable</h1>
        <p class="text-slate-400">Outstanding supplier obligations for purchase requests.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Supplier</label>
            <select v-model="selectedSupplier" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All Suppliers</option>
              <option v-for="supplier in supplierOptions" :key="supplier" :value="supplier">{{ supplier }}</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Delivery Status</label>
            <select v-model="selectedDeliveryStatus" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Delayed">Delayed</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Payment Status</label>
            <select v-model="selectedPaymentStatus" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search Item</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Item name..."
              class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Total Payable</p>
          <p class="text-2xl font-bold text-rose-400">{{ formatCurrency(totalPayable) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Unpaid Records</p>
          <p class="text-2xl font-bold text-white">{{ unpaidCount }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Partial Records</p>
          <p class="text-2xl font-bold text-amber-400">{{ partialCount }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Supplier</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Item</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Qty</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Unit Cost</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Total Cost</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Paid Amount</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Balance</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Delivery</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="row in filteredRows" :key="row.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white">{{ row.supplier || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ row.item || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ Number(row.quantity || 0) }} {{ row.unit || 'units' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatCurrency(getUnitCost(row)) }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatCurrency(getTotalCost(row)) }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatCurrency(getAmountPaid(row)) }}</td>
                <td class="px-6 py-4 text-rose-300 font-medium">{{ formatCurrency(getBalance(row)) }}</td>
                <td class="px-6 py-4">
                  <span :class="deliveryBadgeClass(row.status)">
                    {{ row.status || 'Pending' }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span :class="badgeClass(getPaymentStatus(row))">{{ getPaymentStatus(row) }}</span>
                </td>
                <td class="px-6 py-4">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-50"
                    :disabled="!row.receiptUrl"
                    @click="openReceiptModal(row)"
                  >
                    View Receipt
                  </button>
                </td>
              </tr>
              <tr v-if="rows.length === 0">
                <td colspan="10" class="px-6 py-8 text-center text-slate-400">No purchase records available.</td>
              </tr>
              <tr v-else-if="filteredRows.length === 0">
                <td colspan="10" class="px-6 py-8 text-center text-slate-400">No payable records matched your filters.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="showReceiptModal" class="fixed inset-0 bg-black/60 z-50 p-4 flex items-center justify-center">
        <div class="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl p-5 max-h-[90vh] overflow-auto">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h2 class="text-xl font-semibold text-white">Payment Receipt</h2>
              <p class="text-slate-400 text-sm">
                {{ selectedReceiptRow?.item || '-' }} - {{ selectedReceiptRow?.supplier || '-' }}
              </p>
            </div>
            <button type="button" class="text-slate-300 hover:text-white" @click="closeReceiptModal">Close</button>
          </div>

          <div v-if="selectedReceiptRow?.receiptUrl" class="space-y-3">
            <img
              v-if="isReceiptImage(selectedReceiptRow)"
              :src="selectedReceiptRow.receiptUrl"
              alt="Payment receipt"
              class="w-full max-h-[70vh] object-contain rounded-lg border border-slate-700 bg-slate-950"
            />
            <iframe
              v-else
              :src="selectedReceiptRow.receiptUrl"
              title="Payment receipt file"
              class="w-full h-[70vh] rounded-lg border border-slate-700 bg-white"
            ></iframe>
            <a
              :href="selectedReceiptRow.receiptUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block text-sky-300 hover:text-sky-200 underline text-sm"
            >
              Open in new tab
            </a>
          </div>
          <p v-else class="text-slate-400">No receipt uploaded for this record.</p>
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
  name: 'FinanceAccountsPayable',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const rows = ref([])
    const showReceiptModal = ref(false)
    const selectedReceiptRow = ref(null)

    const selectedSupplier = ref('')
    const selectedDeliveryStatus = ref('')
    const selectedPaymentStatus = ref('')
    const searchQuery = ref('')

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))

    const getUnitCost = (entry) =>
      Number(entry.unitCost || entry.costPerUnit || entry.costPrice || entry.unitPrice || entry.price || 0)

    const getTotalCost = (entry) => {
      const directTotal = Number(entry.totalCost || entry.total || 0)
      if (directTotal > 0) return directTotal
      return Number(entry.quantity || 0) * getUnitCost(entry)
    }

    const getPaymentStatus = (entry) => String(entry.paymentStatus || 'Unpaid').trim() || 'Unpaid'

    const getAmountPaid = (entry) => {
      const status = getPaymentStatus(entry)
      if (status === 'Paid') return getTotalCost(entry)
      return Number(entry.amountPaid || 0)
    }

    const getBalance = (entry) => {
      const status = getPaymentStatus(entry)
      if (status === 'Paid') return 0
      const explicitBalance = entry.balance
      if (explicitBalance !== undefined && explicitBalance !== null && explicitBalance !== '') {
        return Number(explicitBalance || 0)
      }
      return Math.max(0, getTotalCost(entry) - getAmountPaid(entry))
    }

    const badgeClass = (status) => {
      if (status === 'Paid') return 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400'
      if (status === 'Partial') return 'px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400'
      return 'px-3 py-1 rounded-full text-xs font-medium bg-rose-500/20 text-rose-400'
    }

    const deliveryBadgeClass = (status) => {
      const normalized = String(status || '').trim()
      if (normalized === 'Delivered') return 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400'
      if (normalized === 'Delayed') return 'px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400'
      return 'px-3 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400'
    }

    const supplierOptions = computed(() =>
      [...new Set(rows.value.map((item) => item.supplier).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
    )

    const filteredRows = computed(() =>
      rows.value
        .filter((row) => {
          const status = getPaymentStatus(row)
          if (selectedSupplier.value && row.supplier !== selectedSupplier.value) return false
          if (selectedDeliveryStatus.value && String(row.status || '') !== selectedDeliveryStatus.value) return false
          if (selectedPaymentStatus.value && status !== selectedPaymentStatus.value) return false
          if (searchQuery.value.trim()) {
            const text = searchQuery.value.trim().toLowerCase()
            if (!String(row.item || '').toLowerCase().includes(text)) return false
          }
          return true
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    )

    const totalPayable = computed(() => filteredRows.value.reduce((sum, row) => sum + getBalance(row), 0))
    const unpaidCount = computed(() => filteredRows.value.filter((row) => getPaymentStatus(row) === 'Unpaid').length)
    const partialCount = computed(() => filteredRows.value.filter((row) => getPaymentStatus(row) === 'Partial').length)
    const isReceiptImage = (row) => String(row?.receiptMimeType || '').toLowerCase().startsWith('image/')

    const loadRows = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value)))
      rows.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const openReceiptModal = (entry) => {
      selectedReceiptRow.value = entry || null
      showReceiptModal.value = true
    }

    const closeReceiptModal = () => {
      showReceiptModal.value = false
      selectedReceiptRow.value = null
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          rows.value = []
          return
        }
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadRows()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      rows,
      showReceiptModal,
      selectedReceiptRow,
      selectedSupplier,
      selectedDeliveryStatus,
      selectedPaymentStatus,
      searchQuery,
      supplierOptions,
      filteredRows,
      totalPayable,
      unpaidCount,
      partialCount,
      formatCurrency,
      getUnitCost,
      getTotalCost,
      getPaymentStatus,
      getAmountPaid,
      getBalance,
      badgeClass,
      deliveryBadgeClass,
      isReceiptImage,
      openReceiptModal,
      closeReceiptModal,
    }
  },
}
</script>

