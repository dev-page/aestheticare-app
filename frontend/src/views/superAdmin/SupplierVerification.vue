<template>
  <div class="flex module-theme min-h-screen bg-slate-900">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">Supplier Verification</h1>
          <p class="mt-2 text-slate-400">Review supplier business registrations before they are allowed into the procurement flow.</p>
        </div>

        <button
          type="button"
          class="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          :disabled="loading"
          @click="loadPendingSuppliers"
        >
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <p v-if="error" class="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        {{ error }}
      </p>

      <section class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        <div class="border-b border-slate-700 px-4 py-4">
          <h2 class="text-lg font-semibold text-white">Pending Supplier Registrations</h2>
          <p class="text-sm text-slate-400">Review supplier details and documents before approval.</p>
        </div>
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700 bg-slate-900/70">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Business Name</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Email</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Automatic Verification</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="px-4 py-4 text-slate-300">Loading pending supplier registrations...</td>
            </tr>
            <tr v-else-if="!pendingSuppliers.length">
              <td colspan="5" class="px-4 py-4 text-slate-300">No pending supplier registrations.</td>
            </tr>
            <tr v-for="row in pendingSuppliers" :key="row.id" class="border-b border-slate-700/60 last:border-b-0">
              <td class="px-4 py-3 text-slate-100">{{ row.businessName }}</td>
              <td class="px-4 py-3 text-slate-300">{{ row.email || '-' }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
                  {{ row.statusLabel }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded-md border px-2 py-1 text-xs font-medium"
                  :class="row.verificationStatus === 'Automatically Verified' ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border-amber-500/40 bg-amber-500/20 text-amber-300'"
                >
                  {{ row.verificationStatus || 'Not processed' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
                  @click="openDetails(row)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>

      <!-- Verified suppliers table below pending suppliers -->
      <section class="mt-6 overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        <div class="border-b border-slate-700 px-4 py-4">
          <h2 class="text-lg font-semibold text-white">Verified Suppliers</h2>
          <p class="text-slate-400 text-sm">Suppliers that have been approved and are active in the system.</p>
        </div>
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700 bg-slate-900/70">
            <tr>
              <th class="px-4 py-3 text-left text-slate-300">Business Name</th>
              <th class="px-4 py-3 text-left text-slate-300">Owner</th>
              <th class="px-4 py-3 text-left text-slate-300">Contact</th>
              <th class="px-4 py-3 text-left text-slate-300">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingVerifiedSuppliers">
              <td class="px-4 py-4 text-slate-300" colspan="4">Loading verified suppliers...</td>
            </tr>
            <tr v-else-if="!verifiedSuppliers.length">
              <td class="px-4 py-4 text-slate-300" colspan="4">No verified suppliers found.</td>
            </tr>
            <tr v-else v-for="s in verifiedSuppliers" :key="s.id" class="border-b border-slate-700/60 last:border-b-0">
              <td class="px-4 py-3 text-slate-100">{{ s.businessName }}</td>
              <td class="px-4 py-3 text-slate-300">{{ s.ownerName }}</td>
              <td class="px-4 py-3 text-slate-300">{{ s.contactNumber || '-' }}</td>
              <td class="px-4 py-3">
                <span class="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300">
                  {{ s.status || 'Active' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>
 
      <div class="mt-3 flex justify-center">
        <button v-if="hasMoreVerifiedSuppliers && !loadingVerifiedSuppliers" @click="loadMoreVerifiedSuppliers" class="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700">Load more</button>
        <div v-else-if="loadingVerifiedSuppliers" class="text-slate-400">Loading more...</div>
        <div v-else class="text-slate-500">No more items</div>
      </div>
 
      <div v-if="showModal && selectedRecord" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
        <div class="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div class="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white">Supplier Registration Details</h2>
              <p class="mt-1 text-sm text-slate-400">Review the business profile and submitted documents.</p>
            </div>
            <button type="button" class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white" @click="closeModal">Close</button>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Business Name</p>
              <p class="mt-2 text-white">{{ selectedRecord.businessName }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Owner Name</p>
              <p class="mt-2 text-white">{{ selectedRecord.fullName }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Email</p>
              <p class="mt-2 text-white">{{ selectedRecord.email || '-' }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Contact Number</p>
              <p class="mt-2 text-white">{{ selectedRecord.contactNumber || '-' }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-4 md:col-span-2">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Business Address</p>
              <p class="mt-2 text-white">{{ selectedRecord.businessAddress || '-' }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Business Type</p>
              <p class="mt-2 text-white">{{ selectedRecord.businessType || '-' }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800 p-4 md:col-span-2">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">TIN</p>
              <p class="mt-2 text-white">{{ formatTinDisplay(selectedRecord.taxRegistrationNumber) || '-' }}</p>
            </div>
          </div>

          <section class="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 class="font-semibold text-white">Automatic Verification and OCR</h3>
                <p class="text-xs text-slate-400">OCR checks document readability, supplier identity, and document completeness.</p>
              </div>
              <span
                class="rounded-md border px-2 py-1 text-xs font-medium"
                :class="selectedRecord.verificationStatus === 'Automatically Verified' ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border-amber-500/40 bg-amber-500/20 text-amber-200'"
              >
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
                <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${getOverallConfidence(selectedRecord.verificationResults)}%` }"></div>
              </div>
            </div>
            <div v-if="selectedRecord.verificationResults?.length" class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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
              v-if="selectedRecord.verificationStatus !== 'Automatically Verified'"
              type="button"
              class="mt-4 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="processing"
              @click="runSupplierVerification"
            >
              {{ processing ? 'Processing documents...' : 'Run OCR and automatic verification' }}
            </button>
          </section>

          <section class="mt-6">
            <h3 class="mb-3 text-lg font-semibold text-white">Submitted Documents</h3>
            <div class="grid gap-4 md:grid-cols-2">
              <article
                v-for="docItem in selectedRecord.documents"
                :key="docItem.key"
                class="rounded-xl border border-slate-700 bg-slate-800 p-4"
              >
                <p class="mb-3 text-sm text-slate-200">{{ docItem.label }}</p>
                <div v-if="docItem.url">
                  <img
                    v-if="docItem.isImage"
                    :src="docItem.url"
                    :alt="docItem.label"
                    class="mb-2 h-44 w-full rounded-lg border border-slate-700 object-cover"
                  />
                  <a :href="docItem.url" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-sky-300 underline">
                    Open document
                  </a>
                </div>
                <p v-else class="text-xs text-slate-500">No file uploaded.</p>
              </article>
            </div>
          </section>

          <section class="mt-6">
            <label class="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">Rejection Remark</label>
            <textarea
              v-model="rejectionRemark"
              rows="3"
              class="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-slate-500"
              placeholder="Explain why the registration is being rejected..."
            ></textarea>
          </section>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
              :disabled="processing"
              @click="approveSelected"
            >
              {{ processing ? 'Processing...' : 'Approve' }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-rose-600 px-4 py-2.5 font-semibold text-white transition hover:bg-rose-500"
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

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { getAuth } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { systemAdminSwal } from '@/utils/systemAdminAlert'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { formatTinDisplay, normalizeTinDigits } from '@/utils/supplierTin'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

const auth = getAuth()
const loading = ref(false)
const processing = ref(false)
const error = ref('')
const pendingSuppliers = ref([])
const showModal = ref(false)
const selectedRecord = ref(null)
const rejectionRemark = ref('')

const mapDocs = (submittedDocuments = {}, draftDocuments = {}) => {
  const docs = { ...(draftDocuments || {}), ...(submittedDocuments || {}) }
  const definitions = [
    { key: 'taxRegistration', label: 'Tax Registration Document' },
    { key: 'businessRegistration', label: 'Business Registration Document' },
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
  taxRegistration: 'Tax Registration Document',
  businessRegistration: 'Business Registration Document',
}[key] || key)

const getOverallConfidence = (results = []) => {
  const scores = results.map((result) => Number(result.confidence)).filter((score) => Number.isFinite(score))
  if (!scores.length) return null
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
}

const toBusinessName = (record = {}) => {
  return (
    String(record.businessName || '').trim() ||
    String(record.name || '').trim() ||
    'Unnamed Supplier'
  )
}

const loadPendingSuppliers = async () => {
  loading.value = true
  error.value = ''

  try {
    const snapshot = await getDocs(collection(db, 'supplierApplications'))
    const pending = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((supplier) => {
        const status = String(supplier.approvalStatus || supplier.status || '').trim().toLowerCase()
        return status.includes('pending') || status.includes('manual review')
      })

    const rows = await Promise.all(
      pending.map(async (application) => {
        const userSnap = await getDoc(doc(db, 'users', application.id))
        const userData = userSnap.exists() ? userSnap.data() : {}
        const fullName =
          String(userData.fullName || '').trim() ||
          `${String(userData.firstName || '').trim()} ${String(userData.lastName || '').trim()}`.trim() ||
          'Unnamed User'

        return {
          id: application.id,
          businessName: toBusinessName(application),
          fullName,
          email: application.email || userData.email || '',
          contactNumber: application.contactNumber || userData.contactNumber || '',
          businessAddress:
            application.businessAddress ||
            userData.address ||
            [
              application.businessAddressStreet,
              application.businessAddressBarangay,
              application.businessAddressCity,
              application.businessAddressProvince,
              application.businessAddressPostalCode,
            ]
              .map((part) => String(part || '').trim())
              .filter(Boolean)
              .join(', '),
          businessType: application.businessType || userData.businessType || '',
          taxRegistrationNumber: normalizeTinDigits(application.taxRegistrationNumber || application.tinNumber || ''),
          statusLabel: String(application.approvalStatus || application.status || 'Pending Approval'),
          documents: mapDocs(application.documents || {}, application.draftDocuments || {}),
          verificationStatus: application.verificationStatus || 'Not processed',
          verificationThreshold: application.verificationThreshold ?? null,
          verificationProcessedAt: application.verificationProcessedAt || null,
          verificationResults: mapVerificationResults(application.verificationResults),
          application,
          userData,
          createdAt: application.createdAt || userData.createdAt || null,
        }
      })
    )

    pendingSuppliers.value = sortRecordsNewestFirst(rows)
  } catch (err) {
    console.error('Failed to load supplier registrations:', err)
    error.value = 'Failed to load supplier verification list. Please try again.'
  } finally {
    loading.value = false
  }
}

// Load verified suppliers (to display below the pending registrations) with pagination
const verifiedSuppliers = ref([])
const loadingVerifiedSuppliers = ref(false)
const verifiedSuppliersPageSize = 20
const verifiedSuppliersLastDoc = ref(null)
const hasMoreVerifiedSuppliers = ref(true)

const loadVerifiedSuppliers = async (reset = false) => {
  if (reset) {
    verifiedSuppliers.value = []
    verifiedSuppliersLastDoc.value = null
    hasMoreVerifiedSuppliers.value = true
  }
  if (!hasMoreVerifiedSuppliers.value) return
  loadingVerifiedSuppliers.value = true
  try {
    // simple paged approach: fetch a page of suppliers ordered by createdAt (descending) and filter locally
    const q = query(collection(db, 'suppliers'))
    const snap = await getDocs(q)
    const docs = snap.docs
    let pageDocs = docs
    if (verifiedSuppliersLastDoc.value) {
      const idx = docs.findIndex((d) => d.id === verifiedSuppliersLastDoc.value)
      pageDocs = idx >= 0 ? docs.slice(idx + 1, idx + 1 + verifiedSuppliersPageSize) : docs.slice(0, verifiedSuppliersPageSize)
    } else {
      pageDocs = docs.slice(0, verifiedSuppliersPageSize)
    }

    const rows = pageDocs.map((d) => {
      const data = d.data() || {}
      const businessName = String(data.businessName || data.name || '').trim() || 'Unnamed Supplier'
      const ownerName = String(data.ownerName || data.fullName || '').trim() || ''
      return { id: d.id, businessName, ownerName, contactNumber: data.contactNumber || data.phone || '', status: data.status || 'Active' }
    })

    if (rows.length) {
      verifiedSuppliers.value = verifiedSuppliers.value.concat(sortRecordsNewestFirst(rows))
      verifiedSuppliersLastDoc.value = pageDocs[pageDocs.length - 1]?.id || verifiedSuppliersLastDoc.value
      if (pageDocs.length < verifiedSuppliersPageSize) hasMoreVerifiedSuppliers.value = false
    } else {
      hasMoreVerifiedSuppliers.value = false
    }
  } catch (e) {
    console.error('Failed to load verified suppliers', e)
    if (!verifiedSuppliers.value.length) verifiedSuppliers.value = []
  } finally {
    loadingVerifiedSuppliers.value = false
  }
}

const loadMoreVerifiedSuppliers = () => loadVerifiedSuppliers(false)

const fetchFromBackend = async (path, options = {}) => {
  let lastError = null
  for (const baseUrl of OTP_BACKEND_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, options)
      if (response.status === 404) {
        lastError = new Error(`Endpoint not found on ${baseUrl}`)
        continue
      }
      return response
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Unable to reach the verification backend.')
}

const buildAuthHeaders = async () => {
  const user = auth.currentUser
  if (!user) throw new Error('Missing administrator session.')
  return { 'content-type': 'application/json', Authorization: `Bearer ${await user.getIdToken(true)}` }
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

const runSupplierVerification = async () => {
  if (!selectedRecord.value) return

  const result = await systemAdminSwal.fire({
    title: 'Run Automatic Verification?',
    text: 'The supplier documents will be processed with OCR. Low-confidence results will remain for manual review.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Run verification',
    cancelButtonText: 'Cancel',
  })
  if (!result.isConfirmed) return

  processing.value = true
  try {
    const response = await fetchFromBackend('/admin/trigger-registration-verification', {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify({ uid: selectedRecord.value.id, applicantType: 'supplier' }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Automatic verification failed.')

    await systemAdminSwal.fire({
      title: 'Verification Complete',
      text: payload.data?.status === 'Automatically Verified'
        ? 'All supplier documents passed the automatic verification threshold.'
        : 'The documents require manual review because one or more confidence scores were below the threshold.',
      icon: payload.data?.status === 'Automatically Verified' ? 'success' : 'info',
      confirmButtonText: 'Continue',
    })
    closeModal()
    await loadPendingSuppliers()
  } catch (err) {
    console.error('Failed to run supplier document verification:', err)
    error.value = err?.message || 'Automatic verification failed. Please try again.'
  } finally {
    processing.value = false
  }
}

const approveSelected = async () => {
  if (!selectedRecord.value) return

  const result = await systemAdminSwal.fire({
    title: 'Approve Supplier?',
    text: `Approve ${selectedRecord.value.businessName} as a verified supplier?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, approve',
    cancelButtonText: 'Cancel',
  })

  if (!result.isConfirmed) return

  processing.value = true
  try {
    const reviewerId = auth.currentUser?.uid || null
    const response = await fetchFromBackend('/admin/supplier/approve', {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify({ uid: selectedRecord.value.id, reviewer: reviewerId }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to approve supplier registration.')

    await systemAdminSwal.fire({
      title: 'Approved',
      text: 'Supplier registration has been approved.',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
    })

    closeModal()
    await loadPendingSuppliers()
  } catch (err) {
    console.error('Failed to approve supplier registration:', err)
    error.value = 'Failed to approve supplier registration. Please try again.'
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
      text: 'Please enter a rejection reason before rejecting this supplier registration.',
      icon: 'warning',
    })
    return
  }

  const result = await systemAdminSwal.fire({
    title: 'Reject Supplier?',
    text: `Reject ${selectedRecord.value.businessName}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, reject',
    cancelButtonText: 'Cancel',
  })

  if (!result.isConfirmed) return

  processing.value = true
  try {
    const reviewerId = auth.currentUser?.uid || null
    const response = await fetchFromBackend('/admin/supplier/reject', {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify({ uid: selectedRecord.value.id, reviewer: reviewerId, reason: remark }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to reject supplier registration.')

    await systemAdminSwal.fire({
      title: 'Rejected',
      text: payload.data?.emailSent
        ? 'Supplier registration was rejected, deleted, and an email with the reason and re-registration link was sent.'
        : 'Supplier registration was rejected and deleted. The email could not be sent, so contact the applicant manually.',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
    })

    closeModal()
    await loadPendingSuppliers()
  } catch (err) {
    console.error('Failed to reject supplier registration:', err)
    error.value = 'Failed to reject supplier registration. Please try again.'
  } finally {
    processing.value = false
  }
}

let unsubscribeSupplierApplications = null
let unsubscribeSuppliers = null

onMounted(async () => {
  await Promise.all([loadPendingSuppliers(), loadVerifiedSuppliers()])
  unsubscribeSupplierApplications = onSnapshot(collection(db, 'supplierApplications'), () => loadPendingSuppliers(), (err) => {
    console.error('Failed to listen to supplier applications:', err)
  })
  unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), () => loadVerifiedSuppliers(true), (err) => {
    console.error('Failed to listen to verified suppliers:', err)
  })
})

onUnmounted(() => {
  unsubscribeSupplierApplications?.()
  unsubscribeSuppliers?.()
})
</script>
