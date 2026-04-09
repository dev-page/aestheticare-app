<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <OwnerPageSkeleton v-if="loading" />
      <div v-else>
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Backup Database</h1>
          <p class="text-slate-400">Generate and download a full backup of your clinic data.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="refreshBackups"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button
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
          <h2 class="text-sm text-slate-400 mb-1">Next Auto Backup</h2>
          <p class="text-lg text-white font-semibold">{{ nextBackupLabel }}</p>
          <p class="text-xs text-slate-500 mt-1">In {{ nextBackupCountdown }}</p>
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
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { auth, db, storage } from '@/config/firebaseConfig'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'

const OTP_API_BASE = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

const loading = ref(true)
const creating = ref(false)
const error = ref('')
const success = ref('')
const backups = ref([])
const downloadingId = ref('')
const menuState = ref({ visible: false, x: 0, y: 0, backup: null })
let unsubscribe = null
let countdownTimer = null

const backupDailyHour = Number(import.meta.env.VITE_BACKUP_DAILY_HOUR || 2)
const backupMonthlyDay = Number(import.meta.env.VITE_BACKUP_MONTHLY_DAY || 1)
const nowTick = ref(Date.now())

const canCreate = computed(() => true)

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

const computeNextBackupTime = (baseTime) => {
  const now = new Date(baseTime)
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(backupDailyHour)
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

const nextBackupTime = computed(() => computeNextBackupTime(nowTick.value))

const nextBackupLabel = computed(() => {
  const next = nextBackupTime.value
  return next.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const nextBackupCountdown = computed(() => {
  const diffMs = Math.max(0, nextBackupTime.value.getTime() - nowTick.value)
  const totalMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
})

const refreshBackups = async () => {
  const user = auth.currentUser
  if (!user) {
    error.value = 'User not authenticated.'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  if (unsubscribe) unsubscribe()

  const backupQuery = query(
    collection(db, 'backups'),
    where('ownerId', '==', user.uid)
  )

  unsubscribe = onSnapshot(
    backupQuery,
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
}

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
      body: JSON.stringify({ ownerId: user.uid })
    })

    const contentType = String(response.headers.get('content-type') || '')
    const data = contentType.includes('application/json') ? await response.json() : null
    if (!response.ok || !data?.success) {
      const fallback = contentType.includes('application/json') ? data?.error : 'Backend did not return JSON. Check OTP_API_BASE and backend status.'
      throw new Error(fallback || 'Failed to generate backup.')
    }
  } catch (err) {
    console.error('Backup error:', err)
    error.value = err?.message || 'Failed to generate backup.'
  } finally {
    creating.value = false
  }
}

const downloadBackup = async (backup) => {
  if (!backup?.storagePath) return
  downloadingId.value = backup.id
  error.value = ''
  success.value = ''
  try {
    const url = await getDownloadURL(storageRef(storage, backup.storagePath))
    window.open(url, '_blank', 'noopener')
  } catch (err) {
    console.error('Failed to download backup:', err)
    error.value = 'Unable to download backup.'
  } finally {
    downloadingId.value = ''
    closeMenu()
  }
}

const loadBackupJson = async (backup) => {
  const url = await getDownloadURL(storageRef(storage, backup.storagePath))
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to download backup file.')
  }
  return response.json()
}

const buildCsvContent = (rows = []) => {
  if (!rows.length) return 'collection,'
  const keys = Object.keys(rows[0] || {})
  const escapeCell = (value) => {
    if (value === null || value === undefined) return ''
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    const escaped = raw.replace(/"/g, '""')
    return `"${escaped}"`
  }
  const header = ['collection', ...keys].join(',')
  const lines = rows.map((row) => {
    return ['data', ...keys.map((key) => escapeCell(row[key]))].join(',')
  })
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
      items.forEach((item) => records.push({ collection: collectionName, ...item }))
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
        ownerId: user.uid,
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
  if (countdownTimer) clearInterval(countdownTimer)
})

onMounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 60000)
})
</script>
