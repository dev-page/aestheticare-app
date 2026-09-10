<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <h1 class="text-3xl font-bold text-white mb-2">Activity Logs</h1>
      <p class="text-slate-400 mb-6">Track actions performed by users across the platform.</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden p-4">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div class="flex gap-3 items-end">
            <div>
              <label class="text-xs text-slate-400">From</label>
              <input type="date" v-model="fromDate" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />
            </div>
            <div>
              <label class="text-xs text-slate-400">To</label>
              <input type="date" v-model="toDate" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />
            </div>
            <div>
              <label class="text-xs text-slate-400">Role</label>
              <select v-model="roleFilter" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100">
                <option value="">All</option>
                <option value="Superadmin">Superadmin</option>
                <option value="Clinic Admin">Clinic Admin</option>
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-400">Search User</label>
              <input v-model="searchUser" placeholder="name or email" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />
            </div>
            <button class="px-3 py-2 rounded bg-sky-600 text-white" @click="loadLogs">Filter</button>
          </div>

          <div class="flex gap-3">
            <button class="px-3 py-2 rounded bg-slate-700 text-slate-200" @click="reload">Reload</button>
            <button class="px-3 py-2 rounded bg-emerald-600 text-white" @click="exportCsv">Export CSV</button>
          </div>
        </div>

        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Timestamp</th>
              <th class="text-left text-slate-300 px-4 py-3">User</th>
              <th class="text-left text-slate-300 px-4 py-3">Role</th>
              <th class="text-left text-slate-300 px-4 py-3">Module</th>
              <th class="text-left text-slate-300 px-4 py-3">Action</th>
              <th class="text-left text-slate-300 px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-300" colspan="6">Loading activity logs...</td>
            </tr>
            <tr v-else-if="error">
              <td class="px-4 py-3 text-rose-300" colspan="6">{{ error }}</td>
            </tr>
            <tr v-else-if="!logs.length">
              <td class="px-4 py-3 text-slate-200" colspan="6">No activity logs yet.</td>
            </tr>
            <tr v-else v-for="log in logs" :key="log.id" class="border-t border-slate-700/60">
              <td class="px-4 py-3 text-slate-300">{{ formatDate(log.createdAt) }}</td>
              <td class="px-4 py-3 text-slate-200">{{ log.actorName || log.actorEmail || '-' }}</td>
              <td class="px-4 py-3 text-slate-300">
                {{ log.actorRole || '-' }}
                <span v-if="log.actorUserType" class="text-xs text-slate-500">({{ log.actorUserType }})</span>
              </td>
              <td class="px-4 py-3 text-slate-300">{{ log.module || 'General' }}</td>
              <td class="px-4 py-3 text-slate-200">{{ log.action || '-' }}</td>
              <td class="max-w-md truncate px-4 py-3 text-slate-400" :title="log.details || ''">{{ log.details || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

export default {
  name: 'SuperAdminActivityLogs',
  components: { SuperAdminSidebar },
  setup() {
    const logs = ref([])
    const loading = ref(false)
    const error = ref('')

    const fromDate = ref(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0,10))
    const toDate = ref(new Date().toISOString().slice(0,10))
    const roleFilter = ref('')
    const searchUser = ref('')
    let unsubscribeLogs = null

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const normalizeRole = (value) => {
      const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
      if (!compact) return ''
      if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
      if (compact === 'owner' || compact === 'clinicadmin' || compact === 'clinicadministrator') return 'Clinic Admin'
      if (compact === 'customer') return 'Customer'
      if (compact === 'supplier') return 'Supplier'
      return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
    }

    const allowedRoles = new Set(['Superadmin', 'Clinic Admin', 'Customer', 'Supplier'])

    const loadLogs = () => {
      if (unsubscribeLogs) unsubscribeLogs()
      loading.value = true
      error.value = ''
      const activityQuery = query(collection(db, 'activities'), orderBy('createdAt', 'desc'))
      unsubscribeLogs = onSnapshot(activityQuery, (snapshot) => {
        const all = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

        // Apply server-like filters client-side for now
        const start = new Date(fromDate.value)
        start.setHours(0,0,0,0)
        const end = new Date(toDate.value)
        end.setHours(23,59,59,999)
        const role = String(roleFilter.value || '').trim()
        const search = String(searchUser.value || '').trim().toLowerCase()

        logs.value = all
          .filter((log) => {
            const created = log.createdAt?.toDate ? log.createdAt.toDate() : null
            if (!created) return false
            if (created < start || created > end) return false
            const normalized = normalizeRole(log.actorRole)
            if (role && normalized !== role) return false
            if (search) {
              const actorName = String(log.actorName || '').toLowerCase()
              const actorEmail = String(log.actorEmail || '').toLowerCase()
              return actorName.includes(search) || actorEmail.includes(search)
            }
            return allowedRoles.has(normalizeRole(log.actorRole))
          })

        loading.value = false
      }, (err) => {
        console.error('Failed to load activity logs:', err)
        error.value = 'Failed to load activity logs.'
        logs.value = []
        loading.value = false
      })
    }

    const reload = () => { fromDate.value = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0,10); toDate.value = new Date().toISOString().slice(0,10); roleFilter.value = ''; searchUser.value = ''; loadLogs() }

    const exportCsv = () => {
      if (!logs.value.length) return alert('No logs to export')
      const rows = [['Timestamp','User','Email','Role','Module','Action','Details']]
      logs.value.forEach((l) => rows.push([formatDate(l.createdAt), l.actorName || '-', l.actorEmail || '-', l.actorRole || '-', l.module || 'General', String(l.action || '-'), String(l.details || '-')]))
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
      logs,
      loading,
      error,
      formatDate,
      loadLogs,
      fromDate,
      toDate,
      roleFilter,
      searchUser,
      reload,
      exportCsv,
    }
  }
}
</script>
