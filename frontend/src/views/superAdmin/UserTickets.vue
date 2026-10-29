<template>
  <div class="flex module-theme reports-page min-h-screen">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 8, rows: 5 }" class="reports-main flex-1 p-8">
      <header class="reports-heading">
        <p class="reports-eyebrow">PLATFORM SUPPORT</p>
        <h1>User Reports</h1>
        <p>Review, investigate, and resolve platform issues and complaints.</p>
      </header>
      <div class="reports-summary">
        <article><span>Total reports</span><strong>{{ issues.length }}</strong></article>
        <article><span>Needs attention</span><strong>{{ issues.filter(issue => !['Resolved', 'Dismissed'].includes(issue.statusLabel)).length }}</strong></article>
        <article><span>Resolved</span><strong>{{ issues.filter(issue => issue.statusLabel === 'Resolved').length }}</strong></article>
      </div>

      <div class="reports-filters">
        <label for="report-search">Search reports<input id="report-search" v-model.trim="search" type="search" placeholder="Search reporter, topic, or clinic..." /></label>
        <ContractAppearanceSelect id="report-status-filter" v-model="statusFilter" label="Status" :options="[{ value: '', label: 'All statuses' }, ...reportStatuses.map(value => ({ value, label: value }))]" />
        <ContractAppearanceSelect id="report-category-filter" v-model="categoryFilter" label="Category" :options="[{ value: '', label: 'All categories' }, ...reportCategories.map(value => ({ value, label: value }))]" />
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="reports-table-wrap" aria-label="User reports">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Reporter</th>
              <th class="text-left text-slate-300 px-4 py-3">Date</th>
              <th class="text-left text-slate-300 px-4 py-3">Topic</th>
              <th class="text-left text-slate-300 px-4 py-3">Clinic</th>
              <th class="text-left text-slate-300 px-4 py-3">Urgency</th>
              <th class="text-left text-slate-300 px-4 py-3">Status</th>
              <th class="text-right text-slate-300 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-200" colspan="7">Loading reported issues...</td>
            </tr>
            <tr v-else-if="!filteredIssues.length">
              <td class="px-4 py-3 text-slate-200" colspan="7">No matching reports.</td>
            </tr>
            <tr
              v-else
              v-for="issue in paginatedIssues"
              :key="issue.id"
              class="border-b border-slate-700/60 last:border-b-0"
            >
              <td class="px-4 py-3 text-slate-200">
                <div class="font-medium">{{ issue.userName || issue.userEmail || 'Unknown' }}</div>
                <div class="text-xs text-slate-400">{{ issue.role || issue.userType || '' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-300">{{ issue.createdLabel }}</td>
              <td class="px-4 py-3 text-slate-200">{{ issue.subject || '-' }}</td>
              <td class="px-4 py-3 text-slate-300">{{ issue.clinicName || issue.branchId || '-' }}</td>
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
                  class="report-secondary"
                  :aria-label="`View report: ${issue.subject || 'Untitled report'}`"
                  @click="openIssue(issue)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <TablePagination v-model:page="currentPage" v-model:page-size="pageSize" :total-items="filteredIssues.length" />
    </main>
  </div>

  <Modal
    :isOpen="showModal"
    panelClass="report-modal"
    :panel-style="{ background: '#fffdf9', color: '#3d281d', maxWidth: '880px' }"
    bodyClass="report-modal-body"
    :close-on-backdrop="!savingStatus"
    @close="closeIssue"
  >
    <template #header>
      <div><p class="reports-eyebrow">USER REPORT</p><h2 class="report-modal-title">Reported Issue</h2></div>
    </template>

    <template #body>
      <div v-if="selectedIssue" class="report-details space-y-4 text-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Reporter</p>
            <p class="text-white mt-1">{{ selectedIssue.userName || selectedIssue.userEmail || 'Unknown' }}</p>
            <a v-if="selectedIssue.source === 'landing-contact' && selectedIssue.userEmail" :href="`mailto:${selectedIssue.userEmail}`" class="mt-1 inline-block text-amber-300 hover:underline">{{ selectedIssue.userEmail }}</a>
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
          <p class="text-slate-400 text-xs uppercase tracking-wide">Clinic</p>
          <p class="text-white mt-1">{{ selectedIssue.clinicName || selectedIssue.branchId || 'Not linked' }}</p>
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

          <ContractAppearanceSelect id="report-edit-status" v-model="statusDraft" label="Status" :disabled="savingStatus" :options="reportStatuses.map(value => ({ value, label: value }))" />

          <label class="block">
            <span class="text-slate-400 text-xs uppercase tracking-wide">Internal Investigation Note</span>
            <textarea v-model.trim="internalNote" rows="3" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none" placeholder="Record what was checked or found. This is visible to administrators only."></textarea>
          </label>

          <label v-if="['Resolved', 'Dismissed'].includes(statusDraft)" class="block">
            <span class="text-slate-400 text-xs uppercase tracking-wide">Resolution / dismissal note <span v-if="['Resolved', 'Dismissed'].includes(statusDraft)" class="text-amber-300">(required)</span></span>
            <textarea v-model.trim="resolutionNote" rows="3" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none" placeholder="Explain how the report was resolved or why it was dismissed."></textarea>
          </label>

          <label class="block">
            <span class="text-slate-400 text-xs uppercase tracking-wide">Response to Reporter</span>
            <textarea v-model.trim="reporterResponse" rows="3" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none" placeholder="Explain what the reporter should know about this update."></textarea>
          </label>

          <div v-if="selectedIssue.statusHistory?.length" class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Status History</p>
            <div class="mt-3 space-y-2">
              <div v-for="(entry, index) in selectedIssue.statusHistory" :key="`${entry.status}-${index}`" class="flex items-center justify-between gap-3 text-xs">
                <span class="text-slate-200">{{ entry.status }} <span class="text-slate-500">by {{ entry.byName || 'Admin' }}</span></span>
                <span class="text-slate-500">{{ formatDate(entry.at) }}</span>
              </div>
            </div>
          </div>
        <div class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Handling Note</p>
          <p class="mt-2 text-sm text-slate-200">Choose a status and save. Add a resolution or dismissal note before closing a report.</p>
        </div>
        <p v-if="statusMessage" class="report-success" role="status">{{ statusMessage }}</p>
        <p v-if="statusError" class="report-error" role="alert">{{ statusError }}</p>
      </div>
    </template>
    <template #footer>
      <div class="report-modal-actions"><span class="report-help">Changes are saved to this report.</span><button type="button" class="report-primary" :disabled="savingStatus" @click="saveStatus">{{ savingStatus ? 'Saving...' : 'Save Report' }}</button></div>
    </template>
  </Modal>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { addDoc, arrayUnion, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'

export default {
  name: 'SuperAdminUserTickets',
  components: { SuperAdminSidebar, Modal, TablePagination, ContractAppearanceSelect },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

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
    const search = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const statusFilter = ref('')
    const categoryFilter = ref('')
    const internalNote = ref('')
    const resolutionNote = ref('')
    const reporterResponse = ref('')
    const reportStatuses = ['Open', 'Under Review', 'In Progress', 'Awaiting User Response', 'Resolved', 'Dismissed', 'Escalated']
    const reportCategories = ['Bug/Error', 'Data Issue', 'Performance', 'Billing/Payments', 'Clinic Complaint', 'Service Complaint', 'Employee Complaint', 'Feature Request', 'Other']

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
      if (normalized === 'critical') return 'report-badge report-badge-danger'
      if (normalized === 'high') return 'report-badge report-badge-warning'
      if (normalized === 'low') return 'report-badge report-badge-success'
      return 'report-badge report-badge-neutral'
    }

    const statusLabel = (status) => {
      const normalized = String(status || '').trim()
      return normalized || 'Open'
    }

    const statusClass = (status) => {
      const normalized = String(status || '').toLowerCase()
      if (normalized === 'resolved') return 'report-badge report-badge-success'
      if (normalized === 'dismissed') return 'report-badge report-badge-neutral'
      if (normalized === 'under review') return 'report-badge report-badge-review'
      if (normalized === 'in progress') return 'report-badge report-badge-warning'
      if (normalized === 'awaiting user response') return 'report-badge report-badge-info'
      if (normalized === 'escalated') return 'report-badge report-badge-danger'
      return 'report-badge report-badge-neutral'
    }

    const filteredIssues = computed(() => {
      const keyword = search.value.toLowerCase()
      return issues.value.filter((issue) => {
        const matchesSearch = !keyword || [issue.userName, issue.userEmail, issue.subject, issue.clinicName, issue.branchId].join(' ').toLowerCase().includes(keyword)
        const matchesStatus = !statusFilter.value || statusLabel(issue.status) === statusFilter.value
        const matchesCategory = !categoryFilter.value || issue.category === categoryFilter.value
        return matchesSearch && matchesStatus && matchesCategory
      })
    })
    const paginatedIssues = computed(() => filteredIssues.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))
    const totalPages = computed(() => Math.max(1, Math.ceil(filteredIssues.value.length / pageSize.value)))
    watch([search, statusFilter, categoryFilter, pageSize], () => { currentPage.value = 1 })
    watch(totalPages, (count) => { if (currentPage.value > count) currentPage.value = count })

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
      unsubscribe = pageListener(
        onSnapshot, query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')),
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
      internalNote.value = issue.internalNote || ''
      resolutionNote.value = issue.resolutionNote || ''
      reporterResponse.value = issue.reporterResponse || ''
      statusMessage.value = ''
      statusError.value = ''
      showModal.value = true
    }

    const closeIssue = () => {
      showModal.value = false
      selectedIssue.value = null
      statusMessage.value = ''
      statusError.value = ''
      internalNote.value = ''
      resolutionNote.value = ''
      reporterResponse.value = ''
    }

    const saveStatus = async () => {
      if (!selectedIssue.value) return
      savingStatus.value = true
      statusMessage.value = ''
      statusError.value = ''
      try {
        if (['Resolved', 'Dismissed'].includes(statusDraft.value) && !resolutionNote.value) {
          statusError.value = 'A resolution or dismissal note is required before closing a report.'
          return
        }
        const adminName = auth.currentUser?.email || 'System Administrator'
        await updateDoc(doc(db, 'supportTickets', selectedIssue.value.id), {
          status: statusDraft.value,
          internalNote: internalNote.value,
          resolutionNote: resolutionNote.value,
          reporterResponse: reporterResponse.value,
          statusHistory: arrayUnion({ status: statusDraft.value, byId: auth.currentUser?.uid || '', byName: adminName, at: new Date() }),
          updatedAt: serverTimestamp()
        })
        if (selectedIssue.value.userId) {
          await addDoc(collection(db, 'notifications'), {
            recipientUserId: selectedIssue.value.userId,
            senderId: auth.currentUser?.uid || 'superadmin',
            type: 'support_issue_status',
            title: 'Issue Status Updated',
            message: reporterResponse.value || `Your reported issue is now marked as ${statusDraft.value}.`,
            link: '/notifications',
            read: false,
            createdAt: serverTimestamp()
          })
        }
        const updates = {
          status: statusDraft.value,
          internalNote: internalNote.value,
          resolutionNote: resolutionNote.value,
          reporterResponse: reporterResponse.value,
        }
        refreshIssueInList(selectedIssue.value.id, updates)
        refreshSelectedIssue(updates)
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
      pageLoading,
      issues,
      loading,
      error,
      showModal,
      selectedIssue,
      filteredIssues,
      paginatedIssues,
      search,
      currentPage,
      pageSize,
      statusFilter,
      categoryFilter,
      reportStatuses,
      reportCategories,
      internalNote,
      resolutionNote,
      reporterResponse,
      statusDraft,
      savingStatus,
      statusMessage,
      statusError,
      openIssue,
      closeIssue,
      saveStatus,
      formatDate
    }
  }
}
</script>

<style scoped>
.reports-page { background: #fffdf9; color: #3d281d; }
.reports-main { min-width: 0; }
.reports-heading { margin-bottom: 24px; }
.reports-heading h1 { margin: 6px 0 8px; font-size: 30px; font-weight: 700; color: #3d281d; }
.reports-heading > p:last-child { color: #765d4c; font-size: 14px; }
.reports-eyebrow { color: #9b603d; font-size: 10px; font-weight: 700; letter-spacing: .16em; }
.reports-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
.reports-summary article { padding: 18px 20px; background: #fffdf9; border: 1px solid #ecd6be; border-radius: 12px; }
.reports-summary span { display: block; color: #765d4c; font-size: 12px; }
.reports-summary strong { display: block; margin-top: 8px; font-size: 26px; color: #3d281d; }
.reports-filters { display: grid; grid-template-columns: minmax(200px, 1.5fr) repeat(2, minmax(180px, 1fr)); gap: 16px; padding: 20px; border: 1px solid #ecd6be; border-radius: 12px; margin-bottom: 20px; background: #fffdf9; }
.reports-filters > label { color: #5d4536; font-size: 13px; font-weight: 600; }
.reports-filters input { display: block; width: 100%; min-height: 44px; border: 1px solid #dec19e; border-radius: 10px; margin-top: 8px; padding: 10px 12px; font-size: 13px; font-weight: 400; }
.reports-filters :deep(.appearance-select), .report-details :deep(.appearance-select) { margin: 0; }
.reports-table-wrap { overflow-x: auto; border: 1px solid #ecd6be; border-radius: 12px; background: #fffdf9; }
.reports-table-wrap table { min-width: 920px; }
.reports-table-wrap th { white-space: nowrap; }
.reports-table-wrap td { vertical-align: middle; line-height: 1.6; }
.reports-table-wrap td:nth-child(3) { min-width: 180px; max-width: 300px; overflow-wrap: anywhere; }
.report-badge { display: inline-block; border-radius: 999px; white-space: nowrap; padding: 5px 10px; font-size: 11px; font-weight: 600; }
.report-badge-neutral { background: #f1ece5; color: #635344; }
.report-badge-danger { background: #fceceb; color: #a13732; }
.report-badge-warning { background: #fff0d5; color: #885a16; }
.report-badge-success { background: #e6f3eb; color: #24634a; }
.report-badge-review { background: #eee8f7; color: #65418a; }
.report-badge-info { background: #e5f0f7; color: #315e7d; }
.report-secondary { min-height: 36px; padding: 8px 14px; border: 1px solid #d9b896; border-radius: 8px; background: #fffdf9; color: #70482e; font-size: 13px; font-weight: 600; }
.report-secondary:hover { background: #f8eddc; }
.report-primary { min-height: 42px; padding: 10px 22px; border: 1px solid #8d5a3b; border-radius: 9px; background: #8d5a3b; color: #fffdf9; font-size: 13px; font-weight: 600; }
.report-primary:hover { background: #74462d; }
.report-primary:disabled, .report-secondary:disabled { opacity: .55; cursor: not-allowed; }
.report-primary:focus-visible, .report-secondary:focus-visible { outline: 3px solid #dab999; outline-offset: 3px; }
:global(.app-modal-panel.report-modal) { background: #fffdf9 !important; color: #3d281d !important; border: 1px solid #ecd6be; border-radius: 16px; }
:global(.report-modal > div:first-child), :global(.report-modal > div:last-child) { background: #fffdf9; padding: 20px 24px; }
:global(.report-modal > div:first-child > button) { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; border: 1px solid #ecd6be; border-radius: 9px; color: #765d4c; }
:global(.report-modal > div:first-child > button:hover) { background: #f8eddc; }
:global(.report-modal-body) { background: #fffaf3; padding: 24px; scrollbar-color: #cfaf90 #fffaf3; }
.report-modal-title { color: #3d281d; font-size: 22px; font-weight: 700; margin-top: 4px; }
.report-details { color: #3d281d; line-height: 1.65; }
.report-details > div:not(.flex) { padding: 16px; border: 1px solid #ecd6be; border-radius: 10px; background: #fffdf9 !important; }
.report-details :is(.text-white, .text-slate-200) { color: #3d281d !important; overflow-wrap: anywhere; }
.report-details :is(.text-slate-400, .text-slate-500) { color: #765d4c !important; }
.report-details .uppercase { font-size: 11px; font-weight: 600; letter-spacing: .05em; }
.report-details a { color: #8d5a3b !important; overflow-wrap: anywhere; text-decoration: underline; text-underline-offset: 3px; }
.report-details textarea { background: #fffdf9 !important; color: #3d281d !important; border-color: #dec19e !important; border-radius: 10px; min-height: 104px; resize: vertical; line-height: 1.6; }
.report-details > label > span { font-weight: 600; }
.report-help { color: #765d4c; font-size: 12px; line-height: 1.6; }
.report-modal-actions { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.report-success { background: #e6f3eb; color: #24634a; border-radius: 8px; padding: 12px; }
.report-error { background: #fceceb; color: #a13732; border-radius: 8px; padding: 12px; }
@media (max-width: 720px) {
  .reports-main { padding: 20px 16px; }
  .reports-filters { grid-template-columns: 1fr; padding: 16px; }
  .reports-summary { gap: 8px; }
  .reports-summary article { padding: 14px 10px; }
  .reports-summary strong { font-size: 22px; }
  :global(.report-modal-body) { padding: 16px; }
  :global(.report-modal > div:first-child), :global(.report-modal > div:last-child) { padding: 16px; }
  .report-modal-actions .report-help { display: none; }
  .report-modal-actions { justify-content: flex-end; }
}
</style>
