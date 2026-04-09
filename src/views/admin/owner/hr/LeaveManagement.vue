<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8 text-white">
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
            to="/hr/leave-request"
            class="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Request Leave
          </router-link>
        </div>

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
              <p class="mt-2 text-xl font-semibold text-white">{{ leaveRequests.length }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Pending</p>
              <p class="mt-2 text-xl font-semibold text-white">{{ pendingCount }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Approved</p>
              <p class="mt-2 text-xl font-semibold text-white">{{ approvedCount }}</p>
            </div>
          </div>

          <div v-if="loading" class="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
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
import { computed, onMounted, ref, watch } from 'vue'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { LEAVE_STATUSES, formatLeaveDateRange, isPendingLeaveStatus } from '@/utils/leaveRequests'
import { logActivity } from '@/utils/activityLogger'

const { hasPermission, isClinicAdminOwner } = usePermissions()

const loading = ref(true)
const searchQuery = ref('')
const selectedStatus = ref('')
const leaveRequests = ref([])
const currentUserId = ref('')
const currentUserName = ref('')
const currentBranchId = ref('')
const currentOwnerId = ref('')
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

const resolveViewerContext = async () => {
  const user = auth.currentUser
  if (!user) {
    loading.value = false
    return
  }

  currentUserId.value = user.uid
  const userSnap = await getDoc(doc(db, 'users', user.uid))
  if (!userSnap.exists()) {
    loading.value = false
    return
  }

  const profile = userSnap.data() || {}
  currentUserName.value =
    String(profile.fullName || '').trim() ||
    `${String(profile.firstName || '').trim()} ${String(profile.lastName || '').trim()}`.trim() ||
    user.email ||
    'Employee'
  currentBranchId.value = String(profile.branchId || '').trim()

  if (currentBranchId.value) {
    const clinicSnap = await getDoc(doc(db, 'clinics', currentBranchId.value))
    if (clinicSnap.exists()) {
      currentOwnerId.value = String(clinicSnap.data()?.ownerId || '').trim()
    }
  }

  if (isClinicAdminOwner.value && !currentOwnerId.value) {
    currentOwnerId.value = user.uid
  }
}

const loadLeaveRequests = async () => {
  if (!currentUserId.value) {
    leaveRequests.value = []
    return
  }

  let requestsSnap = null

  if (reviewerMode.value && currentOwnerId.value) {
    requestsSnap = await getDocs(query(collection(db, 'leaveRequests'), where('ownerId', '==', currentOwnerId.value)))
  } else {
    requestsSnap = await getDocs(query(collection(db, 'leaveRequests'), where('requesterId', '==', currentUserId.value)))
  }

  leaveRequests.value = requestsSnap.docs
    .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() }))
    .sort((a, b) => {
      const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0
      const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0
      return bTime - aTime
    })
}

const updateLeaveStatus = async (request, status, reviewRemarks = '') => {
  await updateDoc(doc(db, 'leaveRequests', request.id), {
    status,
    reviewRemarks,
    reviewedBy: currentUserName.value,
    reviewedById: currentUserId.value,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  await logActivity(db, {
    module: 'HR',
    action: `${status} leave request`,
    details: `${currentUserName.value} marked ${request.requesterName}'s ${request.leaveType} request as ${status}.`
  })

  await loadLeaveRequests()
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

  await updateDoc(doc(db, 'leaveRequests', request.id), {
    status: 'Cancelled',
    updatedAt: serverTimestamp()
  })

  await logActivity(db, {
    module: 'HR',
    action: 'Cancelled leave request',
    details: `${currentUserName.value} cancelled a ${request.leaveType} request.`
  })

  await loadLeaveRequests()
  toast.success('Leave request cancelled.')
}

onMounted(async () => {
  await resolveViewerContext()
  await loadLeaveRequests()
  loading.value = false
})

watch(reviewerMode, async () => {
  if (!currentUserId.value || loading.value) return
  await loadLeaveRequests()
})
</script>
