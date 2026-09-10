<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <h1 class="text-3xl font-bold text-white mb-2">Approved Clinics</h1>
      <p class="text-slate-400 mb-6">List of clinics that have been approved and verified.</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Clinic Name</th>
              <th class="text-left text-slate-300 px-4 py-3">Owner</th>
              <th class="text-left text-slate-300 px-4 py-3">Subscription</th>
              <th class="text-left text-slate-300 px-4 py-3">Center Status</th>
              <th class="text-left text-slate-300 px-4 py-3">Verified Date</th>
              <th class="text-left text-slate-300 px-4 py-3">Reported Issues</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-200" colspan="6">Loading approved clinics...</td>
            </tr>
            <tr v-else-if="!verifiedClinics.length">
              <td class="px-4 py-3 text-slate-200" colspan="6">No approved clinics yet.</td>
            </tr>
            <tr
              v-else
              v-for="clinic in verifiedClinics"
              :key="clinic.id"
              class="border-b border-slate-700/60 last:border-b-0"
            >
              <td class="px-4 py-3 text-slate-100">
                <div class="font-semibold">{{ clinic.clinicName || clinic.clinicBranch || 'Unnamed Clinic' }}</div>
                <div class="text-xs text-slate-400">{{ clinic.clinicLocation || '-' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-300">
                <div class="font-medium">{{ clinic.ownerName }}</div>
                <div class="text-xs text-slate-400">{{ clinic.ownerEmail || '-' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-300">
                <div class="font-medium">{{ clinic.planLabel }}</div>
                <div class="text-xs text-slate-400">Status: {{ clinic.paymentStatus || '-' }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-md text-xs font-medium" :class="statusClass(clinic.centerStatus)">
                  {{ clinic.centerStatus }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-300">{{ clinic.approvedAtLabel }}</td>
              <td class="px-4 py-3">
                <span class="rounded-md border px-2 py-1 text-xs font-medium" :class="clinic.complaintCount ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'">
                  {{ clinic.complaintCount }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'

export default {
  name: 'SuperAdminVerifiedClinics',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const verifiedClinics = ref([])
    let unsubscribeClinics = null

    const normalizePlanLabel = (value) => {
      const raw = String(value || '').trim().toLowerCase()
      if (!raw) return 'Not set'
      if (raw.includes('free')) return 'FreePlan'
      if (raw.includes('basic')) return 'Basic'
      if (raw.includes('premium')) return 'Premium'
      return value
    }

    const formatDate = (value) => {
      if (!value?.toDate) return '-'
      return value.toDate().toLocaleDateString()
    }

    const isApproved = (value) => String(value || '').trim().toLowerCase().includes('approved')

    const loadVerifiedClinics = () => {
      if (unsubscribeClinics) unsubscribeClinics()
      loading.value = true
      unsubscribeClinics = onSnapshot(collection(db, 'clinics'), async (clinicsSnap) => {
        const approvedClinics = clinicsSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((clinic) => {
            if (!isApproved(clinic.approvalStatus)) return false
            return true
          })

        const rows = await Promise.all(
          approvedClinics.map(async (clinic) => {
            const ownerLookupId = clinic.ownerId || clinic.id
            const userSnap = await getDoc(doc(db, 'users', ownerLookupId))
            const user = userSnap.exists() ? userSnap.data() : {}
            const fullName =
              String(user.fullName || '').trim() ||
              `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
              'Unnamed Owner'

            const resolvedPlan = clinic.subscriptionPlan || user.subscriptionPlan || clinic.plan || user.plan || ''
            const resolvedPayment = clinic.paymentStatus || user.paymentStatus || ''
            const approvedAt = clinic.approvedAt || user.approvedAt || null
            const complaintsSnap = await getDocs(query(
              collection(db, 'supportTickets'),
              where('branchId', '==', clinic.id),
            ))

            return {
              id: clinic.id,
              approvalStatus: clinic.approvalStatus || 'Approved',
              clinicName: clinic.clinicName || clinic.clinicBranch || '',
              clinicBranch: clinic.clinicBranch || '',
              clinicLocation: clinic.clinicLocation || '',
              ownerName: fullName,
              ownerEmail: user.email || clinic.ownerEmail || '',
              planLabel: normalizePlanLabel(resolvedPlan),
              paymentStatus: resolvedPayment,
              centerStatus: clinic.status || clinic.moderationStatus || 'Active',
              approvedAtLabel: formatDate(approvedAt),
              approvedAt: approvedAt || null,
              complaintCount: complaintsSnap.size,
            }
          })
        )

        verifiedClinics.value = sortRecordsNewestFirst(rows)
        loading.value = false
      }, (error) => {
        console.error('Failed to load verified clinics:', error)
        verifiedClinics.value = []
        loading.value = false
      })
    }

    onMounted(loadVerifiedClinics)
    onUnmounted(() => unsubscribeClinics?.())

    return {
      loading,
      verifiedClinics,
      statusClass: (value) => {
        const normalized = String(value || '').trim().toLowerCase()
        if (normalized.includes('review')) {
          return 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
        }
        return 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
      }
    }
  }
}
</script>
