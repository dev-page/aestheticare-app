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
              <th class="text-left text-slate-300 px-4 py-3">Automatic Verification</th>
              <th class="text-left text-slate-300 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-200" colspan="5">Loading pending clinics...</td>
            </tr>

            <tr v-else-if="!pendingClinics.length">
              <td class="px-4 py-3 text-slate-200" colspan="5">No pending clinics.</td>
            </tr>

            <tr v-for="row in pendingClinics" :key="row.id" class="border-b border-slate-700/50 last:border-b-0">
              <td class="px-4 py-3 text-slate-100">{{ row.fullName }}</td>
              <td class="px-4 py-3 text-slate-300">{{ row.email || '-' }}</td>
              <td class="px-4 py-3 text-slate-300">
                <span class="px-2 py-1 rounded-md text-xs border border-amber-500/40 bg-amber-500/20 text-amber-300">
                  {{ row.statusLabel }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-300">
                <span class="px-2 py-1 rounded-md text-xs border" :class="row.verificationStatus === 'Automatically Verified' ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border-amber-500/40 bg-amber-500/20 text-amber-300'">
                  {{ row.verificationStatus || 'Not processed' }}
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
          <h2 class="text-lg font-semibold text-white">Approved Clinics</h2>
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
              <th class="text-left text-slate-300 px-4 py-3">Reported Issues</th>
              <th class="text-left text-slate-300 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingVerifiedClinics">
              <td class="px-4 py-3 text-slate-200" colspan="7">Loading approved clinics...</td>
            </tr>
            <tr v-else-if="!verifiedClinics.length">
              <td class="px-4 py-3 text-slate-200" colspan="7">No approved clinics yet.</td>
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
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs"
                  @click="openDetails(clinic)"
                >
                  View
                </button>
              </td>
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
              <p class="text-slate-400 text-sm">{{ isPendingRecord(selectedRecord) ? 'Review and approve/reject this clinic owner registration.' : 'View the approved clinic registration and its verification record.' }}</p>
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
            <h3 class="text-white font-semibold mb-3">Registration Details</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div v-for="item in [
                ['Birth Date', formatDateValue(selectedRecord.birthDate)],
                ['Contact Number', selectedRecord.contactNumber],
                ['House / Building Number', selectedRecord.clinicBuildingNumber],
                ['Street / Subdivision / Village', selectedRecord.clinicStreetName],
                ['Barangay', selectedRecord.clinicBarangay],
                ['Province', selectedRecord.clinicProvince],
                ['Postal Code', selectedRecord.clinicPostalCode],
                ['Resolved Address', selectedRecord.clinicLocationAddress],
                ['Coordinates', selectedRecord.clinicLocationLat && selectedRecord.clinicLocationLng ? `${selectedRecord.clinicLocationLat}, ${selectedRecord.clinicLocationLng}` : 'Not available'],
              ]" :key="item[0]" class="bg-slate-800 border border-slate-700 rounded-xl p-3">
                <p class="text-xs text-slate-400 mb-1">{{ item[0] }}</p>
                <p class="text-sm text-white break-words">{{ item[1] || '-' }}</p>
              </div>
            </div>
          </section>

          <section class="mb-6 bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 class="text-white font-semibold">Automatic Verification and OCR</h3>
                <p class="text-xs text-slate-400">Document text extraction and automatic checks run when the applicant submits the documents.</p>
              </div>
              <span class="px-2 py-1 rounded-md text-xs border border-amber-500/40 bg-amber-500/20 text-amber-200 capitalize">
                {{ selectedRecord.verificationStatus || 'Not processed' }}
              </span>
            </div>
            <p class="mt-2 text-xs text-slate-400">
              Processed: {{ formatDateValue(selectedRecord.verificationProcessedAt) }}
              <span v-if="selectedRecord.verificationThreshold !== null"> · Automatic threshold: {{ Math.round(Number(selectedRecord.verificationThreshold) * 100) }}%</span>
            </p>
            <div class="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-slate-300">Overall OCR confidence</span>
                <strong class="text-lg text-white">{{ getOverallConfidence(selectedRecord.verificationResults) === null ? 'Not available' : `${getOverallConfidence(selectedRecord.verificationResults)}%` }}</strong>
              </div>
              <div v-if="getOverallConfidence(selectedRecord.verificationResults) !== null" class="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  class="h-full rounded-full bg-emerald-500 transition-all"
                  :style="{ width: `${getOverallConfidence(selectedRecord.verificationResults)}%` }"
                ></div>
              </div>
            </div>
            <div v-if="selectedRecord.verificationResults?.length" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <article v-for="result in selectedRecord.verificationResults" :key="result.key" class="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                <div class="flex items-start justify-between gap-3">
                  <p class="text-sm text-slate-200">{{ documentLabel(result.key) }}</p>
                  <span class="text-xs capitalize" :class="result.status === 'verified' ? 'text-emerald-300' : 'text-amber-300'">{{ result.status }}</span>
                </div>
                <p class="mt-1 text-xs text-slate-400">Confidence: {{ result.confidence }}%</p>
                <p class="mt-1 text-xs text-slate-300">{{ result.reason }}</p>
                <details v-if="result.extractedText" class="mt-2">
                  <summary class="cursor-pointer text-xs text-sky-300">View extracted text</summary>
                  <pre class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-slate-400">{{ result.extractedText }}</pre>
                </details>
              </article>
            </div>
            <p v-else class="mt-4 text-xs text-slate-500">No automatic verification result is stored for this registration.</p>
            <button
              v-if="isPendingRecord(selectedRecord) && selectedRecord.verificationStatus !== 'Automatically Verified'"
              type="button"
              class="mt-4 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="processing"
              @click="runClinicVerification"
            >
              {{ processing ? 'Processing documents...' : 'Run OCR and automatic verification' }}
            </button>
          </section>

          <section class="mb-6">
            <h3 class="text-white font-semibold mb-3">Submitted Documents</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <article v-for="docItem in selectedRecord.documents" :key="docItem.key" class="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p class="text-sm text-slate-200 mb-3">{{ docItem.label }}</p>
                <div class="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div class="rounded-md bg-slate-900/60 p-2">
                    <span class="text-slate-500">Document number</span>
                    <p class="mt-1 text-slate-200">{{ docItem.documentNumber || '-' }}</p>
                  </div>
                  <div class="rounded-md bg-slate-900/60 p-2">
                    <span class="text-slate-500">Expiry date</span>
                    <p class="mt-1 text-slate-200">{{ formatDateValue(docItem.expiryDate) }}</p>
                  </div>
                </div>
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

          <section v-if="isPendingRecord(selectedRecord)" class="mb-4">
            <label class="block text-xs text-slate-400 mb-1">Rejection Remark (required when rejecting)</label>
            <textarea
              v-model="rejectionRemark"
              rows="3"
              placeholder="Enter reason for rejection..."
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
            ></textarea>
          </section>

          <div v-if="isPendingRecord(selectedRecord)" class="flex flex-col sm:flex-row gap-3 sm:justify-end">
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
          <div v-else class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            This clinic is already approved. Approval and rejection actions are unavailable.
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue'
import { doc, getDoc, getDocs, collection, onSnapshot, updateDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { systemAdminSwal } from '@/utils/systemAdminAlert'
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

const isPendingRecord = (record) => {
  const status = String(record?.approvalStatus || record?.status || '').trim().toLowerCase()
  return status.includes('pending approval') || status.includes('manual review') || status.includes('pending')
}

const formatApplicantName = (user = {}) => {
  const parts = [user.firstName, user.midName || user.middleName, user.lastName, user.suffix]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return String(user.fullName || '').trim() || parts.join(' ') || 'Unnamed User'
}

const mapDocs = (submittedDocuments = {}, draftDocuments = {}) => {
  const docs = { ...(draftDocuments || {}), ...(submittedDocuments || {}) }
  const definitions = [
    { key: 'businessPermit', label: 'Business Permit/Registration' },
    { key: 'birRegistration', label: 'BIR Registration' },
    { key: 'sanitaryCertificate', label: 'Sanitary Certificate' },
    { key: 'clinicLicense', label: 'Clinic License' },
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
      documentNumber: String(file?.documentNumber || file?.number || '').trim(),
      expiryDate: String(file?.expiryDate || '').trim(),
    }
  })
}

const mapVerificationResults = (verificationResults = {}) => Object.entries(verificationResults || {}).map(([key, result = {}]) => ({
  key,
  status: String(result.status || 'manual_review').replaceAll('_', ' '),
  confidence: Number.isFinite(Number(result.confidence)) ? Math.round(Number(result.confidence) * 100) : 0,
  reason: String(result.reason || 'No verification explanation was returned.'),
  extractedText: String(result.extractedText || '').trim(),
}))

const formatDateValue = (value) => {
  if (!value) return '-'
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}

const documentLabel = (key) => ({
  businessPermit: 'Business Permit/Registration',
  birRegistration: 'BIR Registration',
  sanitaryCertificate: 'Sanitary Certificate',
  clinicLicense: 'Clinic License',
  governmentIdRepresentativeFront: 'Government-Issued ID (Front)',
  governmentIdRepresentativeBack: 'Government-Issued ID (Back)',
  dohAccreditation: 'DOH Accreditation',
  fdaApproval: 'FDA Approval',
  prcIdMedicalDirector: 'PRC ID of Medical Director',
}[key] || key)

const getOverallConfidence = (results = []) => {
  const scores = results.map((result) => Number(result.confidence)).filter((score) => Number.isFinite(score))
  if (!scores.length) return null
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
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
    let unsubscribeClinics = null

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
            const fullName = formatApplicantName(user).replace('Unnamed User', 'Unnamed Owner')

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
              clinicLocation: clinic.clinicLocation || clinic.clinicLocationAddress || clinic.clinicBranch || '',
              middleName: user.midName || user.middleName || '',
              suffix: user.suffix || '',
              birthDate: user.birthDate || null,
              contactNumber: user.contactNumber || clinic.contactNumber || '',
              authorizedRepPosition: clinic.authorizedRepPosition || user.authorizedRepPosition || '',
              companyName: clinic.companyName || user.companyName || clinic.clinicName || '',
              companyType: clinic.companyType || user.companyType || '',
              clinicLocationAddress: clinic.clinicLocationAddress || '',
              clinicBuildingNumber: clinic.clinicBuildingNumber || '',
              clinicStreetName: clinic.clinicStreetName || '',
              clinicBarangay: clinic.clinicBarangay || '',
              clinicProvince: clinic.clinicProvince || '',
              clinicPostalCode: clinic.clinicPostalCode || '',
              clinicLocationLat: clinic.clinicLocationLat || '',
              clinicLocationLng: clinic.clinicLocationLng || '',
              ownerName: fullName,
              ownerEmail: user.email || clinic.ownerEmail || '',
              planLabel: normalizePlanLabel(resolvedPlan),
              paymentStatus: resolvedPayment,
              centerStatus: clinic.status || clinic.moderationStatus || 'Active',
              approvedAtLabel: approvedAt && approvedAt.toDate ? approvedAt.toDate().toLocaleDateString() : '-',
              approvedAt: approvedAt || null,
              documents: mapDocs(clinic.submittedDocuments || {}, clinic.draftDocuments || {}),
              verificationStatus: clinic.verificationStatus || 'Not processed',
              verificationThreshold: clinic.verificationThreshold || null,
              verificationProcessedAt: clinic.verificationProcessedAt || null,
              verificationResults: mapVerificationResults(clinic.verificationResults),
              complaintCount: complaintsSnap.size,
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

    const loadPendingClinics = () => {
      if (unsubscribeClinics) unsubscribeClinics()
      loading.value = true
      error.value = ''
      unsubscribeClinics = onSnapshot(collection(db, 'clinics'), async (clinicsSnap) => {
        try {
        const clinicRecords = await Promise.all(clinicsSnap.docs.map(async (docSnap) => {
          const clinic = { id: docSnap.id, ...docSnap.data() }
          const wasAutoApproved =
            String(clinic.approvalStatus || '').toLowerCase() === 'approved' &&
            String(clinic.verificationProcessedBy || '').toLowerCase() === 'automatic_processor' &&
            !clinic.approvedBy

          if (wasAutoApproved) {
            await Promise.all([
              updateDoc(doc(db, 'clinics', clinic.id), {
                approvalStatus: 'Pending Approval',
                verificationStatus: 'Automatically Verified',
                updatedAt: serverTimestamp(),
              }),
              updateDoc(doc(db, 'users', clinic.id), {
                status: 'Pending Approval',
                approvalStatus: 'Pending Approval',
                verificationStatus: 'Automatically Verified',
                updatedAt: serverTimestamp(),
              }),
            ])
            clinic.approvalStatus = 'Pending Approval'
            clinic.verificationStatus = 'Automatically Verified'
          }

          return clinic
        }))
        const pending = clinicRecords
          .filter((clinic) => {
            const status = String(clinic.approvalStatus || '').toLowerCase()
            return status.includes('pending approval') || status.includes('manual review')
          })

        const rows = await Promise.all(
          pending.map(async (clinic) => {
            const userSnap = await getDoc(doc(db, 'users', clinic.id))
            const user = userSnap.exists() ? userSnap.data() : {}
            const fullName = formatApplicantName(user)

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
              approvalStatus: clinic.approvalStatus || 'Pending Approval',
              fullName,
              email: user.email || '',
              middleName: user.midName || user.middleName || '',
              suffix: user.suffix || '',
              birthDate: user.birthDate || null,
              contactNumber: user.contactNumber || clinic.contactNumber || '',
              authorizedRepPosition: clinic.authorizedRepPosition || user.authorizedRepPosition || '',
              companyName: clinic.companyName || user.companyName || clinic.clinicName || '',
              companyType: clinic.companyType || user.companyType || '',
              statusLabel: normalizeStatusLabel(clinic.approvalStatus, user.status),
              clinicName: clinic.clinicName || clinic.companyName || user.companyName || '',
              clinicLocation: clinic.clinicLocation || clinic.clinicLocationAddress || '',
              clinicLocationAddress: clinic.clinicLocationAddress || '',
              clinicBuildingNumber: clinic.clinicBuildingNumber || '',
              clinicStreetName: clinic.clinicStreetName || '',
              clinicBarangay: clinic.clinicBarangay || '',
              clinicProvince: clinic.clinicProvince || '',
              clinicPostalCode: clinic.clinicPostalCode || '',
              clinicLocationLat: clinic.clinicLocationLat || '',
              clinicLocationLng: clinic.clinicLocationLng || '',
              planKey: String(resolvedPlan || '').trim().toLowerCase(),
              planLabel: normalizePlanLabel(resolvedPlan),
              paymentStatus: resolvedPayment,
              documents: mapDocs(clinic.submittedDocuments || {}, clinic.draftDocuments || {}),
              verificationStatus: clinic.verificationStatus || 'Not processed',
              verificationThreshold: clinic.verificationThreshold || null,
              verificationProcessedAt: clinic.verificationProcessedAt || null,
              verificationResults: mapVerificationResults(clinic.verificationResults),
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
      }, (snapshotError) => {
        console.error('Failed to listen to pending clinic registrations:', snapshotError)
        error.value = 'Failed to listen for clinic registration updates.'
        loading.value = false
      })
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

    const runClinicVerification = async () => {
      if (!selectedRecord.value) return

      const result = await systemAdminSwal.fire({
        title: 'Run Automatic Verification?',
        text: 'The clinic documents will be processed with OCR. Low-confidence results will remain for manual review.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Run verification',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : ''
        if (!token) throw new Error('Missing authorization token')
        const response = await fetchFromBackend('/admin/trigger-clinic-registration-verification', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: selectedRecord.value.id, applicantType: 'clinic' }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Automatic verification failed.')

        await systemAdminSwal.fire({
          title: 'Verification Complete',
          text: payload.data?.status === 'Automatically Verified'
            ? 'All clinic documents passed the automatic verification threshold.'
            : 'The documents require manual review because one or more confidence scores were below the threshold.',
          icon: payload.data?.status === 'Automatically Verified' ? 'success' : 'info',
          confirmButtonText: 'Continue',
        })
        closeModal()
        await loadPendingClinics()
      } catch (err) {
        console.error('Failed to run clinic document verification:', err)
        error.value = err?.message || 'Automatic verification failed. Please try again.'
      } finally {
        processing.value = false
      }
    }

    const approveSelected = async () => {
      if (!selectedRecord.value) return

      const result = await systemAdminSwal.fire({
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

        await systemAdminSwal.fire({
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
        await systemAdminSwal.fire({
          title: 'Remark Required',
          text: 'Please enter a rejection reason before rejecting this registration.',
          icon: 'warning',
        })
        return
        }

      const result = await systemAdminSwal.fire({
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

        await systemAdminSwal.fire({
          title: 'Rejected',
          text: payload.data?.emailSent
            ? 'Clinic registration was rejected, the account was removed, and an email with the reason and re-registration link was sent.'
            : 'Clinic registration was rejected and the account was removed. The email could not be sent, so contact the applicant manually.',
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
    onUnmounted(() => unsubscribeClinics?.())

    return {
      loading,
      processing,
      error,
      pendingClinics,
      verifiedClinics,
      isPendingRecord,
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
      runClinicVerification,
      formatDateValue,
      documentLabel,
      getOverallConfidence,
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

