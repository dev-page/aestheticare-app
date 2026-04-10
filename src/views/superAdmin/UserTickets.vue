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
          <p class="text-slate-400 text-xs uppercase tracking-wide">Handling Note</p>
          <p class="mt-2 text-sm text-slate-200">Use the status selector above to manage this support ticket.</p>
        </div>
        <p v-if="statusMessage" class="text-xs text-emerald-300">{{ statusMessage }}</p>
        <p v-if="statusError" class="text-xs text-rose-300">{{ statusError }}</p>
      </div>
    </template>
  </Modal>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
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
      if (normalized === 'under review') return 'bg-violet-500/20 text-violet-300'
      if (normalized === 'in progress') return 'bg-amber-500/20 text-amber-300'
      return 'bg-slate-500/20 text-slate-300'
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
      openIssue,
      closeIssue,
      saveStatus
    }
  }
}
</script>
