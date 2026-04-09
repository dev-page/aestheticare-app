<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Item Catalog</h1>
          <p class="text-slate-400">Inventory items and stock levels from delivered purchase requests</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search</label>
            <input v-model="searchQuery" type="text" placeholder="Search items..." class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Category</label>
            <select v-model="selectedCategory" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All Categories</option>
              <option value="Injectables">Injectables</option>
              <option value="Skincare">Skincare</option>
              <option value="Equipment">Equipment</option>
              <option value="Medical Supplies">Medical Supplies</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Stock Status</label>
            <select v-model="selectedStockStatus" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Supplier</label>
            <select v-model="selectedSupplier" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All Suppliers</option>
              <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.name">{{ supplier.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold text-white">DSS Recommendations</h2>
            <p class="text-xs text-slate-400">Suggested reorder quantities based on current stock levels.</p>
          </div>
        </div>

        <div v-if="dssRecommendations.length === 0" class="text-sm text-slate-400">
          No urgent restock recommendations at the moment.
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="rec in dssRecommendations"
            :key="rec.id"
            class="bg-slate-900/60 border border-slate-700 rounded-lg p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-white font-medium">{{ rec.name }}</p>
                <p class="text-xs text-slate-400">{{ rec.supplier || 'Unknown supplier' }}</p>
              </div>
              <span
                :class="[
                  'px-2 py-1 rounded-full text-[11px] font-medium',
                  rec.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                  rec.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                ]"
              >
                {{ rec.priority }}
              </span>
            </div>
            <div class="mt-3 text-xs text-slate-300 space-y-1">
              <p>Current stock: <span class="text-white">{{ rec.currentStock }}</span> {{ rec.unit || '' }}</p>
              <p>Min stock: <span class="text-white">{{ rec.minStock }}</span> {{ rec.unit || '' }}</p>
              <p>Suggested reorder: <span class="text-white">{{ rec.reorderQty }}</span> {{ rec.unit || '' }}</p>
              <p v-if="rec.estimatedCost > 0">Est. cost: <span class="text-white">PHP {{ rec.estimatedCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Item</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Category</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Supplier</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Stock</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Cost Price</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Unit Price</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4">
                  <div>
                    <p class="text-white font-medium">{{ item.name }}</p>
                    <p class="text-slate-400 text-sm">SKU: {{ item.sku }}</p>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="text-slate-300">{{ resolveItemCategory(item) || '-' }}</span></td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="text-slate-300">{{ item.supplier }}</span></td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p class="text-white font-medium">{{ item.currentStock }} / {{ getEffectiveMaxStock(item) }}</p>
                    <p class="text-slate-400 text-xs">Min: {{ getEffectiveMinStock(item) }} {{ item.unit }}</p>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="relative w-28">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-sm">&#8369;</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      :value="getDraftCostPrice(item)"
                      @input="setDraftCostPrice(item.id, $event.target.value)"
                      class="w-full bg-slate-700 text-white pl-6 pr-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="relative w-28">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-sm">&#8369;</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      :value="getDraftUnitPrice(item)"
                      @input="setDraftUnitPrice(item.id, $event.target.value)"
                      class="w-full bg-slate-700 text-white pl-6 pr-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="['px-3 py-1 rounded-full text-xs font-medium', resolveStockStatus(item) === 'In Stock' ? 'bg-green-500/20 text-green-400' : resolveStockStatus(item) === 'Low Stock' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400']">
                    {{ resolveStockStatus(item) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <button
                    @click="savePrices(item)"
                    class="px-3 py-1 rounded bg-purple-500 hover:bg-purple-600 text-white text-xs"
                  >
                    Save
                  </button>
                </td>
              </tr>

              <tr v-if="items.length === 0">
                <td colspan="8" class="px-6 py-8 text-center text-slate-400">No items yet in the catalog.</td>
              </tr>

              <tr v-else-if="filteredItems.length === 0">
                <td colspan="8" class="px-6 py-8 text-center text-slate-400">No items matched your filters.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'ManagerItemCatalog',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const searchQuery = ref('')
    const selectedCategory = ref('')
    const selectedStockStatus = ref('')
    const selectedSupplier = ref('')

    const currentBranchId = ref('')
    const items = ref([])
    const suppliers = ref([])
    const deliveredTotals = ref({})
    const costPriceDrafts = ref({})
    const unitPriceDrafts = ref({})

    const getDraftCostPrice = (item) => {
      if (Object.prototype.hasOwnProperty.call(costPriceDrafts.value, item.id)) {
        return costPriceDrafts.value[item.id]
      }
      if (typeof item.costPrice === 'number') return item.costPrice
      if (typeof item.unitCost === 'number') return item.unitCost
      return item.unitPrice ?? 0
    }

    const setDraftCostPrice = (itemId, rawValue) => {
      costPriceDrafts.value[itemId] = rawValue
    }

    const getDraftUnitPrice = (item) => {
      if (Object.prototype.hasOwnProperty.call(unitPriceDrafts.value, item.id)) {
        return unitPriceDrafts.value[item.id]
      }
      return item.unitPrice ?? 0
    }

    const setDraftUnitPrice = (itemId, rawValue) => {
      unitPriceDrafts.value[itemId] = rawValue
    }

    const savePrices = async (item) => {
      const nextCostPrice = Number(getDraftCostPrice(item))
      const nextUnitPrice = Number(getDraftUnitPrice(item))

      if (Number.isNaN(nextCostPrice) || nextCostPrice < 0) {
        toast.error('Cost price must be 0 or higher.')
        return
      }
      if (Number.isNaN(nextUnitPrice) || nextUnitPrice < 0) {
        toast.error('Unit price must be 0 or higher.')
        return
      }

      try {
        await updateDoc(doc(db, 'inventoryItems', item.id), {
          costPrice: nextCostPrice,
          unitPrice: nextUnitPrice,
          updatedAt: serverTimestamp()
        })
        await logActivity(db, {
          module: 'Manager',
          action: 'Updated catalog prices',
          details: `Updated prices for ${item.name || item.id}.`
        })
        item.costPrice = nextCostPrice
        item.unitPrice = nextUnitPrice
        costPriceDrafts.value[item.id] = nextCostPrice
        unitPriceDrafts.value[item.id] = nextUnitPrice
        toast.success('Prices updated.')
      } catch (error) {
        console.error(error)
        toast.error('Failed to update prices.')
      }
    }

    const resolveItemCategory = (item) => {
      if (item?.category) return item.category

      const supplier = suppliers.value.find((s) => (s.name || '') === (item?.supplier || ''))
      if (!supplier) return ''

      const offeredItems = Array.isArray(supplier.offeredItems) ? supplier.offeredItems : []
      const matchedItem = offeredItems.find(
        (offered) => (offered?.name || '').trim().toLowerCase() === (item?.name || '').toLowerCase()
      )
      if (matchedItem?.category) return matchedItem.category

      if (Array.isArray(supplier.categories) && supplier.categories.length > 0) return supplier.categories[0]
      if (supplier.category) return supplier.category
      return ''
    }

    const buildDeliveredTotals = (requests) => {
      const map = {}
      requests.forEach((request) => {
        if (String(request.status || '').toLowerCase() !== 'delivered') return
        const name = String(request.item || '').trim().toLowerCase()
        const supplier = String(request.supplier || '').trim().toLowerCase()
        if (!name) return
        const key = `${name}::${supplier}`
        const quantity = Number(request.quantity || 0)
        if (!Number.isFinite(quantity) || quantity <= 0) return
        map[key] = (map[key] || 0) + quantity
      })
      return map
    }

    const getEffectiveMinStock = (_item) => 1

    const getEffectiveMaxStock = (item) => {
      const maxStock = Number(item?.maxStock || 0)
      if (maxStock > 0) return maxStock
      const key = `${String(item?.name || '').trim().toLowerCase()}::${String(item?.supplier || '').trim().toLowerCase()}`
      const deliveredMax = Number(deliveredTotals.value[key] || 0)
      if (deliveredMax > 0) return deliveredMax
      return Number(item?.currentStock || 0)
    }

    const resolveStockStatus = (item) => {
      const currentStock = Number(item?.currentStock || 0)
      const maxStock = Number(getEffectiveMaxStock(item) || 0)
      if (currentStock <= 0) return 'Out of Stock'
      if (maxStock > 0 && currentStock < maxStock * 0.5) return 'Low Stock'
      return 'In Stock'
    }

    const computeReorderQty = (item) => {
      const currentStock = Number(item?.currentStock || 0)
      const maxStock = Number(getEffectiveMaxStock(item) || 0)
      if (maxStock > 0) {
        return Math.max(maxStock - currentStock, 0)
      }
      return Math.max(10 - currentStock, 0)
    }

    const resolvePriority = (item) => {
      const status = resolveStockStatus(item)
      if (status === 'Out of Stock') return 'High'
      if (status === 'Low Stock') return 'Medium'
      return 'Low'
    }

    const loadSuppliers = async () => {
      if (!currentBranchId.value) {
        suppliers.value = []
        return
      }
      const supplierQuery = query(collection(db, 'suppliers'), where('branchId', '==', currentBranchId.value))
      const snapshot = await getDocs(supplierQuery)
      suppliers.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const loadItems = async () => {
      if (!currentBranchId.value) {
        items.value = []
        return
      }

      const itemQuery = query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))
      const snapshot = await getDocs(itemQuery)
      items.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const loadDeliveredTotals = async () => {
      if (!currentBranchId.value) {
        deliveredTotals.value = {}
        return
      }
      const requestQuery = query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value))
      const snapshot = await getDocs(requestQuery)
      const requests = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      deliveredTotals.value = buildDeliveredTotals(requests)
    }

    const filteredItems = computed(() => {
      return items.value.filter((item) => {
        const matchesSearch =
          (item.name || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          (item.sku || '').toLowerCase().includes(searchQuery.value.toLowerCase())
        const matchesCategory = !selectedCategory.value || resolveItemCategory(item) === selectedCategory.value
        const matchesStockStatus = !selectedStockStatus.value || resolveStockStatus(item) === selectedStockStatus.value
        const matchesSupplier = !selectedSupplier.value || item.supplier === selectedSupplier.value
        return matchesSearch && matchesCategory && matchesStockStatus && matchesSupplier
      })
    })

    const dssRecommendations = computed(() => {
      return items.value
        .map((item) => {
          const reorderQty = computeReorderQty(item)
          const priority = resolvePriority(item)
          const unitCost = Number(item.costPrice ?? item.unitCost ?? 0)
          const estimatedCost = reorderQty > 0 && unitCost > 0 ? reorderQty * unitCost : 0
          return {
            id: item.id,
            name: item.name,
            supplier: item.supplier,
            unit: item.unit,
            currentStock: Number(item.currentStock || 0),
            minStock: Number(getEffectiveMinStock(item) || 1),
            maxStock: Number(getEffectiveMaxStock(item) || 0),
            reorderQty,
            priority,
            estimatedCost,
            status: resolveStockStatus(item),
          }
        })
        .filter((rec) => {
          if (rec.currentStock <= 0) return rec.reorderQty > 0
          const trigger = rec.maxStock * 0.5
          if (rec.maxStock <= 0) return false
          return rec.reorderQty > 0 && rec.currentStock < trigger
        })
        .sort((a, b) => {
          const order = { High: 0, Medium: 1, Low: 2 }
          return order[a.priority] - order[b.priority]
        })
        .slice(0, 6)
    })

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          items.value = []
          suppliers.value = []
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''

        await loadSuppliers()
        await loadDeliveredTotals()
        await loadItems()
        await logActivity(db, {
          module: 'Manager',
          action: 'Viewed item catalog',
          details: 'Opened manager item catalog page.'
        })
      })
    })

    return {
      searchQuery,
      selectedCategory,
      selectedStockStatus,
      selectedSupplier,
      suppliers,
      items,
      filteredItems,
      dssRecommendations,
      getEffectiveMaxStock,
      getEffectiveMinStock,
      resolveItemCategory,
      resolveStockStatus,
      getDraftCostPrice,
      setDraftCostPrice,
      getDraftUnitPrice,
      setDraftUnitPrice,
      savePrices
    }
  }
}
</script>

