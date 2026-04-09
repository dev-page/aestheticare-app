<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <h1 class="text-3xl font-bold text-white mb-2">User Issues</h1>
      <p class="text-slate-400 mb-6">Reported issues submitted by platform users.</p>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Reporter</th>
              <th class="text-left text-slate-300 px-4 py-3">Date</th>
              <th class="text-left text-slate-300 px-4 py-3">Topic</th>
              <th class="text-left text-slate-300 px-4 py-3">Urgency</th>
              <th class="text-left text-slate-300 px-4 py-3">Status</th>
              <th class="text-right text-slate-300 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-200" colspan="6">Loading reported issues...</td>
            </tr>
            <tr v-else-if="!issues.length">
              <td class="px-4 py-3 text-slate-200" colspan="6">No reported issues yet.</td>
            </tr>
            <tr
              v-else
              v-for="issue in issues"
              :key="issue.id"
              class="border-b border-slate-700/60 last:border-b-0"
            >
              <td class="px-4 py-3 text-slate-200">
                <div class="font-medium">{{ issue.userName || issue.userEmail || 'Unknown' }}</div>
                <div class="text-xs text-slate-400">{{ issue.role || issue.userType || '' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-300">{{ issue.createdLabel }}</td>
              <td class="px-4 py-3 text-slate-200">{{ issue.subject || '-' }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-md text-xs font-medium" :class="issue.urgencyClass">
                  {{ issue.severity || 'Medium' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-md text-xs font-medium" :class="issue.statusClass">
                  {{ issue.statusLabel }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
                  @click="openIssue(issue)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>

  <Modal
    :isOpen="showModal"
    panelClass="bg-slate-800 text-white w-full max-w-2xl"
    @close="closeIssue"
  >
    <template #header>
      <h2 class="text-xl font-semibold">Reported Issue</h2>
    </template>

    <template #body>
      <div v-if="selectedIssue" class="space-y-4 text-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Reporter</p>
            <p class="text-white mt-1">{{ selectedIssue.userName || selectedIssue.userEmail || 'Unknown' }}</p>
          </div>
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Date</p>
            <p class="text-white mt-1">{{ selectedIssue.createdLabel }}</p>
          </div>
        </div>

        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Topic</p>
          <p class="text-white mt-1">{{ selectedIssue.subject || '-' }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Category</p>
            <p class="text-white mt-1">{{ selectedIssue.category || '-' }}</p>
          </div>
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Urgency</p>
            <p class="text-white mt-1">{{ selectedIssue.severity || 'Medium' }}</p>
          </div>
        </div>

        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Location</p>
          <p class="text-white mt-1">{{ selectedIssue.location || '-' }}</p>
        </div>

        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Description</p>
          <p class="text-white mt-1 whitespace-pre-line">{{ selectedIssue.description || '-' }}</p>
        </div>

        <div v-if="selectedIssue.steps">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Steps to Reproduce</p>
          <p class="text-white mt-1 whitespace-pre-line">{{ selectedIssue.steps }}</p>
        </div>

        <div v-if="selectedIssue.proofUrl" class="space-y-2">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Proof</p>
          <a
            :href="selectedIssue.proofUrl"
            target="_blank"
            rel="noopener"
            class="text-amber-300 hover:text-amber-200 text-sm"
          >
            View attachment
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-xs uppercase tracking-wide mb-2">Status</label>
            <select
              v-model="statusDraft"
              class="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Under Review">Under Review</option>
              <option value="Resolved">Resolved</option>
              <option value="Dismissed">Dismissed</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
          <div class="flex items-end">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-60"
              :disabled="savingStatus"
              @click="saveStatus"
            >
              {{ savingStatus ? 'Saving...' : 'Update Status' }}
            </button>
          </div>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Recommended Handling</p>
          <p class="mt-2 text-sm text-slate-200">{{ moderationGuidance }}</p>
        </div>
        <div v-if="selectedIssue?.centerId" class="space-y-3">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Moderation Actions</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              :disabled="savingStatus"
              @click="warnClinicAdmin"
            >
              Warn Clinic Admin
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-60"
              :disabled="savingStatus"
              @click="markUnderReview"
            >
              Mark Under Review
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
              :disabled="savingStatus"
              @click="suspendCenter"
            >
              Suspend Center
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60"
              :disabled="savingStatus"
              @click="restoreCenter"
            >
              Restore Center
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              :disabled="savingStatus"
              @click="dismissIssue"
            >
              Dismiss Report
            </button>
          </div>
        </div>
        <p v-if="statusMessage" class="text-xs text-emerald-300">{{ statusMessage }}</p>
        <p v-if="statusError" class="text-xs text-rose-300">{{ statusError }}</p>
      </div>
    </template>
  </Modal>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { addDoc, collection, deleteField, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import Modal from '@/components/common/Modal.vue'

export default {
  name: 'SuperAdminUserTickets',
  components: { SuperAdminSidebar, Modal },
  setup() {
    const REPORT_WINDOW_DAYS = 90
    const issues = ref([])
    const loading = ref(true)
    const error = ref('')
    let unsubscribe = null
    const showModal = ref(false)
    const selectedIssue = ref(null)
    const statusDraft = ref('Open')
    const savingStatus = ref(false)
    const statusMessage = ref('')
    const statusError = ref('')
    const moderationGuidance = computed(() => {
      const severity = String(selectedIssue.value?.severity || '').toLowerCase()
      if (severity === 'critical') return 'Critical reports should be reviewed immediately. Suspend the center if the issue looks credible, then notify the clinic admin.'
      if (severity === 'high') return 'High-severity reports should usually be marked under review and may need a warning or temporary suspension while evidence is checked.'
      if (severity === 'low') return 'Low-severity reports can usually be reviewed, clarified, and dismissed or resolved after checking the details.'
      return 'Medium-severity reports should be reviewed, acknowledged, and escalated to the clinic admin when needed.'
    })

    const formatDate = (value) => {
      if (!value) return '-'
      const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
      if (Number.isNaN(date.getTime())) return '-'
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(date)
    }

    const urgencyClass = (severity) => {
      const normalized = String(severity || '').toLowerCase()
      if (normalized === 'critical') return 'bg-rose-500/20 text-rose-300'
      if (normalized === 'high') return 'bg-amber-500/20 text-amber-300'
      if (normalized === 'low') return 'bg-emerald-500/20 text-emerald-300'
      return 'bg-slate-500/20 text-slate-300'
    }

    const statusLabel = (status) => {
      const normalized = String(status || '').trim()
      return normalized || 'Open'
    }

    const statusClass = (status) => {
      const normalized = String(status || '').toLowerCase()
      if (normalized === 'resolved') return 'bg-emerald-500/20 text-emerald-300'
      if (normalized === 'dismissed') return 'bg-slate-500/20 text-slate-300'
      if (normalized === 'suspended') return 'bg-rose-500/20 text-rose-300'
      if (normalized === 'under review') return 'bg-violet-500/20 text-violet-300'
      if (normalized === 'in progress') return 'bg-amber-500/20 text-amber-300'
      return 'bg-slate-500/20 text-slate-300'
    }

    const notifyClinicAdmins = async (issue, title, message) => {
      if (!issue?.centerId) return
      const recipients = new Set()
      const clinicSnap = await getDoc(doc(db, 'clinics', issue.centerId))
      if (clinicSnap.exists()) {
        const clinicData = clinicSnap.data() || {}
        const ownerId = String(clinicData.ownerId || '').trim()
        if (ownerId) {
          recipients.add(ownerId)
        }
      }
      const snapshot = await getDocs(query(collection(db, 'users'), where('branchId', '==', issue.centerId)))
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() || {}
        const normalizedRole = String(data.role || '').trim().toLowerCase()
        if (['owner', 'clinic admin', 'clinicadmin', 'clinicadministrator'].includes(normalizedRole)) {
          recipients.add(docSnap.id)
        }
      })

      await Promise.all(
        Array.from(recipients)
          .filter((recipientUserId) => recipientUserId && recipientUserId !== (auth.currentUser?.uid || ''))
          .map((recipientUserId) =>
          addDoc(collection(db, 'notifications'), {
            recipientUserId,
            senderId: auth.currentUser?.uid || 'superadmin',
            type: 'support_issue_moderation',
            title,
            message,
            link: '/notifications',
            read: false,
            createdAt: serverTimestamp()
          })
        )
      )
    }

    const toJsDate = (value) => {
      if (!value) return null
      if (typeof value?.toDate === 'function') return value.toDate()
      if (value instanceof Date) return value
      if (typeof value === 'number') return new Date(value)
      if (typeof value === 'string') {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? null : parsed
      }
      return null
    }

    const syncCenterReportCounts = async (centerId) => {
      if (!centerId) return
      const reportsSnap = await getDocs(query(collection(db, 'supportTickets'), where('centerId', '==', centerId)))
      const reports = reportsSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      const windowStart = Date.now() - (REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      const validReports = reports.filter((report) => {
        const createdAt = toJsDate(report.createdAt)
        if (!createdAt) return false
        if (createdAt.getTime() < windowStart) return false
        if (String(report.reportTargetType || '').trim().toLowerCase() !== 'clinic_center') return false
        return String(report.status || '').trim().toLowerCase() !== 'dismissed'
      })

      await updateDoc(doc(db, 'clinics', centerId), {
        reportCount: reports.length,
        validReportCount: validReports.length,
        updatedAt: serverTimestamp()
      })
    }

    const refreshIssueInList = (issueId, updates) => {
      issues.value = issues.value.map((issue) => {
        if (issue.id !== issueId) return issue
        const nextStatus = updates.status ?? issue.status
        return {
          ...issue,
          ...updates,
          status: nextStatus,
          statusLabel: statusLabel(nextStatus),
          statusClass: statusClass(nextStatus)
        }
      })
    }

    const refreshSelectedIssue = (updates) => {
      if (!selectedIssue.value) return
      selectedIssue.value = {
        ...selectedIssue.value,
        ...updates,
        statusLabel: statusLabel(updates.status ?? selectedIssue.value.status),
        statusClass: statusClass(updates.status ?? selectedIssue.value.status)
      }
    }

    const loadIssues = () => {
      loading.value = true
      error.value = ''
      unsubscribe = onSnapshot(
        query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          issues.value = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() || {}
            return {
              id: docSnap.id,
              ...data,
              createdLabel: formatDate(data.createdAt),
              urgencyClass: urgencyClass(data.severity),
              statusLabel: statusLabel(data.status),
              statusClass: statusClass(data.status)
            }
          })
          loading.value = false
        },
        (err) => {
          console.error('Error loading support tickets:', err)
          error.value = 'Unable to load reported issues.'
          loading.value = false
        }
      )
    }

    const openIssue = (issue) => {
      selectedIssue.value = issue
      statusDraft.value = statusLabel(issue.status)
      statusMessage.value = ''
      statusError.value = ''
      showModal.value = true
    }

    const closeIssue = () => {
      showModal.value = false
      selectedIssue.value = null
      statusMessage.value = ''
      statusError.value = ''
    }

    const saveStatus = async () => {
      if (!selectedIssue.value) return
      savingStatus.value = true
      statusMessage.value = ''
      statusError.value = ''
      try {
        await updateDoc(doc(db, 'supportTickets', selectedIssue.value.id), {
          status: statusDraft.value,
          updatedAt: serverTimestamp()
        })
        if (selectedIssue.value.userId) {
          await addDoc(collection(db, 'notifications'), {
            recipientUserId: selectedIssue.value.userId,
            senderId: auth.currentUser?.uid || 'superadmin',
            type: 'support_issue_status',
            title: 'Issue Status Updated',
            message: `Your reported issue is now marked as ${statusDraft.value}.`,
            link: '/notifications',
            read: false,
            createdAt: serverTimestamp()
          })
        }
        refreshIssueInList(selectedIssue.value.id, { status: statusDraft.value })
        refreshSelectedIssue({ status: statusDraft.value })
        statusMessage.value = 'Status updated.'
      } catch (err) {
        console.error('Failed to update issue status:', err)
        statusError.value = 'Failed to update status.'
      } finally {
        savingStatus.value = false
      }
    }

    const applyModeration = async ({ status, clinicTitle, clinicMessage, customerMessage, centerStatus, centerModerationStatus, centerPublishedState, clearSuspensionFields, successMessage }) => {
      if (!selectedIssue.value) return
      savingStatus.value = true
      statusMessage.value = ''
      statusError.value = ''

      try {
        await updateDoc(doc(db, 'supportTickets', selectedIssue.value.id), {
          status,
          moderationAction: status,
          updatedAt: serverTimestamp()
        })

        if (selectedIssue.value.centerId && centerStatus) {
          const clinicUpdates = {
            status: centerStatus,
            moderationStatus: centerModerationStatus || status,
            updatedAt: serverTimestamp()
          }
          if (typeof centerPublishedState === 'boolean') {
            clinicUpdates.isPublished = centerPublishedState
          }
          if (clearSuspensionFields) {
            clinicUpdates.suspendedAt = deleteField()
            clinicUpdates.suspensionEndsAt = deleteField()
            clinicUpdates.suspensionReason = deleteField()
            clinicUpdates.suspensionSource = deleteField()
          }
          await updateDoc(doc(db, 'clinics', selectedIssue.value.centerId), clinicUpdates)
        }

        if (clinicTitle && clinicMessage) {
          await notifyClinicAdmins(selectedIssue.value, clinicTitle, clinicMessage)
        }

        if (selectedIssue.value.userId && customerMessage) {
          await addDoc(collection(db, 'notifications'), {
            recipientUserId: selectedIssue.value.userId,
            senderId: auth.currentUser?.uid || 'superadmin',
            type: 'support_issue_status',
            title: 'Report Update',
            message: customerMessage,
            link: '/notifications',
            read: false,
            createdAt: serverTimestamp()
          })
        }

        statusDraft.value = status
        if (selectedIssue.value.centerId) {
          await syncCenterReportCounts(selectedIssue.value.centerId)
        }
        refreshIssueInList(selectedIssue.value.id, {
          status,
          moderationAction: status,
          centerStatus: centerStatus || selectedIssue.value.centerStatus || '',
          centerModerationStatus: centerModerationStatus || status
        })
        refreshSelectedIssue({ status })
        statusMessage.value = successMessage
      } catch (err) {
        console.error('Failed to apply moderation:', err)
        statusError.value = 'Failed to apply moderation action.'
      } finally {
        savingStatus.value = false
      }
    }

    const warnClinicAdmin = async () => applyModeration({
      status: 'In Progress',
      clinicTitle: 'Center Report Warning',
      clinicMessage: `${selectedIssue.value?.centerName || 'Your center'} has an active customer report. Please review and respond as needed.`,
      customerMessage: 'Your report has been escalated to the clinic admin for follow-up.',
      successMessage: 'Clinic admin notified and ticket marked in progress.'
    })

    const markUnderReview = async () => applyModeration({
      status: 'Under Review',
      clinicTitle: 'Center Under Review',
      clinicMessage: `${selectedIssue.value?.centerName || 'Your center'} is now under super admin review because of a customer report.`,
      customerMessage: 'Your report is now under review by the platform team.',
      centerModerationStatus: 'Under Review',
      successMessage: 'Ticket marked under review.'
    })

    const suspendCenter = async () => applyModeration({
      status: 'Suspended',
      clinicTitle: 'Center Suspended',
      clinicMessage: `${selectedIssue.value?.centerName || 'Your center'} has been temporarily suspended while the reported issue is being handled.`,
      customerMessage: 'The reported center has been temporarily suspended while the issue is being reviewed.',
      centerStatus: 'Suspended',
      centerModerationStatus: 'Suspended',
      centerPublishedState: false,
      successMessage: 'Center suspended successfully.'
    })

    const restoreCenter = async () => applyModeration({
      status: 'Resolved',
      clinicTitle: 'Center Restored',
      clinicMessage: `${selectedIssue.value?.centerName || 'Your center'} has been restored after review.`,
      customerMessage: 'The reported center has been restored and the issue was marked resolved.',
      centerStatus: 'Active',
      centerModerationStatus: 'Resolved',
      centerPublishedState: true,
      clearSuspensionFields: true,
      successMessage: 'Center restored and ticket resolved.'
    })

    const dismissIssue = async () => applyModeration({
      status: 'Dismissed',
      clinicTitle: 'Report Dismissed',
      clinicMessage: `The report filed for ${selectedIssue.value?.centerName || 'your center'} was dismissed after review.`,
      customerMessage: 'Your report was reviewed and dismissed after verification.',
      successMessage: 'Report dismissed.'
    })

    onMounted(loadIssues)
    onUnmounted(() => {
      if (unsubscribe) unsubscribe()
    })

    return {
      issues,
      loading,
      error,
      showModal,
      selectedIssue,
      statusDraft,
      savingStatus,
      statusMessage,
      statusError,
      moderationGuidance,
      openIssue,
      closeIssue,
      saveStatus,
      warnClinicAdmin,
      markUnderReview,
      suspendCenter,
      restoreCenter,
      dismissIssue
    }
  }
}
</script>
