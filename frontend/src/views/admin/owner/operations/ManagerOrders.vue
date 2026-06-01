<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Customer Orders</h1>
        <p class="text-slate-400">Orders placed through the platform for this branch.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <input
            v-model="search"
            type="text"
            placeholder="Search customer, payment method, or order id..."
            class="w-full md:max-w-sm bg-slate-900 text-[#f3e3cf] placeholder:text-[#c7a98c] px-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <div class="text-sm text-slate-400">Total Orders: {{ filteredOrders.length }}</div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4">Order ID</th>
                <th class="py-3 px-4">Customer</th>
                <th class="py-3 px-4">Items</th>
                <th class="py-3 px-4">Total</th>
                <th class="py-3 px-4">Payment</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Created At</th>
                <th class="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody class="text-slate-200">
              <tr v-if="!loading && filteredOrders.length === 0">
                <td colspan="7" class="py-8 text-center text-slate-400">No orders found.</td>
              </tr>
              <tr v-for="order in filteredOrders" :key="order.id" class="border-t border-slate-700">
                <td class="py-3 px-4 text-slate-300">{{ order.id }}</td>
                <td class="py-3 px-4">
                  <div class="font-semibold text-white">{{ order.customerName || 'Customer' }}</div>
                  <div class="text-xs text-slate-400">{{ order.customerEmail || order.delivery?.email || 'No email' }}</div>
                </td>
                <td class="py-3 px-4">{{ order.items.length }}</td>
                <td class="py-3 px-4 text-amber-300">PHP {{ Number(order.total || 0).toFixed(2) }}</td>
                <td class="py-3 px-4">{{ order.paymentMethod || 'Cash' }}</td>
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-1 rounded-full text-xs font-semibold"
                    :class="order.status === 'Completed'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : order.status === 'Cancelled'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'"
                  >
                    {{ order.status || 'Pending' }}
                  </span>
                </td>
                <td class="py-3 px-4">{{ formatDate(order.createdAt) }}</td>
                <td class="py-3 px-4">
                  <button
                    type="button"
                    class="px-3 py-1 rounded-lg bg-gold-700 hover:bg-gold-800 text-white text-xs"
                    @click="openOrder(order)"
                  >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <Modal :isOpen="showModal" @close="closeModal" :showConfirm="false" panelClass="bg-slate-900 border border-slate-700">
      <div v-if="selectedOrder" class="text-slate-200">
        <h2 class="text-xl font-semibold text-white mb-2">Order Details</h2>
        <p class="text-sm text-slate-400 mb-4">Order ID: {{ selectedOrder.id }}</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p class="text-xs uppercase text-slate-400">Customer</p>
            <p class="text-white font-semibold mt-1">{{ selectedOrder.customerName || 'Customer' }}</p>
            <p class="text-xs text-slate-400">{{ selectedOrder.customerEmail || selectedOrder.delivery?.email || 'No email' }}</p>
            <p class="text-xs text-slate-400 mt-2">Phone: {{ selectedOrder.delivery?.phone || 'N/A' }}</p>
            <p class="text-xs text-slate-400">Address: {{ selectedOrder.delivery?.address || 'N/A' }}</p>
          </div>
          <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p class="text-xs uppercase text-slate-400">Payment</p>
            <p class="text-white font-semibold mt-1">{{ selectedOrder.paymentMethod || 'Cash' }}</p>
            <p class="text-xs text-slate-400 mt-2">Total: PHP {{ Number(selectedOrder.total || 0).toFixed(2) }}</p>
            <p class="text-xs text-slate-400">Status: {{ selectedOrder.status || 'Pending' }}</p>
            <p class="text-xs text-slate-400">Created: {{ formatDate(selectedOrder.createdAt) }}</p>
          </div>
        </div>

        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p class="text-xs uppercase text-slate-400 mb-3">Items</p>
          <div v-for="item in selectedOrder.items" :key="item.id" class="flex items-start justify-between py-2 border-b border-slate-700 last:border-b-0">
            <div>
              <p class="text-white font-medium">{{ item.name }}</p>
              <p class="text-xs text-slate-400">Qty: {{ item.quantity }} • Branch: {{ item.branchName || 'N/A' }}</p>
            </div>
            <div class="text-amber-300">PHP {{ Number(item.price || 0).toFixed(2) }}</div>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'

export default {
  name: 'ManagerOrders',
  components: { OwnerSidebar, Modal },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const loading = ref(true)
    const search = ref('')
    const orders = ref([])
    const currentBranchId = ref('')
    const showModal = ref(false)
    const selectedOrder = ref(null)

    const formatDate = (value) => {
      if (!value) return 'N/A'
      if (value.toDate) return value.toDate().toLocaleString()
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString()
      return String(value)
    }

    const loadOrders = async () => {
      if (!currentBranchId.value) return
      loading.value = true
      try {
        const snapshot = await getDocs(collection(db, 'customerOrders'))
        const allOrders = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
        orders.value = allOrders.filter((order) => {
          const items = Array.isArray(order.items) ? order.items : []
          return items.some((item) => String(item.branchId || '').trim() === currentBranchId.value)
        })
      } catch (error) {
        console.error('Failed to load orders:', error)
      } finally {
        loading.value = false
      }
    }

    const filteredOrders = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()
      if (!keyword) return orders.value
      return orders.value.filter((order) => {
        const text = [
          order.id,
          order.customerName,
          order.customerEmail,
          order.paymentMethod,
        ]
          .map((entry) => String(entry || '').toLowerCase())
          .join(' ')
        return text.includes(keyword)
      })
    })

    const openOrder = (order) => {
      selectedOrder.value = order
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
      selectedOrder.value = null
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        await loadOrders()
      })
    })

    return {
      loading,
      search,
      filteredOrders,
      formatDate,
      openOrder,
      closeModal,
      showModal,
      selectedOrder,
    }
  }
}
</script>

