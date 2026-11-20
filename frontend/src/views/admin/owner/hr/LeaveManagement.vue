<template>
  <div class="flex flex-row owner-theme bg-slate-900" :class="{ 'min-h-screen': !embedded }">
    <OwnerSidebar v-if="!embedded" />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 9, rows: 5 }" class="flex-1 p-6 md:p-8 text-white">
      <div class="mx-auto max-w-7xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">HR and Payroll</p>
            <h1 class="mt-3 text-3xl font-bold text-white">Leave Management</h1>
            <p class="mt-2 max-w-3xl text-sm text-slate-400">
              {{ headerDescription }}
            </p>
          </div>
          <router-link
            v-if="hasPermission('page:leave:request')"
            to="/hr/leave-request"
            class="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Request Leave
          </router-link>
        </div>

        <section v-if="reviewerMode && branchOptions.length" class="mt-6 rounded-3xl border border-amber-500/25 bg-slate-800/85 p-5 shadow-lg">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold text-white">Paid leave rule</h2>
              <p class="mt-1 max-w-3xl text-sm text-slate-400">Set the annual allowance and service wait for standard paid leave. HR records employment start dates in Base Pay.</p>
            </div>
            <button type="button" class="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50" :disabled="savingPolicy || !policyBranchId" @click="saveLeavePolicy">
              {{ savingPolicy ? 'Saving...' : 'Save rule' }}
            </button>
          </div>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <label class="text-sm text-slate-300">Clinic branch
              <select v-model="policyBranchId" class="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white" @change="loadLeavePolicy">
                <option v-for="branch in branchOptions" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="text-sm text-slate-300">Paid workdays per year
              <input v-model.number="leavePolicy.annualPaidDays" type="number" min="0" max="365" step="1" class="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
            </label>
            <label class="text-sm text-slate-300">Months of service before eligibility
              <input v-model.number="leavePolicy.eligibilityMonths" type="number" min="0" max="60" step="1" class="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
            </label>
          </div>
        </section>

        <section class="mt-8 rounded-3xl border border-slate-700 bg-slate-800/85 p-6 shadow-lg">
          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search leave type, employee, branch, or reason"
              class="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
            />
            <select v-model="selectedStatus" class="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white">
              <option value="">All statuses</option>
              <option v-for="status in LEAVE_STATUSES" :key="status" :value="status">{{ status }}</option>
            </select>
          </div>

          <div class="mt-6 grid gap-4 md:grid-cols-3">
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Total Requests</p>
              <p class="mt-2 text-xl font-semibold text-white">{{ loadError || loading ? '—' : leaveRequests.length }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Pending</p>
              <p class="mt-2 text-xl font-semibold text-white">{{ loadError || loading ? '—' : pendingCount }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Approved</p>
              <p class="mt-2 text-xl font-semibold text-white">{{ loadError || loading ? '—' : approvedCount }}</p>
            </div>
          </div>

          <div v-if="loadError" role="alert" class="mt-6 rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900">
            <h2 class="font-semibold">Unable to load leave requests</h2>
            <p class="mt-2">{{ loadError }}</p>
            <button type="button" class="mt-4 rounded-lg border border-rose-300 px-4 py-2 font-semibold disabled:opacity-50" :disabled="loading" @click="reloadLeaveRequests">Try again</button>
          </div>
          <div v-else-if="loading" class="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
            Loading leave requests...
          </div>

          <div v-else-if="!filteredRequests.length" class="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-5 py-12 text-center">
            <h2 class="text-lg font-semibold text-white">No leave requests found</h2>
            <p class="mt-2 text-sm text-slate-400">
              {{ emptyStateMessage }}
            </p>
          </div>

          <div v-else class="mt-6 overflow-x-auto">
            <table class="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-700 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <th class="px-4 py-3">Employee</th>
                  <th class="px-4 py-3">Leave Type</th>
                  <th class="px-4 py-3">Dates</th>
                  <th class="px-4 py-3">Payment</th>
                  <th class="px-4 py-3">Days</th>
                  <th class="px-4 py-3">Reason</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3">Attachment</th>
                  <th class="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="request in filteredRequests" :key="request.id" class="border-b border-slate-800 text-sm text-slate-200">
                  <td class="px-4 py-4">
                    <p class="font-semibold text-white">{{ request.requesterName }}</p>
                    <p class="mt-1 text-xs text-slate-400">{{ request.branchName || 'No branch' }}</p>
                  </td>
                  <td class="px-4 py-4">{{ request.leaveType }}</td>
                  <td class="px-4 py-4">{{ formatLeaveDateRange(request.startDate, request.endDate) }}</td>
                  <td class="px-4 py-4">{{ request.paymentType }}</td>
                  <td class="px-4 py-4">{{ request.daysRequested }}</td>
                  <td class="px-4 py-4">
                    <p class="max-w-xs truncate" :title="request.reason">{{ request.reason }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <span
                      class="rounded-full px-3 py-1 text-xs font-semibold"
                      :class="statusClasses(request.status)"
                    >
                      {{ request.status }}
                    </span>
                  </td>
                  <td class="px-4 py-4">
                    <a
                      v-if="request.attachmentUrl"
                      :href="request.attachmentUrl"
                      target="_blank"
                      rel="noreferrer"
                      class="text-amber-300 hover:text-amber-200"
                    >
                      {{ request.attachmentFileName || 'Open file' }}
                    </a>
                    <span v-else class="text-slate-500">None</span>
                  </td>
                  <td class="px-4 py-4">
                    <div class="flex flex-wrap gap-2">
                      <router-link
                        v-if="canEditOwnRequest(request)"
                        :to="`/hr/leave-request?id=${request.id}`"
                        class="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                      >
                        Edit
                      </router-link>
                      <button
                        v-if="canCancelOwnRequest(request)"
                        type="button"
                        class="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
                        @click="cancelLeaveRequest(request)"
                      >
                        Cancel
                      </button>
                      <button
                        v-if="canReviewRequest(request)"
                        type="button"
                        class="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
                        @click="approveLeaveRequest(request)"
                      >
                        Approve
                      </button>
                      <button
                        v-if="canReviewRequest(request)"
                        type="button"
                        class="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
                        @click="rejectLeaveRequest(request)"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { LEAVE_STATUSES, formatLeaveDateRange, isPendingLeaveStatus } from '@/utils/leaveRequests'
import { logActivity } from '@/utils/activityLogger'
import { workflowApi } from '@/utils/workflowApi'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
import { leaveRequestScopes, subscribeLeaveScopes } from '@/utils/leaveRequestScope'
import { DEFAULT_LEAVE_POLICY, normalizeLeavePolicy } from '../../../../../../shared/leavePolicy.js'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

const props = defineProps({ embedded: { type: Boolean, default: false } })
const embedded = props.embedded

const { hasPermission, isClinicAdminOwner } = usePermissions()

const loading = ref(true)
const loadError = ref('')
const searchQuery = ref('')
const selectedStatus = ref('')
const leaveRequests = ref([])
const currentUserId = ref('')
const currentUserName = ref('')
const branchIds = ref([])
const branchOptions = ref([])
const policyBranchId = ref('')
const leavePolicy = ref({ ...DEFAULT_LEAVE_POLICY })
const savingPolicy = ref(false)
let unsubscribeLeaveRequests = null
let isDisposed = false
const reviewerMode = computed(() => Boolean(isClinicAdminOwner.value || hasPermission('leave:review')))

const headerDescription = computed(() =>
  reviewerMode.value
    ? 'Review, approve, or reject leave requests for your clinic branches.'
    : 'Track your submitted leave requests and update pending ones when needed.'
)

const filteredRequests = computed(() => {
  const keyword = String(searchQuery.value || '').trim().toLowerCase()
  return leaveRequests.value.filter((request) => {
    const statusMatches = !selectedStatus.value || request.status === selectedStatus.value
    const searchMatches =
      !keyword ||
      [request.requesterName, request.branchName, request.leaveType, request.reason, request.paymentType]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    return statusMatches && searchMatches
  })
})

const pendingCount = computed(() => leaveRequests.value.filter((request) => isPendingLeaveStatus(request.status)).length)
const approvedCount = computed(() => leaveRequests.value.filter((request) => String(request.status || '').trim() === 'Approved').length)
const emptyStateMessage = computed(() =>
  reviewerMode.value
    ? 'No leave requests match the current filters for this clinic.'
    : 'You have not submitted any leave requests yet.'
)

const statusClasses = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'approved') return 'bg-emerald-500/15 text-emerald-300'
  if (normalized === 'rejected') return 'bg-rose-500/15 text-rose-300'
  if (normalized === 'cancelled') return 'bg-slate-700 text-slate-300'
  return 'bg-amber-500/15 text-amber-300'
}

const canEditOwnRequest = (request) =>
  !reviewerMode.value &&
  String(request.requesterId || '').trim() === currentUserId.value &&
  isPendingLeaveStatus(request.status)

const canCancelOwnRequest = (request) => canEditOwnRequest(request)

const canReviewRequest = (request) =>
  reviewerMode.value &&
  isPendingLeaveStatus(request.status) &&
  String(request.requesterId || '').trim() !== currentUserId.value

const resolveViewerContext = trackPageLoad(async () => {
  const user = auth.currentUser
  if (!user) throw new Error('Please sign in again to view leave requests.')
  currentUserId.value = user.uid
  const scope = await loadOwnerBranchScope(db, user.uid)
  const profile = scope.userProfile
  currentUserName.value = String(profile.fullName || '').trim()
    || `${String(profile.firstName || '').trim()} ${String(profile.lastName || '').trim()}`.trim()
    || user.email || 'Employee'
  const clinics = await loadClinicDocsByIds(db, scope.branchIds)
  // Workforce records are authorized per branch and are Premium-only.
  const eligibleClinics = clinics.filter(clinic => clinic.subscriptionPlan === 'premium')
  branchIds.value = eligibleClinics.map(clinic => clinic.id)
  branchOptions.value = eligibleClinics.map(clinic => ({ id: clinic.id, name: clinic.clinicBranch || clinic.clinicName || clinic.id }))
  if (!branchOptions.value.some(branch => branch.id === policyBranchId.value)) policyBranchId.value = branchOptions.value[0]?.id || ''
  if (!branchIds.value.length) throw new Error('No assigned branch includes Premium workforce access. Check your branch assignment and subscription.')
})

const subscriptionErrorMessage = error => error?.code === 'permission-denied'
  ? 'Access to leave requests was denied. Your assigned branches, leave-review permission, and branch Premium plan must allow this access.'
  : error?.message || 'Leave requests could not be loaded. Please check your connection and try again.'

const loadLeavePolicy = async () => {
  if (!policyBranchId.value || !reviewerMode.value) return
  try {
    const token = await auth.currentUser?.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/hr/leave-policy?branchId=${encodeURIComponent(policyBranchId.value)}`, { headers: { Authorization: `Bearer ${token}` } })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Paid leave rule could not be loaded.')
    leavePolicy.value = normalizeLeavePolicy(payload.data)
  } catch (error) {
    toast.error(error.message || 'Paid leave rule could not be loaded.')
  }
}

const saveLeavePolicy = async () => {
  if (!policyBranchId.value || savingPolicy.value) return
  savingPolicy.value = true
  try {
    leavePolicy.value = normalizeLeavePolicy(leavePolicy.value)
    await workflowApi('/hr/leave-policy', { branchId: policyBranchId.value, ...leavePolicy.value })
    toast.success('Paid leave rule saved.')
  } catch (error) {
    toast.error(error.message || 'Paid leave rule could not be saved.')
  } finally { savingPolicy.value = false }
}

const subscribeLeaveRequests = () => {
  unsubscribeLeaveRequests?.()
  leaveRequests.value = []
  loadError.value = ''
  loading.value = true
  const scopes = leaveRequestScopes(branchIds.value, currentUserId.value, reviewerMode.value)
  unsubscribeLeaveRequests = subscribeLeaveScopes(scopes, (scope, success, failure) => {
    const constraints = [where('branchId', '==', scope.branchId)]
    if (scope.requesterId) constraints.push(where('requesterId', '==', scope.requesterId))
    return pageListener(onSnapshot, query(collection(db, 'leaveRequests'), ...constraints),
      snapshot => success(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() }))),
      error => { console.error('Failed to subscribe to branch leave updates:', error); failure(error) })
  }, state => {
    leaveRequests.value = state.requests
    loading.value = state.loading
    loadError.value = state.errors.length ? subscriptionErrorMessage(state.errors[0]) : ''
  })
}

const reloadLeaveRequests = trackPageLoad(async () => {
  unsubscribeLeaveRequests?.()
  loading.value = true
  loadError.value = ''
  try {
    await resolveViewerContext()
    if (isDisposed) return
    if (reviewerMode.value) await loadLeavePolicy()
    subscribeLeaveRequests()
  } catch (error) {
    console.error('Failed to load leave management:', error)
    loadError.value = subscriptionErrorMessage(error)
    loading.value = false
  }
})

const updateLeaveStatus = async (request, status, reviewRemarks = '') => {
  await workflowApi(`/hr/leave-requests/${encodeURIComponent(request.id)}/review`, { status, reviewRemarks })

  await logActivity(db, {
    module: 'HR',
    action: `${status} leave request`,
    details: `${currentUserName.value} marked ${request.requesterName}'s ${request.leaveType} request as ${status}.`
  })

  // The live listener reflects this update automatically.
}

const approveLeaveRequest = async (request) => {
  const prompt = await Swal.fire({
    title: 'Approve Leave Request',
    text: `Approve the ${request.leaveType} request of ${request.requesterName}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Approve',
    cancelButtonText: 'Cancel'
  })
  if (!prompt.isConfirmed) return
  await updateLeaveStatus(request, 'Approved')
  toast.success('Leave request approved.')
}

const rejectLeaveRequest = async (request) => {
  const prompt = await Swal.fire({
    title: 'Reject Leave Request',
    input: 'textarea',
    inputLabel: 'Reason for rejection',
    inputPlaceholder: 'Share a short reason for rejecting this leave request',
    inputValidator: (value) => (!String(value || '').trim() ? 'A rejection reason is required.' : undefined),
    showCancelButton: true,
    confirmButtonText: 'Reject request',
    cancelButtonText: 'Cancel'
  })
  if (!prompt.isConfirmed) return
  await updateLeaveStatus(request, 'Rejected', String(prompt.value || '').trim())
  toast.success('Leave request rejected.')
}

const cancelLeaveRequest = async (request) => {
  const prompt = await Swal.fire({
    title: 'Cancel Leave Request',
    text: 'Cancel this pending leave request?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Cancel request',
    cancelButtonText: 'Keep request'
  })
  if (!prompt.isConfirmed) return

  await workflowApi(`/hr/leave-requests/${encodeURIComponent(request.id)}/cancel`, {})

  await logActivity(db, {
    module: 'HR',
    action: 'Cancelled leave request',
    details: `${currentUserName.value} cancelled a ${request.leaveType} request.`
  })

  toast.success('Leave request cancelled.')
}

onMounted(reloadLeaveRequests)

watch(reviewerMode, () => {
  if (!currentUserId.value || loading.value || loadError.value) return
  subscribeLeaveRequests()
})

onUnmounted(() => {
  isDisposed = true
  unsubscribeLeaveRequests?.()
})
</script>
