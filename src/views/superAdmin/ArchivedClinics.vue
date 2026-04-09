<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Archived Clinics</h1>
          <p class="text-slate-400">Clinics marked as inactive, disabled, or archived.</p>
        </div>

        <div class="flex gap-3">
          <input
            v-model="search"
            type="text"
            placeholder="Search clinic, owner, status..."
            class="w-72 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
          />
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadArchivedClinics"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-700 text-sm text-slate-400">
          Total Archived Clinics: <span class="text-slate-200 font-semibold">{{ filteredClinics.length }}</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 bg-slate-800">
              <tr>
                <th class="text-left text-slate-300 px-4 py-3">Clinic</th>
                <th class="text-left text-slate-300 px-4 py-3">Owner</th>
                <th class="text-left text-slate-300 px-4 py-3">Location</th>
                <th class="text-left text-slate-300 px-4 py-3">Plan</th>
                <th class="text-left text-slate-300 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-300" colspan="5">Loading archived clinics...</td>
              </tr>

              <tr v-else-if="!filteredClinics.length">
                <td class="px-4 py-3 text-slate-300" colspan="5">No archived clinics found.</td>
              </tr>

              <tr v-for="clinic in filteredClinics" :key="clinic.id" class="border-b border-slate-700/60 last:border-b-0">
                <td class="px-4 py-3 text-slate-200">
                  <div class="font-semibold">{{ clinic.clinicName || 'Unnamed Clinic' }}</div>
                  <div class="text-xs text-slate-500">ID: {{ clinic.id }}</div>
                </td>
                <td class="px-4 py-3 text-slate-300">
                  <div>{{ clinic.ownerName || '-' }}</div>
                  <div class="text-xs text-slate-500">{{ clinic.ownerEmail || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-slate-300">{{ clinic.location || '-' }}</td>
                <td class="px-4 py-3 text-slate-300">{{ clinic.planLabel || '-' }}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-md text-xs font-medium" :class="statusClass(clinic.statusLabel)">
                    {{ clinic.statusLabel || 'Archived' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { hasExpiredSuspension, restoreExpiredSuspension } from '@/utils/centerSuspension'

const normalizePlanLabel = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return '-'
  if (raw.includes('free')) return 'Free Trial'
  if (raw.includes('basic')) return 'Basic'
  if (raw.includes('premium')) return 'Premium'
  return value
}

const normalizeStatus = (value) => String(value || '').trim().toLowerCase()

const isArchivedStatus = (value) => {
  const status = normalizeStatus(value)
  if (!status) return false
  return (
    status === 'inactive' ||
    status === 'disabled' ||
    status === 'archived' ||
    status.includes('inactive') ||
    status.includes('disabled') ||
    status.includes('archiv')
  )
}

export default {
  name: 'SuperAdminArchivedClinics',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const search = ref('')
    const clinics = ref([])

    const statusClass = (status) => {
      const normalized = normalizeStatus(status)
      if (normalized.includes('inactive') || normalized.includes('disabled') || normalized.includes('archiv')) {
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      }
      return 'bg-slate-600/30 text-slate-200 border border-slate-500/40'
    }

    const loadArchivedClinics = async () => {
      loading.value = true
      error.value = ''

      try {
        const clinicsSnap = await getDocs(collection(db, 'clinics'))
        const baseClinics = clinicsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

        const enriched = await Promise.all(
          baseClinics.map(async (clinic) => {
            if (hasExpiredSuspension(clinic)) {
              await restoreExpiredSuspension(db, clinic.id, clinic)
              clinic.status = 'Active'
              clinic.moderationStatus = 'Resolved'
              clinic.isPublished = true
              clinic.suspendedAt = null
              clinic.suspensionEndsAt = null
              clinic.suspensionReason = ''
              clinic.suspensionSource = ''
            }

            let ownerName = ''
            let ownerEmail = ''
            let ownerStatus = ''
            let ownerArchived = false

            try {
              const ownerLookupId = clinic.ownerId || clinic.id
              const userSnap = await getDoc(doc(db, 'users', ownerLookupId))
              if (userSnap.exists()) {
                const userData = userSnap.data() || {}
                ownerName =
                  String(userData.fullName || '').trim() ||
                  `${String(userData.firstName || '').trim()} ${String(userData.lastName || '').trim()}`.trim()
                ownerEmail = userData.email || ''
                ownerStatus = userData.status || ''
                ownerArchived = userData.archived === true
              }
            } catch (_err) {
              // ignore owner lookup failures
            }

            const clinicStatus = clinic.status || clinic.approvalStatus || ''
            const statusLabel = String(clinic.approvalStatus || clinic.status || ownerStatus || 'Archived')
            const archived =
              clinic.archived === true ||
              ownerArchived ||
              isArchivedStatus(clinic.status) ||
              isArchivedStatus(clinic.approvalStatus) ||
              isArchivedStatus(ownerStatus)

            return {
              ...clinic,
              ownerName,
              ownerEmail,
              statusLabel,
              archived,
              planLabel: normalizePlanLabel(clinic.subscriptionPlan || clinic.plan || ''),
              location: clinic.clinicLocation || clinic.location || '',
            }
          })
        )

        clinics.value = enriched.filter((clinic) => clinic.archived)
      } catch (err) {
        console.error('Error loading archived clinics:', err)
        error.value = 'Failed to load archived clinics. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const filteredClinics = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()
      if (!keyword) return clinics.value

      return clinics.value.filter((clinic) => {
        const haystack = [
          clinic.clinicName,
          clinic.ownerName,
          clinic.ownerEmail,
          clinic.location,
          clinic.planLabel,
          clinic.statusLabel,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(keyword)
      })
    })

    onMounted(loadArchivedClinics)

    return {
      loading,
      error,
      search,
      clinics,
      filteredClinics,
      statusClass,
      loadArchivedClinics,
    }
  },
}
</script>
