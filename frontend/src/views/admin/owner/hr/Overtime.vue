<template>
  <div class="flex min-h-screen flex-row owner-theme bg-slate-900">
    <OwnerSidebar />

    <main class="min-w-0 flex-1 p-4 text-white sm:p-6 md:p-8">
      <div class="mx-auto max-w-7xl">
        <div class="mb-8">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Leave & Overtime</p>
          <h1 class="mt-3 text-3xl font-bold">Overtime</h1>
          <p class="mt-2 max-w-3xl text-sm text-slate-400">
            Overtime is based on the employee's scheduled shift and recorded attendance, then reviewed before payroll.
          </p>
        </div>

        <section v-if="canSubmit" class="mb-6 rounded-3xl border border-slate-700 bg-slate-800/85 p-5 shadow-lg sm:p-6">
          <h2 class="text-lg font-semibold">Submit Overtime</h2>
          <p class="mt-1 text-sm text-slate-400">Only completed attendance records with time beyond the scheduled shift can be submitted.</p>

          <div class="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label class="mb-2 block text-sm text-slate-300">Date</label>
              <input v-model="form.date" type="date" :max="todayKey" class="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white" @change="loadOwnAttendance" />
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm">
              <div class="grid gap-3 sm:grid-cols-4">
                <div><span class="block text-xs text-slate-500">Scheduled shift</span><strong>{{ attendanceEvidence.shiftLabel || 'Not available' }}</strong></div>
                <div><span class="block text-xs text-slate-500">Scheduled end</span><strong>{{ attendanceEvidence.shiftEnd || '-' }}</strong></div>
                <div><span class="block text-xs text-slate-500">Actual time-out</span><strong>{{ attendanceEvidence.timeOut || '-' }}</strong></div>
                <div><span class="block text-xs text-slate-500">Calculated overtime</span><strong class="text-amber-300">{{ calculatedHours }} hour(s)</strong></div>
              </div>
              <p class="mt-3 text-xs text-slate-400">Attendance status: {{ attendanceEvidence.attendanceStatus || 'No record' }}</p>
            </div>
          </div>

          <textarea v-model.trim="form.reason" rows="3" maxlength="500" placeholder="Explain why the overtime was needed..." class="mt-4 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500" />
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p v-if="formError" class="text-sm text-rose-300">{{ formError }}</p>
            <span v-else class="text-xs text-slate-500">The reviewer will compare this request with attendance and shift records.</span>
            <button type="button" class="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50" :disabled="saving || !calculatedOvertimeMinutes" @click="submitRequest">
              {{ saving ? 'Submitting...' : 'Submit Request' }}
            </button>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-700 bg-slate-800/85 p-5 shadow-lg sm:p-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-lg font-semibold">{{ reviewerMode ? 'Overtime Requests for Review' : 'My Overtime Requests' }}</h2>
              <p class="mt-1 text-sm text-slate-400">{{ requests.length }} request(s) loaded.</p>
            </div>
            <select v-model="selectedStatus" class="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-white">
              <option value="">All statuses</option>
              <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
            </select>
          </div>

          <div v-if="loading" class="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-8 text-center text-sm text-slate-400">Loading overtime requests...</div>
          <div v-else-if="!filteredRequests.length" class="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center text-sm text-slate-400">No overtime requests found.</div>
          <div v-else class="mt-6 overflow-x-auto">
            <table class="w-full min-w-[1050px] border-collapse text-left text-sm">
              <thead><tr class="border-b border-slate-700 text-xs uppercase tracking-[0.16em] text-slate-400">
                <th class="px-3 py-3">Employee</th><th class="px-3 py-3">Date</th><th class="px-3 py-3">Shift evidence</th><th class="px-3 py-3">Attendance</th><th class="px-3 py-3">OT hours</th><th class="px-3 py-3">Reason</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Actions</th>
              </tr></thead>
              <tbody>
                <tr v-for="request in filteredRequests" :key="request.id" class="border-b border-slate-800 text-slate-200">
                  <td class="px-3 py-4"><strong class="text-white">{{ request.requesterName }}</strong><span class="mt-1 block text-xs text-slate-500">{{ request.branchName || 'No branch' }}</span></td>
                  <td class="px-3 py-4">{{ request.date }}</td>
                  <td class="px-3 py-4"><span class="block">{{ request.shiftLabel || '-' }}</span><span class="text-xs text-slate-400">End {{ request.scheduledEnd || '-' }} / Out {{ request.actualTimeOut || '-' }}</span></td>
                  <td class="px-3 py-4">{{ request.attendanceStatus || 'Recorded' }}</td>
                  <td class="px-3 py-4 font-semibold text-amber-300">{{ formatHours(request.calculatedOvertimeMinutes) }}</td>
                  <td class="max-w-xs px-3 py-4"><span :title="request.reason" class="block truncate">{{ request.reason }}</span></td>
                  <td class="px-3 py-4"><span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(request.status)">{{ request.status }}</span></td>
                  <td class="px-3 py-4"><div v-if="canReview(request)" class="flex flex-wrap gap-2"><button type="button" class="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400" @click="reviewRequest(request, 'Approved')">Approve</button><button type="button" class="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-400" @click="reviewRequest(request, 'Rejected')">Reject</button></div><span v-else class="text-xs text-slate-500">No action</span></td>
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
import { computed, onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { db } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { logActivity } from '@/utils/activityLogger'

const auth = getAuth()
const { hasPermission, isClinicAdminOwner } = usePermissions()
const statuses = ['Pending', 'Approved', 'Rejected']
const localDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const todayKey = localDateKey()
const loading = ref(true)
const saving = ref(false)
const requests = ref([])
const selectedStatus = ref('')
const currentUserId = ref('')
const currentUserName = ref('')
const currentBranchId = ref('')
const currentOwnerId = ref('')
const formError = ref('')
const attendanceEvidence = ref({})
const form = ref({ date: todayKey, reason: '' })

const reviewerMode = computed(() => Boolean(isClinicAdminOwner.value || hasPermission('overtime:review')))
const canSubmit = computed(() => hasPermission('overtime:create'))
const calculatedOvertimeMinutes = computed(() => {
  const scheduled = toMinutes(attendanceEvidence.value.shiftEnd)
  const actual = toMinutes(attendanceEvidence.value.timeOut)
  if (scheduled === null || actual === null || actual <= scheduled) return 0
  return actual - scheduled
})
const calculatedHours = computed(() => formatHours(calculatedOvertimeMinutes.value))
const filteredRequests = computed(() => requests.value.filter((request) => !selectedStatus.value || request.status === selectedStatus.value))

function toMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function formatHours(minutes) {
  const value = Number(minutes || 0) / 60
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function statusClass(status) {
  if (status === 'Approved') return 'bg-emerald-500/15 text-emerald-300'
  if (status === 'Rejected') return 'bg-rose-500/15 text-rose-300'
  return 'bg-amber-500/15 text-amber-300'
}

function canReview(request) {
  return reviewerMode.value && request.status === 'Pending' && request.requesterId !== currentUserId.value
}

function nameFromProfile(profile = {}) {
  return String(profile.fullName || '').trim() || `${String(profile.firstName || '').trim()} ${String(profile.lastName || '').trim()}`.trim() || profile.email || 'Employee'
}

async function resolveContext() {
  const user = auth.currentUser
  if (!user) return
  currentUserId.value = user.uid
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  const profile = snapshot.exists() ? snapshot.data() || {} : {}
  currentUserName.value = nameFromProfile(profile)
  currentBranchId.value = String(profile.branchId || '').trim()
  if (currentBranchId.value) {
    const branch = await getDoc(doc(db, 'clinics', currentBranchId.value))
    currentOwnerId.value = String(branch.data()?.ownerId || '').trim()
  }
  if (reviewerMode.value && !currentOwnerId.value) currentOwnerId.value = user.uid
}

async function loadOwnAttendance() {
  attendanceEvidence.value = {}
  if (!currentUserId.value || !form.value.date) return
  const direct = await getDoc(doc(db, 'attendance', `${currentUserId.value}_${form.value.date}`))
  if (direct.exists()) {
    attendanceEvidence.value = direct.data() || {}
    return
  }
  const snapshot = await getDocs(query(collection(db, 'attendance'), where('employeeId', '==', currentUserId.value)))
  attendanceEvidence.value = snapshot.docs.map((entry) => entry.data() || {}).find((entry) => entry.date === form.value.date) || {}
}

async function loadRequests() {
  if (!currentUserId.value) return
  const requestQuery = reviewerMode.value && currentOwnerId.value
    ? query(collection(db, 'overtimeRequests'), where('ownerId', '==', currentOwnerId.value))
    : query(collection(db, 'overtimeRequests'), where('requesterId', '==', currentUserId.value))
  const snapshot = await getDocs(requestQuery)
  requests.value = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

async function submitRequest() {
  formError.value = ''
  if (!form.value.date || form.value.date > todayKey) return (formError.value = 'Choose a completed date.')
  if (!calculatedOvertimeMinutes.value) return (formError.value = 'No overtime was calculated from the attendance record.')
  if (String(form.value.reason || '').trim().length < 10) return (formError.value = 'Provide a reason with at least 10 characters.')
  const requestId = `${currentUserId.value}_${form.value.date}`
  if (requests.value.some((request) => request.requestId === requestId && request.status === 'Pending')) return (formError.value = 'A pending request already exists for this date.')

  try {
    saving.value = true
    await setDoc(doc(db, 'overtimeRequests', requestId), {
      requestId,
      requesterId: currentUserId.value,
      requesterName: currentUserName.value,
      ownerId: currentOwnerId.value,
      branchId: currentBranchId.value,
      date: form.value.date,
      shiftLabel: attendanceEvidence.value.shiftLabel || '',
      scheduledStart: attendanceEvidence.value.shiftStart || '',
      scheduledEnd: attendanceEvidence.value.shiftEnd || '',
      actualTimeIn: attendanceEvidence.value.timeIn || '',
      actualTimeOut: attendanceEvidence.value.timeOut || '',
      attendanceStatus: attendanceEvidence.value.attendanceStatus || attendanceEvidence.value.status || 'Recorded',
      attendanceRecordId: `${currentUserId.value}_${form.value.date}`,
      calculatedOvertimeMinutes: calculatedOvertimeMinutes.value,
      reason: String(form.value.reason).trim(),
      status: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    form.value.reason = ''
    await loadRequests()
    toast.success('Overtime request submitted.')
  } catch (error) {
    console.error('Failed to submit overtime request:', error)
    formError.value = 'Unable to submit the overtime request.'
  } finally {
    saving.value = false
  }
}

async function reviewRequest(request, status) {
  let reviewRemarks = ''
  if (status === 'Rejected') {
    const result = await Swal.fire({ title: 'Reject Overtime Request', input: 'textarea', inputLabel: 'Reason for rejection', inputValidator: (value) => String(value || '').trim() ? undefined : 'A reason is required.', showCancelButton: true, confirmButtonText: 'Reject', cancelButtonText: 'Cancel' })
    if (!result.isConfirmed) return
    reviewRemarks = String(result.value || '').trim()
  } else {
    const result = await Swal.fire({ title: 'Approve Overtime Request', text: `Approve ${formatHours(request.calculatedOvertimeMinutes)} overtime hour(s) for ${request.requesterName}?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Approve', cancelButtonText: 'Cancel' })
    if (!result.isConfirmed) return
  }
  try {
    await updateDoc(doc(db, 'overtimeRequests', request.id), { status, reviewRemarks, reviewedBy: currentUserName.value, reviewedById: currentUserId.value, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() })
    await logActivity(db, { module: 'HR', action: `${status} overtime request`, details: `${currentUserName.value} marked ${request.requesterName}'s overtime request for ${request.date} as ${status}.` })
    await loadRequests()
    toast.success(`Overtime request ${status.toLowerCase()}.`)
  } catch (error) {
    console.error('Failed to review overtime request:', error)
    toast.error('Unable to update the overtime request.')
  }
}

onMounted(() => onAuthStateChanged(auth, async () => {
  try {
    loading.value = true
    await resolveContext()
    await Promise.all([loadOwnAttendance(), loadRequests()])
  } finally {
    loading.value = false
  }
}))
</script>

<style scoped>
@media (max-width: 640px) {
  table { font-size: 0.75rem; }
}
</style>
