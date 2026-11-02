<template>
  <div class="flex module-theme activity-logs-page min-h-screen">
    <SuperAdminSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 6, rows: 5 }" class="activity-logs-main flex-1 p-8">
      <header class="activity-logs-heading"><p class="activity-logs-eyebrow">PLATFORM ADMINISTRATION</p><h1>Activity Logs</h1><p>Track actions performed by System Administrators across the platform.</p></header>
      <section class="activity-logs-panel">
        <div class="activity-logs-toolbar">
          <div class="activity-logs-filters">
            <label><span>From</span><input type="date" v-model="fromDate" /></label>
            <label><span>To</span><input type="date" v-model="toDate" /></label>
            <label class="activity-logs-search"><span>Search user</span><input v-model="searchUser" placeholder="Name or email" /></label>
            <button type="button" class="activity-filter-button" @click="loadLogs">Filter</button>
          </div>
          <div class="activity-logs-actions">
            <button type="button" aria-label="Refresh activity logs" title="Refresh activity logs" class="activity-reload-button" @click="reload"><svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span>Reload</span></button>
            <button type="button" class="activity-export-button" @click="exportCsv">Export CSV</button>
          </div>
        </div>
        <div class="activity-table-wrap"><table class="activity-table"><thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Module</th><th>Action</th><th>Details</th></tr></thead><tbody>
          <tr v-if="loading"><td colspan="6">Loading activity logs...</td></tr>
          <tr v-else-if="error"><td class="activity-table-error" colspan="6">{{ error }}</td></tr>
          <tr v-else-if="!logs.length"><td colspan="6">No activity logs yet.</td></tr>
          <tr v-else v-for="log in paginatedLogs" :key="log.id"><td>{{ formatDate(log.createdAt) }}</td><td class="activity-actor"><span>{{ log.actorName || log.actorEmail || '-' }}</span><small v-if="log.actorName && log.actorEmail">{{ log.actorEmail }}</small></td><td><span class="activity-role">System Administrator</span></td><td>{{ log.module || 'General' }}</td><td class="activity-action">{{ log.action || '-' }}</td><td class="activity-details" :title="log.details || ''">{{ log.details || '-' }}</td></tr>
        </tbody></table></div>
        <TablePagination v-model:page="currentPage" v-model:page-size="pageSize" :total-items="logs.length" />
      </section>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'

export default {
  name: 'SuperAdminActivityLogs',
  components: { SuperAdminSidebar, TablePagination },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const logs = ref([])
    const currentPage = ref(1)
    const pageSize = ref(10)
    const loading = ref(false)
    const error = ref('')

    const fromDate = ref(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0,10))
    const toDate = ref(new Date().toISOString().slice(0,10))
    const searchUser = ref('')
    let unsubscribeLogs = null

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const normalizeRole = (value) => {
      const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
      if (!compact) return ''
      if (['superadmin', 'systemadmin', 'sysadmin', 'systemadministrator'].includes(compact)) return 'System Administrator'
      return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
    }

    const loadLogs = () => {
      if (unsubscribeLogs) unsubscribeLogs()
      loading.value = true
      error.value = ''
      const activityQuery = query(collection(db, 'activities'), orderBy('createdAt', 'desc'))
      unsubscribeLogs = pageListener(onSnapshot, activityQuery, (snapshot) => {
        const all = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

        // Apply server-like filters client-side for now
        const start = new Date(fromDate.value)
        start.setHours(0,0,0,0)
        const end = new Date(toDate.value)
        end.setHours(23,59,59,999)
        const search = String(searchUser.value || '').trim().toLowerCase()

        logs.value = all
          .filter((log) => {
            const created = log.createdAt?.toDate ? log.createdAt.toDate() : null
            if (!created) return false
            if (created < start || created > end) return false
            if (normalizeRole(log.actorRole || log.actorUserType) !== 'System Administrator') return false
            if (search) {
              const actorName = String(log.actorName || '').toLowerCase()
              const actorEmail = String(log.actorEmail || '').toLowerCase()
              return actorName.includes(search) || actorEmail.includes(search)
            }
            return true
          })

        currentPage.value = 1

        loading.value = false
      }, (err) => {
        console.error('Failed to load activity logs:', err)
        error.value = 'Failed to load activity logs.'
        logs.value = []
        loading.value = false
      })
    }

    const reload = () => { fromDate.value = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0,10); toDate.value = new Date().toISOString().slice(0,10); searchUser.value = ''; loadLogs() }
    const paginatedLogs = computed(() => logs.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))
    const totalPages = computed(() => Math.max(1, Math.ceil(logs.value.length / pageSize.value)))
    watch(pageSize, () => { currentPage.value = 1 })
    watch(totalPages, (count) => { if (currentPage.value > count) currentPage.value = count })

    const exportCsv = () => {
      if (!logs.value.length) return alert('No logs to export')
      const rows = [['Timestamp','User','Email','Role','Module','Action','Details']]
      logs.value.forEach((l) => rows.push([formatDate(l.createdAt), l.actorName || '-', l.actorEmail || '-', 'System Administrator', l.module || 'General', String(l.action || '-'), String(l.details || '-')]))
      const csv = rows.map(r=> r.map(c=> '"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-logs-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    onMounted(loadLogs)
    onUnmounted(() => unsubscribeLogs?.())

    return {
      pageLoading,
      logs,
      paginatedLogs,
      currentPage,
      pageSize,
      loading,
      error,
      formatDate,
      loadLogs,
      fromDate,
      toDate,
      searchUser,
      reload,
      exportCsv,
    }
  }
}
</script>

<style scoped>
.activity-logs-page { background: #fffdf9; color: #3d281d; }
.activity-logs-main { min-width: 0; }
.activity-logs-heading { margin-bottom: 24px; }
.activity-logs-eyebrow { margin: 0; color: #9b603d; font-size: 10px; font-weight: 700; letter-spacing: .16em; }
.activity-logs-heading h1 { margin: 6px 0 8px; color: #3d281d; font-size: 30px; font-weight: 700; }
.activity-logs-heading > p:last-child { margin: 0; color: #765d4c; font-size: 14px; }
.activity-logs-panel { overflow: hidden; border: 1px solid #ecd6be; border-radius: 12px; background: #fffdf9; box-shadow: 0 10px 24px rgba(92, 59, 37, .06); }
.activity-logs-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding: 20px; border-bottom: 1px solid #ecd6be; }
.activity-logs-filters, .activity-logs-actions { display: flex; align-items: end; gap: 12px; }
.activity-logs-filters label { display: block; min-width: 150px; color: #765d4c; font-size: 12px; font-weight: 600; }
.activity-logs-filters label span { display: block; margin-bottom: 6px; }
.activity-logs-filters input { box-sizing: border-box; width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #dec19e; border-radius: 9px; background: #fffdf9; color: #3d281d; font: inherit; }
.activity-logs-filters input:focus { border-color: #8d5a3b; outline: 3px solid #f2dec6; }
.activity-logs-filters .activity-logs-search { min-width: 210px; }
.activity-filter-button, .activity-export-button, .activity-reload-button { min-height: 42px; border-radius: 9px; font-size: 13px; font-weight: 700; white-space: nowrap; }
.activity-filter-button, .activity-export-button { padding: 9px 16px; border: 1px solid #8d5a3b; background: #8d5a3b; color: #fffdf9; }
.activity-filter-button:hover, .activity-export-button:hover { background: #74462d; }
.activity-reload-button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 13px; border: 1px solid #d9b896; background: #fffdf9; color: #70482e; }
.activity-reload-button:hover { background: #f8eddc; }
.activity-filter-button:focus-visible, .activity-export-button:focus-visible, .activity-reload-button:focus-visible { outline: 3px solid #dab999; outline-offset: 3px; }
.activity-table-wrap { overflow-x: auto; }
.activity-table { width: 100%; min-width: 940px; border-collapse: collapse; font-size: 13px; }
.activity-table th { padding: 13px 16px; background: #f9ebd3; color: #694b37; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-align: left; text-transform: uppercase; white-space: nowrap; }
.activity-table td { padding: 14px 16px; border-top: 1px solid #f0dfcc; color: #765d4c; line-height: 1.45; vertical-align: top; }
.activity-table tbody tr:hover { background: #fffaf3; }
.activity-table tbody tr:first-child td { border-top: 0; }
.activity-actor, .activity-action { color: #3d281d !important; font-weight: 600; }
.activity-actor > span, .activity-actor > small { display: block; overflow-wrap: anywhere; }
.activity-actor > small { margin-top: 2px; color: #765d4c; font-size: 11px; font-weight: 400; }
.activity-role { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #f1ece5; color: #635344; font-size: 11px; font-weight: 700; white-space: nowrap; }
.activity-details { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-table-error { color: #a13732 !important; }
:deep(.table-pagination) { margin: 0; padding: 14px 16px; border-top: 1px solid #ecd6be; }
@media (max-width: 960px) { .activity-logs-toolbar { align-items: flex-start; flex-direction: column; } }
@media (max-width: 720px) { .activity-logs-main { padding: 20px 16px; } .activity-logs-toolbar { padding: 16px; } .activity-logs-filters { display: grid; grid-template-columns: 1fr 1fr; width: 100%; } .activity-logs-filters .activity-logs-search { min-width: 0; } .activity-logs-actions { width: 100%; } .activity-logs-actions button { flex: 1; } }
@media (max-width: 460px) { .activity-logs-filters { grid-template-columns: 1fr; } .activity-filter-button { width: 100%; } }
</style>
