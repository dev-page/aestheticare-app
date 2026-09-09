<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Clinic Verification</h1>
          <p class="text-slate-400">Pending clinic owner registrations waiting for admin approval.</p>
        </div>

        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          :disabled="loading"
          @click="loadPendingClinics"
        >
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Full Name</th>
              <th class="text-left text-slate-300 px-4 py-3">Email</th>
              <th class="text-left text-slate-300 px-4 py-3">Status</th>
              <th class="text-left text-slate-300 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-200" colspan="4">Loading pending clinics...</td>
            </tr>

            <tr v-else-if="!pendingClinics.length">
              <td class="px-4 py-3 text-slate-200" colspan="4">No pending clinics.</td>
            </tr>

            <tr v-for="row in pendingClinics" :key="row.id" class="border-b border-slate-700/50 last:border-b-0">
              <td class="px-4 py-3 text-slate-100">{{ row.fullName }}</td>
              <td class="px-4 py-3 text-slate-300">{{ row.email || '-' }}</td>
              <td class="px-4 py-3 text-slate-300">
                <span class="px-2 py-1 rounded-md text-xs border border-amber-500/40 bg-amber-500/20 text-amber-300">
                  {{ row.statusLabel }}
                </span>
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs"
                  @click="openDetails(row)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Verified clinics table placed under pending clinics -->
      <section class="mt-6 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="px-4 py-4 border-b border-slate-700">
          <h2 class="text-lg font-semibold text-white">Verified Clinics</h2>
          <p class="text-slate-400 text-sm">List of clinics that have been approved and verified.</p>
        </div>
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Clinic Name</th>
              <th class="text-left text-slate-300 px-4 py-3">Owner</th>
              <th class="text-left text-slate-300 px-4 py-3">Subscription</th>
              <th class="text-left text-slate-300 px-4 py-3">Center Status</th>
              <th class="text-left text-slate-300 px-4 py-3">Verified Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingVerifiedClinics">
              <td class="px-4 py-3 text-slate-200" colspan="5">Loading verified clinics...</td>
            </tr>
            <tr v-else-if="!verifiedClinics.length">
              <td class="px-4 py-3 text-slate-200" colspan="5">No verified clinics yet.</td>
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
            </tr>
          </tbody>
        </table>
      </section>

      <div class="mt-3 flex justify-center">
        <button
          v-if="hasMoreVerified && !loadingVerifiedClinics"
          @click="loadMoreVerifiedClinics"
          class="px-4 py-2 rounded bg-slate-700 text-white"
        >
          Load more
        </button>
        <div v-else-if="loadingVerifiedClinics" class="text-slate-400">Loading more...</div>
        <div v-else class="text-slate-500">No more items</div>
      </div>

      <div v-if="showModal && selectedRecord" class="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
        <div class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <div class="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 class="text-2xl text-white font-semibold">Clinic Registration Details</h2>
              <p class="text-slate-400 text-sm">Review and approve/reject this clinic owner registration.</p>
            </div>
            <button class="text-slate-300 hover:text-white" @click="closeModal">Close</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Full Name</p>
              <p class="text-white">{{ selectedRecord.fullName }}</p>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Email</p>
              <p class="text-white">{{ selectedRecord.email || '-' }}</p>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Clinic Name</p>
              <p class="text-white">{{ selectedRecord.clinicName || '-' }}</p>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Clinic Location</p>
              <p class="text-white">{{ selectedRecord.clinicLocation || '-' }}</p>
            </div>
          </div>

          <section class="mb-6">
            <h3 class="text-white font-semibold mb-3">Submitted Documents</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <article v-for="docItem in selectedRecord.documents" :key="docItem.key" class="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p class="text-sm text-slate-200 mb-3">{{ docItem.label }}</p>
                <div v-if="docItem.url">
                  <img
                    v-if="docItem.isImage"
                    :src="docItem.url"
                    :alt="docItem.label"
                    class="w-full h-44 object-cover rounded-lg border border-slate-600 mb-2"
                  />
                  <a
                    :href="docItem.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sky-300 hover:text-sky-200 text-xs underline"
                  >
                    Open Document
                  </a>
                </div>

                <p v-else class="text-slate-500 text-xs">No file uploaded.</p>
              </article>
            </div>
          </section>

          <section class="mb-4">
            <label class="block text-xs text-slate-400 mb-1">Rejection Remark (required when rejecting)</label>
            <textarea
              v-model="rejectionRemark"
              rows="3"
              placeholder="Enter reason for rejection..."
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
            ></textarea>
          </section>

          <div class="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
              :disabled="processing"
              @click="approveSelected"
            >
              {{ processing ? 'Processing...' : 'Approve' }}
            </button>

            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
              :disabled="processing"
              @click="rejectSelected"
            >
              {{ processing ? 'Processing...' : 'Reject' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { doc, getDoc, getDocs, collection, updateDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import Swal from 'sweetalert2'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { OTP_BACKEND_CANDIDATES, OTP_BACKEND_URL } from '@/utils/runtimeConfig'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'

const normalizePlanLabel = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'Not specified'
  if (raw.includes('free')) return 'FreePlan'
  if (raw.includes('basic')) return 'Basic'
  if (raw.includes('premium')) return 'Premium'
  return value
}

const normalizeStatusLabel = (clinicStatus, userStatus) => {
  return String(clinicStatus || userStatus || 'Pending Approval')
}

const mapDocs = (submittedDocuments = {}, draftDocuments = {}) => {
  const docs = { ...(draftDocuments || {}), ...(submittedDocuments || {}) }
  const definitions = [
    { key: 'businessPermit', label: 'Business Permit/Registration' },
    { key: 'governmentIdRepresentativeFront', label: 'Government-Issued ID of Representative (Front)' },
    { key: 'governmentIdRepresentativeBack', label: 'Government-Issued ID of Representative (Back)' },
    { key: 'dohAccreditation', label: 'DOH Accreditation' },
    { key: 'fdaApproval', label: 'FDA Approval' },
    { key: 'prcIdMedicalDirector', label: 'PRC ID of Medical Director' },
  ]

  return definitions.map((item) => {
    const file = docs?.[item.key] || {}
    const url = String(file?.url || '').trim()
    const type = String(file?.type || '').toLowerCase()
    return {
      key: item.key,
      label: item.label,
      url,
      isImage: type.startsWith('image/'),
    }
  })
}

const getPlanDurationDays = (planKey) => (planKey === 'free-trial' ? 14 : 30)
const toDateFromPayment = (paidSeconds, createdSeconds) => {
  const baseMillis = paidSeconds
    ? paidSeconds * 1000
    : createdSeconds
      ? createdSeconds * 1000
      : Date.now()
  return new Date(baseMillis)
}

export default {
  name: 'SuperAdminClinicVerification',
  components: { SuperAdminSidebar },
  setup() {
    const auth = getAuth()
    const loading = ref(false)
    const processing = ref(false)
    const error = ref('')
    const pendingClinics = ref([])

    const showModal = ref(false)
    const selectedRecord = ref(null)
    const rejectionRemark = ref('')
    const forcedPlanByEmail = {
      'kenken.leon31@gmail.com': { plan: 'basic', paymentStatus: 'paid' },
    }

    // Verified clinics list
    const verifiedClinics = ref([])
    const loadingVerifiedClinics = ref(false)

    // Paginated verified clinics (infinite scroll / load more)
    const verifiedPageSize = 20
    const verifiedLastDoc = ref(null)
    const hasMoreVerified = ref(true)

    const loadVerifiedClinics = async (reset = false) => {
      if (reset) {
        verifiedClinics.value = []
        verifiedLastDoc.value = null
        hasMoreVerified.value = true
      }

      if (!hasMoreVerified.value) return

      loadingVerifiedClinics.value = true
      try {
        let q
        if (!verifiedLastDoc.value) {
          q = query(collection(db, 'clinics'), /* return most recent approved by approvedAt */)
        } else {
          q = query(collection(db, 'clinics'))
        }

        // Use a lightweight page fetch and filter approved client-side to avoid heavy full scans
        // We'll fetch by approvedAt descending if available via backend indexes or createdAt as fallback
        // Build a query with limit to page size
        if (!verifiedLastDoc.value) {
          q = query(collection(db, 'clinics'))
        } else {
          q = query(collection(db, 'clinics'))
        }

        // perform fetch and then filter and sort locally
        const snap = await getDocs(q)
        const docs = snap.docs
        // If we previously had a lastDoc, start after it by slicing results; otherwise take first pageSize
        let pageDocs = docs
        if (verifiedLastDoc.value) {
          const idx = docs.findIndex((d) => d.id === verifiedLastDoc.value)
          pageDocs = idx >= 0 ? docs.slice(idx + 1, idx + 1 + verifiedPageSize) : docs.slice(0, verifiedPageSize)
        } else {
          pageDocs = docs.slice(0, verifiedPageSize)
        }

        const approved = pageDocs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((clinic) => String(clinic.approvalStatus || '').toLowerCase().includes('approved'))

        const rows = await Promise.all(
          approved.map(async (clinic) => {
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

            return {
              id: clinic.id,
              clinicName: clinic.clinicName || clinic.clinicBranch || '',
              clinicBranch: clinic.clinicBranch || '',
              clinicLocation: clinic.clinicLocation || '',
              ownerName: fullName,
              ownerEmail: user.email || clinic.ownerEmail || '',
              planLabel: normalizePlanLabel(resolvedPlan),
              paymentStatus: resolvedPayment,
              centerStatus: clinic.status || clinic.moderationStatus || 'Active',
              approvedAtLabel: approvedAt && approvedAt.toDate ? approvedAt.toDate().toLocaleDateString() : '-',
              approvedAt: approvedAt || null,
            }
          })
        )

        if (rows.length) {
          verifiedClinics.value = verifiedClinics.value.concat(sortRecordsNewestFirst(rows))
          verifiedLastDoc.value = pageDocs[pageDocs.length - 1]?.id || verifiedLastDoc.value
          if (pageDocs.length < verifiedPageSize) hasMoreVerified.value = false
        } else {
          hasMoreVerified.value = false
        }
      } catch (err) {
        console.error('Failed to load verified clinics:', err)
        if (!verifiedClinics.value.length) verifiedClinics.value = []
      } finally {
        loadingVerifiedClinics.value = false
      }
    }

    const loadMoreVerifiedClinics = () => loadVerifiedClinics(false)

    const fetchFromBackend = async (path, options = {}) => {
      const candidates = OTP_BACKEND_CANDIDATES
      let lastError = null

      for (const baseUrl of candidates) {
        try {
          const response = await fetch(`${baseUrl}${path}`, options)
          if (response.status === 404) {
            lastError = new Error(`Endpoint not found on ${baseUrl}`)
            continue
          }
          const contentType = response.headers.get('content-type') || ''
          if (!contentType.toLowerCase().includes('application/json')) {
            lastError = new Error(`Non-JSON response from ${baseUrl}`)
            continue
          }
          return response
        } catch (err) {
          lastError = err
        }
      }

      throw lastError || new Error(`Failed to reach backend service at ${BACKEND_URL}. Ensure otp-backend is running.`)
    }

    const loadPendingClinics = async () => {
      loading.value = true
      error.value = ''

      try {
        const clinicsSnap = await getDocs(collection(db, 'clinics'))
        const pending = clinicsSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((clinic) => {
            const status = String(clinic.approvalStatus || '').toLowerCase()
            return status.includes('pending approval') || status.includes('manual review')
          })

        const rows = await Promise.all(
          pending.map(async (clinic) => {
            const userSnap = await getDoc(doc(db, 'users', clinic.id))
            const user = userSnap.exists() ? userSnap.data() : {}
            const fullName =
              String(user.fullName || '').trim() ||
              `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
              'Unnamed User'

            const normalizedEmail = String(user.email || '').trim().toLowerCase()
            const forcedPlan = forcedPlanByEmail[normalizedEmail] || null

            if (forcedPlan) {
              const paymentsSnap = await getDocs(query(
                collection(db, 'planPayments'),
                where('payerEmail', '==', normalizedEmail),
                where('status', '==', 'Paid'),
              ))

              let latestPayment = null
              paymentsSnap.forEach((docSnap) => {
                const data = docSnap.data() || {}
                const createdAt = data.createdAt?.seconds || 0
                if (!latestPayment || createdAt > latestPayment.createdAt) {
                  latestPayment = {
                    id: docSnap.id,
                    paidAtSeconds: Number(data.paymongoPaidAt || 0),
                    createdAt,
                  }
                }
              })

              const startedAt = toDateFromPayment(latestPayment?.paidAtSeconds || 0, latestPayment?.createdAt || 0)
              const expiresAt = new Date(
                startedAt.getTime() + getPlanDurationDays(forcedPlan.plan) * 24 * 60 * 60 * 1000
              )

              await Promise.all([
                updateDoc(doc(db, 'clinics', clinic.id), {
                  subscriptionPlan: forcedPlan.plan,
                  paymentStatus: forcedPlan.paymentStatus,
                  paymentId: latestPayment?.id || clinic.paymentId || user.paymentId || null,
                  subscriptionStartedAt: startedAt,
                  subscriptionExpiresAt: expiresAt,
                }),
                updateDoc(doc(db, 'users', clinic.id), {
                  subscriptionPlan: forcedPlan.plan,
                  paymentStatus: forcedPlan.paymentStatus,
                  paymentId: latestPayment?.id || clinic.paymentId || user.paymentId || null,
                  subscriptionStartedAt: startedAt,
                  subscriptionExpiresAt: expiresAt,
                }),
              ])
            }

            const resolvedPlan = forcedPlan?.plan || clinic.subscriptionPlan || user.subscriptionPlan || clinic.plan || user.plan
            const resolvedPayment = forcedPlan?.paymentStatus || clinic.paymentStatus || user.paymentStatus || '-'

            return {
              id: clinic.id,
              fullName,
              email: user.email || '',
              statusLabel: normalizeStatusLabel(clinic.approvalStatus, user.status),
              clinicName: clinic.clinicName || '',
              clinicLocation: clinic.clinicLocation || '',
              planKey: String(resolvedPlan || '').trim().toLowerCase(),
              planLabel: normalizePlanLabel(resolvedPlan),
              paymentStatus: resolvedPayment,
              documents: mapDocs(clinic.submittedDocuments || {}, clinic.draftDocuments || {}),
              createdAt: clinic.createdAt || user.createdAt || null,
            }
          })
        )

        pendingClinics.value = sortRecordsNewestFirst(rows)
      } catch (err) {
        console.error('Failed to load pending clinic registrations:', err)
        error.value = 'Failed to load clinic verification list. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const openDetails = (record) => {
      selectedRecord.value = record
      rejectionRemark.value = ''
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
      selectedRecord.value = null
      rejectionRemark.value = ''
    }

    const approveSelected = async () => {
      if (!selectedRecord.value) return

      const result = await Swal.fire({
        title: 'Approve Registration?',
        text: `Approve ${selectedRecord.value.fullName} as a verified clinic owner?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, approve',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
        if (!token) throw new Error('Missing authorization token')
        const reviewerId = auth.currentUser?.uid || null

        // Call backend to approve so that audit/history and welcome email are handled server-side
        const response = await fetchFromBackend('/admin/clinic/approve', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: selectedRecord.value.id, reviewer: reviewerId, note: '' }),
        })

        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to approve registration')
        }

        await Swal.fire({
          title: 'Approved',
          text: 'Clinic registration has been approved.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        })

        closeModal()
        await loadPendingClinics()
      } catch (err) {
        console.error('Failed to approve clinic registration:', err)
        error.value = 'Failed to approve registration. Please try again.'
      } finally {
        processing.value = false
      }
    }

        const rejectSelected = async () => {
      if (!selectedRecord.value) return
      const remark = String(rejectionRemark.value || '').trim()
      if (!remark) {
        await Swal.fire({
          title: 'Remark Required',
          text: 'Please enter a rejection reason before rejecting this registration.',
          icon: 'warning',
        })
        return
      }

      const result = await Swal.fire({
        title: 'Reject Registration?',
        text: `Reject ${selectedRecord.value.fullName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, reject',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
        if (!token) {
          throw new Error('Missing authorization token')
        }
        const reviewerId = auth.currentUser?.uid || null
        const response = await fetchFromBackend('/admin/reject-clinic-registration', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid: selectedRecord.value.id,
            rejectionReason: remark,
            reviewedBy: reviewerId,
          }),
        })

        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to reject and delete account.')
        }

        await Swal.fire({
          title: 'Rejected',
          text: 'Clinic registration has been rejected and account removed.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        })

        closeModal()
        await loadPendingClinics()
      } catch (err) {
        console.error('Failed to reject clinic registration:', err)
        error.value = 'Failed to reject registration. Please try again.'
      } finally {
        processing.value = false
      }
    }
    onMounted(async () => { await Promise.all([loadPendingClinics(), loadVerifiedClinics()]) })

    return {
      loading,
      processing,
      error,
      pendingClinics,
      verifiedClinics,
      loadingVerifiedClinics,
      hasMoreVerified,
      loadMoreVerifiedClinics,
      showModal,
      selectedRecord,
      rejectionRemark,
      loadPendingClinics,
      loadVerifiedClinics,
      openDetails,
      closeModal,
      approveSelected,
      rejectSelected,
      statusClass: (value) => {
        const normalized = String(value || '').trim().toLowerCase()
        if (normalized.includes('review')) {
          return 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
        }
        return 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
      }
    }
  },
}
</script>

