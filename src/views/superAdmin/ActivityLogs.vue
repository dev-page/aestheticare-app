<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <h1 class="text-3xl font-bold text-white mb-2">Activity Logs</h1>
      <p class="text-slate-400 mb-6">Track actions performed by users across the platform.</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Timestamp</th>
              <th class="text-left text-slate-300 px-4 py-3">User</th>
              <th class="text-left text-slate-300 px-4 py-3">Role</th>
              <th class="text-left text-slate-300 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-300" colspan="5">Loading activity logs...</td>
            </tr>
            <tr v-else-if="error">
              <td class="px-4 py-3 text-rose-300" colspan="5">{{ error }}</td>
            </tr>
            <tr v-else-if="!logs.length">
              <td class="px-4 py-3 text-slate-200" colspan="5">No activity logs yet.</td>
            </tr>
            <tr v-else v-for="log in logs" :key="log.id" class="border-t border-slate-700/60">
              <td class="px-4 py-3 text-slate-300">{{ formatDate(log.createdAt) }}</td>
              <td class="px-4 py-3 text-slate-200">{{ log.actorName || '-' }}</td>
              <td class="px-4 py-3 text-slate-300">
                {{ log.actorRole || '-' }}
                <span v-if="log.actorUserType" class="text-xs text-slate-500">({{ log.actorUserType }})</span>
              </td>
              <td class="px-4 py-3 text-slate-200">{{ log.action || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

export default {
  name: 'SuperAdminActivityLogs',
  components: { SuperAdminSidebar },
  setup() {
    const logs = ref([])
    const loading = ref(false)
    const error = ref('')

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
        return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
      }

      const allowedRoles = new Set(['Superadmin', 'Clinic Admin', 'Customer'])

    const loadLogs = async () => {
      loading.value = true
      error.value = ''
      try {
        const activityQuery = query(collection(db, 'activities'), orderBy('createdAt', 'desc'))
        const snapshot = await getDocs(activityQuery)
        logs.value = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((log) => allowedRoles.has(normalizeRole(log.actorRole)))
      } catch (err) {
        console.error('Failed to load activity logs:', err)
        error.value = 'Failed to load activity logs.'
        logs.value = []
      } finally {
        loading.value = false
      }
    }

    onMounted(loadLogs)

    return {
      logs,
      loading,
      error,
      formatDate,
      loadLogs,
    }
  }
}
</script>
