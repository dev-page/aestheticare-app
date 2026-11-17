<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, blocks: [{ variant: 'settings', fields: 2, sections: 1 }, { variant: 'table', columns: 5, rows: 4 }] }" class="flex-1 p-8">
      <OwnerPageSkeleton v-if="loading" />
      <div v-else>
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Backup Database</h1>
          <p class="text-slate-400">Generate and download a clinic data export for offline reference or analysis.</p>
          <p class="mt-2 max-w-3xl text-xs leading-5 text-slate-500">Restore adds records missing from a saved backup and keeps existing records unchanged. Exports do not include every Firebase resource, uploaded files, or Firebase Authentication accounts.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="refreshBackups"
          >
            <svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span>
          </button>
          <button
            v-if="canCreate"
            type="button"
            class="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            :disabled="loading || creating"
            @click="createBackup"
          >
            {{ creating ? 'Generating...' : 'Generate Backup' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>
      <p v-if="success" class="mb-4 text-sm text-emerald-300">{{ success }}</p>

      <section class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 class="text-sm text-slate-400 mb-1">Last Backup</h2>
          <p class="text-lg text-white font-semibold">{{ lastBackupLabel }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ lastBackupStatus }}</p>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 class="text-sm text-slate-400 mb-1">Total Backups</h2>
          <p class="text-lg text-white font-semibold">{{ backups.length }}</p>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 class="text-sm text-slate-400 mb-1">Latest Size</h2>
          <p class="text-lg text-white font-semibold">{{ lastBackupSize }}</p>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 class="text-sm text-slate-400 mb-1">Automatic Exports</h2>
          <p class="text-lg text-white font-semibold">{{ backupScheduleLabel }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ backupScheduleNote }}</p>
        </div>
      </section>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-visible">
        <div class="px-4 py-3 border-b border-slate-700 text-sm text-slate-400">
          Backups
        </div>

        <div class="max-h-[720px] min-h-[520px] overflow-y-auto overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 bg-slate-800">
              <tr>
                <th class="text-left text-slate-300 px-4 py-3">Created</th>
                <th class="text-left text-slate-300 px-4 py-3">Status</th>
                <th class="text-left text-slate-300 px-4 py-3">Size</th>
                <th class="text-left text-slate-300 px-4 py-3">File</th>
                <th class="text-right text-slate-300 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-300" colspan="5">Loading backups...</td>
              </tr>
              <tr v-else-if="!backups.length">
                <td class="px-4 py-3 text-slate-300" colspan="5">No backups yet.</td>
              </tr>
              <tr
                v-for="backup in backups"
                :key="backup.id"
                class="border-b border-slate-700/60 last:border-b-0"
              >
                <td class="px-4 py-3 text-slate-200">{{ backup.createdLabel }}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-md text-xs font-medium" :class="statusClass(backup.status)">
                    {{ backup.status || 'Unknown' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-300">{{ backup.sizeLabel }}</td>
                <td class="px-4 py-3 text-slate-400">{{ backup.fileName || '-' }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="relative inline-block text-left">
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
                      :disabled="!backup.storagePath || downloadingId === backup.id"
                      @click="openDownloadMenu(backup, $event)"
                      :title="downloadTooltip"
                    >
                      {{ downloadingId === backup.id ? 'Preparing...' : 'Download' }}
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

  <teleport to="body">
    <div
      v-if="menuState.visible"
      class="fixed inset-0 z-[80]"
      @click="closeMenu"
    >
      <div
        class="absolute w-48 origin-top-right rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
        :style="{ top: `${menuState.y}px`, left: `${menuState.x}px` }"
        @click.stop
      >
        <button
          v-if="canRestoreBackups"
          type="button"
          class="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          :disabled="menuState.backup?.status !== 'complete'"
          @click="openRestoreDialog(menuState.backup)"
        >
          Restore missing records
        </button>
        <button
          type="button"
          class="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          @click="downloadBackup(menuState.backup)"
        >
          Download JSON
        </button>
        <button
          type="button"
          class="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          @click="downloadCsv(menuState.backup)"
        >
          Export CSV
        </button>
        <button
          type="button"
          class="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          @click="downloadZip(menuState.backup)"
        >
          Download ZIP
        </button>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div
      v-if="restoreState.visible"
      class="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      @click.self="closeRestoreDialog"
    >
      <section role="dialog" aria-modal="true" aria-labelledby="restore-backup-title" class="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-900 p-6 shadow-2xl">
        <h2 id="restore-backup-title" class="text-xl font-semibold text-white">Restore missing clinic records?</h2>
        <p class="mt-3 text-sm leading-6 text-slate-300">
          This adds records from <strong>{{ restoreState.backup?.fileName }}</strong> only when their document is missing. Records that exist now will be left unchanged.
        </p>
        <p class="mt-2 text-sm leading-6 text-slate-400">
          This cannot restore uploaded files or Firebase sign-in accounts. Staff profiles may be restored, but their sign-in accounts must still exist.
        </p>
        <label class="mt-5 flex items-start gap-3 text-sm text-slate-200">
          <input v-model="restoreConfirmed" type="checkbox" class="mt-1 accent-emerald-500" :disabled="restoring" />
          <span>I understand this will add missing records from the selected backup.</span>
        </label>
        <p v-if="restoreError" class="mt-3 text-sm text-rose-300">{{ restoreError }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800" :disabled="restoring" @click="closeRestoreDialog">Cancel</button>
          <button type="button" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50" :disabled="!restoreConfirmed || restoring" @click="restoreBackup">
            {{ restoring ? 'Restoring…' : 'Restore missing records' }}
          </button>
        </div>
      </section>
    </div>
  </teleport>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { auth, db } from '@/config/firebaseConfig'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'
import { usePermissions } from '@/composables/usePermissions'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
const { hasPermission, isClinicAdminOwner } = usePermissions()


const loading = ref(true)
const creating = ref(false)
const error = ref('')
const success = ref('')
const backups = ref([])
const backupOwnerId = ref('')
const downloadingId = ref('')
const menuState = ref({ visible: false, x: 0, y: 0, backup: null })
let unsubscribe = null
const backupSchedule = ref(null)
const backupScheduleLoading = ref(false)
const restoreState = ref({ visible: false, backup: null })
const restoreConfirmed = ref(false)
const restoring = ref(false)
const restoreError = ref('')

const canCreate = computed(() => isClinicAdminOwner.value || hasPermission('backups:create'))
const canRestoreBackups = computed(() => isClinicAdminOwner.value)

const resolveBackupOwnerId = async (user) => {
  const profileSnap = await getDoc(doc(db, 'users', user.uid))
  const profile = profileSnap.exists() ? profileSnap.data() || {} : {}
  const role = String(profile.role || profile.userType || '').trim().toLowerCase()
  if (role === 'owner' || role === 'clinic owner') return user.uid

  const assignedBranches = [
    profile.branchId,
    ...(Array.isArray(profile.branchIds) ? profile.branchIds : [])
  ].map((value) => String(value || '').trim()).filter(Boolean)
  if (!assignedBranches.length) return user.uid

  const clinicSnap = await getDoc(doc(db, 'clinics', assignedBranches[0]))
  const clinic = clinicSnap.exists() ? clinicSnap.data() || {} : {}
  return String(clinic.ownerId || user.uid).trim()
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (!date || Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatBytes = (bytes) => {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let size = value
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'complete' || normalized === 'success') {
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
  }
  if (normalized === 'processing') {
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
  }
  if (normalized === 'failed') {
    return 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
  }
  return 'bg-slate-600/30 text-slate-200 border border-slate-500/40'
}

const lastBackup = computed(() => backups.value[0])
const lastBackupLabel = computed(() => (lastBackup.value ? lastBackup.value.createdLabel : 'None'))
const lastBackupStatus = computed(() => (lastBackup.value ? lastBackup.value.status : ''))
const lastBackupSize = computed(() => (lastBackup.value ? lastBackup.value.sizeLabel : '-'))
const downloadTooltip = 'Your browser will choose the save location.'

const backupScheduleLabel = computed(() => {
  if (backupScheduleLoading.value) return 'Checking server…'
  if (!backupSchedule.value) return 'Status unavailable'
  if (!backupSchedule.value.enabled) return 'Disabled on server'
  const hour = Number(backupSchedule.value.dailyHour)
  const time = Number.isFinite(hour)
    ? new Date(2000, 0, 1, hour).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    : 'configured time'
  return `Daily at ${time}`
})

const backupScheduleNote = computed(() => {
  if (backupScheduleLoading.value) return 'Reading the backend schedule configuration.'
  if (!backupSchedule.value) return 'The backend schedule could not be checked.'
  if (!backupSchedule.value.enabled) return 'Enable BACKUP_SCHEDULE_ENABLED on the server to run automatic exports.'
  return `Monthly export on day ${backupSchedule.value.monthlyDay} · ${backupSchedule.value.timeZone || 'server time'}`
})

const refreshBackupSchedule = async () => {
  const user = auth.currentUser
  if (!user || !backupOwnerId.value) {
    backupSchedule.value = null
    return
  }

  backupScheduleLoading.value = true
  try {
    const token = await user.getIdToken()
    const params = new URLSearchParams({ ownerId: backupOwnerId.value })
    const response = await fetch(`${OTP_API_BASE}/owner/backup/schedule?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to read schedule.')
    backupSchedule.value = payload.data || null
  } catch (scheduleError) {
    console.error('Failed to load backup schedule:', scheduleError)
    backupSchedule.value = null
  } finally {
    backupScheduleLoading.value = false
  }
}

const refreshBackups = trackPageLoad(async () => {
  const user = auth.currentUser
  if (!user) {
    error.value = 'User not authenticated.'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  if (unsubscribe) unsubscribe()

  try {
    backupOwnerId.value = await resolveBackupOwnerId(user)
  } catch (err) {
    console.error('Failed to resolve backup organization:', err)
    error.value = 'Unable to determine the clinic organization for backups.'
    loading.value = false
    return
  }

  await refreshBackupSchedule()

  const backupQuery = query(
    collection(db, 'backups'),
    where('ownerId', '==', backupOwnerId.value)
  )

  unsubscribe = pageListener(
    onSnapshot, backupQuery,
    (snapshot) => {
      backups.value = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {}
        return {
          id: docSnap.id,
          createdAt: data.createdAt,
          createdLabel: formatDate(data.createdAt),
          status: data.status || 'Unknown',
          size: data.size || 0,
          sizeLabel: formatBytes(data.size),
          storagePath: data.storagePath || '',
          fileName: data.fileName || ''
        }
      }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      loading.value = false
    },
    (err) => {
      console.error('Failed to load backups:', err)
      error.value = 'Failed to load backups.'
      loading.value = false
    }
  )
})

const createBackup = async () => {
  error.value = ''
  success.value = ''
  const user = auth.currentUser
  if (!user) {
    error.value = 'User not authenticated.'
    return
  }

  creating.value = true
  try {
    const token = await user.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/owner/backup`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ ownerId: backupOwnerId.value || await resolveBackupOwnerId(user) })
    })

    const contentType = String(response.headers.get('content-type') || '')
    const data = contentType.includes('application/json') ? await response.json() : null
    if (!response.ok || !data?.success) {
      const fallback = response.status === 503
        ? 'The backup service is temporarily unavailable. Check the Vercel runtime log for /api/owner/backup.'
        : `The backup service returned HTTP ${response.status}. Check the Vercel runtime log for /api/owner/backup.`
      const runtimeId = response.headers.get('x-vercel-id')
      const details = [data?.error || fallback, data?.stage ? `Stage: ${data.stage}.` : '', data?.requestId ? `Request ID: ${data.requestId}.` : runtimeId ? `Vercel request ID: ${runtimeId}.` : '']
        .filter(Boolean)
        .join(' ')
      throw new Error(details)
    }
    success.value = 'Backup created and saved to the clinic backup history.'
  } catch (err) {
    console.error('Backup error:', err)
    error.value = err?.message || 'Failed to generate backup.'
  } finally {
    creating.value = false
  }
}

const openRestoreDialog = (backup) => {
  closeMenu()
  if (!backup?.id || backup.status !== 'complete') return
  restoreError.value = ''
  restoreConfirmed.value = false
  restoreState.value = { visible: true, backup }
}

const closeRestoreDialog = () => {
  if (restoring.value) return
  restoreState.value = { visible: false, backup: null }
  restoreConfirmed.value = false
  restoreError.value = ''
}

const restoreBackup = async () => {
  const backup = restoreState.value.backup
  const user = auth.currentUser
  if (!backup?.id || !user || !restoreConfirmed.value || restoring.value) return
  restoring.value = true
  restoreError.value = ''
  error.value = ''
  success.value = ''
  try {
    const token = await user.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/owner/backup/restore`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ownerId: backupOwnerId.value || await resolveBackupOwnerId(user),
        backupId: backup.id,
        confirmRestore: true
      })
    })
    const contentType = String(response.headers.get('content-type') || '')
    const payload = contentType.includes('application/json') ? await response.json() : null
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || `Restore failed with HTTP ${response.status}.`)
    }
    const restored = Number(payload.data?.restoredRecords || 0)
    const existing = Number(payload.data?.skippedExistingRecords || 0)
    success.value = `Recovery finished: restored ${restored} missing record${restored === 1 ? '' : 's'}; left ${existing} existing record${existing === 1 ? '' : 's'} unchanged.`
    restoreState.value = { visible: false, backup: null }
    restoreConfirmed.value = false
  } catch (restoreFailure) {
    console.error('Backup restore error:', restoreFailure)
    restoreError.value = restoreFailure?.message || 'Unable to restore missing clinic records.'
  } finally {
    restoring.value = false
  }
}

const downloadBackup = async (backup) => {
  if (!backup?.storagePath) return
  downloadingId.value = backup.id
  error.value = ''
  success.value = ''
  try {
    const response = await fetchBackupFile(backup)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = (backup.fileName || 'backup').replace(/\.json$/i, '') + '.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download backup:', err)
    error.value = 'Unable to download backup.'
  } finally {
    downloadingId.value = ''
    closeMenu()
  }
}

const fetchBackupFile = async (backup) => {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated.')
  const token = await user.getIdToken()
  const response = await fetch(`${OTP_API_BASE}/owner/backup/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ownerId: backupOwnerId.value || await resolveBackupOwnerId(user),
      storagePath: backup.storagePath,
      fileName: backup.fileName || 'backup',
    }),
  })
  if (!response.ok) {
    const contentType = String(response.headers.get('content-type') || '')
    const payload = contentType.includes('application/json') ? await response.json() : null
    throw new Error(payload?.error || 'Failed to download backup.')
  }
  return response
}

const loadBackupJson = trackPageLoad(async (backup) => {
  const response = await fetchBackupFile(backup)
  return response.json()
})

const buildCsvContent = (rows = []) => {
  if (!rows.length) return 'collection'
  const escapeCell = (value) => {
    if (value === null || value === undefined) return ''
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    const escaped = raw.replace(/"/g, '""')
    return `"${escaped}"`
  }
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))].filter((key) => key !== 'collection')
  const header = ['collection', ...keys].map(escapeCell).join(',')
  const lines = rows.map((row) => [escapeCell(row.collection), ...keys.map((key) => escapeCell(row[key]))].join(','))
  return [header, ...lines].join('\n')
}

const downloadCsv = async (backup) => {
  if (!backup?.storagePath) return
  downloadingId.value = backup.id
  error.value = ''
  success.value = ''
  try {
    const data = await loadBackupJson(backup)
    const records = []
    Object.entries(data?.collections || {}).forEach(([collectionName, items]) => {
      if (!Array.isArray(items)) return
      items.forEach((item) => records.push({ ...item, collection: collectionName }))
    })
    const csvContent = buildCsvContent(records)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = (backup.fileName || 'backup').replace(/\.json$/i, '') + '.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export CSV:', err)
    error.value = 'Unable to export CSV.'
  } finally {
    downloadingId.value = ''
    closeMenu()
  }
}

const downloadZip = async (backup) => {
  if (!backup?.storagePath) return
  downloadingId.value = backup.id
  error.value = ''
  success.value = ''
  try {
    const user = auth.currentUser
    if (!user) throw new Error('User not authenticated.')
    const token = await user.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/owner/backup/zip`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ownerId: backupOwnerId.value || await resolveBackupOwnerId(user),
        storagePath: backup.storagePath,
        fileName: backup.fileName || 'backup'
      })
    })

    if (!response.ok) {
      const contentType = String(response.headers.get('content-type') || '')
      const data = contentType.includes('application/json') ? await response.json() : null
      throw new Error(data?.error || 'Failed to generate ZIP.')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = (backup.fileName || 'backup').replace(/\.json$/i, '') + '.zip'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to generate ZIP:', err)
    error.value = err?.message || 'Unable to generate ZIP.'
  } finally {
    downloadingId.value = ''
    closeMenu()
  }
}

const openDownloadMenu = (backup, event) => {
  if (!backup) return
  const button = event?.currentTarget
  if (!button) return
  const rect = button.getBoundingClientRect()
  const menuWidth = 192
  const margin = 8
  let x = rect.right - menuWidth
  let y = rect.bottom + margin
  x = Math.max(margin, Math.min(x, window.innerWidth - menuWidth - margin))
  if (y + 180 > window.innerHeight) {
    y = rect.top - 180
  }
  menuState.value = { visible: true, x, y, backup }
}

const closeMenu = () => {
  menuState.value = { visible: false, x: 0, y: 0, backup: null }
}

onMounted(refreshBackups)

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>
