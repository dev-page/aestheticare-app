<template>
  <div class="flex module-theme min-h-screen bg-slate-900">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="mb-2 text-3xl font-bold text-white">Appointment Request Approvals</h1>
          <p class="text-slate-400">Approve or reject cancellation and reschedule requests from customers.</p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
          @click="loadRequests"
        >
          Refresh
        </button>
      </div>

      <div class="mb-6 grid gap-4 md:grid-cols-3">
        <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-sm text-slate-400">Pending Requests</p>
          <p class="mt-2 text-2xl font-bold text-white">{{ pendingRequests.length }}</p>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-sm text-slate-400">Cancellation Requests</p>
          <p class="mt-2 text-2xl font-bold text-rose-300">{{ cancellationRequests.length }}</p>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-sm text-slate-400">Reschedule Requests</p>
          <p class="mt-2 text-2xl font-bold text-cyan-300">{{ rescheduleRequests.length }}</p>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <section class="space-y-6">
          <div class="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label class="mb-2 block text-sm text-slate-400">Search</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Customer, service, date..."
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label class="mb-2 block text-sm text-slate-400">Type</label>
                <select
                  v-model="typeFilter"
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All</option>
                  <option value="cancel">Cancellation</option>
                  <option value="reschedule">Reschedule</option>
                </select>
              </div>
              <div>
                <label class="mb-2 block text-sm text-slate-400">Status</label>
                <select
                  v-model="statusFilter"
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <div class="border-b border-slate-700 px-6 py-4">
              <h2 class="text-lg font-semibold text-white">Requests</h2>
            </div>
            <div v-if="loading" class="px-6 py-8 text-slate-400">Loading appointment requests...</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[920px]">
                <thead class="bg-slate-700">
                  <tr>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Request</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Customer</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Original</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Requested</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Status</th>
                    <th class="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                  <tr v-if="filteredRequests.length === 0">
                    <td colspan="6" class="px-6 py-8 text-center text-slate-400">No requests matched your filters.</td>
                  </tr>
                  <tr
                    v-for="request in filteredRequests"
                    :key="request.id"
                    class="cursor-pointer transition hover:bg-slate-700/40"
                    :class="selectedRequest?.id === request.id ? 'bg-slate-700/50' : ''"
                    @click="selectRequest(request)"
                  >
                    <td class="px-6 py-4">
                      <p class="font-semibold text-white">{{ request.requestTypeLabel }}</p>
                      <p class="text-xs text-slate-400">{{ request.branchName || 'Branch' }}</p>
                    </td>
                    <td class="px-6 py-4 text-slate-300">
                      <p class="text-white">{{ request.clientName }}</p>
                      <p class="text-xs text-slate-400">{{ request.serviceLabel }}</p>
                    </td>
                    <td class="px-6 py-4 text-slate-300">
                      <p>{{ request.date || '-' }} {{ request.time || '' }}</p>
                      <p class="text-xs text-slate-400">{{ request.assignedPractitionerName || 'Assigned Practitioner' }}</p>
                    </td>
                    <td class="px-6 py-4 text-slate-300">
                      <p>{{ request.requestedDate || '-' }} {{ request.requestedTime || '' }}</p>
                      <p class="text-xs text-slate-400">{{ request.requestedPractitionerName || 'Assigned Practitioner' }}</p>
                    </td>
                    <td class="px-6 py-4">
                      <span class="rounded-full px-3 py-1 text-xs font-medium" :class="request.requestBadgeClass">
                        {{ request.requestReviewState }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <button
                        type="button"
                        class="rounded-lg px-3 py-2 text-sm text-white transition"
                        :class="selectedRequest?.id === request.id ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-600 hover:bg-slate-500'"
                        @click.stop="selectRequest(request)"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside class="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div v-if="loading" class="min-h-[320px] text-slate-400">Loading request details...</div>
          <div v-else-if="selectedRequest">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Selected Request</p>
                <h2 class="mt-2 text-xl font-semibold text-white">{{ selectedRequest.requestTypeLabel }}</h2>
                <p class="mt-1 text-sm text-slate-400">{{ selectedRequest.clientName }}</p>
              </div>
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="selectedRequest.requestBadgeClass">
                {{ selectedRequest.requestReviewState }}
              </span>
            </div>

            <div class="mt-6 space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
              <div class="flex items-center justify-between gap-4">
                <span>Service</span>
                <span class="font-semibold text-white">{{ selectedRequest.serviceLabel }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span>Original Schedule</span>
                <span class="font-semibold text-white">{{ selectedRequest.date || '-' }} {{ selectedRequest.time || '' }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span>Requested Schedule</span>
                <span class="font-semibold text-cyan-200">{{ selectedRequest.requestedDate || '-' }} {{ selectedRequest.requestedTime || '' }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span>Practitioner</span>
                <span class="font-semibold text-white">{{ selectedRequest.requestedPractitionerName || selectedRequest.assignedPractitionerName || 'Assigned Practitioner' }}</span>
              </div>
              <div v-if="selectedRequest.requestType === 'cancel'" class="flex items-center justify-between gap-4">
                <span>Refund Amount</span>
                <span class="font-semibold text-emerald-300">{{ formatCurrency(selectedRequest.refundRequestedAmount || 0) }}</span>
              </div>
              <div v-if="selectedRequest.requestType === 'cancel'" class="flex items-center justify-between gap-4">
                <span>Commission Excluded</span>
                <span class="font-semibold text-rose-300">{{ formatCurrency(selectedRequest.refundCommissionAmount || 0) }}</span>
              </div>
            </div>

            <div class="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Request Reason</p>
              <p class="mt-2 whitespace-pre-wrap">{{ selectedRequest.requestReason || 'No reason provided.' }}</p>
            </div>

            <div class="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Clinic Policy</p>
              <p class="mt-2 whitespace-pre-wrap">{{ selectedRequest.policySnapshot || selectedRequest.fallbackPolicyText }}</p>
            </div>

            <div class="mt-6">
              <label class="mb-2 block text-sm text-slate-400">Decision Note</label>
              <textarea
                v-model.trim="decisionNote"
                rows="4"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Optional note to record with this decision."
              ></textarea>
            </div>

            <div class="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="processing || selectedRequest.requestReviewState !== 'Pending'"
                @click="rejectSelectedRequest"
              >
                Reject
              </button>
              <button
                type="button"
                class="rounded-lg bg-cyan-600 px-4 py-2 text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="processing || selectedRequest.requestReviewState !== 'Pending'"
                @click="approveSelectedRequest"
              >
                {{ processing ? 'Processing...' : 'Approve' }}
              </button>
            </div>
          </div>

          <div v-else class="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-slate-400">
            Select a request to review its details and decision options.
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

const db = getFirestore(getApp())
const auth = getAuth(getApp())

const loading = ref(true)
const processing = ref(false)
const currentUserId = ref('')
const currentUserName = ref('')
const currentBranchId = ref('')
const currentBranchName = ref('')
const currentBranchPolicy = ref({ cancellationPolicy: '', reschedulePolicy: '', refundPolicy: '' })
const requests = ref([])
const selectedRequestId = ref('')
const searchQuery = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const decisionNote = ref('')
let unsubscribeAuth = null

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))

const normalizeStatus = (value) => String(value || '').trim().toLowerCase()

const requestTypeLabel = (status) => {
  const normalized = normalizeStatus(status)
  if (normalized.includes('cancellation requested')) return 'Cancellation Request'
  if (normalized.includes('reschedule requested')) return 'Reschedule Request'
  return 'Appointment Request'
}

const requestReviewState = (status) => {
  const normalized = normalizeStatus(status)
  if (normalized.includes('requested')) return 'Pending'
  if (normalized === 'cancelled') return 'Approved'
  return String(status || 'Pending')
}

const requestBadgeClass = (state) => {
  const normalized = normalizeStatus(state)
  if (normalized === 'approved') return 'bg-emerald-500/20 text-emerald-300'
  if (normalized === 'rejected') return 'bg-rose-500/20 text-rose-300'
  return 'bg-purple-500/20 text-purple-300'
}

const resolveTimeValue = (value) => {
  if (value?.seconds) return value.seconds * 1000
  const parsed = new Date(value || 0)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const filteredRequests = computed(() => {
  const keyword = String(searchQuery.value || '').trim().toLowerCase()
  return requests.value.filter((request) => {
    const matchesSearch =
      !keyword ||
      [request.clientName, request.serviceLabel, request.date, request.time, request.requestedDate, request.requestedTime]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
        .includes(keyword)
    const matchesType =
      !typeFilter.value ||
      (typeFilter.value === 'cancel' && request.requestType === 'cancel') ||
      (typeFilter.value === 'reschedule' && request.requestType === 'reschedule')
    const matchesStatus = !statusFilter.value || request.requestReviewState.toLowerCase() === statusFilter.value
    return matchesSearch && matchesType && matchesStatus
  })
})

const pendingRequests = computed(() => requests.value.filter((request) => request.requestReviewState === 'Pending'))
const cancellationRequests = computed(() => requests.value.filter((request) => request.requestType === 'cancel'))
const rescheduleRequests = computed(() => requests.value.filter((request) => request.requestType === 'reschedule'))
const selectedRequest = computed(() => requests.value.find((request) => request.id === selectedRequestId.value) || filteredRequests.value[0] || null)

const selectRequest = (request) => {
  selectedRequestId.value = request?.id || ''
}

const loadRequests = async () => {
  loading.value = true
  try {
    const [appointmentSnap, clinicSnap] = await Promise.all([
      getDocs(query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value))),
      getDoc(doc(db, 'clinics', currentBranchId.value)),
    ])

    const clinicData = clinicSnap.exists() ? clinicSnap.data() || {} : {}
    currentBranchName.value = String(clinicData.clinicName || clinicData.clinicBranch || currentBranchName.value || 'Branch').trim()
    currentBranchPolicy.value = {
      cancellationPolicy: String(clinicData.cancellationPolicy || '').trim(),
      reschedulePolicy: String(clinicData.reschedulePolicy || '').trim(),
      refundPolicy: String(clinicData.refundPolicy || '').trim(),
    }

    requests.value = appointmentSnap.docs
      .map((snap) => {
        const data = snap.data() || {}
        const status = String(data.status || '').toLowerCase()
        const requestType = status.includes('cancellation requested')
          ? 'cancel'
          : status.includes('reschedule requested')
            ? 'reschedule'
            : ''
        if (!requestType) return null

        const requestReason = requestType === 'cancel' ? data.cancellationReason || '' : data.rescheduleReason || ''
        const policySnapshot =
          requestType === 'cancel'
            ? data.cancellationPolicySnapshot || currentBranchPolicy.value.cancellationPolicy || currentBranchPolicy.value.refundPolicy
            : data.reschedulePolicySnapshot || currentBranchPolicy.value.reschedulePolicy

        return {
          id: snap.id,
          ...data,
          branchName: currentBranchName.value || 'Branch',
          requestType,
          requestTypeLabel: requestTypeLabel(data.status),
          requestReviewState: requestReviewState(data.status),
          requestBadgeClass: requestBadgeClass(requestReviewState(data.status)),
          requestReason,
          policySnapshot: String(policySnapshot || '').trim() || 'No clinic policy was provided.',
          fallbackPolicyText:
            requestType === 'cancel'
              ? 'Cancellation requests are reviewed by the clinic first. Approved cancellations are refunded without the system commission.'
              : 'Reschedule requests are reviewed by the clinic first. The new date and time only take effect after approval.',
          serviceLabel: Array.isArray(data.services) && data.services.length ? data.services.join(', ') : data.service || 'Service not set',
          clientName: data.clientName || data.customerName || data.name || 'Customer',
          requestedPractitionerName: data.requestedPractitionerName || data.assignedPractitionerName || data.practitionerName || 'Assigned Practitioner',
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = resolveTimeValue(a.rescheduleRequestedAt || a.cancellationRequestedAt)
        const bTime = resolveTimeValue(b.rescheduleRequestedAt || b.cancellationRequestedAt)
        return bTime - aTime
      })

    if (!selectedRequest.value && requests.value.length) {
      selectedRequestId.value = requests.value[0].id
    }
  } catch (error) {
    console.error(error)
    toast.error('Failed to load appointment requests.')
  } finally {
    loading.value = false
  }
}

const approveSelectedRequest = async () => {
  const request = selectedRequest.value
  if (!request) {
    toast.error('Please select a request first.')
    return
  }

  processing.value = true
  try {
    if (request.requestType === 'cancel') {
      const totalAmount = Number(request.totalAmount || request.amountPaid || request.amount || 0)
      const commissionAmount = Number(request.commissionAmount || request.refundCommissionAmount || 0)
      const refundAmount = Number(request.refundRequestedAmount || Math.max(0, totalAmount - commissionAmount))

      await updateDoc(doc(db, 'appointments', request.id), {
        status: 'Cancelled',
        refundStatus: 'Approved',
        refundApprovedAmount: refundAmount,
        refundCommissionAmount: commissionAmount,
        refundDecisionNote: decisionNote.value.trim(),
        refundDecisionAt: serverTimestamp(),
        refundDecisionById: currentUserId.value,
        refundDecisionByName: currentUserName.value || 'Clinic Staff',
        cancellationApprovedAt: serverTimestamp(),
        cancellationApprovedById: currentUserId.value,
        cancellationApprovedByName: currentUserName.value || 'Clinic Staff',
        updatedAt: serverTimestamp(),
      })
      toast.success('Cancellation request approved.')
    } else {
      await updateDoc(doc(db, 'appointments', request.id), {
        status: 'Scheduled',
        date: request.requestedDate,
        time: request.requestedTime,
        practitionerId: request.requestedPractitionerId || request.practitionerId || request.assignedPractitionerId || '',
        assignedPractitionerId: request.requestedPractitionerId || request.practitionerId || request.assignedPractitionerId || '',
        practitionerName: request.requestedPractitionerName || request.practitionerName || request.assignedPractitionerName || '',
        assignedPractitionerName: request.requestedPractitionerName || request.practitionerName || request.assignedPractitionerName || '',
        rescheduleDecisionNote: decisionNote.value.trim(),
        rescheduleApprovedAt: serverTimestamp(),
        rescheduleApprovedById: currentUserId.value,
        rescheduleApprovedByName: currentUserName.value || 'Clinic Staff',
        updatedAt: serverTimestamp(),
      })
      toast.success('Reschedule request approved.')
    }

    decisionNote.value = ''
    await loadRequests()
    const nextSelected = requests.value.find((item) => item.id === request.id) || requests.value[0] || null
    selectedRequestId.value = nextSelected?.id || ''
  } catch (error) {
    console.error(error)
    toast.error('Failed to approve the request.')
  } finally {
    processing.value = false
  }
}

const rejectSelectedRequest = async () => {
  const request = selectedRequest.value
  if (!request) {
    toast.error('Please select a request first.')
    return
  }

  processing.value = true
  try {
    const payload = {
      requestDecisionStatus: 'Rejected',
      requestDecisionNote: decisionNote.value.trim(),
      requestDecisionAt: serverTimestamp(),
      requestDecisionById: currentUserId.value,
      requestDecisionByName: currentUserName.value || 'Clinic Staff',
      updatedAt: serverTimestamp(),
    }

    if (request.requestType === 'cancel') {
      payload.status = 'Cancellation Rejected'
      payload.refundStatus = 'Rejected'
      payload.refundDecisionNote = decisionNote.value.trim()
      payload.refundDecisionAt = serverTimestamp()
      payload.refundDecisionById = currentUserId.value
      payload.refundDecisionByName = currentUserName.value || 'Clinic Staff'
    } else {
      payload.status = 'Reschedule Rejected'
      payload.rescheduleDecisionNote = decisionNote.value.trim()
      payload.rescheduleDecisionAt = serverTimestamp()
      payload.rescheduleDecisionById = currentUserId.value
      payload.rescheduleDecisionByName = currentUserName.value || 'Clinic Staff'
    }

    await updateDoc(doc(db, 'appointments', request.id), payload)
    decisionNote.value = ''
    toast.success('Request rejected.')
    await loadRequests()
    const nextSelected = requests.value.find((item) => item.id === request.id) || requests.value[0] || null
    selectedRequestId.value = nextSelected?.id || ''
  } catch (error) {
    console.error(error)
    toast.error('Failed to reject the request.')
  } finally {
    processing.value = false
  }
}

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) return
    currentUserId.value = user.uid

    const userSnap = await getDoc(doc(db, 'users', user.uid))
    const userData = userSnap.exists() ? userSnap.data() || {} : {}
    currentBranchId.value = String(userData.branchId || '').trim()
    currentUserName.value =
      String(userData.fullName || '').trim() ||
      `${String(userData.firstName || '').trim()} ${String(userData.lastName || '').trim()}`.trim() ||
      user.email ||
      'Clinic Staff'

    if (!currentBranchId.value) {
      toast.error('Your account has no branch assignment.')
      loading.value = false
      return
    }

    await loadRequests()
  })
})

onUnmounted(() => {
  if (unsubscribeAuth) unsubscribeAuth()
})
</script>
