<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Suspended Centers</h1>
          <p class="text-slate-400">Centers that are temporarily blocked from accessing the platform.</p>
        </div>

        <div class="flex gap-3">
          <input
            v-model="search"
            type="text"
            placeholder="Search center, owner, reason..."
            class="w-72 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
          />
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadSuspendedClinics"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-700 text-sm text-slate-400">
          Total Suspended Centers: <span class="text-slate-200 font-semibold">{{ filteredClinics.length }}</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 bg-slate-800">
              <tr>
                <th class="text-left text-slate-300 px-4 py-3">Center</th>
                <th class="text-left text-slate-300 px-4 py-3">Owner</th>
                <th class="text-left text-slate-300 px-4 py-3">Reports</th>
                <th class="text-left text-slate-300 px-4 py-3">Reason</th>
                <th class="text-left text-slate-300 px-4 py-3">Suspension Ends</th>
                <th class="text-left text-slate-300 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-300" colspan="6">Loading suspended centers...</td>
              </tr>

              <tr v-else-if="!filteredClinics.length">
                <td class="px-4 py-3 text-slate-300" colspan="6">No suspended centers found.</td>
              </tr>

              <tr v-for="clinic in filteredClinics" :key="clinic.id" class="border-b border-slate-700/60 last:border-b-0">
                <td class="px-4 py-3 text-slate-200">
                  <div class="font-semibold">{{ clinic.clinicName || 'Unnamed Center' }}</div>
                  <div class="text-xs text-slate-500">{{ clinic.location || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-slate-300">
                  <div>{{ clinic.ownerName || '-' }}</div>
                  <div class="text-xs text-slate-500">{{ clinic.ownerEmail || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-slate-300">
                  <div class="font-medium">{{ clinic.validReportCount }}</div>
                  <div class="text-xs text-slate-500">Total: {{ clinic.reportCount }}</div>
                </td>
                <td class="px-4 py-3 text-slate-300 max-w-xs">
                  <p class="line-clamp-2">{{ clinic.suspensionReason || 'No reason recorded.' }}</p>
                </td>
                <td class="px-4 py-3 text-slate-300">{{ clinic.suspensionEndsAtLabel }}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-md text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {{ clinic.statusLabel }}
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
import { hasExpiredSuspension, isSuspendedStatus, restoreExpiredSuspension } from '@/utils/centerSuspension'

const formatDate = (value) => {
  if (!value?.toDate) return '-'
  return value.toDate().toLocaleDateString()
}

export default {
  name: 'SuperAdminSuspendedClinics',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const search = ref('')
    const clinics = ref([])

    const loadSuspendedClinics = async () => {
      loading.value = true
      error.value = ''

      try {
        const clinicsSnap = await getDocs(collection(db, 'clinics'))
        const baseClinics = clinicsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

        const rows = await Promise.all(
          baseClinics.map(async (clinic) => {
            if (hasExpiredSuspension(clinic)) {
              await restoreExpiredSuspension(db, clinic.id, clinic)
              return null
            }

            const suspended =
              isSuspendedStatus(clinic.status) ||
              isSuspendedStatus(clinic.moderationStatus)

            if (!suspended) return null

            let ownerName = ''
            let ownerEmail = ''

            try {
              const ownerLookupId = clinic.ownerId || clinic.id
              const userSnap = await getDoc(doc(db, 'users', ownerLookupId))
              if (userSnap.exists()) {
                const userData = userSnap.data() || {}
                ownerName =
                  String(userData.fullName || '').trim() ||
                  `${String(userData.firstName || '').trim()} ${String(userData.lastName || '').trim()}`.trim()
                ownerEmail = userData.email || ''
              }
            } catch (_error) {
              // ignore owner lookup failures
            }

            return {
              ...clinic,
              ownerName,
              ownerEmail,
              clinicName: clinic.clinicName || clinic.clinicBranch || '',
              location: clinic.clinicLocation || clinic.location || '',
              reportCount: Number(clinic.reportCount || 0),
              validReportCount: Number(clinic.validReportCount || 0),
              suspensionReason: clinic.suspensionReason || '',
              suspensionEndsAtLabel: formatDate(clinic.suspensionEndsAt),
              statusLabel: clinic.moderationStatus || clinic.status || 'Suspended'
            }
          })
        )

        clinics.value = rows.filter(Boolean).sort((a, b) => String(a.clinicName || '').localeCompare(String(b.clinicName || '')))
      } catch (err) {
        console.error('Error loading suspended centers:', err)
        error.value = 'Failed to load suspended centers. Please try again.'
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
          clinic.suspensionReason,
          clinic.statusLabel
        ].join(' ').toLowerCase()

        return haystack.includes(keyword)
      })
    })

    onMounted(loadSuspendedClinics)

    return {
      loading,
      error,
      search,
      clinics,
      filteredClinics,
      loadSuspendedClinics
    }
  }
}
</script>
