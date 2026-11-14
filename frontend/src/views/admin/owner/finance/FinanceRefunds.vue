<template>
  <div class="flex module-theme finance-page min-h-screen bg-slate-900">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'refunds' }" class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Refund Management</h1>
        <p class="text-slate-400">Review customer refunds for orders, appointments, and services.</p>
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
                  placeholder="Order, appointment, customer..."
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
                  <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span>
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <p class="text-sm text-slate-400">Refund Requests to Review</p>
              <div v-if="loading" class="mt-3 h-8 w-16 animate-pulse rounded-lg bg-slate-700"></div>
              <p v-else class="mt-2 text-2xl font-bold text-amber-300">{{ eligibleOrders.length }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <p class="text-sm text-slate-400">Refunds Processing</p>
              <div v-if="loading" class="mt-3 h-8 w-16 animate-pulse rounded-lg bg-slate-700"></div>
              <p v-else class="mt-2 text-2xl font-bold text-purple-300">{{ pendingRefundRequests.length }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <p class="text-sm text-slate-400">Refunds Confirmed</p>
              <div v-if="loading" class="mt-3 h-8 w-16 animate-pulse rounded-lg bg-slate-700"></div>
              <p v-else class="mt-2 text-2xl font-bold text-rose-300">{{ refundedOrders.length }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-5 md:col-span-3">
              <p class="text-sm text-slate-400">Confirmed Refund Value</p>
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
                        :class="requestStatusClass(order.refundStatus)"
                      >
                        {{ order.refundStatus || 'No refund' }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <button
                      type="button"
                      class="rounded-lg px-3 py-2 text-sm text-white transition"
                      :class="isRefundRequestActionable(order) ? 'bg-purple-600 hover:bg-purple-500' : 'bg-slate-600 hover:bg-slate-500'"
                      @click="selectOrder(order)"
                    >
                        {{ isRefundRequestActionable(order) ? 'Review Request' : 'View Details' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

              <div class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <div class="border-b border-slate-700 px-6 py-4">
              <h2 class="text-lg font-semibold text-white">Appointments & Services</h2>
              <p class="mt-1 text-sm text-slate-400">Appointment refunds waiting for review, processing, or confirmed.</p>
            </div>
            <div v-if="loading" class="px-6 py-6">
              <PageSectionSkeleton variant="table" :rows="6" :columns="7" />
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[900px]">
                <thead class="bg-slate-700">
                  <tr>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Record</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Customer</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Branch</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Service</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Refund</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Status</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Date</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                  <tr v-if="refundedAppointments.length === 0">
                    <td colspan="7" class="px-6 py-8 text-center text-slate-400">No refunded appointments or services yet.</td>
                  </tr>
                  <template v-for="entry in refundedAppointments" :key="entry.id">
                  <tr class="transition hover:bg-slate-700/40">
                    <td class="px-6 py-4 text-slate-200">
                      <p class="font-semibold text-white">{{ entry.id }}</p>
                      <p class="text-xs text-slate-400">{{ entry.recordType }}</p>
                    </td>
                    <td class="px-6 py-4 text-slate-300">
                      <p class="text-white">{{ entry.customerName || 'Customer' }}</p>
                      <p class="text-xs text-slate-400">{{ entry.customerEmail || 'No email' }}</p>
                    </td>
                    <td class="px-6 py-4 text-slate-300">{{ entry.branchName || 'Unknown' }}</td>
                    <td class="px-6 py-4 text-slate-300">{{ entry.service || entry.title || 'Appointment' }}</td>
                    <td class="px-6 py-4 font-medium text-amber-300">{{ formatCurrency(entry.refundAmount) }}</td>
                    <td class="px-6 py-4">
                      <span class="rounded-full px-3 py-1 text-xs font-medium" :class="requestStatusClass(entry.refundStatus)">
                        {{ entry.refundStatus || 'Refunded' }}
                      </span>
                      <button v-if="canManageRefunds && ['Requested', 'Processing'].includes(entry.refundStatus) && (!entry.paymongoRefundId || String(entry.paymongoRefundStatus || '').toLowerCase() === 'failed') && entry.source === 'paymongo_checkout' && ['Cancelled', 'Rejected'].includes(entry.status)" type="button" :disabled="retryingAppointmentId === entry.id" class="mt-2 block rounded-md bg-purple-600 px-3 py-1.5 text-xs text-white disabled:opacity-60" @click="retryAppointmentRefund(entry)">
                        {{ retryingAppointmentId === entry.id ? 'Checking...' : entry.refundStatus === 'Processing' ? 'Retry safely' : 'Retry PayMongo refund' }}
                      </button>
                      <button v-if="canManageRefunds && entry.refundStatus === 'Requested' && !entry.paymongoRefundId && entry.source !== 'paymongo_checkout' && !entry.paymongoPaymentId && ['Cancelled', 'Rejected'].includes(entry.status)" type="button" class="mt-2 block rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/20" @click="openOfflineAppointmentRefund(entry)">
                        Record offline refund
                      </button>
                    </td>
                    <td class="px-6 py-4 text-slate-300">{{ formatDate(entry.refundedAt || entry.updatedAt || entry.createdAt) }}</td>
                  </tr>
                  <tr v-if="offlineRefundAppointmentId === entry.id">
                    <td colspan="7" class="px-6 pb-5">
                      <div class="grid gap-4 rounded-xl border border-amber-400/30 bg-slate-900/70 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        <div class="space-y-3">
                          <label class="flex items-start gap-2 text-sm text-slate-200">
                            <input v-model="offlineRefundConfirmed" type="checkbox" class="mt-1 accent-amber-500" />
                            <span>I confirm the money was already returned to the customer.</span>
                          </label>
                          <input v-model.trim="offlineRefundReference" type="text" maxlength="160" class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="Cash receipt or bank transfer reference" />
                        </div>
                        <input v-model.trim="offlineRefundReason" type="text" maxlength="500" class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="Short finance note" />
                        <div class="flex gap-2">
                          <button type="button" :disabled="!offlineRefundConfirmed || offlineRefundReference.trim().length < 2 || offlineRefundReason.trim().length < 3 || retryingAppointmentId === entry.id" class="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" @click="recordOfflineAppointmentRefund(entry)">
                            {{ retryingAppointmentId === entry.id ? 'Recording…' : 'Confirm recorded refund' }}
                          </button>
                          <button type="button" class="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200" @click="closeOfflineAppointmentRefund">Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  </template>
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
                <span>{{ selectedOrder.paymentMethod || 'Not set' }} · {{ selectedOrder.source === 'paymongo_checkout' ? 'PayMongo' : 'Offline' }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Branch</span>
                <span>{{ selectedOrder.branchName || 'Unknown' }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Refund Status</span>
                <span>{{ selectedOrder.refundStatus || selectedOrder.refundRequestStatus || 'Not refunded' }}</span>
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
              <label class="block text-sm text-slate-400 mb-2">Decision Note</label>
              <textarea
                v-model="refundForm.reason"
                rows="4"
                :disabled="!isRefundRequestActionable(selectedOrder) || issuingRefund"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                placeholder="Add a short note for the customer and finance record."
              />
            </div>

            <div class="mt-4">
              <label class="block text-sm text-slate-400 mb-2">Refund Amount (PHP)</label>
              <input
                v-model.number="refundForm.amount"
                type="number"
                min="0"
                step="0.01"
                :max="maxRefundAmount(selectedOrder)"
                :disabled="!isRefundRequestActionable(selectedOrder) || issuingRefund"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
              />
            </div>

            <p class="mt-1 text-xs text-slate-400">Maximum eligible refund: {{ formatCurrency(maxRefundAmount(selectedOrder)) }}</p>

            <div v-if="Number(refundForm.amount) > 0" class="mt-4">
              <label class="block text-sm text-slate-400 mb-2">Refund Method</label>
              <select v-model="refundForm.method" :disabled="!isRefundRequestActionable(selectedOrder) || issuingRefund" class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white">
                <option v-if="selectedOrder.source === 'paymongo_checkout'" value="original">Return to original PayMongo payment</option>
                <option v-else value="offline">Offline refund recorded by clinic</option>
              </select>
              <p class="mt-1 text-xs text-slate-400">{{ refundForm.method === 'original' ? 'PayMongo confirms when the refund reaches a final state.' : 'Enter a cash or bank reference only after the clinic has returned the money.' }}</p>
            </div>

            <div v-if="Number(refundForm.amount) > 0 && refundForm.method === 'offline'" class="mt-4">
              <label class="block text-sm text-slate-400 mb-2">Offline refund reference</label>
              <input v-model.trim="refundForm.reference" :disabled="!isRefundRequestActionable(selectedOrder) || issuingRefund" type="text" maxlength="160" class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" placeholder="Receipt, bank transfer, or cash reference" />
            </div>

            <div class="mt-6 flex gap-3">
              <button
                v-if="canManageRefunds && selectedOrder.refundRequestId && canRejectRefundRequest(selectedOrder)"
                type="button"
                class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-200 transition hover:bg-red-500/20"
                :disabled="!canManageRefunds || issuingRefund"
                @click="rejectRefundRequest"
              >
                Reject Request
              </button>
              <button
                v-if="canManageRefunds && selectedOrder.refundRequestId && isRefundRequestActionable(selectedOrder)"
                type="button"
                class="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!canManageRefunds || issuingRefund"
                @click="issueRefund"
              >
                {{ issuingRefund ? 'Saving...' : selectedOrder.refundRequest?.requestType === 'cancellation' && Number(refundForm.amount) === 0 ? 'Approve Cancellation' : refundForm.method === 'original' && selectedOrder.refundStatus === 'Requested' ? 'Retry PayMongo Refund' : refundForm.method === 'original' ? 'Approve and Start Refund' : 'Confirm Refund Paid' }}
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
            Select an order to review its refund request or status.
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { usePermissions } from '@/composables/usePermissions'
import { workflowApi } from '@/utils/workflowApi'

const OWNER_ROLES = new Set(['owner', 'clinicowner', 'clinicadmin', 'clinicadministrator'])

export default {
  name: 'FinanceRefunds',
  components: { OwnerSidebar, PageSectionSkeleton },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission } = usePermissions()

    const loading = ref(true)
    const issuingRefund = ref(false)
    const retryingAppointmentId = ref('')
    const offlineRefundAppointmentId = ref('')
    const offlineRefundConfirmed = ref(false)
    const offlineRefundReference = ref('')
    const offlineRefundReason = ref('')
    const accessibleBranchIds = ref([])
    const branchMap = ref({})
    const refundRequestMap = ref({})
    const orders = ref([])
    const appointments = ref([])
    const selectedOrder = ref(null)
    const search = ref('')
    const statusFilter = ref('')
    const refundStateFilter = ref('')
    const refundForm = ref({
      reason: '',
      amount: 0,
      method: 'original',
      reference: '',
    })
    const canManageRefunds = computed(() => hasPermission('finance:refunds:manage'))

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'symbol' }).format(Number(value || 0))

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
      if (['approved', 'refunded'].includes(normalized)) return 'bg-emerald-500/20 text-emerald-300'
      if (normalized === 'rejected') return 'bg-red-500/20 text-red-300'
      if (['pending', 'requested', 'processing'].includes(normalized)) return 'bg-purple-500/20 text-purple-300'
      if (normalized === 'not applicable') return 'bg-slate-600 text-slate-200'
      return 'bg-slate-600 text-slate-200'
    }

    const isRefundRequestActionable = order => ['requested', 'processing', 'pending'].includes(String(order?.refundRequestStatus || '').trim().toLowerCase())
    const canRejectRefundRequest = order => ['requested', 'pending'].includes(String(order?.refundRequestStatus || '').trim().toLowerCase())
      && !(order?.refundRequest?.requestType === 'cancellation' && order?.cancellationRequestStatus === 'Approved')
    const maxRefundAmount = order => {
      if (!order) return 0
      const paid = Number(order.amountPaid || order.totalPaid || order.total || 0)
      const remaining = Math.max(0, paid - Number(order.refundedAmountTotal || 0))
      const requestAmount = Number(order.refundRequest?.amount ?? order.refundRequest?.estimatedRefundAmount ?? order.refundAmount ?? remaining)
      return Math.max(0, Math.min(remaining, requestAmount))
    }

    const eligibleOrders = computed(() =>
      orders.value.filter(order => isRefundRequestActionable(order))
    )

    const refundedOrders = computed(() => orders.value.filter((order) => String(order.refundStatus || '').toLowerCase() === 'refunded'))

    const refundedAppointments = computed(() => appointments.value.filter(entry => ['requested', 'processing', 'refunded'].includes(String(entry.refundStatus || '').trim().toLowerCase())))

    const pendingRefundRequests = computed(() =>
      orders.value.filter((order) => String(order.refundRequestStatus || '').trim() === 'Processing')
    )

    const totalRefundValue = computed(() =>
      refundedOrders.value.reduce((sum, order) => sum + Number(order.refundedAmountTotal || order.refundAmount || 0), 0) +
      refundedAppointments.value.filter(entry => String(entry.refundStatus || '').trim() === 'Refunded').reduce((sum, entry) => sum + Number(entry.refundedAmountTotal || entry.refundAmount || 0), 0)
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
          (refundStateFilter.value === 'eligible' && isRefundRequestActionable(order)) ||
          (refundStateFilter.value === 'refunded' && String(order.refundStatus || '').toLowerCase() === 'refunded')

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

    const loadData = trackPageLoad(async () => {
      if (!accessibleBranchIds.value.length) {
        orders.value = []
        loading.value = false
        return
      }

      loading.value = true
      try {
        const branchChunks = []
        for (let index = 0; index < accessibleBranchIds.value.length; index += 10) {
          branchChunks.push(accessibleBranchIds.value.slice(index, index + 10))
        }
        const readBranchScoped = async (collectionName) => {
          const snapshots = await Promise.all(
            branchChunks.map((branchChunk) => getDocs(query(
              collection(db, collectionName),
              where('branchId', 'in', branchChunk)
            )))
          )
          return snapshots.flatMap((snapshot) => snapshot.docs)
        }

        const requestDocs = await readBranchScoped('refundRequests')
        refundRequestMap.value = Object.fromEntries(
          requestDocs.map((snap) => [snap.id, { id: snap.id, ...snap.data() }])
        )

        const orderDocs = await readBranchScoped('customerOrders')
        const allOrders = orderDocs.map((snap) => ({ id: snap.id, ...snap.data() }))

        const appointmentDocs = await readBranchScoped('appointments')
        const allAppointments = appointmentDocs.map((snap) => ({ id: snap.id, ...snap.data() }))

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
              refundRequest,
              refundStatus: order.refundStatus || '',
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

        appointments.value = allAppointments
          .map((appointment) => {
            const branchId = String(appointment.branchId || '').trim()
            if (!accessibleBranchIds.value.includes(branchId)) return null

            const paymentStatus = String(appointment.paymentStatus || '').trim()
            const isRefunded =
              ['Requested', 'Processing', 'Refunded'].includes(String(appointment.refundStatus || '').trim()) ||
              paymentStatus.toLowerCase() === 'refunded' ||
              String(appointment.paymongoRefundStatus || '').toLowerCase() === 'processing'

            if (!isRefunded) return null

            return {
              ...appointment,
              recordType: String(appointment.type || appointment.bookingType || appointment.consultationMode || 'appointment')
                .trim()
                .replace(/_/g, ' '),
              branchId,
              branchName: branchMap.value[branchId] || appointment.branchName || 'Branch',
              customerName: appointment.customerName || appointment.clientName || 'Customer',
              customerEmail: appointment.customerEmail || appointment.clientEmail || '',
              service: appointment.service || appointment.services?.join(', ') || 'Appointment',
              refundAmount: Number(
                appointment.refundAmount || appointment.refundedAmountTotal || appointment.refundApprovedAmount || appointment.refundRequestedAmount ||
                appointment.totalAmount ||
                appointment.amountPaid ||
                appointment.amount ||
                0
              ),
            }
          })
          .filter(Boolean)
          .sort((a, b) => {
            const aTime = a.refundedAt?.toDate ? a.refundedAt.toDate().getTime() : new Date(a.refundedAt || a.updatedAt || a.createdAt || 0).getTime()
            const bTime = b.refundedAt?.toDate ? b.refundedAt.toDate().getTime() : new Date(b.refundedAt || b.updatedAt || b.createdAt || 0).getTime()
            return bTime - aTime
          })
      } catch (error) {
        console.error('Failed to load refund data:', error)
        toast.error('Failed to load refund data.')
      } finally {
        loading.value = false
      }
    })

    const selectOrder = (order) => {
      selectedOrder.value = order
      refundForm.value = {
        reason: String(order.refundReason || '').trim(),
        amount: maxRefundAmount(order),
        method: order.source === 'paymongo_checkout' ? 'original' : 'offline',
        reference: '',
      }
    }

    const clearSelection = () => {
      selectedOrder.value = null
      refundForm.value = {
        reason: '',
        amount: 0,
        method: 'original',
        reference: '',
      }
    }

    const issueRefund = async () => {
      if (!canManageRefunds.value) {
        toast.error('You do not have permission to manage refunds.')
        return
      }
      if (!selectedOrder.value?.id) {
        toast.error('Select an order first.')
        return
      }
      if (!isRefundRequestActionable(selectedOrder.value)) {
        toast.info('This order has no refund request awaiting review.')
        return
      }
      if (!refundForm.value.reason.trim()) {
        toast.error('Enter a short decision note.')
        return
      }
      const paidAmount = maxRefundAmount(selectedOrder.value)
      const refundAmount = Number(refundForm.value.amount)
      const noRefundCancellation = selectedOrder.value.refundRequest?.requestType === 'cancellation' && paidAmount === 0 && refundAmount === 0
      if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > paidAmount || (refundAmount === 0 && !noRefundCancellation)) {
        toast.error(`Refund amount must be between zero and ${formatCurrency(paidAmount)}. Zero is only valid when a cancellation has no refundable balance.`)
        return
      }
      if (refundAmount > 0 && refundForm.value.method === 'offline' && String(refundForm.value.reference || '').trim().length < 2) {
        toast.error('Enter the offline refund reference after the money has been returned.')
        return
      }

      issuingRefund.value = true
      try {
        const orderId = selectedOrder.value.id
        const result = await workflowApi(`/finance/refunds/orders/${encodeURIComponent(orderId)}/settle`, {
          refundRequestId: selectedOrder.value.refundRequestId || '',
          method: refundForm.value.method,
          amount: refundAmount,
          reason: refundForm.value.reason.trim(),
          reference: refundForm.value.reference.trim(),
        })
        const target = orders.value.find((entry) => entry.id === orderId)
        if (target) {
          Object.assign(target, {
            ...(selectedOrder.value.refundRequest?.requestType === 'cancellation' ? { status: 'Cancelled', cancellationRequestStatus: 'Approved' } : {}),
            refundStatus: result.refundStatus || result.status,
            refundType: result.method || (refundAmount === 0 ? 'None' : refundForm.value.method === 'original' ? 'PayMongo' : 'Offline'),
            refundReason: refundForm.value.reason.trim(),
            refundAmount: result.amount ?? refundAmount,
            refundRequestStatus: result.status === 'Approved' ? 'Approved' : (result.refundStatus || result.status),
          })
        }
        selectOrder(target || { ...selectedOrder.value, ...result })
        toast.success(result.status === 'Refunded' ? 'Refund confirmed and recorded.' : result.status === 'Approved' ? 'Cancellation approved. No refund was due.' : 'Refund request approved and sent for processing.')
      } catch (error) {
        console.error('Failed to issue refund:', error)
        toast.error(error.message || 'Failed to settle refund request.')
      } finally {
        issuingRefund.value = false
      }
    }

    const rejectRefundRequest = async () => {
      if (!canManageRefunds.value) {
        toast.error('You do not have permission to manage refunds.')
        return
      }
      if (!selectedOrder.value?.refundRequestId) {
        toast.error('No refund request selected.')
        return
      }

      const rejectionReason = window.prompt('Reason for rejecting this refund request:')?.trim() || ''
      if (!rejectionReason) {
        toast.error('A rejection reason is required.')
        return
      }

      try {
        const orderId = selectedOrder.value.id
        const result = await workflowApi(`/finance/refunds/orders/${encodeURIComponent(orderId)}/reject`, {
          refundRequestId: selectedOrder.value.refundRequestId,
          reason: rejectionReason,
        })
        const target = orders.value.find((entry) => entry.id === orderId)
        if (target) {
          target.refundRequestStatus = 'Rejected'
          target.refundStatus = 'Rejected'
          selectOrder(target)
        }
        toast.success('Refund request rejected.')
      } catch (error) {
        console.error('Failed to reject refund request:', error)
        toast.error(error.message || 'Failed to reject refund request.')
      }
    }

    const retryAppointmentRefund = async (appointment) => {
      if (!canManageRefunds.value || !appointment?.id) return
      retryingAppointmentId.value = appointment.id
      try {
        const result = await workflowApi(`/finance/refunds/appointments/${encodeURIComponent(appointment.id)}/retry`, {})
        const target = appointments.value.find(entry => entry.id === appointment.id)
        if (target) {
          target.refundStatus = result.status || 'Processing'
          target.refundRequestStatus = result.status || 'Processing'
          target.paymongoRefundId = result.paymongoRefundId || target.paymongoRefundId || null
          target.paymongoRefundStatus = result.providerStatus || target.paymongoRefundStatus || null
        }
        toast.success(result.status === 'Refunded' ? 'Appointment refund confirmed.' : 'Appointment refund sent to PayMongo.')
      } catch (error) {
        console.error('Failed to retry appointment refund:', error)
        toast.error(error.message || 'Failed to retry appointment refund.')
      } finally {
        retryingAppointmentId.value = ''
      }
    }

    const openOfflineAppointmentRefund = (appointment) => {
      offlineRefundAppointmentId.value = appointment?.id || ''
      offlineRefundConfirmed.value = false
      offlineRefundReference.value = ''
      offlineRefundReason.value = ''
    }

    const closeOfflineAppointmentRefund = () => {
      offlineRefundAppointmentId.value = ''
      offlineRefundConfirmed.value = false
      offlineRefundReference.value = ''
      offlineRefundReason.value = ''
    }

    const recordOfflineAppointmentRefund = async (appointment) => {
      if (!canManageRefunds.value || !appointment?.id || !offlineRefundConfirmed.value) return
      retryingAppointmentId.value = appointment.id
      try {
        const result = await workflowApi(`/finance/refunds/appointments/${encodeURIComponent(appointment.id)}/settle-offline`, {
          offlineRefundConfirmed: true,
          reference: offlineRefundReference.value.trim(),
          reason: offlineRefundReason.value.trim(),
        })
        const target = appointments.value.find(entry => entry.id === appointment.id)
        if (target) {
          target.refundStatus = 'Refunded'
          target.refundRequestStatus = 'Refunded'
          target.refundMethod = 'Offline'
          target.refundReference = result.reference || offlineRefundReference.value.trim()
          target.refundAmount = result.amount || target.refundAmount
          target.refundedAmountTotal = Number(target.refundedAmountTotal || 0) + Number(result.amount || 0)
          target.paymentStatus = target.refundedAmountTotal >= Number(target.amountPaid || 0) ? 'Refunded' : 'Partially Refunded'
          target.refundedAt = new Date()
        }
        toast.success('Offline refund recorded with its payment reference.')
        closeOfflineAppointmentRefund()
      } catch (error) {
        console.error('Failed to record offline appointment refund:', error)
        toast.error(error.message || 'Failed to record offline appointment refund.')
      } finally {
        retryingAppointmentId.value = ''
      }
    }

    onMounted(trackPageLoad(() => {
      pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          accessibleBranchIds.value = []
          orders.value = []
          return
        }

        await resolveAccessibleBranches(user)
        await loadData()
      })
    }))

    return {
      pageLoading,
      loading,
      issuingRefund,
      orders,
      selectedOrder,
      search,
      statusFilter,
      refundStateFilter,
      refundForm,
      canManageRefunds,
      filteredOrders,
      eligibleOrders,
      pendingRefundRequests,
      refundedOrders,
      refundedAppointments,
      totalRefundValue,
      formatCurrency,
      formatDate,
      statusClass,
      requestStatusClass,
      isRefundRequestActionable,
      canRejectRefundRequest,
      maxRefundAmount,
      retryingAppointmentId,
      retryAppointmentRefund,
      offlineRefundAppointmentId,
      offlineRefundConfirmed,
      offlineRefundReference,
      offlineRefundReason,
      openOfflineAppointmentRefund,
      closeOfflineAppointmentRefund,
      recordOfflineAppointmentRefund,
      selectOrder,
      clearSelection,
      issueRefund,
      rejectRefundRequest,
      loadData,
    }
  },
}
</script>
