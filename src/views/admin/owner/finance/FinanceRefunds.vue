<template>
  <div class="flex module-theme min-h-screen bg-slate-900">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Refund Management</h1>
        <p class="text-slate-400">Review customer refund requests and issue voucher-based refunds for approved purchases.</p>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] gap-6">
        <section class="space-y-6">
          <div class="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Search</label>
                <input
                  v-model="search"
                  type="text"
                  placeholder="Order, customer, branch..."
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Status</label>
                <select
                  v-model="statusFilter"
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Refund Requested">Refund Requested</option>
                  <option value="Processing">Processing</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Refund State</label>
                <select
                  v-model="refundStateFilter"
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All orders</option>
                  <option value="eligible">Eligible only</option>
                  <option value="refunded">Refunded only</option>
                </select>
              </div>
              <div class="flex items-end">
                <button
                  type="button"
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white transition hover:bg-slate-600"
                  @click="loadData"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <p class="text-sm text-slate-400">Eligible Orders</p>
              <div v-if="loading" class="mt-3 h-8 w-16 animate-pulse rounded-lg bg-slate-700"></div>
              <p v-else class="mt-2 text-2xl font-bold text-amber-300">{{ eligibleOrders.length }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <p class="text-sm text-slate-400">Pending Requests</p>
              <div v-if="loading" class="mt-3 h-8 w-16 animate-pulse rounded-lg bg-slate-700"></div>
              <p v-else class="mt-2 text-2xl font-bold text-purple-300">{{ pendingRefundRequests.length }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <p class="text-sm text-slate-400">Refunded Orders</p>
              <div v-if="loading" class="mt-3 h-8 w-16 animate-pulse rounded-lg bg-slate-700"></div>
              <p v-else class="mt-2 text-2xl font-bold text-rose-300">{{ refundedOrders.length }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5 md:col-span-3">
              <p class="text-sm text-slate-400">Voucher Value Issued</p>
              <div v-if="loading" class="mt-3 h-8 w-40 animate-pulse rounded-lg bg-slate-700"></div>
              <p v-else class="mt-2 text-2xl font-bold text-emerald-300">{{ formatCurrency(totalRefundValue) }}</p>
            </div>
          </div>

          <div class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <div class="border-b border-slate-700 px-6 py-4">
              <h2 class="text-lg font-semibold text-white">Orders</h2>
            </div>
            <div v-if="loading" class="px-6 py-6">
              <PageSectionSkeleton variant="table" :rows="6" :columns="8" />
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[900px]">
                <thead class="bg-slate-700">
                  <tr>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Order</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Customer</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Branch</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Total</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Status</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Request</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Refund</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                  <tr v-if="filteredOrders.length === 0">
                    <td colspan="8" class="px-6 py-8 text-center text-slate-400">No orders matched your filters.</td>
                  </tr>
                  <tr
                    v-for="order in filteredOrders"
                    :key="order.id"
                    class="transition hover:bg-slate-700/40"
                  >
                    <td class="px-6 py-4 text-slate-200">
                      <p class="font-semibold text-white">{{ order.id }}</p>
                      <p class="text-xs text-slate-400">{{ formatDate(order.createdAt) }}</p>
                    </td>
                    <td class="px-6 py-4 text-slate-300">
                      <p class="text-white">{{ order.customerName || order.delivery?.fullName || 'Customer' }}</p>
                      <p class="text-xs text-slate-400">{{ order.customerEmail || order.delivery?.email || 'No email' }}</p>
                    </td>
                    <td class="px-6 py-4 text-slate-300">{{ order.branchName || 'Multiple / Unknown' }}</td>
                    <td class="px-6 py-4 font-medium text-amber-300">{{ formatCurrency(order.total) }}</td>
                    <td class="px-6 py-4">
                      <span class="rounded-full px-3 py-1 text-xs font-medium" :class="statusClass(order.status)">
                        {{ order.status || 'Pending' }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <span
                        class="rounded-full px-3 py-1 text-xs font-medium"
                        :class="requestStatusClass(order.refundRequestStatus)"
                      >
                        {{ order.refundRequestStatus || 'No request' }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <span
                        class="rounded-full px-3 py-1 text-xs font-medium"
                        :class="order.refundVoucherId ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-600 text-slate-200'"
                      >
                        {{ order.refundVoucherId ? 'Voucher Issued' : 'None' }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <button
                      type="button"
                      class="rounded-lg px-3 py-2 text-sm text-white transition"
                      :class="order.refundVoucherId ? 'bg-slate-600 hover:bg-slate-500' : order.refundRequestStatus === 'Pending' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-slate-600 hover:bg-slate-500'"
                      @click="selectOrder(order)"
                    >
                        {{ order.refundVoucherId ? 'View Refund' : order.refundRequestStatus === 'Pending' ? 'Review Request' : 'View Details' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside class="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div v-if="loading" class="min-h-[320px]">
            <PageSectionSkeleton variant="detail" />
          </div>

          <div v-else-if="selectedOrder">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Selected Order</p>
                <h2 class="mt-2 text-xl font-semibold text-white">{{ selectedOrder.id }}</h2>
                <p class="mt-1 text-sm text-slate-400">{{ selectedOrder.customerName || selectedOrder.delivery?.fullName || 'Customer' }}</p>
              </div>
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="statusClass(selectedOrder.status)">
                {{ selectedOrder.status || 'Pending' }}
              </span>
            </div>

            <div class="mt-6 space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
              <div class="flex items-center justify-between">
                <span>Total</span>
                <span class="font-semibold text-amber-300">{{ formatCurrency(selectedOrder.total) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Payment Method</span>
                <span>{{ selectedOrder.paymentMethod || 'Not set' }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Branch</span>
                <span>{{ selectedOrder.branchName || 'Unknown' }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Refund Status</span>
                <span>{{ selectedOrder.refundVoucherId ? 'Voucher issued' : selectedOrder.refundRequestStatus || 'Not refunded' }}</span>
              </div>
            </div>

            <div v-if="selectedOrder.refundRequestId" class="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300 space-y-3">
              <div class="flex items-center justify-between">
                <span>Request ID</span>
                <span>{{ selectedOrder.refundRequestId }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Issue Type</span>
                <span>{{ selectedOrder.refundIssueType || 'N/A' }}</span>
              </div>
              <div>
                <p class="text-xs uppercase text-slate-400 mb-2">Customer Reason</p>
                <p class="whitespace-pre-wrap">{{ selectedOrder.refundReason || 'No reason provided.' }}</p>
              </div>
              <a
                v-if="selectedOrder.refundProofUrl"
                :href="selectedOrder.refundProofUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex rounded-lg bg-purple-700 px-3 py-2 text-xs text-white transition hover:bg-purple-600"
              >
                View Proof Photo
              </a>
            </div>

            <div class="mt-6">
              <label class="block text-sm text-slate-400 mb-2">Refund Reason</label>
              <textarea
                v-model="refundForm.reason"
                rows="4"
                :disabled="Boolean(selectedOrder.refundVoucherId)"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                placeholder="Explain why the order is being refunded..."
              />
            </div>

            <div class="mt-4">
              <label class="block text-sm text-slate-400 mb-2">Voucher Amount</label>
              <input
                v-model.number="refundForm.amount"
                type="number"
                min="0"
                step="0.01"
                :disabled="Boolean(selectedOrder.refundVoucherId)"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
              />
            </div>

            <div class="mt-4">
              <label class="block text-sm text-slate-400 mb-2">Voucher Code</label>
              <input
                :value="refundForm.code"
                type="text"
                disabled
                class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-300"
              />
            </div>

            <div v-if="selectedOrder.refundVoucherId" class="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              This order already has a voucher refund. Voucher ID: {{ selectedOrder.refundVoucherId }}
            </div>

            <div class="mt-6 flex gap-3">
              <button
                v-if="selectedOrder.refundRequestId && selectedOrder.refundRequestStatus === 'Pending' && !selectedOrder.refundVoucherId"
                type="button"
                class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-200 transition hover:bg-red-500/20"
                :disabled="issuingRefund"
                @click="rejectRefundRequest"
              >
                Reject Request
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="issuingRefund || Boolean(selectedOrder.refundVoucherId) || (selectedOrder.refundRequestId && selectedOrder.refundRequestStatus !== 'Pending')"
                @click="issueRefund"
              >
                {{ issuingRefund ? 'Issuing...' : selectedOrder.refundRequestId ? 'Approve and Issue Voucher' : 'Issue Voucher Refund' }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 transition hover:bg-slate-700"
                @click="clearSelection"
              >
                Clear
              </button>
            </div>
          </div>

          <div v-else class="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-slate-400">
            Select an order to issue or review a refund voucher.
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'

const OWNER_ROLES = new Set(['owner', 'clinicadmin', 'clinicadministrator'])

export default {
  name: 'FinanceRefunds',
  components: { OwnerSidebar, PageSectionSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const loading = ref(true)
    const issuingRefund = ref(false)
    const currentUserId = ref('')
    const accessibleBranchIds = ref([])
    const branchMap = ref({})
    const refundRequestMap = ref({})
    const orders = ref([])
    const selectedOrder = ref(null)
    const search = ref('')
    const statusFilter = ref('')
    const refundStateFilter = ref('')
    const refundForm = ref({
      reason: '',
      amount: 0,
      code: '',
    })

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))

    const formatDate = (value) => {
      if (!value) return 'N/A'
      if (value.toDate) return value.toDate().toLocaleString()
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString()
    }

    const statusClass = (status) => {
      const normalized = String(status || '').trim().toLowerCase()
      if (normalized === 'completed') return 'bg-emerald-500/20 text-emerald-300'
      if (normalized === 'refund requested') return 'bg-purple-500/20 text-purple-300'
      if (normalized === 'refunded') return 'bg-rose-500/20 text-rose-300'
      if (normalized === 'cancelled') return 'bg-red-500/20 text-red-300'
      return 'bg-amber-500/20 text-amber-300'
    }

    const requestStatusClass = (status) => {
      const normalized = String(status || '').trim().toLowerCase()
      if (normalized === 'approved') return 'bg-emerald-500/20 text-emerald-300'
      if (normalized === 'rejected') return 'bg-red-500/20 text-red-300'
      if (normalized === 'pending') return 'bg-purple-500/20 text-purple-300'
      return 'bg-slate-600 text-slate-200'
    }

    const buildVoucherCode = (orderId) => {
      const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
      return `VCHR-${String(orderId || '').slice(0, 6).toUpperCase()}-${suffix}`
    }

    const eligibleOrders = computed(() =>
      orders.value.filter(
        (order) =>
          !order.refundVoucherId &&
          (String(order.refundRequestStatus || '').toLowerCase() === 'pending' ||
            ['completed', 'cancelled'].includes(String(order.status || '').toLowerCase()))
      )
    )

    const refundedOrders = computed(() => orders.value.filter((order) => Boolean(order.refundVoucherId)))

    const pendingRefundRequests = computed(() =>
      orders.value.filter((order) => String(order.refundRequestStatus || '').trim().toLowerCase() === 'pending')
    )

    const totalRefundValue = computed(() =>
      refundedOrders.value.reduce((sum, order) => sum + Number(order.refundAmount || 0), 0)
    )

    const filteredOrders = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()

      return orders.value.filter((order) => {
        const status = String(order.status || '').trim()
        const matchesSearch =
          !keyword ||
          [order.id, order.customerName, order.customerEmail, order.branchName]
            .map((entry) => String(entry || '').toLowerCase())
            .join(' ')
            .includes(keyword)

        const matchesStatus = !statusFilter.value || status === statusFilter.value
        const matchesRefundState =
          !refundStateFilter.value ||
          (refundStateFilter.value === 'eligible' && !order.refundVoucherId) ||
          (refundStateFilter.value === 'refunded' && Boolean(order.refundVoucherId))

        return matchesSearch && matchesStatus && matchesRefundState
      })
    })

    const resolveAccessibleBranches = async (user) => {
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const userData = userSnap.exists() ? userSnap.data() || {} : {}
      const compactRole = String(userData.role || userData.userType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')

      if (OWNER_ROLES.has(compactRole)) {
        const clinicsSnap = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', user.uid)))
        const clinics = clinicsSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
        accessibleBranchIds.value = clinics.map((clinic) => clinic.id)
        branchMap.value = Object.fromEntries(
          clinics.map((clinic) => [clinic.id, String(clinic.clinicBranch || clinic.clinicName || 'Branch').trim()])
        )
        return
      }

      const branchId = String(userData.branchId || '').trim()
      accessibleBranchIds.value = branchId ? [branchId] : []
      branchMap.value = branchId ? { [branchId]: String(userData.clinicBranch || 'Branch').trim() } : {}
    }

    const loadData = async () => {
      if (!accessibleBranchIds.value.length) {
        orders.value = []
        loading.value = false
        return
      }

      loading.value = true
      try {
        const requestSnapshot = await getDocs(collection(db, 'refundRequests'))
        refundRequestMap.value = Object.fromEntries(
          requestSnapshot.docs.map((snap) => [snap.id, { id: snap.id, ...snap.data() }])
        )

        const snapshot = await getDocs(collection(db, 'customerOrders'))
        const allOrders = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))

        orders.value = allOrders
          .map((order) => {
            const items = Array.isArray(order.items) ? order.items : []
            const branchItem = items.find((item) => accessibleBranchIds.value.includes(String(item.branchId || '').trim()))
            if (!branchItem) return null

            const refundRequest = order.refundRequestId ? refundRequestMap.value[order.refundRequestId] : null

            return {
              ...order,
              branchId: String(branchItem.branchId || '').trim(),
              branchName: branchMap.value[String(branchItem.branchId || '').trim()] || branchItem.branchName || 'Branch',
              refundAmount: Number(order.refundAmount || 0),
              orderStatusAtRequest: order.orderStatusAtRequest || refundRequest?.orderStatusAtRequest || 'Completed',
              refundRequestStatus: order.refundRequestStatus || refundRequest?.status || '',
              refundIssueType: order.refundIssueType || refundRequest?.issueType || '',
              refundReason: order.refundReason || refundRequest?.reason || '',
              refundProofUrl: order.refundProofUrl || refundRequest?.proofUrl || '',
            }
          })
          .filter(Boolean)
          .sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime()
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime()
            return bTime - aTime
          })
      } catch (error) {
        console.error('Failed to load refund data:', error)
        toast.error('Failed to load refund data.')
      } finally {
        loading.value = false
      }
    }

    const selectOrder = (order) => {
      selectedOrder.value = order
      refundForm.value = {
        reason: String(order.refundReason || '').trim(),
        amount: Number(order.refundAmount || order.total || 0),
        code: String(order.refundVoucherCode || buildVoucherCode(order.id)).trim(),
      }
    }

    const clearSelection = () => {
      selectedOrder.value = null
      refundForm.value = {
        reason: '',
        amount: 0,
        code: '',
      }
    }

    const createCustomerNotification = async (customerId, title, message) => {
      if (!customerId) return
      await addDoc(collection(db, 'notifications'), {
        recipientUserId: String(customerId).trim(),
        title: String(title || 'Notification').trim(),
        message: String(message || '').trim(),
        link: '/customer/orders',
        read: false,
        deleted: false,
        createdAt: serverTimestamp(),
      })
    }

    const issueRefund = async () => {
      if (!selectedOrder.value?.id) {
        toast.error('Select an order first.')
        return
      }
      if (selectedOrder.value.refundVoucherId) {
        toast.info('This order already has a refund voucher.')
        return
      }
      if (!refundForm.value.reason.trim()) {
        toast.error('Refund reason is required.')
        return
      }
      if (Number(refundForm.value.amount) <= 0) {
        toast.error('Voucher amount must be greater than zero.')
        return
      }

      issuingRefund.value = true
      try {
        const voucherPayload = {
          orderId: selectedOrder.value.id,
          branchId: selectedOrder.value.branchId,
          customerId: selectedOrder.value.customerId || '',
          customerName: selectedOrder.value.customerName || selectedOrder.value.delivery?.fullName || 'Customer',
          code: refundForm.value.code,
          amount: Number(refundForm.value.amount),
          reason: refundForm.value.reason.trim(),
          status: 'Issued',
          issuedBy: currentUserId.value,
          issuedAt: serverTimestamp(),
          expiresAt: null,
          type: 'refund_voucher',
        }

        const voucherRef = await addDoc(collection(db, 'refundVouchers'), voucherPayload)

        await updateDoc(doc(db, 'customerOrders', selectedOrder.value.id), {
          status: 'Refunded',
          refundType: 'Voucher',
          refundReason: refundForm.value.reason.trim(),
          refundAmount: Number(refundForm.value.amount),
          refundVoucherId: voucherRef.id,
          refundVoucherCode: refundForm.value.code,
          refundRequestStatus: selectedOrder.value.refundRequestId ? 'Approved' : '',
          refundedAt: serverTimestamp(),
          refundedBy: currentUserId.value,
          updatedAt: serverTimestamp(),
        })

        if (selectedOrder.value.refundRequestId) {
          await updateDoc(doc(db, 'refundRequests', selectedOrder.value.refundRequestId), {
            status: 'Approved',
            voucherId: voucherRef.id,
            voucherCode: refundForm.value.code,
            reviewedBy: currentUserId.value,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }

        await addDoc(collection(db, 'transactions'), {
          branchId: selectedOrder.value.branchId,
          amount: -Math.abs(Number(refundForm.value.amount)),
          method: 'Voucher',
          status: 'Refunded',
          type: 'refund_voucher',
          orderId: selectedOrder.value.id,
          clientName: selectedOrder.value.customerName || selectedOrder.value.delivery?.fullName || 'Customer',
          service: 'Order Refund Voucher',
          voucherCode: refundForm.value.code,
          receptionistId: currentUserId.value,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        const target = orders.value.find((entry) => entry.id === selectedOrder.value.id)
        if (target) {
          target.status = 'Refunded'
          target.refundType = 'Voucher'
          target.refundReason = refundForm.value.reason.trim()
          target.refundAmount = Number(refundForm.value.amount)
          target.refundVoucherId = voucherRef.id
          target.refundVoucherCode = refundForm.value.code
          if (target.refundRequestId) target.refundRequestStatus = 'Approved'
        }

        await createCustomerNotification(
          selectedOrder.value.customerId,
          'Refund Approved',
          `Your refund for order ${selectedOrder.value.id} was approved. A voucher refund has been issued to your account.`
        )

        selectOrder(target || { ...selectedOrder.value, refundVoucherId: voucherRef.id, refundVoucherCode: refundForm.value.code })
        toast.success('Refund voucher issued successfully.')
      } catch (error) {
        console.error('Failed to issue refund:', error)
        toast.error('Failed to issue refund voucher.')
      } finally {
        issuingRefund.value = false
      }
    }

    const rejectRefundRequest = async () => {
      if (!selectedOrder.value?.refundRequestId) {
        toast.error('No refund request selected.')
        return
      }

      try {
        await updateDoc(doc(db, 'refundRequests', selectedOrder.value.refundRequestId), {
          status: 'Rejected',
          reviewedBy: currentUserId.value,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        await updateDoc(doc(db, 'customerOrders', selectedOrder.value.id), {
          status: selectedOrder.value.orderStatusAtRequest || 'Completed',
          refundRequestStatus: 'Rejected',
          updatedAt: serverTimestamp(),
        })

        const target = orders.value.find((entry) => entry.id === selectedOrder.value.id)
        if (target) {
          target.status = target.orderStatusAtRequest || 'Completed'
          target.refundRequestStatus = 'Rejected'
        }
        if (target) {
          selectOrder(target)
        }
        await createCustomerNotification(
          selectedOrder.value.customerId,
          'Refund Request Rejected',
          `Your refund request for order ${selectedOrder.value.id} was reviewed and rejected.`
        )
        toast.success('Refund request rejected.')
      } catch (error) {
        console.error('Failed to reject refund request:', error)
        toast.error('Failed to reject refund request.')
      }
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          accessibleBranchIds.value = []
          orders.value = []
          return
        }

        currentUserId.value = user.uid
        await resolveAccessibleBranches(user)
        await loadData()
      })
    })

    return {
      loading,
      issuingRefund,
      orders,
      selectedOrder,
      search,
      statusFilter,
      refundStateFilter,
      refundForm,
      filteredOrders,
      eligibleOrders,
      pendingRefundRequests,
      refundedOrders,
      totalRefundValue,
      formatCurrency,
      formatDate,
      statusClass,
      requestStatusClass,
      selectOrder,
      clearSelection,
      issueRefund,
      rejectRefundRequest,
      loadData,
    }
  },
}
</script>
