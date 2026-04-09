<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8 text-white">
      <div class="mx-auto max-w-5xl">
        <div class="mb-8">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">HR and Payroll</p>
          <h1 class="mt-3 text-3xl font-bold text-white">{{ pageTitle }}</h1>
          <p class="mt-2 max-w-3xl text-sm text-slate-400">
            Submit a leave request using your assigned clinic context. Paid leave balance is tracked for the current year.
          </p>
        </div>

        <section class="rounded-3xl border border-slate-700 bg-slate-800/85 p-6 shadow-lg">
          <div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Leave Policy</p>
            <ul class="mt-3 space-y-2 text-slate-100">
              <li>- Service Incentive Leave (SIL): 5 days per year after 1 year of employment.</li>
              <li>- Maternity Leave: 105 days with full pay for live childbirth (regardless of civil status).</li>
              <li>- Paid leave requests are checked against your remaining balance before submission.</li>
            </ul>
          </div>

          <div class="grid gap-4 lg:grid-cols-3">
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Branch</p>
              <p class="mt-2 text-base font-semibold text-white">{{ branchName || 'No branch assigned' }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Role</p>
              <p class="mt-2 text-base font-semibold text-white">{{ currentRoleLabel || 'Staff' }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Paid Leave Remaining</p>
              <p class="mt-2 text-base font-semibold text-white">{{ paidLeaveRemaining }} day<span v-if="paidLeaveRemaining !== 1">s</span></p>
            </div>
          </div>

          <div v-if="loading" class="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
            Loading your leave form...
          </div>

          <form v-else class="mt-6 space-y-6" @submit.prevent="submitLeaveRequest">
            <div class="grid gap-6 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Leave Payment Type</label>
                <div class="grid gap-3 sm:grid-cols-2">
                  <label
                    v-for="option in PAYMENT_TYPES"
                    :key="option"
                    class="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition"
                    :class="form.paymentType === option ? 'border-amber-400 bg-amber-500/10 text-white' : 'border-slate-700 bg-slate-900/70 text-slate-300'"
                  >
                    <input v-model="form.paymentType" type="radio" :value="option" class="h-4 w-4 accent-amber-400" />
                    <span class="text-sm font-medium">{{ option }}</span>
                  </label>
                </div>
                <p v-if="fieldErrors.paymentType" class="mt-2 text-sm text-rose-300">{{ fieldErrors.paymentType }}</p>
              </div>

              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Leave Type</label>
                <select
                  v-model="form.leaveType"
                  required
                  class="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
                  :class="fieldErrors.leaveType ? 'border-rose-400 focus:border-rose-400' : ''"
                >
                  <option value="">Select leave type</option>
                  <option v-for="type in LEAVE_TYPES" :key="type" :value="type">{{ type }}</option>
                </select>
                <p v-if="fieldErrors.leaveType" class="mt-2 text-sm text-rose-300">{{ fieldErrors.leaveType }}</p>
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-3">
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Days Requested</label>
                <input :value="daysRequested" type="number" readonly class="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-white" />
              </div>
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Year</label>
                <input :value="requestYear" type="number" readonly class="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-white" />
              </div>
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Employment Type</label>
                <input :value="employmentType || 'Not set'" type="text" readonly class="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-white" />
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Start Date</label>
                <input
                  v-model="form.startDate"
                  type="date"
                  required
                  class="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
                  :class="fieldErrors.startDate ? 'border-rose-400 focus:border-rose-400' : ''"
                />
                <p v-if="fieldErrors.startDate" class="mt-2 text-sm text-rose-300">{{ fieldErrors.startDate }}</p>
              </div>
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">End Date</label>
                <input
                  v-model="form.endDate"
                  type="date"
                  required
                  class="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
                  :class="fieldErrors.endDate ? 'border-rose-400 focus:border-rose-400' : ''"
                />
                <p v-if="fieldErrors.endDate" class="mt-2 text-sm text-rose-300">{{ fieldErrors.endDate }}</p>
              </div>
            </div>

            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Reason for Leave</label>
              <textarea
                v-model="form.reason"
                rows="5"
                placeholder="Share the reason for this leave request"
                class="w-full rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
                :class="fieldErrors.reason ? 'border-rose-400 focus:border-rose-400' : ''"
              ></textarea>
              <div class="mt-2 flex items-center justify-between gap-3">
                <p v-if="fieldErrors.reason" class="text-sm text-rose-300">{{ fieldErrors.reason }}</p>
                <p class="text-xs text-slate-500">{{ reasonLength }}/200 characters</p>
              </div>
            </div>

            <div class="rounded-2xl border border-dashed border-slate-600 bg-slate-900/50 p-5">
              <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p class="text-sm font-semibold text-white">Attachment</p>
                  <p class="mt-1 text-sm text-slate-400">Optional. Upload supporting documents or proofs if needed.</p>
                </div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  @change="handleAttachment"
                  class="block text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-amber-400"
                />
              </div>
              <p class="mt-3 text-xs text-slate-500">Accepted: JPG, PNG, WEBP, PDF, DOC, DOCX. Max file size: 5 MB.</p>
              <p v-if="fieldErrors.attachment" class="mt-2 text-sm text-rose-300">{{ fieldErrors.attachment }}</p>
              <p class="mt-3 text-sm text-slate-300">{{ attachmentLabel }}</p>
            </div>

            <div v-if="paidLeaveWarning" class="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {{ paidLeaveWarning }}
            </div>

            <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" class="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700" @click="goToManagement">
                Cancel
              </button>
              <button type="submit" class="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving || !canSubmit">
                {{ saving ? 'Saving...' : submitLabel }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, addDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import Swal from 'sweetalert2'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db, storage } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { LEAVE_TYPES, PAID_LEAVE_ALLOWANCE, PAYMENT_TYPES, calculateLeaveDays, isPendingLeaveStatus } from '@/utils/leaveRequests'
import { logActivity } from '@/utils/activityLogger'

const route = useRoute()
const router = useRouter()
const { hasPermission, isClinicAdminOwner } = usePermissions()

const loading = ref(true)
const saving = ref(false)
const branchName = ref('')
const branchId = ref('')
const ownerId = ref('')
const currentRoleLabel = ref('')
const employmentType = ref('')
const currentUserName = ref('')
const editingRequestId = ref('')
const attachmentFile = ref(null)
const attachmentName = ref('')
const paidLeaveUsed = ref(0)
const fieldErrors = ref({
  paymentType: '',
  leaveType: '',
  startDate: '',
  endDate: '',
  reason: '',
  attachment: ''
})

const form = ref({
  paymentType: 'Paid Leave',
  leaveType: '',
  startDate: '',
  endDate: '',
  reason: ''
})

const requestYear = computed(() => {
  if (form.value.startDate) return Number(form.value.startDate.slice(0, 4))
  return new Date().getFullYear()
})

const daysRequested = computed(() => calculateLeaveDays(form.value.startDate, form.value.endDate))
const paidLeaveRemaining = computed(() => Math.max(0, PAID_LEAVE_ALLOWANCE - paidLeaveUsed.value))
const pageTitle = computed(() => (editingRequestId.value ? 'Update Leave Request' : 'Request Leave'))
const submitLabel = computed(() => (editingRequestId.value ? 'Update Request' : 'Submit Request'))
const attachmentLabel = computed(() => attachmentName.value || 'No file selected')
const reasonLength = computed(() => String(form.value.reason || '').trim().length)
const paidLeaveWarning = computed(() => {
  if (form.value.paymentType !== 'Paid Leave') return ''
  if (!daysRequested.value) return ''
  if (daysRequested.value > paidLeaveRemaining.value) {
    return `This request needs ${daysRequested.value} paid leave day(s), but only ${paidLeaveRemaining.value} day(s) are available for this year.`
  }
  return ''
})

const resetFieldErrors = () => {
  fieldErrors.value = {
    paymentType: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    attachment: ''
  }
}

const validateForm = () => {
  resetFieldErrors()

  let isValid = true
  const startDate = String(form.value.startDate || '').trim()
  const endDate = String(form.value.endDate || '').trim()
  const reason = String(form.value.reason || '').trim()

  if (!String(form.value.paymentType || '').trim()) {
    fieldErrors.value.paymentType = 'Please choose a leave payment type.'
    isValid = false
  }

  if (!String(form.value.leaveType || '').trim()) {
    fieldErrors.value.leaveType = 'Please select a leave type.'
    isValid = false
  }

  if (!startDate) {
    fieldErrors.value.startDate = 'Start date is required.'
    isValid = false
  }

  if (!endDate) {
    fieldErrors.value.endDate = 'End date is required.'
    isValid = false
  }

  if (startDate && endDate && daysRequested.value <= 0) {
    fieldErrors.value.endDate = 'End date must be on or after the start date.'
    isValid = false
  }

  if (!reason) {
    fieldErrors.value.reason = 'Please provide a reason for the leave request.'
    isValid = false
  } else if (reason.length < 10) {
    fieldErrors.value.reason = 'Please enter at least 10 characters.'
    isValid = false
  } else if (reason.length > 200) {
    fieldErrors.value.reason = 'Reason must be 200 characters or less.'
    isValid = false
  }

  if (attachmentFile.value) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const maxSizeBytes = 5 * 1024 * 1024
    if (!allowedTypes.includes(attachmentFile.value.type)) {
      fieldErrors.value.attachment = 'Unsupported attachment type.'
      isValid = false
    } else if (attachmentFile.value.size > maxSizeBytes) {
      fieldErrors.value.attachment = 'Attachment must be 5 MB or smaller.'
      isValid = false
    }
  }

  return isValid
}

const canSubmit = computed(() => {
  return (
    Boolean(branchId.value) &&
    Boolean(form.value.leaveType) &&
    Boolean(form.value.startDate) &&
    Boolean(form.value.endDate) &&
    Boolean(String(form.value.reason || '').trim()) &&
    daysRequested.value > 0 &&
    !paidLeaveWarning.value
  )
})

const resolveCurrentContext = async () => {
  const user = auth.currentUser
  if (!user) {
    loading.value = false
    return
  }

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
  currentRoleLabel.value = String(profile.customRoleName || profile.role || 'Staff').trim()
  employmentType.value = String(profile.employmentType || '').trim()
  branchId.value = String(profile.branchId || '').trim()

  if (branchId.value) {
    const clinicSnap = await getDoc(doc(db, 'clinics', branchId.value))
    if (clinicSnap.exists()) {
      const clinic = clinicSnap.data() || {}
      branchName.value = `${clinic.clinicBranch || clinic.clinicName || 'Assigned Branch'}${clinic.clinicLocation ? ` - ${clinic.clinicLocation}` : ''}`
      ownerId.value = String(clinic.ownerId || '').trim()
    }
  }

  if (!branchName.value) {
    branchName.value = 'No branch assigned'
  }
}

const loadPaidLeaveUsage = async () => {
  const user = auth.currentUser
  if (!user) return

  const requestsSnap = await getDocs(query(collection(db, 'leaveRequests'), where('requesterId', '==', user.uid)))
  const targetYear = requestYear.value
  const usage = requestsSnap.docs.reduce((total, requestDoc) => {
    const data = requestDoc.data() || {}
    const year = Number(data.year || 0)
    const isPaid = String(data.paymentType || '').trim() === 'Paid Leave'
    const isApproved = String(data.status || '').trim() === 'Approved'
    if (!isPaid || !isApproved || year !== targetYear) return total
    return total + Number(data.daysRequested || 0)
  }, 0)
  paidLeaveUsed.value = usage
}

const loadExistingRequest = async () => {
  const requestId = String(route.query.id || '').trim()
  if (!requestId) return

  const user = auth.currentUser
  if (!user) return

  const requestSnap = await getDoc(doc(db, 'leaveRequests', requestId))
  if (!requestSnap.exists()) {
    toast.error('Leave request not found.')
    return
  }

  const record = requestSnap.data() || {}
  const belongsToUser = String(record.requesterId || '').trim() === user.uid
  if (!belongsToUser || !isPendingLeaveStatus(record.status)) {
    toast.error('Only your pending leave requests can be updated.')
    return
  }

  editingRequestId.value = requestId
  form.value = {
    paymentType: String(record.paymentType || 'Paid Leave').trim(),
    leaveType: String(record.leaveType || '').trim(),
    startDate: String(record.startDate || '').trim(),
    endDate: String(record.endDate || '').trim(),
    reason: String(record.reason || '').trim()
  }
  attachmentName.value = String(record.attachmentFileName || '').trim()
}

const handleAttachment = (event) => {
  const file = event?.target?.files?.[0] || null
  attachmentFile.value = file
  attachmentName.value = file?.name || attachmentName.value || ''
  if (!file) {
    fieldErrors.value.attachment = ''
    return
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  const maxSizeBytes = 5 * 1024 * 1024
  if (!allowedTypes.includes(file.type)) {
    fieldErrors.value.attachment = 'Unsupported attachment type.'
  } else if (file.size > maxSizeBytes) {
    fieldErrors.value.attachment = 'Attachment must be 5 MB or smaller.'
  } else {
    fieldErrors.value.attachment = ''
  }
}

const uploadAttachment = async () => {
  if (!attachmentFile.value || !auth.currentUser?.uid) return {}
  const extension = (attachmentFile.value.name || '').split('.').pop() || 'bin'
  const filePath = `leave-requests/${auth.currentUser.uid}/${Date.now()}.${extension}`
  const fileRef = storageRef(storage, filePath)
  await uploadBytes(fileRef, attachmentFile.value)
  const fileUrl = await getDownloadURL(fileRef)
  return {
    attachmentUrl: fileUrl,
    attachmentFileName: attachmentFile.value.name || '',
    attachmentMimeType: attachmentFile.value.type || ''
  }
}

const goToManagement = () => {
  if (isClinicAdminOwner.value || hasPermission('leave:review')) {
    router.push('/hr/leave-management')
    return
  }
  router.push('/employee/dashboard')
}

const submitLeaveRequest = async () => {
  if (!auth.currentUser?.uid) {
    toast.error('Please sign in to submit a leave request.')
    return
  }

  if (!validateForm() || !canSubmit.value) {
    toast.error('Please complete the leave form before submitting.')
    return
  }

  const prompt = await Swal.fire({
    title: editingRequestId.value ? 'Update Leave Request' : 'Submit Leave Request',
    text: editingRequestId.value
      ? 'Save the changes to this leave request?'
      : 'Submit this leave request for review?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: editingRequestId.value ? 'Update request' : 'Submit request',
    cancelButtonText: 'Cancel'
  })

  if (!prompt.isConfirmed) return

  try {
    saving.value = true
    const attachmentMeta = await uploadAttachment()
    const payload = {
      requesterId: auth.currentUser.uid,
      requesterName: currentUserName.value,
      requesterRole: currentRoleLabel.value || 'Staff',
      employmentType: employmentType.value || '',
      ownerId: ownerId.value || '',
      branchId: branchId.value || '',
      branchName: branchName.value || '',
      paymentType: form.value.paymentType,
      leaveType: form.value.leaveType,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      daysRequested: daysRequested.value,
      year: requestYear.value,
      reason: String(form.value.reason || '').trim(),
      updatedAt: serverTimestamp(),
      ...attachmentMeta
    }

    if (editingRequestId.value) {
      await updateDoc(doc(db, 'leaveRequests', editingRequestId.value), payload)
    } else {
      await addDoc(collection(db, 'leaveRequests'), {
        ...payload,
        status: 'Pending',
        reviewedBy: '',
        reviewedAt: null,
        reviewRemarks: '',
        createdAt: serverTimestamp()
      })
    }

    await logActivity(db, {
      module: 'HR',
      action: editingRequestId.value ? 'Updated leave request' : 'Requested leave',
      details: `${currentUserName.value} ${editingRequestId.value ? 'updated' : 'submitted'} a ${form.value.leaveType} request from ${form.value.startDate} to ${form.value.endDate}.`
    })

    toast.success(editingRequestId.value ? 'Leave request updated successfully.' : 'Leave request submitted successfully.')
    goToManagement()
  } catch (error) {
    console.error(error)
    toast.error('Failed to save leave request.')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await resolveCurrentContext()
  await loadExistingRequest()
  await loadPaidLeaveUsage()
  loading.value = false
})

watch(requestYear, async () => {
  if (loading.value) return
  await loadPaidLeaveUsage()
})
</script>
