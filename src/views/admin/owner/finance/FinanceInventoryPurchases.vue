<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6">
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-white mb-1">Inventory & Purchases</h1>
        <p class="text-slate-400 text-xs">Track supplier spending, stock levels, expiry, and item cost trends.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-5">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label class="block text-slate-400 text-xs mb-2">Supplier</label>
            <select v-model="selectedSupplier" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 text-sm focus:border-purple-500 focus:outline-none">
              <option value="">All Suppliers</option>
              <option v-for="supplier in supplierOptions" :key="supplier" :value="supplier">{{ supplier }}</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-xs mb-2">Purchase Status</label>
            <select v-model="selectedStatus" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 text-sm focus:border-purple-500 focus:outline-none">
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Delayed">Delayed</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-xs mb-2">Payment Status</label>
            <select v-model="selectedPaymentStatus" class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 text-sm focus:border-purple-500 focus:outline-none">
              <option value="">All</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-xs mb-2">Search Item</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Item name..."
              class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 text-sm focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div class="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p class="text-slate-400 text-xs">Total Stock Value</p>
          <p class="text-xl font-bold text-cyan-400">{{ formatCurrency(totalStockValue) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p class="text-slate-400 text-xs">Delivered Purchase Cost</p>
          <p class="text-xl font-bold text-amber-400">{{ formatCurrency(deliveredPurchaseCost) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p class="text-slate-400 text-xs">Expiring Batches (30 days)</p>
          <p class="text-xl font-bold text-orange-400">{{ expiringSoonCount }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
        <div class="px-5 py-3 border-b border-slate-700">
          <h2 class="text-base font-semibold text-white">Purchase Records</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Supplier</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Item</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Qty</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Unit Cost</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Total Cost</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Purchase Date</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Delivery Status</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Payment</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Paid Amount</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="purchase in filteredPurchases" :key="purchase.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-5 py-3 text-white text-sm">{{ purchase.supplier || '-' }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ purchase.item || '-' }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ Number(purchase.quantity || 0) }} {{ purchase.unit || 'units' }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ formatCurrency(getUnitCost(purchase)) }}</td>
                <td class="px-5 py-3 text-amber-400 font-semibold text-sm">{{ formatCurrency(getTotalCost(purchase)) }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ formatDate(purchase.deliveredAt || purchase.createdAt) }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ purchase.status || '-' }}</td>
                <td class="px-5 py-3">
                  <button
                    @click="togglePaymentQuick(purchase)"
                    :disabled="savingPaymentId === purchase.id"
                    class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors disabled:opacity-60"
                    :class="paymentBadgeClass(getPaymentStatus(purchase))"
                    title="Click to toggle unpaid/paid"
                  >
                    {{ getPaymentStatus(purchase) }}
                  </button>
                </td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ formatCurrency(getAmountPaid(purchase)) }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ formatCurrency(getBalance(purchase)) }}</td>
              </tr>
              <tr v-if="purchases.length === 0">
                <td colspan="10" class="px-6 py-8 text-center text-slate-400">No purchase records yet.</td>
              </tr>
              <tr v-else-if="filteredPurchases.length === 0">
                <td colspan="10" class="px-6 py-8 text-center text-slate-400">No purchase records matched your filters.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold text-white">Current Stock and Batch Expiry</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-700">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Item</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Stock</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Stock Value</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Batch / Expiry</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="item in inventoryItems" :key="item.id" class="hover:bg-slate-700/50 transition-colors">
                  <td class="px-6 py-4 text-white">{{ item.name || '-' }}</td>
                  <td class="px-6 py-4 text-slate-300">{{ Number(item.currentStock || 0) }} {{ item.unit || 'units' }}</td>
                  <td class="px-6 py-4 text-cyan-400 font-semibold">{{ formatCurrency(Number(item.currentStock || 0) * getInventoryUnitPrice(item)) }}</td>
                  <td class="px-6 py-4 text-slate-300">{{ item.batchNo || item.batchNumber || '-' }} / {{ formatExpiry(item) }}</td>
                </tr>
                <tr v-if="inventoryItems.length === 0">
                  <td colspan="4" class="px-6 py-8 text-center text-slate-400">No inventory items available.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold text-white">Cost History per Item</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-700">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Item</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Avg Unit Cost</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Last Unit Cost</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Entries</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="row in costHistory" :key="row.item" class="hover:bg-slate-700/50 transition-colors">
                  <td class="px-6 py-4 text-white">{{ row.item }}</td>
                  <td class="px-6 py-4 text-slate-300">{{ formatCurrency(row.avgUnitCost) }}</td>
                  <td class="px-6 py-4 text-slate-300">{{ formatCurrency(row.lastUnitCost) }}</td>
                  <td class="px-6 py-4 text-slate-300">{{ row.entries }}</td>
                </tr>
                <tr v-if="costHistory.length === 0">
                  <td colspan="4" class="px-6 py-8 text-center text-slate-400">No cost history data available.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'FinanceInventoryPurchases',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const purchases = ref([])
    const inventoryItems = ref([])
    const suppliers = ref([])
    const savingPaymentId = ref('')

    const selectedSupplier = ref('')
    const selectedStatus = ref('')
    const selectedPaymentStatus = ref('')
    const searchQuery = ref('')

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))
    const formatDate = (timestamp) => (timestamp?.toDate ? timestamp.toDate().toLocaleDateString('en-PH') : '-')

    const getSupplierOfferedUnitCost = (purchase) => {
      const supplierName = String(purchase?.supplier || '').trim().toLowerCase()
      const itemName = String(purchase?.item || '').trim().toLowerCase()
      if (!supplierName || !itemName) return 0

      const supplier = suppliers.value.find((entry) => String(entry.name || '').trim().toLowerCase() === supplierName)
      if (!supplier) return 0

      const offeredItems = Array.isArray(supplier.offeredItems) ? supplier.offeredItems : []
      const offered = offeredItems.find((entry) => String(entry?.name || '').trim().toLowerCase() === itemName)
      if (!offered) return 0

      return Number(offered.unitCost || offered.costPerUnit || offered.costPrice || offered.unitPrice || offered.price || 0)
    }

    const getInventoryItemUnitCostByPurchase = (purchase) => {
      const supplierName = String(purchase?.supplier || '').trim().toLowerCase()
      const itemName = String(purchase?.item || '').trim().toLowerCase()
      if (!itemName) return 0

      const inventoryItem = inventoryItems.value.find((item) => {
        const sameName = String(item?.name || '').trim().toLowerCase() === itemName
        const inventorySupplier = String(item?.supplier || '').trim().toLowerCase()
        const sameSupplier = !supplierName || !inventorySupplier || inventorySupplier === supplierName
        return sameName && sameSupplier
      })

      if (!inventoryItem) return 0
      return Number(
        inventoryItem.costPrice ||
          inventoryItem.unitCost ||
          inventoryItem.costPerUnit ||
          inventoryItem.unitPrice ||
          inventoryItem.price ||
          0
      )
    }

    const getUnitCost = (purchase) =>
      Number(
        purchase.unitCost ||
          purchase.costPerUnit ||
          purchase.costPrice ||
          purchase.unitPrice ||
          purchase.price ||
          getInventoryItemUnitCostByPurchase(purchase) ||
          getSupplierOfferedUnitCost(purchase) ||
          0
      )
    const getInventoryUnitPrice = (item) =>
      Number(item.unitPrice || item.price || item.costPrice || item.unitCost || item.costPerUnit || 0)
    const getTotalCost = (purchase) => {
      const total = Number(purchase.totalCost || purchase.total || 0)
      if (total > 0) return total
      return Number(purchase.quantity || 0) * getUnitCost(purchase)
    }
    const getPaymentStatus = (purchase) => {
      const raw = String(purchase.paymentStatus || '').trim()
      if (raw) return raw
      return 'Unpaid'
    }
    const getAmountPaid = (purchase) => {
      const status = getPaymentStatus(purchase)
      const totalCost = getTotalCost(purchase)
      if (status === 'Paid') return totalCost
      return Number(purchase.amountPaid || 0)
    }
    const getBalance = (purchase) => {
      const status = getPaymentStatus(purchase)
      if (status === 'Paid') return 0

      const explicitBalance = purchase.balance
      if (explicitBalance !== undefined && explicitBalance !== null && explicitBalance !== '') {
        return Number(explicitBalance || 0)
      }
      return Math.max(0, getTotalCost(purchase) - getAmountPaid(purchase))
    }

    const paymentBadgeClass = (status) => {
      if (status === 'Paid') return 'bg-green-500/20 text-green-400'
      if (status === 'Partial') return 'bg-yellow-500/20 text-yellow-400'
      return 'bg-rose-500/20 text-rose-400'
    }

    const supplierOptions = computed(() => {
      return [...new Set(purchases.value.map((item) => item.supplier).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b))
      )
    })

    const filteredPurchases = computed(() => {
      return purchases.value
        .filter((purchase) => {
          if (selectedSupplier.value && purchase.supplier !== selectedSupplier.value) return false
          if (selectedStatus.value && purchase.status !== selectedStatus.value) return false
          if (selectedPaymentStatus.value && getPaymentStatus(purchase) !== selectedPaymentStatus.value) return false
          if (searchQuery.value.trim()) {
            const queryText = searchQuery.value.toLowerCase()
            if (!String(purchase.item || '').toLowerCase().includes(queryText)) return false
          }
          return true
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    })

    const deliveredPurchaseCost = computed(() =>
      purchases.value
        .filter((purchase) => String(purchase.status || '').toLowerCase() === 'delivered')
        .reduce((sum, purchase) => sum + getTotalCost(purchase), 0)
    )

    const totalStockValue = computed(() =>
      inventoryItems.value.reduce(
        (sum, item) => sum + Number(item.currentStock || 0) * getInventoryUnitPrice(item),
        0
      )
    )

    const expiringSoonCount = computed(() => {
      const now = new Date()
      const cutoff = new Date()
      cutoff.setDate(now.getDate() + 30)

      return inventoryItems.value.filter((item) => {
        const raw = item.expiryDate || item.expirationDate || item.expireAt
        const date = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null
        return date && !Number.isNaN(date.getTime()) && date >= now && date <= cutoff
      }).length
    })

    const formatExpiry = (item) => {
      const raw = item.expiryDate || item.expirationDate || item.expireAt
      const date = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null
      return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-PH') : '-'
    }

    const costHistory = computed(() => {
      const grouped = {}

      purchases.value.forEach((purchase) => {
        const item = String(purchase.item || '').trim()
        if (!item) return
        const unitCost = getUnitCost(purchase)
        if (!grouped[item]) {
          grouped[item] = { item, sumUnitCost: 0, entries: 0, lastUnitCost: 0, lastTime: 0 }
        }

        grouped[item].sumUnitCost += unitCost
        grouped[item].entries += 1

        const createdAtSec = purchase.createdAt?.seconds || 0
        if (createdAtSec >= grouped[item].lastTime) {
          grouped[item].lastTime = createdAtSec
          grouped[item].lastUnitCost = unitCost
        }
      })

      return Object.values(grouped)
        .map((entry) => ({
          item: entry.item,
          entries: entry.entries,
          avgUnitCost: entry.entries > 0 ? entry.sumUnitCost / entry.entries : 0,
          lastUnitCost: entry.lastUnitCost
        }))
        .sort((a, b) => b.entries - a.entries)
    })

    const loadInventoryPurchaseData = async () => {
      if (!currentBranchId.value) return

      const [purchaseSnap, inventorySnap, supplierSnap] = await Promise.all([
        getDocs(query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'suppliers'), where('branchId', '==', currentBranchId.value))),
      ])

      purchases.value = purchaseSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      inventoryItems.value = inventorySnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      suppliers.value = supplierSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const togglePaymentQuick = async (purchase) => {
      const deliveryStatus = String(purchase.status || '')
      if (deliveryStatus !== 'Delivered') {
        toast.error('Only delivered purchase requests can be settled.')
        return
      }

      const totalCost = getTotalCost(purchase)
      const currentStatus = getPaymentStatus(purchase)
      const nextStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid'
      const amountPaid = nextStatus === 'Paid' ? totalCost : 0
      const balance = nextStatus === 'Paid' ? 0 : totalCost

      const paidAt = nextStatus === 'Paid' ? serverTimestamp() : null

      savingPaymentId.value = purchase.id
      try {
        await updateDoc(doc(db, 'purchaseRequests', purchase.id), {
          paymentStatus: nextStatus,
          amountPaid,
          balance,
          paidAt,
          paidBy: currentUserId.value || null,
          updatedAt: serverTimestamp()
        })

        const target = purchases.value.find((entry) => entry.id === purchase.id)
        if (target) {
          target.paymentStatus = nextStatus
          target.amountPaid = amountPaid
          target.balance = balance
        }

        toast.success('Payment status updated.')
      } catch (error) {
        console.error(error)
        toast.error('Failed to update payment status.')
      } finally {
        savingPaymentId.value = ''
      }
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          currentUserId.value = ''
          purchases.value = []
          inventoryItems.value = []
          suppliers.value = []
          return
        }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadInventoryPurchaseData()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      purchases,
      inventoryItems,
      selectedSupplier,
      selectedStatus,
      selectedPaymentStatus,
      searchQuery,
      supplierOptions,
      filteredPurchases,
      deliveredPurchaseCost,
      totalStockValue,
      expiringSoonCount,
      costHistory,
      formatCurrency,
      formatDate,
      formatExpiry,
      getUnitCost,
      getInventoryUnitPrice,
      getTotalCost,
      getPaymentStatus,
      getAmountPaid,
      getBalance,
      paymentBadgeClass,
      togglePaymentQuick,
      savingPaymentId
    }
  }
}
</script>

