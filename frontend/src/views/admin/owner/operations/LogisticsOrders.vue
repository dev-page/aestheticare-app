<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Logistics</h1>
          <p class="text-slate-400">
            Coordinate supplier pickup and delivery for clinic purchases, then confirm receipt so Inventory can be updated.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
        <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-xs uppercase tracking-wider text-slate-400">Pending</p>
          <p class="mt-2 text-3xl font-bold text-orange-400">{{ pendingCount }}</p>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-xs uppercase tracking-wider text-slate-400">Ready / In Transit</p>
          <p class="mt-2 text-3xl font-bold text-cyan-400">{{ inTransitCount }}</p>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-xs uppercase tracking-wider text-slate-400">Claimed / Shipped</p>
          <p class="mt-2 text-3xl font-bold text-sky-400">{{ shippedCount }}</p>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-xs uppercase tracking-wider text-slate-400">Delivered</p>
          <p class="mt-2 text-3xl font-bold text-emerald-400">{{ deliveredCount }}</p>
        </div>
      </div>

      <div class="rounded-xl border border-slate-700 bg-slate-800 p-5 mb-6">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label class="mb-2 block text-sm text-slate-400">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search supplier, request, or item..."
              class="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm text-slate-400">Status</label>
            <select
              v-model="selectedStatus"
              class="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="">All</option>
              <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-sm text-slate-400">Priority</label>
            <select
              v-model="selectedPriority"
              class="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="">All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-700 text-slate-300">
              <tr>
                <th class="px-4 py-3 text-left uppercase tracking-wider text-[11px]">Order ID</th>
                <th class="px-4 py-3 text-left uppercase tracking-wider text-[11px]">Supplier</th>
                <th class="px-4 py-3 text-left uppercase tracking-wider text-[11px]">Request</th>
                <th class="px-4 py-3 text-left uppercase tracking-wider text-[11px]">Items</th>
                <th class="px-4 py-3 text-left uppercase tracking-wider text-[11px]">Status</th>
                <th class="px-4 py-3 text-left uppercase tracking-wider text-[11px]">Updated</th>
                <th class="px-4 py-3 text-left uppercase tracking-wider text-[11px]">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700 text-slate-200">
              <tr v-if="!loading && filteredOrders.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-slate-400">No logistics orders found.</td>
              </tr>
              <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-slate-700/40">
                <td class="px-4 py-3 text-slate-300">{{ order.id }}</td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200"
                  >
                    {{ order.sourceLabel }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="font-semibold text-white">{{ order.partyName }}</div>
                  <div class="text-xs text-slate-400">{{ order.partyMeta }}</div>
                </td>
                <td class="px-4 py-3 text-slate-300">
                  <div>{{ order.itemSummary }}</div>
                  <div class="text-xs text-slate-500">{{ order.quantitySummary }}</div>
                </td>
                <td class="px-4 py-3">
                  <span :class="statusBadgeClass(order.status)">{{ order.status || 'Pending' }}</span>
                </td>
                <td class="px-4 py-3 text-slate-300">{{ formatDate(order.updatedAt || order.createdAt) }}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="nextStatus in nextStatusOptions(order)"
                      :key="`${order.id}-${nextStatus}`"
                      type="button"
                      class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      :class="buttonClass(nextStatus)"
                      :disabled="!canUpdateLogistics"
                      @click="updateOrderStatus(order, nextStatus)"
                    >
                      {{ nextStatus }}
                    </button>
                    <button
                      type="button"
                      class="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600"
                      @click="openDetails(order)"
                    >
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <div v-if="showDetailsModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 class="text-2xl font-bold text-white">Order Details</h2>
            <p class="text-slate-400 text-sm">{{ selectedOrder?.id || '-' }}</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-white" @click="closeDetails">Close</button>
        </div>

        <div v-if="selectedOrder" class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p class="text-xs uppercase tracking-wider text-slate-400">Party</p>
            <p class="mt-2 text-white font-semibold">{{ selectedOrder.partyName }}</p>
            <p class="text-sm text-slate-400">{{ selectedOrder.partyMeta }}</p>
          </div>
          <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p class="text-xs uppercase tracking-wider text-slate-400">Status</p>
            <p class="mt-2 text-white font-semibold">{{ selectedOrder.status || 'Pending' }}</p>
            <p class="text-sm text-slate-400">{{ selectedOrder.itemSummary }}</p>
          </div>
          <div class="rounded-xl border border-slate-700 bg-slate-800 p-4 md:col-span-2">
            <p class="text-xs uppercase tracking-wider text-slate-400 mb-3">Items</p>
            <div v-if="selectedOrder.items.length" class="space-y-2">
              <div
                v-for="item in selectedOrder.items"
                :key="item.key"
                class="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3"
              >
                <div>
                  <p class="text-white font-medium">{{ item.name }}</p>
                  <p class="text-xs text-slate-400">{{ item.details }}</p>
                </div>
                <div class="text-right">
                  <p class="text-slate-200">{{ item.quantityText }}</p>
                  <p class="text-xs text-slate-500">{{ item.valueText }}</p>
                </div>
              </div>
            </div>
            <p v-else class="text-slate-400 text-sm">No item details available.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, getFirestore } from 'firebase/firestore'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { usePermissions } from '@/composables/usePermissions'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

export default {
  name: 'LogisticsOrders',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission } = usePermissions()

    const loading = ref(true)
    const currentBranchId = ref('')
    const currentUserId = ref('')
    const selectedSource = ref('business')
    const selectedStatus = ref('')
    const selectedPriority = ref('')
    const searchQuery = ref('')
    const customerOrders = ref([])
    const businessOrders = ref([])
    const showDetailsModal = ref(false)
    const selectedOrder = ref(null)
    const riderForm = ref({ name: '', phone: '', vehicle: '' })
    const canUpdateLogistics = computed(() => hasPermission('orders:update') || hasPermission('inventory:update') || hasPermission('inventory:review'))

    const formatDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleString('en-PH')
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('en-PH')
    }

    const formatMoney = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))

    const normalizeStatus = (value) => String(value || '').trim()

    const statusOptions = computed(() => {
      return ['Pending', 'Approved', 'Ready for Claim', 'Claimed', 'Shipped', 'In Transit', 'Received', 'Cancelled']
    })

    const getCustomerItemSummary = (order) => {
      const items = Array.isArray(order.items) ? order.items : []
      if (!items.length) return 'No items'
      return items.map((item) => item.name).filter(Boolean).slice(0, 3).join(', ')
    }

    const getBusinessItemSummary = (order) => String(order.item || '').trim() || 'Business order'

    const sourceLabel = (source) => (source === 'customer' ? 'Customer' : 'Business')

    const loadCustomerOrders = async () => {
      const snapshot = await getDocs(collection(db, 'customerOrders'))
      const docs = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      customerOrders.value = docs
        .filter((order) => {
          const items = Array.isArray(order.items) ? order.items : []
          return items.some((item) => String(item.branchId || '').trim() === currentBranchId.value)
        })
        .map((order) => {
          const items = Array.isArray(order.items) ? order.items : []
          return {
            id: order.id,
            source: 'customer',
            sourceLabel: sourceLabel('customer'),
            status: normalizeStatus(order.status) || 'Pending',
            priority: 'Medium',
            createdAt: order.createdAt || null,
            updatedAt: order.updatedAt || order.createdAt || null,
            customerId: order.customerId || '',
            riderName: order.riderName || '',
            riderPhone: order.riderPhone || '',
            riderVehicle: order.riderVehicle || '',
            partyName: order.customerName || order.delivery?.fullName || 'Customer',
            partyMeta: order.customerEmail || order.delivery?.email || 'No email',
            itemSummary: getCustomerItemSummary(order),
            quantitySummary: `${items.length} item(s)`,
            items: items.map((item, index) => ({
              key: `${order.id}-${index}`,
              name: item.name || 'Item',
              details: `${item.branchName || 'Branch'}${item.category ? ` - ${item.category}` : ''}`,
              quantityText: `Qty: ${Number(item.quantity || 0)}`,
              valueText: formatMoney(item.price || 0)
            }))
          }
        })
    }

    const loadBusinessOrders = async () => {
      const snapshot = await getDocs(query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value)))
      businessOrders.value = snapshot.docs.map((snap) => {
        const order = snap.data()
        return {
          id: snap.id,
          source: 'business',
          sourceLabel: sourceLabel('business'),
          status: ['', 'Not Claimed', 'Pending'].includes(normalizeStatus(order.logisticsStatus)) && normalizeStatus(order.status) === 'Approved' && normalizeStatus(order.budgetStatus) === 'Approved'
            ? 'Ready for Claim'
            : normalizeStatus(order.logisticsStatus) || normalizeStatus(order.status) || 'Pending',
          budgetStatus: normalizeStatus(order.budgetStatus),
          workflowStage: normalizeStatus(order.workflowStage),
          priority: normalizeStatus(order.priority) || 'Medium',
          createdAt: order.createdAt || null,
          updatedAt: order.updatedAt || order.createdAt || null,
          customerId: '',
          partyName: order.supplier || 'Supplier',
          partyMeta: order.category || order.branch || 'Business order',
          itemSummary: getBusinessItemSummary(order),
          quantitySummary: `${Number(order.quantity || 0)} ${order.unit || 'units'}`,
          items: [
            {
              key: snap.id,
              name: order.item || 'Item',
              details: `${order.supplier || 'Supplier'}${order.category ? ` - ${order.category}` : ''}`,
              quantityText: `Qty: ${Number(order.quantity || 0)} ${order.unit || 'units'}`,
              valueText: formatMoney(order.totalCost || 0)
            }
          ]
        }
      })
    }

    const loadData = async () => {
      if (!currentBranchId.value) return
      loading.value = true
      try {
        await loadBusinessOrders()
      } finally {
        loading.value = false
      }
    }

    // Customer orders are pickup-only and are managed from CRM Orders, not Logistics.
    const allOrders = computed(() => [...businessOrders.value])

    const filteredOrders = computed(() => {
      const keyword = String(searchQuery.value || '').trim().toLowerCase()
      return allOrders.value.filter((order) => {
        const matchesSource = order.source === 'business'
        const matchesStatus = !selectedStatus.value || normalizeStatus(order.status) === selectedStatus.value
        const matchesPriority = !selectedPriority.value || normalizeStatus(order.priority) === selectedPriority.value
        if (!matchesSource || !matchesStatus || !matchesPriority) return false
        if (!keyword) return true
        const text = [order.id, order.partyName, order.partyMeta, order.itemSummary, order.quantitySummary, order.status, order.sourceLabel]
          .map((entry) => String(entry || '').toLowerCase())
          .join(' ')
        return text.includes(keyword)
      })
    })

    const countByStatus = (statusList) => filteredOrders.value.filter((order) => statusList.includes(normalizeStatus(order.status))).length

    const pendingCount = computed(() => countByStatus(['Pending', 'Confirmed']))
    const inTransitCount = computed(() => countByStatus(['Packed', 'Shipped', 'Out for Delivery', 'Claimed', 'In Transit']))
    const shippedCount = computed(() => countByStatus(['Shipped', 'Out for Delivery']))
    const deliveredCount = computed(() => countByStatus(['Delivered', 'Received']))

    const nextStatusOptions = (order) => {
      const current = normalizeStatus(order.status)
      if (order.source === 'customer') {
        if (current === 'Cancelled' || current === 'Delivered') return []
        if (current === 'Pending') return ['Confirmed', 'Packed']
        if (current === 'Confirmed') return ['Packed', 'Shipped']
        if (current === 'Packed') return ['Shipped']
        if (current === 'Shipped') return ['Out for Delivery', 'Delivered']
        if (current === 'Out for Delivery') return ['Delivered']
        return ['Packed', 'Shipped', 'Delivered']
      }

      if (current === 'Cancelled' || current === 'Received' || current === 'Delivered') return []
      if (current === 'Ready for Claim') return ['Claimed']
      if (current === 'Claimed') return ['Shipped', 'In Transit']
      if (current === 'Shipped') return ['In Transit', 'Received']
      if (current === 'In Transit') return ['Received']
      return []
    }

    const buttonClass = (status) => {
      const normalized = normalizeStatus(status)
      if (['Delivered', 'Received'].includes(normalized)) return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
      if (['Shipped', 'Out for Delivery', 'In Transit'].includes(normalized)) return 'border border-cyan-500/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
      if (['Ready for Claim', 'Claimed', 'Packed', 'Confirmed', 'Approved'].includes(normalized)) return 'border border-amber-500/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25'
      return 'border border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600'
    }

    const statusBadgeClass = (status) => {
      const normalized = normalizeStatus(status)
      if (['Delivered', 'Received'].includes(normalized)) return 'rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200'
      if (['Shipped', 'Out for Delivery', 'In Transit'].includes(normalized)) return 'rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200'
      if (['Ready for Claim', 'Claimed', 'Packed', 'Confirmed', 'Approved'].includes(normalized)) return 'rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200'
      if (normalized === 'Cancelled') return 'rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200'
      return 'rounded-full bg-slate-600/50 px-3 py-1 text-xs font-semibold text-slate-200'
    }

    const createNotification = async ({ recipientUserId = null, recipientRole = null, title, message, link = '/manager/logistics' }) => {
      await addDoc(collection(db, 'notifications'), {
        recipientUserId,
        recipientRole,
        title: String(title || 'Logistics Update').trim(),
        message: String(message || '').trim(),
        link,
        read: false,
        deleted: false,
        createdAt: serverTimestamp()
      })
    }

    const updateOrderStatus = async (order, nextStatus) => {
      if (!order?.id || !nextStatus) return
      if (!canUpdateLogistics.value) {
        toast.error('You have view-only access to logistics.')
        return
      }
      if (order.source === 'business') {
        if (!nextStatusOptions(order).includes(nextStatus)) {
          toast.error('This logistics status transition is not allowed.')
          return
        }
        if (normalizeStatus(order.budgetStatus) !== 'Approved') {
          toast.info('Finance must approve the budget before Logistics can claim this order.')
          return
        }
      }

      try {
        if (order.source === 'business') {
          const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : ''
          let response
          let lastError
          for (const baseUrl of OTP_BACKEND_CANDIDATES) {
            try {
              response = await fetch(`${baseUrl}/logistics/purchase-requests/${order.id}/transition`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ nextStatus })
              })
              if (response.status !== 404) break
            } catch (error) { lastError = error }
          }
          if (!response) throw lastError || new Error('Logistics service is unavailable.')
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(payload.error || 'The logistics status could not be updated.')
          toast.success(`Order updated to ${payload.data?.status || nextStatus}.`)
          return
        }
        const updatePayload = {
          logisticsStatus: nextStatus,
          logisticsUpdatedBy: currentUserId.value || null,
          logisticsUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }

        if (order.source === 'business') {
          updatePayload.workflowStage = nextStatus === 'Claimed'
            ? 'Claimed by Logistics'
            : nextStatus === 'Received'
              ? 'Delivered - Awaiting Finance Settlement'
              : `Logistics: ${nextStatus}`
          if (nextStatus === 'Claimed') {
            updatePayload.logisticsClaimedBy = currentUserId.value || null
            updatePayload.logisticsClaimedAt = serverTimestamp()
          }
          if (nextStatus === 'Received') updatePayload.status = 'Delivered'
        } else {
          updatePayload.status = nextStatus
        }

        if (order.source === 'customer') {
          await updateDoc(doc(db, 'customerOrders', order.id), updatePayload)
          await createNotification({
            recipientUserId: order.customerId || null,
            title: `Order ${nextStatus}`,
            message: `Your order ${order.id} is now ${nextStatus}.`,
            link: '/customer/orders'
          })
        } else {
          await updateDoc(doc(db, 'purchaseRequests', order.id), updatePayload)
          await Promise.all([
            createNotification({
              recipientRole: 'Owner',
              title: `Business Order ${nextStatus}`,
              message: `Business order ${order.id} has been updated to ${nextStatus}.`,
              link: '/manager/logistics'
            }),
            createNotification({
              recipientRole: 'Manager',
              title: `Business Order ${nextStatus}`,
              message: `Business order ${order.id} has been updated to ${nextStatus}.`,
              link: '/manager/logistics'
            })
          ])
        }

        order.status = nextStatus
        order.logisticsStatus = nextStatus
        order.updatedAt = new Date()
        selectedOrder.value = selectedOrder.value?.id === order.id ? { ...order } : selectedOrder.value
        toast.success(`Order updated to ${nextStatus}.`)
        await loadData()
      } catch (error) {
        console.error(error)
        toast.error('Failed to update order status.')
      }
    }

    const openDetails = (order) => {
      selectedOrder.value = order
      riderForm.value = {
        name: String(order?.riderName || '').trim(),
        phone: String(order?.riderPhone || '').trim(),
        vehicle: String(order?.riderVehicle || '').trim(),
      }
      showDetailsModal.value = true
    }

    const closeDetails = () => {
      selectedOrder.value = null
      showDetailsModal.value = false
    }

    const saveRiderInformation = async () => {
      if (!selectedOrder.value?.id || selectedOrder.value.source !== 'customer') return
      if (!canUpdateLogistics.value) {
        toast.error('You do not have permission to update logistics.')
        return
      }
      try {
        const payload = {
          riderName: String(riderForm.value.name || '').trim(),
          riderPhone: String(riderForm.value.phone || '').trim(),
          riderVehicle: String(riderForm.value.vehicle || '').trim(),
          riderAssignedAt: serverTimestamp(),
          riderAssignedBy: currentUserId.value || null,
          updatedAt: serverTimestamp(),
        }
        await updateDoc(doc(db, 'customerOrders', selectedOrder.value.id), payload)
        Object.assign(selectedOrder.value, payload, { riderAssignedAt: new Date() })
        toast.success('Rider information saved.')
        await loadData()
      } catch (error) {
        console.error(error)
        toast.error('Failed to save rider information.')
      }
    }

    let unsubscribeAuth = null
    let unsubscribeCustomerOrders = null
    let unsubscribeBusinessOrders = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (unsubscribeCustomerOrders) unsubscribeCustomerOrders()
          if (unsubscribeBusinessOrders) unsubscribeBusinessOrders()
          unsubscribeCustomerOrders = null
          unsubscribeBusinessOrders = null
          currentBranchId.value = ''
          currentUserId.value = ''
          customerOrders.value = []
          businessOrders.value = []
          loading.value = false
          return
        }

        currentUserId.value = user.uid
        const scope = await loadOwnerBranchScope(db, user.uid)
        currentBranchId.value = scope.branchId || ''

        if (unsubscribeCustomerOrders) unsubscribeCustomerOrders()
        if (unsubscribeBusinessOrders) unsubscribeBusinessOrders()
        unsubscribeCustomerOrders = onSnapshot(collection(db, 'customerOrders'), (snapshot) => {
          const docs = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
          customerOrders.value = docs.filter((order) => (Array.isArray(order.items) ? order.items : []).some((item) => String(item.branchId || '').trim() === currentBranchId.value)).map((order) => {
            const items = Array.isArray(order.items) ? order.items : []
            return { id: order.id, source: 'customer', sourceLabel: sourceLabel('customer'), status: normalizeStatus(order.status) || 'Pending', priority: 'Medium', createdAt: order.createdAt || null, updatedAt: order.updatedAt || order.createdAt || null, customerId: order.customerId || '', riderName: order.riderName || '', riderPhone: order.riderPhone || '', riderVehicle: order.riderVehicle || '', partyName: order.customerName || order.delivery?.fullName || 'Customer', partyMeta: order.customerEmail || order.delivery?.email || 'No email', itemSummary: getCustomerItemSummary(order), quantitySummary: `${items.length} item(s)`, items: items.map((item, index) => ({ key: `${order.id}-${index}`, name: item.name || 'Item', details: `${item.branchName || 'Branch'}${item.category ? ` - ${item.category}` : ''}`, quantityText: `Qty: ${Number(item.quantity || 0)}`, valueText: formatMoney(item.price || 0) })) }
          })
        })
        unsubscribeBusinessOrders = onSnapshot(query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value)), (snapshot) => {
          businessOrders.value = snapshot.docs.map((snap) => {
            const order = snap.data()
            const readyForClaim = ['', 'Not Claimed', 'Pending'].includes(normalizeStatus(order.logisticsStatus)) && normalizeStatus(order.status) === 'Approved' && normalizeStatus(order.budgetStatus) === 'Approved'
            return { id: snap.id, source: 'business', sourceLabel: sourceLabel('business'), status: readyForClaim ? 'Ready for Claim' : normalizeStatus(order.logisticsStatus) || (normalizeStatus(order.purchaseOrderStatus) === 'Received' ? 'Received' : normalizeStatus(order.status)) || 'Pending', budgetStatus: normalizeStatus(order.budgetStatus), workflowStage: normalizeStatus(order.workflowStage), priority: normalizeStatus(order.priority) || 'Medium', createdAt: order.createdAt || null, updatedAt: order.updatedAt || order.createdAt || null, customerId: '', partyName: order.supplier || 'Supplier', partyMeta: order.category || order.branch || 'Business order', itemSummary: getBusinessItemSummary(order), quantitySummary: `${Number(order.quantity || 0)} ${order.unit || 'units'}`, items: [{ key: snap.id, name: order.item || 'Item', details: `${order.supplier || 'Supplier'}${order.category ? ` - ${order.category}` : ''}`, quantityText: `Qty: ${Number(order.quantity || 0)} ${order.unit || 'units'}`, valueText: formatMoney(order.totalCost || 0) }] }
          })
          loading.value = false
        })
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      if (unsubscribeCustomerOrders) unsubscribeCustomerOrders()
      if (unsubscribeBusinessOrders) unsubscribeBusinessOrders()
    })

    return {
      loading,
      selectedTab,
      selectedSource,
      selectedStatus,
      selectedPriority,
      searchQuery,
      statusOptions,
      filteredOrders,
      pendingCount,
      inTransitCount,
      shippedCount,
      deliveredCount,
      formatDate,
      nextStatusOptions,
      statusBadgeClass,
      buttonClass,
      updateOrderStatus,
      openDetails,
      closeDetails,
      saveRiderInformation,
      showDetailsModal,
      selectedOrder,
      riderForm,
      canUpdateLogistics
    }
  }
}
</script>
