<template>
  <div class="flex min-h-screen bg-slate-950">
    <SuperAdminSidebar />

    <main class="flex-1 p-6 md:p-8">
      <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">Supplier Verification</h1>
          <p class="mt-2 text-slate-400">Review supplier business registrations before they are allowed into the procurement flow.</p>
        </div>

        <button
          type="button"
          class="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          :disabled="loading"
          @click="loadPendingSuppliers"
        >
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <p v-if="error" class="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        {{ error }}
      </p>

      <section class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-800 bg-slate-900">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Business Name</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Email</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-300">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="px-4 py-4 text-slate-300">Loading pending supplier registrations...</td>
            </tr>
            <tr v-else-if="!pendingSuppliers.length">
              <td colspan="4" class="px-4 py-4 text-slate-300">No pending supplier registrations.</td>
            </tr>
            <tr v-for="row in pendingSuppliers" :key="row.id" class="border-b border-slate-800/70 last:border-b-0">
              <td class="px-4 py-3 text-slate-100">{{ row.businessName }}</td>
              <td class="px-4 py-3 text-slate-300">{{ row.email || '-' }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
                  {{ row.statusLabel }}
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
      </section>

      <div v-if="showModal && selectedRecord" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div class="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-6">
          <div class="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white">Supplier Registration Details</h2>
              <p class="mt-1 text-sm text-slate-400">Review the business profile and submitted documents.</p>
            </div>
            <button class="text-sm text-slate-300 hover:text-white" @click="closeModal">Close</button>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Business Name</p>
              <p class="mt-2 text-white">{{ selectedRecord.businessName }}</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Owner Name</p>
              <p class="mt-2 text-white">{{ selectedRecord.fullName }}</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Email</p>
              <p class="mt-2 text-white">{{ selectedRecord.email || '-' }}</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Contact Number</p>
              <p class="mt-2 text-white">{{ selectedRecord.contactNumber || '-' }}</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4 md:col-span-2">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Business Address</p>
              <p class="mt-2 text-white">{{ selectedRecord.businessAddress || '-' }}</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Business Type</p>
              <p class="mt-2 text-white">{{ selectedRecord.businessType || '-' }}</p>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4 md:col-span-2">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">TIN</p>
              <p class="mt-2 text-white">{{ formatTinDisplay(selectedRecord.taxRegistrationNumber) || '-' }}</p>
            </div>
          </div>

          <section class="mt-6">
            <h3 class="mb-3 text-lg font-semibold text-white">Submitted Documents</h3>
            <div class="grid gap-4 md:grid-cols-2">
              <article
                v-for="docItem in selectedRecord.documents"
                :key="docItem.key"
                class="rounded-2xl border border-slate-800 bg-slate-900 p-4"
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
              class="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-slate-500"
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
import { onMounted, ref } from 'vue'
import { getAuth } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { formatTinDisplay, normalizeTinDigits } from '@/utils/supplierTin'

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
        return status.includes('pending')
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
    const application = selectedRecord.value.application || {}
    const userData = selectedRecord.value.userData || {}

    const supplierPayload = {
      ownerId: selectedRecord.value.id,
      name: selectedRecord.value.businessName,
      businessName: selectedRecord.value.businessName,
      email: selectedRecord.value.email || '',
      contactNumber: selectedRecord.value.contactNumber || '',
      businessType: selectedRecord.value.businessType || application.businessType || userData.businessType || '',
      contact: selectedRecord.value.contactNumber || '',
      phone: selectedRecord.value.contactNumber || '',
      address: selectedRecord.value.businessAddress || '',
      businessAddress: selectedRecord.value.businessAddress || '',
      businessAddressStreet: application.businessAddressStreet || userData.addressStreet || '',
      businessAddressBarangay: application.businessAddressBarangay || userData.addressBarangay || '',
      businessAddressCity: application.businessAddressCity || userData.addressCity || '',
      businessAddressProvince: application.businessAddressProvince || userData.addressProvince || '',
      businessAddressPostalCode: application.businessAddressPostalCode || userData.addressPostalCode || '',
      businessAddressLat: application.businessAddressLat || userData.addressLat || '',
      businessAddressLng: application.businessAddressLng || userData.addressLng || '',
      businessType: selectedRecord.value.businessType || application.businessType || userData.businessType || '',
      taxRegistrationNumber: normalizeTinDigits(selectedRecord.value.taxRegistrationNumber || application.taxRegistrationNumber || userData.taxRegistrationNumber || ''),
      profilePicture: userData.profilePicture || application.profilePicture || '',
      approvalStatus: 'Approved',
      status: 'Active',
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
      createdAt: application.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      offeredItems: Array.isArray(application.offeredItems) ? application.offeredItems : [],
      documents: application.documents || {},
    }

    await Promise.all([
      updateDoc(doc(db, 'supplierApplications', selectedRecord.value.id), {
        approvalStatus: 'Approved',
        status: 'Active',
        approvedAt: serverTimestamp(),
        rejectedAt: null,
        rejectionReason: '',
        reviewedBy: reviewerId,
      }),
      updateDoc(doc(db, 'users', selectedRecord.value.id), {
        role: 'Supplier',
        userType: 'supplier',
        approvalStatus: 'Approved',
        status: 'Active',
        approvedAt: serverTimestamp(),
      }),
      setDoc(doc(db, 'suppliers', selectedRecord.value.id), supplierPayload, { merge: true }),
    ])

    await Swal.fire({
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
    await Swal.fire({
      title: 'Remark Required',
      text: 'Please enter a rejection reason before rejecting this supplier registration.',
      icon: 'warning',
    })
    return
  }

  const result = await Swal.fire({
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
    await Promise.all([
      updateDoc(doc(db, 'supplierApplications', selectedRecord.value.id), {
        approvalStatus: 'Rejected',
        status: 'Inactive',
        rejectionReason: remark,
        rejectedAt: serverTimestamp(),
        reviewedBy: reviewerId,
      }),
      updateDoc(doc(db, 'users', selectedRecord.value.id), {
        status: 'Inactive',
        approvalStatus: 'Rejected',
        rejectionReason: remark,
        rejectedAt: serverTimestamp(),
      }),
    ])

    await Swal.fire({
      title: 'Rejected',
      text: 'Supplier registration has been rejected.',
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

onMounted(loadPendingSuppliers)
</script>
