<template>
  <div :class="embedded ? 'directory directory-embedded module-theme supplier-theme' : 'directory module-theme supplier-theme flex min-h-screen'">
    <OwnerSidebar v-if="!embedded" />
    <main class="content" :class="{ 'flex-1': !embedded }">
      <header class="page-heading">
        <div>
          <small>SUPPLIER MANAGEMENT</small>
          <h1>Supplier Directory</h1>
          <p>Keep your clinic’s private supplier contacts and FDA LTO documents in one place.</p>
        </div>
        <button v-if="canCreate" class="primary-button" type="button" @click="openCreate">Add supplier</button>
      </header>

      <SupplyFlowGuide v-if="!embedded" department="procurement" page="suppliers" />

      <div v-if="error" class="feedback error" role="alert">
        <span>{{ error }}</span>
        <button v-if="pendingLtoUploads.length" type="button" class="retry-button" @click="retryPendingLtoCleanup">Retry LTO cleanup</button>
        <button v-if="loadFailed" type="button" class="retry-button" @click="load">Try again</button>
      </div>
      <div v-if="notice" class="feedback success" role="status">{{ notice }}</div>

      <section class="summary" aria-label="Supplier overview">
        <article><b>{{ associations.length }}</b><span>Clinic suppliers</span></article>
        <article><b>{{ activeCount }}</b><span>Active</span></article>
        <article><b>{{ reviewCount }}</b><span>Checks to review</span></article>
      </section>

      <section class="toolbar" aria-label="Find suppliers">
        <label class="search-field">Search suppliers
          <input v-model="search" type="search" placeholder="Business, contact, or category" />
        </label>
        <label class="status-field">Status
          <select v-model="status">
            <option value="">All statuses</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>For review</option>
          </select>
        </label>
      </section>

      <div v-if="loading" class="loading-state" role="status">Loading suppliers…</div>
      <section v-else-if="visible.length" class="grid" aria-label="Supplier contacts">
        <article v-for="supplier in visible" :key="supplier.key" class="card">
          <div class="card-heading">
            <div>
              <h2>{{ supplier.businessName }}</h2>
              <p>{{ supplier.category || 'Uncategorized supplier' }}</p>
            </div>
            <span class="status-pill" :class="statusClass(supplier.associationStatus)">{{ supplier.associationStatus }}</span>
          </div>

          <dl>
            <div><dt>Contact person</dt><dd>{{ supplier.contactPerson || 'Not recorded' }}</dd></div>
            <div><dt>Email</dt><dd>{{ supplier.email || 'Not recorded' }}</dd></div>
            <div><dt>Phone</dt><dd>{{ supplier.contactNumber || 'Not recorded' }}</dd></div>
            <div><dt>FDA LTO number</dt><dd>{{ supplier.regulatory?.ltoNumber || 'Not recorded' }}</dd></div>
            <div><dt>Document check</dt><dd>{{ ltoStatusLabel(supplier.regulatory?.ltoStatus) }}<small v-if="supplier.regulatory?.ltoExpiryDate"> · Expires {{ supplier.regulatory.ltoExpiryDate }}</small></dd></div>
            <div><dt>Name on FDA LTO</dt><dd>{{ supplier.regulatory?.ltoBusinessName || 'Not detected' }}</dd></div>
            <div><dt>Name match</dt><dd>{{ businessNameMatchLabel(supplierNameMatch(supplier)) }}</dd></div>
          </dl>

          <div class="card-actions">
            <button v-if="supplier.regulatory?.ltoDocument?.storagePath" type="button" class="secondary-button" @click="openLtoDocument(supplier)">View FDA LTO</button>
            <button v-if="canManage" type="button" class="secondary-button" @click="edit(supplier)">Edit supplier</button>
          </div>
        </article>
      </section>
      <section v-else class="empty-state">
        <h2>No supplier contacts found</h2>
        <p>Add supplier contacts that your clinic uses. These records are visible only within your clinic.</p>
        <button v-if="canCreate" type="button" class="primary-button" @click="openCreate">Add supplier</button>
      </section>

      <div v-if="showForm" class="overlay" @click.self="close">
        <form class="modal" @submit.prevent="save" :aria-busy="saving">
          <header class="modal-heading">
            <div>
              <small>{{ editing ? 'SUPPLIER DETAILS' : 'SUPPLIER SETUP' }}</small>
              <h2>{{ editing ? (editing.canEditBusiness ? 'Edit supplier' : 'Edit clinic relationship') : 'Add supplier' }}</h2>
            </div>
            <button class="close-button" type="button" aria-label="Close" :disabled="saving || ltoUploadBusy" @click="close">×</button>
          </header>

          <p v-if="!editing" class="modal-intro">Add the contact details you use to request and compare supply quotes.</p>
          <div class="form-grid">
            <label>Business name <span aria-hidden="true">*</span>
              <input v-model.trim="form.businessName" required :disabled="editing && !editing.canEditBusiness" autocomplete="organization" />
            </label>
            <CategorySelectField id="supplier-category" label="Category" v-model="form.category" :options="supplierCategoryOptions" :disabled="editing && !editing.canEditBusiness" />
            <label>Contact person
              <input v-model.trim="form.contactPerson" :disabled="editing && !editing.canEditBusiness" autocomplete="name" />
            </label>
            <label>Email
              <input v-model.trim="form.email" type="email" :disabled="editing && !editing.canEditBusiness" autocomplete="email" />
            </label>
            <label>Contact number
              <input v-model.trim="form.contactNumber" :disabled="editing && !editing.canEditBusiness" autocomplete="tel" />
            </label>
            <label>Address
              <input v-model.trim="form.address" :disabled="editing && !editing.canEditBusiness" autocomplete="street-address" />
            </label>
            <label>Relationship status
              <select v-model="form.associationStatus">
                <option>Active</option>
                <option>Inactive</option>
                <option>For review</option>
              </select>
            </label>
          </div>

          <section class="lto-panel" aria-labelledby="lto-heading">
            <div class="lto-heading">
              <div>
                <h3 id="lto-heading">FDA LTO document</h3>
                <p>Upload a clear PDF or image. OCR will read the LTO number and check for a printed expiry date.</p>
              </div>
              <span class="lto-status" :class="`lto-${form.ltoStatus}`">{{ ltoStatusLabel(form.ltoStatus) }}</span>
            </div>
            <label class="file-field">Upload document
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" :disabled="ltoUploadBusy || (editing && !editing.canEditBusiness)" @change="onLtoFileChange" />
              <small>PDF, JPG, PNG, or WEBP · Up to 10 MB</small>
            </label>
            <div v-if="form.ltoDocument" class="lto-file-row">
              <span>{{ form.ltoDocument.name || 'FDA LTO document uploaded' }}</span>
              <button v-if="editing?.supplierId" type="button" class="text-button" @click="openLtoDocument(editing)">Open document</button>
            </div>
            <div class="form-grid lto-fields">
              <label>FDA LTO number
                <input v-model.trim="form.ltoNumber" autocomplete="off" placeholder="Filled from OCR when detected" :disabled="editing && !editing.canEditBusiness" />
              </label>
              <label>Expiry date detected
                <input :value="form.ltoExpiryDate" type="date" readonly aria-readonly="true" />
              </label>
            </div>
            <div v-if="form.ltoDocument" class="lto-name-check" :class="`lto-name-${formBusinessNameMatch}`" role="status">
              <strong>Business name on FDA LTO</strong>
              <span>{{ form.ltoBusinessName || 'Not detected by OCR' }}</span>
              <small>{{ businessNameMatchLabel(formBusinessNameMatch) }}</small>
            </div>
            <p v-if="businessNameMismatch" class="lto-message lto-message-mismatch" role="alert">
              The supplier business name does not match the FDA LTO. Update the supplier name or upload the correct document before saving.
            </p>
            <p v-else-if="form.ltoDocument && formBusinessNameMatch === 'unverified'" class="lto-message lto-message-needs_review" role="status">
              OCR could not read the business name. Review the original document manually.
            </p>
            <label
              v-if="form.ltoDocument && ['unverified', 'manually_confirmed'].includes(formBusinessNameMatch) && (!editing || editing.canEditBusiness)"
              class="manual-name-confirmation"
            >
              <input type="checkbox" :checked="manualNameConfirmationCurrent" @change="setManualNameConfirmation($event.target.checked)" />
              <span>I reviewed this FDA LTO and confirm its business name matches the supplier name above.</span>
            </label>
            <p v-if="businessNameSaveBlocked && formBusinessNameMatch === 'unverified'" class="lto-message lto-message-needs_review" role="alert">
              Confirm the name against the original document before saving.
            </p>
            <p v-if="form.ltoOcrReason" class="lto-message" :class="`lto-message-${form.ltoStatus}`" role="status">{{ form.ltoOcrReason }}</p>
            <p v-if="ltoUploadBusy" class="lto-progress" role="status"><span class="button-spinner" aria-hidden="true"></span> Uploading and reading the document…</p>
            <details v-if="form.ltoExtractedText" class="ocr-text">
              <summary>View extracted text</summary>
              <pre>{{ form.ltoExtractedText }}</pre>
            </details>
          </section>

          <footer>
            <button type="button" class="secondary-button" :disabled="saving || ltoUploadBusy" @click="close">Cancel</button>
            <button type="submit" class="primary-button" :disabled="saving || ltoUploadBusy || businessNameSaveBlocked">
              <span v-if="saving || ltoUploadBusy" class="button-spinner" aria-hidden="true"></span>
              {{ ltoUploadBusy ? 'Reading document…' : saving ? 'Saving…' : editing ? 'Save changes' : 'Save supplier' }}
            </button>
          </footer>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ref as storageRef, uploadBytes } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import SupplyFlowGuide from '@/components/common/SupplyFlowGuide.vue'
import CategorySelectField from '@/components/common/CategorySelectField.vue'
import { supplyCategoryOptions as buildSupplyCategoryOptions } from '@/utils/supplyCategories'
import { auth, db, storage } from '@/config/firebaseConfig'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { usePermissions } from '@/composables/usePermissions'

defineProps({ embedded: { type: Boolean, default: false } })

const { hasPermission, isClinicAdminOwner } = usePermissions()
const loading = ref(true)
const saving = ref(false)
const ltoUploadBusy = ref(false)
const loadFailed = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const status = ref('')
const showForm = ref(false)
const editing = ref(null)
const associations = ref([])
const draftSupplierId = ref('')
const ltoPreviewUrl = ref('')
const pendingLtoUploads = ref([])
const manualNameConfirmation = ref(null)
const scope = ref({ branchId: '', ownerId: '' })

const blank = () => ({
  businessName: '', category: '', contactPerson: '', email: '', contactNumber: '', address: '',
  associationStatus: 'Active', ltoNumber: '', ltoDocument: null, ltoExpiryDate: '',
  ltoBusinessName: '', ltoStatus: 'not_uploaded', ltoOcrReason: '', ltoExtractedText: '', ltoOcrProcessedAt: '',
})
const form = ref(blank())

const api = async (path, options = {}) => {
  await auth.authStateReady?.()
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in to view supplier records.')
  let lastError
  for (const base of OTP_BACKEND_CANDIDATES) {
    let response
    try {
      const headers = { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
      response = await fetch(`${base}/supply${path}`, {
        ...options,
        headers,
        ...(options.body && typeof options.body !== 'string' ? { body: JSON.stringify(options.body) } : {}),
      })
    } catch (cause) {
      lastError = cause
      continue
    }
    let json = {}
    try { json = await response.json() } catch { json = {} }
    if (!response.ok || json.success === false) {
      const failure = new Error(json.error || 'Unable to load supplier records.')
      if (response.status >= 500) { lastError = failure; continue }
      throw failure
    }
    return json.data
  }
  throw lastError || new Error('The supplier service is temporarily unavailable.')
}

const canCreate = computed(() => isClinicAdminOwner.value || hasPermission('suppliers:create'))
const canManage = computed(() => isClinicAdminOwner.value || hasPermission('suppliers:update'))
const activeCount = computed(() => associations.value.filter(item => item.associationStatus === 'Active').length)
const reviewCount = computed(() => associations.value.filter(item => ['needs_review', 'expired'].includes(item.regulatory?.ltoStatus)
  || ['mismatch', 'unverified'].includes(supplierNameMatch(item))).length)
const visible = computed(() => {
  const seen = new Set()
  return associations.value.filter(supplier => {
    const id = supplier.supplierId || supplier.id
    if (seen.has(id)) return false
    seen.add(id)
    const text = [supplier.businessName, supplier.contactPerson, supplier.email, supplier.category].join(' ').toLowerCase()
    return (!search.value || text.includes(search.value.toLowerCase()))
      && (!status.value || supplier.associationStatus === status.value)
  })
})
const supplierCategoryOptions = computed(() => buildSupplyCategoryOptions([
  ...associations.value.map(supplier => supplier.category),
  form.value.category,
]))

const ltoStatusLabel = value => {
  if (!value || value === 'not_uploaded') return 'Not uploaded'
  return ({
    not_expired: 'Not expired · OCR', expired: 'Expired · OCR', needs_review: 'Needs manual review',
  }[value] || 'Needs manual review')
}
const normalizeBusinessName = value => String(value || '')
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .replace(/&/g, ' and ')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')
const getBusinessNameMatch = (supplierName, documentName, hasDocument) => {
  if (!hasDocument || !documentName) return hasDocument ? 'unverified' : 'not_checked'
  const supplier = normalizeBusinessName(supplierName)
  const document = normalizeBusinessName(documentName)
  return supplier && supplier === document ? 'matched' : 'mismatch'
}
const supplierNameMatch = supplier => getBusinessNameMatch(
  supplier.businessName,
  supplier.regulatory?.ltoBusinessName,
  Boolean(supplier.regulatory?.ltoDocument?.storagePath),
) === 'unverified'
  && isBusinessNameConfirmationCurrent(
    supplier.businessName,
    supplier.regulatory?.ltoDocument?.storagePath,
    supplier.regulatory?.ltoBusinessNameManualConfirmation,
  )
  ? 'manually_confirmed'
  : getBusinessNameMatch(supplier.businessName, supplier.regulatory?.ltoBusinessName, Boolean(supplier.regulatory?.ltoDocument?.storagePath))
const isBusinessNameConfirmationCurrent = (businessName, storagePath, confirmation) => Boolean(
  confirmation?.confirmed === true
  && normalizeBusinessName(confirmation.businessName) === normalizeBusinessName(businessName)
  && confirmation.storagePath === storagePath,
)
const manualNameConfirmationCurrent = computed(() => isBusinessNameConfirmationCurrent(
  form.value.businessName,
  form.value.ltoDocument?.storagePath,
  manualNameConfirmation.value,
))
const formBusinessNameMatch = computed(() => {
  const match = getBusinessNameMatch(form.value.businessName, form.value.ltoBusinessName, Boolean(form.value.ltoDocument?.storagePath))
  return match === 'unverified' && manualNameConfirmationCurrent.value ? 'manually_confirmed' : match
})
const businessNameMismatch = computed(() => (!editing.value || editing.value.canEditBusiness)
  && formBusinessNameMatch.value === 'mismatch')
const businessNameSaveBlocked = computed(() => {
  if (businessNameMismatch.value) return true
  const canEditSupplier = !editing.value || editing.value.canEditBusiness
  return canEditSupplier && formBusinessNameMatch.value === 'unverified' && Boolean(form.value.ltoDocument?.storagePath)
})
const businessNameMatchLabel = value => ({
  matched: 'Matches document', mismatch: 'Does not match document',
  manually_confirmed: 'Manually confirmed against document', unverified: 'Not verified', not_checked: 'Not checked',
}[value] || 'Not verified')
const statusClass = value => ({ Active: 'is-active', Inactive: 'is-inactive', 'For review': 'is-review' }[value] || 'is-review')
const errorMessage = error => {
  if (['permission-denied', 'storage/unauthorized'].includes(error?.code)) return 'Your account does not have access to this clinic supplier record or document.'
  if (error?.code === 'unavailable' || /503|unavailable|network/i.test(error?.message || '')) return 'The supplier service is temporarily unavailable. Try again in a moment.'
  return error?.message || 'Unable to complete this supplier action.'
}
const view = (supplier, link = {}) => ({
  ...supplier,
  supplierId: supplier.id,
  key: link.id || supplier.id,
  associationId: link.id || '',
  associationStatus: link.status || 'Active',
  regulatory: supplier.regulatory || {},
  canEditBusiness: supplier.createdForClinicId === scope.value.ownerId,
})

async function load() {
  if (!scope.value.branchId) {
    loading.value = false
    error.value = 'No clinic branch is assigned to this account.'
    loadFailed.value = true
    return
  }
  loading.value = true
  error.value = ''
  loadFailed.value = false
  try {
    const workspace = await api(`/workspace?branchId=${encodeURIComponent(scope.value.branchId)}`)
    associations.value = (workspace.suppliers || []).filter(supplier => supplier.clinicSupplierId).map(supplier => view(supplier, {
      id: supplier.clinicSupplierId,
      status: supplier.associationStatus,
    }))
  } catch (cause) {
    error.value = errorMessage(cause)
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  manualNameConfirmation.value = null
  draftSupplierId.value = doc(collection(db, 'suppliers')).id
  form.value = blank()
  error.value = ''
  showForm.value = true
}

function edit(supplier) {
  editing.value = supplier
  manualNameConfirmation.value = supplier.regulatory?.ltoBusinessNameManualConfirmation || null
  form.value = {
    ...blank(),
    businessName: supplier.businessName || '',
    category: supplier.category || '',
    contactPerson: supplier.contactPerson || '',
    email: supplier.email || '',
    contactNumber: supplier.contactNumber || '',
    address: supplier.address || '',
    associationStatus: supplier.associationStatus || 'Active',
    ltoNumber: supplier.regulatory?.ltoNumber || '',
    ltoDocument: supplier.regulatory?.ltoDocument || null,
    ltoExpiryDate: supplier.regulatory?.ltoExpiryDate || '',
    ltoBusinessName: supplier.regulatory?.ltoBusinessName || '',
    ltoStatus: supplier.regulatory?.ltoStatus || (supplier.regulatory?.ltoNumber ? 'needs_review' : 'not_uploaded'),
    ltoOcrReason: supplier.regulatory?.ltoOcrReason || '',
    ltoOcrProcessedAt: supplier.regulatory?.ltoOcrProcessedAt || '',
  }
  error.value = ''
  showForm.value = true
}

async function cleanupLtoUpload(upload) {
  await api('/suppliers/lto-document-cleanup', {
    method: 'POST',
    body: { branchId: scope.value.branchId, supplierId: upload.supplierId, storagePath: upload.storagePath },
  })
}

async function retryPendingLtoCleanup() {
  const uploads = [...pendingLtoUploads.value]
  const results = await Promise.allSettled(uploads.map(cleanupLtoUpload))
  pendingLtoUploads.value = uploads.filter((_, index) => results[index].status === 'rejected')
  if (pendingLtoUploads.value.length) {
    error.value = 'An unlinked LTO upload could not be removed. Please retry or contact support.'
  } else {
    error.value = ''
  }
}

async function close({ preservePath = '', afterSave = false } = {}) {
  if (ltoUploadBusy.value || (saving.value && !afterSave)) return
  const uploadsToClean = pendingLtoUploads.value.filter(upload => upload.storagePath !== preservePath)
  pendingLtoUploads.value = []
  showForm.value = false
  editing.value = null
  draftSupplierId.value = ''
  if (ltoPreviewUrl.value) URL.revokeObjectURL(ltoPreviewUrl.value)
  ltoPreviewUrl.value = ''
  const cleanupResults = await Promise.allSettled(uploadsToClean.map(cleanupLtoUpload))
  pendingLtoUploads.value = uploadsToClean.filter((_, index) => cleanupResults[index].status === 'rejected')
  if (pendingLtoUploads.value.length) {
    error.value = 'An unlinked LTO upload could not be removed. Please retry or contact support.'
  }
}

async function onLtoFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(String(file.type || '').toLowerCase())) {
    error.value = 'Choose an FDA LTO document in PDF, JPG, PNG, or WEBP format.'
    return
  }
  if (!file.size || file.size > 10 * 1024 * 1024) {
    error.value = 'The FDA LTO document must be 10 MB or smaller.'
    return
  }
  const userId = auth.currentUser?.uid
  const ownerId = String(scope.value.ownerId || '')
  const supplierId = String(editing.value?.supplierId || draftSupplierId.value || '')
  if (!userId || !ownerId || !scope.value.branchId || !supplierId) {
    error.value = 'Clinic details are not ready. Reopen the supplier form and try again.'
    return
  }

  error.value = ''
  notice.value = ''
  manualNameConfirmation.value = null
  ltoUploadBusy.value = true
  let uploadCompleted = false
  const previousDocumentPath = form.value.ltoDocument?.storagePath || ''
  try {
    const extension = ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.type.toLowerCase()]
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}.${extension}`
    const storagePath = `supplier-fda-documents/${ownerId}/${supplierId}/${fileName}`
    await uploadBytes(storageRef(storage, storagePath), file, {
      contentType: file.type.toLowerCase(),
      customMetadata: { uploadedBy: userId },
    })
    uploadCompleted = true
    pendingLtoUploads.value.push({ supplierId, storagePath })
    form.value.ltoNumber = ''
    form.value.ltoExpiryDate = ''
    form.value.ltoBusinessName = ''
    form.value.ltoExtractedText = ''
    form.value.ltoOcrProcessedAt = ''
    form.value.ltoStatus = 'needs_review'
    form.value.ltoOcrReason = 'Document uploaded. Reading the LTO number and expiry date…'
    if (ltoPreviewUrl.value) URL.revokeObjectURL(ltoPreviewUrl.value)
    ltoPreviewUrl.value = URL.createObjectURL(file)
    form.value.ltoDocument = {
      storagePath, name: String(file.name || 'FDA LTO document').slice(0, 200),
      contentType: file.type.toLowerCase(), size: file.size,
      uploadedAt: new Date().toISOString(),
    }
    const result = await api('/suppliers/ocr', {
      method: 'POST',
      body: { branchId: scope.value.branchId, supplierId, storagePath },
    })
    form.value.ltoNumber = String(result?.ltoNumber || '')
    form.value.ltoExpiryDate = String(result?.expiryDate || '')
    form.value.ltoBusinessName = String(result?.businessName || '')
    form.value.ltoStatus = result?.status || 'needs_review'
    form.value.ltoOcrReason = String(result?.reason || 'OCR completed. Review the original document before relying on these details.')
    form.value.ltoExtractedText = String(result?.extractedText || '')
    form.value.ltoOcrProcessedAt = new Date().toISOString()
    if (previousDocumentPath && previousDocumentPath !== storagePath) {
      const previousPendingUpload = pendingLtoUploads.value.find(upload => upload.storagePath === previousDocumentPath)
      if (previousPendingUpload) {
        pendingLtoUploads.value = pendingLtoUploads.value.filter(upload => upload.storagePath !== previousDocumentPath)
        await cleanupLtoUpload(previousPendingUpload).catch(() => {
          pendingLtoUploads.value.push(previousPendingUpload)
        })
      }
    }
  } catch (cause) {
    if (uploadCompleted) {
      form.value.ltoStatus = 'needs_review'
      form.value.ltoOcrReason = `The document was uploaded, but OCR could not complete. Review it manually. ${errorMessage(cause)}`
      form.value.ltoOcrProcessedAt = ''
    } else {
      error.value = errorMessage(cause)
    }
  } finally {
    ltoUploadBusy.value = false
  }
}

function setManualNameConfirmation(confirmed) {
  manualNameConfirmation.value = confirmed
    ? {
        confirmed: true,
        businessName: String(form.value.businessName || '').trim().slice(0, 200),
        storagePath: String(form.value.ltoDocument?.storagePath || ''),
        confirmedAt: new Date().toISOString(),
        confirmedBy: auth.currentUser?.uid || '',
      }
    : null
}

async function openLtoDocument(supplier) {
  if (ltoPreviewUrl.value && (!supplier?.supplierId || supplier.supplierId === draftSupplierId.value || supplier.supplierId === editing.value?.supplierId)) {
    const previewTab = window.open(ltoPreviewUrl.value, '_blank')
    if (previewTab) previewTab.opener = null
    return
  }
  if (!supplier?.supplierId || !scope.value.branchId) return
  const tab = window.open('about:blank', '_blank')
  if (tab) tab.opener = null
  try {
    const result = await api(`/suppliers/${encodeURIComponent(supplier.supplierId)}/lto-document-url?branchId=${encodeURIComponent(scope.value.branchId)}`)
    if (tab) tab.location.replace(result.url)
    else window.location.assign(result.url)
  } catch (cause) {
    tab?.close()
    error.value = errorMessage(cause)
  }
}

async function save() {
  if (!scope.value.branchId || saving.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Sign in to save supplier details.')
    if (businessNameSaveBlocked.value) {
      throw new Error(businessNameMismatch.value
        ? 'The supplier business name must match the name read from the FDA LTO document.'
        : 'Review the FDA LTO and confirm its business name before saving.')
    }
    const batch = writeBatch(db)
    const regulatory = {
      ltoNumber: String(form.value.ltoNumber || '').trim().slice(0, 100),
      ltoDocument: form.value.ltoDocument || null,
      ltoExpiryDate: form.value.ltoExpiryDate || null,
      ltoBusinessName: String(form.value.ltoBusinessName || '').trim().slice(0, 200),
      ltoBusinessNameManualConfirmation: manualNameConfirmationCurrent.value ? manualNameConfirmation.value : null,
      ltoStatus: form.value.ltoStatus || 'not_uploaded',
      ltoOcrReason: String(form.value.ltoOcrReason || '').slice(0, 500),
      ltoOcrProcessedAt: form.value.ltoOcrProcessedAt || null,
    }
    if (editing.value) {
      if (editing.value.canEditBusiness) {
        batch.update(doc(db, 'suppliers', editing.value.supplierId), {
          businessName: form.value.businessName,
          category: form.value.category,
          contactPerson: form.value.contactPerson,
          email: form.value.email,
          contactNumber: form.value.contactNumber,
          address: form.value.address,
          sharedDirectory: false,
          regulatory,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        })
      }
      batch.update(doc(db, 'clinicSuppliers', editing.value.associationId), {
        status: form.value.associationStatus,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
    } else {
      const normalize = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
      const businessName = normalize(form.value.businessName)
      const email = normalize(form.value.email)
      const phone = normalize(form.value.contactNumber)
      const duplicate = associations.value.find(item => {
        if (normalize(item.businessName) !== businessName) return false
        if (!email && !phone) return true
        return (email && normalize(item.email) === email) || (phone && normalize(item.contactNumber) === phone)
      })
      if (duplicate) throw new Error(`A matching supplier contact (${duplicate.businessName}) is already associated with this clinic.`)

      const supplierRef = doc(db, 'suppliers', draftSupplierId.value || doc(collection(db, 'suppliers')).id)
      const associationRef = doc(collection(db, 'clinicSuppliers'))
      batch.set(supplierRef, {
        businessName: form.value.businessName,
        category: form.value.category,
        contactPerson: form.value.contactPerson,
        email: form.value.email,
        contactNumber: form.value.contactNumber,
        address: form.value.address,
        sharedDirectory: false,
        createdForClinicId: scope.value.ownerId,
        regulatory,
        status: 'Active',
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      batch.set(associationRef, {
        clinicId: scope.value.ownerId,
        branchId: scope.value.branchId,
        supplierId: supplierRef.id,
        status: form.value.associationStatus,
        internalNotes: '',
        associatedAt: serverTimestamp(),
        createdBy: userId,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    const newDocumentPath = form.value.ltoDocument?.storagePath || ''
    const oldDocumentPath = editing.value?.regulatory?.ltoDocument?.storagePath || ''
    if (oldDocumentPath && oldDocumentPath !== newDocumentPath) {
      const oldUpload = { supplierId: editing.value.supplierId, storagePath: oldDocumentPath }
      await cleanupLtoUpload(oldUpload).catch(() => pendingLtoUploads.value.push(oldUpload))
    }
    notice.value = editing.value ? 'Supplier changes saved.' : 'Supplier saved and added to this clinic.'
    await close({ preservePath: newDocumentPath, afterSave: true })
    await load()
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}

onMounted(() => onAuthStateChanged(auth, async user => {
  if (!user) {
    loading.value = false
    error.value = 'Sign in to view suppliers.'
    loadFailed.value = true
    return
  }
  try {
    scope.value = await loadOwnerBranchScope(db, user.uid)
    await load()
  } catch (cause) {
    loading.value = false
    loadFailed.value = true
    error.value = errorMessage(cause)
  }
}))
</script>

<style scoped>
.directory { background: var(--ac-bg); color: var(--ac-text); }
.directory:not(.directory-embedded) { min-height: 100vh; }
.content { min-width: 0; padding: clamp(1rem, 3vw, 2.5rem); }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.25rem; margin-bottom: 1.1rem; }
.page-heading small, .modal-heading small { color: var(--ac-text-muted); font-size: .68rem; font-weight: 800; letter-spacing: .14em; }
.page-heading h1 { margin: .2rem 0; color: var(--ac-text); font: 700 clamp(1.8rem, 3vw, 2.45rem) var(--ac-font-display); }
.page-heading p { max-width: 42rem; margin: .25rem 0 0; color: var(--ac-text-muted); }
button { min-height: 2.65rem; border: 1px solid var(--ac-border-strong); border-radius: .65rem; padding: .65rem .9rem; color: var(--ac-text); background: var(--ac-surface); font-weight: 700; cursor: pointer; }
button:disabled { opacity: .58; cursor: wait; }
.primary-button { border-color: var(--ac-primary); background: var(--ac-primary); color: var(--ac-on-primary); }
.primary-button:hover:not(:disabled) { background: var(--ac-primary-hover); }
.secondary-button { background: var(--ac-surface); color: var(--ac-text-secondary); }
.summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin: 0 0 .9rem; }
.summary article { display: flex; align-items: baseline; gap: .55rem; min-width: 0; border: 1px solid var(--ac-border); border-radius: .85rem; background: var(--ac-surface); padding: .8rem 1rem; }
.summary b { color: var(--ac-text); font-size: 1.25rem; }
.summary span { color: var(--ac-text-muted); font-size: .82rem; }
.toolbar { display: grid; grid-template-columns: minmax(14rem, 1fr) minmax(9rem, 12rem); align-items: end; gap: .75rem; border: 1px solid var(--ac-border); border-radius: .9rem; background: var(--ac-surface); padding: .9rem; }
.toolbar label, .form-grid > label { display: grid; gap: .32rem; color: var(--ac-text-secondary); font-size: .78rem; font-weight: 700; }
.toolbar input:not([type="checkbox"]), .toolbar select, .form-grid input:not([type="checkbox"]), .form-grid select, .form-grid textarea { width: 100%; min-width: 0; min-height: 2.8rem; box-sizing: border-box; border: 1px solid var(--ac-border-strong); border-radius: .6rem; padding: .65rem .75rem; color: var(--ac-text); background: var(--ac-surface); }
.toolbar input::placeholder, .form-grid input::placeholder, .form-grid textarea::placeholder { color: var(--ac-text-muted); }
.feedback { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .75rem; border-radius: .7rem; padding: .75rem .9rem; font-size: .88rem; }
.error { border: 1px solid var(--ac-danger); background: var(--ac-danger-bg); color: var(--ac-danger); }
.success { border: 1px solid var(--ac-success); background: var(--ac-success-bg); color: var(--ac-success); }
.retry-button { min-height: 2rem; padding: .35rem .65rem; border-color: currentColor; color: inherit; background: transparent; }
.loading-state, .empty-state { margin-top: .9rem; border: 1px solid var(--ac-border); border-radius: .9rem; background: var(--ac-surface); padding: 1.4rem; color: var(--ac-text-muted); }
.empty-state { text-align: center; }
.empty-state h2 { margin: 0; color: var(--ac-text); font: 700 1.2rem var(--ac-font-display); }
.empty-state p { margin: .35rem 0 1rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr)); gap: .85rem; margin-top: .9rem; }
.card { min-width: 0; border: 1px solid var(--ac-border); border-radius: .9rem; background: var(--ac-surface); padding: 1rem; box-shadow: var(--ac-shadow-sm); }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .7rem; }
.card h2 { overflow-wrap: anywhere; margin: 0; color: var(--ac-text); font-size: 1.05rem; }
.card-heading p { margin: .2rem 0 0; color: var(--ac-text-muted); font-size: .82rem; }
.status-pill { flex: 0 0 auto; border-radius: 999px; padding: .22rem .55rem; font-size: .68rem; font-weight: 800; }
.is-active { background: var(--ac-success-bg); color: var(--ac-success); }
.is-inactive { background: var(--ac-surface-muted); color: var(--ac-text-muted); }
.is-review { background: var(--ac-warning-bg); color: var(--ac-warning); }
.card dl { display: grid; gap: .45rem; margin: .9rem 0 0; }
.card dl div { display: grid; grid-template-columns: minmax(6.5rem, .7fr) minmax(0, 1.3fr); gap: .5rem; font-size: .8rem; }
.card dt { color: var(--ac-text-muted); }
.card dd { min-width: 0; margin: 0; overflow-wrap: anywhere; color: var(--ac-text-secondary); }
.card dd small { display: block; margin-top: .15rem; color: var(--ac-text-muted); font-size: .72rem; }
.card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-top: .9rem; border-top: 1px solid var(--ac-border); padding-top: .75rem; }
.card-actions button { min-height: 2.35rem; padding: .5rem .7rem; font-size: .78rem; }
.overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; overflow-y: auto; padding: 1rem; background: rgb(24 15 10 / .64); backdrop-filter: blur(3px); }
.modal { width: min(100%, 46rem); max-height: min(92vh, 54rem); overflow-y: auto; border: 1px solid var(--ac-border); border-radius: 1rem; padding: clamp(1rem, 2.4vw, 1.5rem); color: var(--ac-text); background: var(--ac-surface); box-shadow: var(--ac-shadow-lg); }
.modal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--ac-border); padding-bottom: .8rem; }
.modal-heading h2 { margin: .15rem 0 0; color: var(--ac-text); font: 700 1.5rem var(--ac-font-display); }
.close-button { display: grid; width: 2.3rem; min-height: 2.3rem; place-items: center; padding: 0; font-size: 1.3rem; }
.modal-intro { margin: .8rem 0; color: var(--ac-text-muted); font-size: .86rem; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; margin-top: .8rem; }
.form-grid > label > span { color: var(--ac-danger); }
.form-grid :is(input, select, textarea):disabled { opacity: .72; background: var(--ac-surface-muted); cursor: not-allowed; }
.form-grid textarea { resize: vertical; }
.full-width { grid-column: 1 / -1; }
.lto-panel { display: grid; gap: .75rem; margin-top: .9rem; border: 1px solid var(--ac-border); border-radius: .85rem; background: var(--ac-surface-soft); padding: .9rem; }
.lto-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
.lto-heading h3 { margin: 0; color: var(--ac-text); font: 700 1.05rem var(--ac-font-display); }
.lto-heading p { margin: .2rem 0 0; color: var(--ac-text-muted); font-size: .78rem; }
.lto-status { flex: 0 0 auto; max-width: 12rem; border-radius: 999px; padding: .28rem .6rem; text-align: center; font-size: .68rem; font-weight: 800; }
.lto-not_uploaded { background: var(--ac-surface-muted); color: var(--ac-text-muted); }
.lto-not_expired { background: var(--ac-success-bg); color: var(--ac-success); }
.lto-expired { background: var(--ac-danger-bg); color: var(--ac-danger); }
.lto-needs_review { background: var(--ac-warning-bg); color: var(--ac-warning); }
.file-field { display: grid; gap: .35rem; color: var(--ac-text-secondary); font-size: .78rem; font-weight: 700; }
.file-field input { width: 100%; min-width: 0; box-sizing: border-box; border: 1px dashed var(--ac-border-strong); border-radius: .6rem; padding: .65rem; color: var(--ac-text-secondary); background: var(--ac-surface); }
.file-field small { color: var(--ac-text-muted); font-size: .72rem; font-weight: 400; }
.lto-file-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; border: 1px solid var(--ac-border); border-radius: .6rem; padding: .55rem .7rem; color: var(--ac-text-secondary); font-size: .78rem; overflow-wrap: anywhere; }
.text-button { min-height: 2rem; padding: .35rem .55rem; color: var(--ac-text-secondary); font-size: .75rem; }
.lto-fields { margin-top: 0; }
.lto-fields input[readonly] { background: var(--ac-surface-muted); }
.lto-name-check { display: grid; gap: .2rem; border: 1px solid var(--ac-border); border-radius: .6rem; padding: .65rem .75rem; background: var(--ac-surface); }
.lto-name-check strong { color: var(--ac-text-secondary); font-size: .75rem; }
.lto-name-check span { overflow-wrap: anywhere; color: var(--ac-text); font-size: .85rem; font-weight: 700; }
.lto-name-check small { color: var(--ac-text-muted); font-size: .72rem; }
.lto-name-matched { border-color: var(--ac-success); }
.lto-name-matched small { color: var(--ac-success); }
.lto-name-mismatch { border-color: var(--ac-danger); }
.lto-name-mismatch small { color: var(--ac-danger); }
.lto-message { margin: 0; font-size: .78rem; line-height: 1.5; }
.lto-message-not_expired { color: var(--ac-success); }
.lto-message-expired { color: var(--ac-danger); }
.lto-message-needs_review { color: var(--ac-warning); }
  .lto-message-mismatch { color: var(--ac-danger); font-weight: 700; }
.manual-name-confirmation { display: flex; align-items: flex-start; gap: .55rem; border: 1px solid var(--ac-border); border-radius: .6rem; padding: .7rem; color: var(--ac-text-secondary); background: var(--ac-surface); font-size: .78rem; line-height: 1.45; }
.manual-name-confirmation input { flex: 0 0 auto; width: 1rem; height: 1rem; margin: .08rem 0 0; accent-color: var(--ac-primary); }
.lto-progress { display: flex; align-items: center; gap: .5rem; margin: 0; color: var(--ac-text-muted); font-size: .78rem; }
.ocr-text { border-top: 1px solid var(--ac-border); padding-top: .6rem; }
.ocr-text summary { cursor: pointer; color: var(--ac-text-secondary); font-size: .78rem; font-weight: 700; }
.ocr-text pre { max-height: 12rem; overflow: auto; margin: .55rem 0 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ac-text-muted); font: .72rem/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
.modal footer { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1rem; border-top: 1px solid var(--ac-border); padding-top: .9rem; }
.modal footer button { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; }
.button-spinner { width: .9rem; height: .9rem; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 700px) {
  .page-heading { flex-direction: column; }
  .summary article { display: grid; gap: .1rem; padding: .7rem; }
  .toolbar { grid-template-columns: 1fr; align-items: stretch; }
}
@media (max-width: 520px) {
  .content { padding: 1rem; }
  .summary { gap: .45rem; }
  .summary b { font-size: 1.1rem; }
  .summary span { font-size: .7rem; }
  .form-grid { grid-template-columns: 1fr; }
  .full-width { grid-column: auto; }
  .modal footer { flex-direction: column-reverse; }
  .modal footer button { width: 100%; }
}
</style>
