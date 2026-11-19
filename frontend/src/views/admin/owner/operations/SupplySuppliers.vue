<template>
  <div :class="embedded ? 'directory directory-embedded module-theme supplier-theme' : 'directory module-theme supplier-theme flex min-h-screen'">
    <OwnerSidebar v-if="!embedded" />
    <main class="content" :class="{ 'flex-1': !embedded }">
      <header class="page-heading">
        <div>
          <small>SUPPLIER MANAGEMENT</small>
          <h1>Supplier Directory</h1>
          <p>Keep the clinic’s supplier contacts in one place. Orders are handled outside AesthetiCare.</p>
        </div>
        <button v-if="canCreate" class="primary-button" type="button" @click="openCreate">Add supplier</button>
      </header>

      <SupplyFlowGuide v-if="!embedded" department="procurement" page="suppliers" />

      <div v-if="error" class="feedback error" role="alert">
        <span>{{ error }}</span>
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
        <label class="shared-toggle">
          <input v-model="showDirectory" type="checkbox" @change="loadDirectory" />
          <span>Include shared directory</span>
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
            <div><dt>FDA check</dt><dd>{{ label(supplier.regulatory?.verificationStatus) }}</dd></div>
          </dl>
          <p v-if="supplier.notes" class="internal-note"><strong>Clinic note:</strong> {{ supplier.notes }}</p>

          <div class="card-actions">
            <button v-if="supplier.directoryOnly && canCreate" type="button" :disabled="associating === supplier.key" @click="associate(supplier)">
              {{ associating === supplier.key ? 'Adding…' : 'Add to my clinic' }}
            </button>
            <button v-else-if="canManage" type="button" class="secondary-button" @click="edit(supplier)">Edit supplier</button>
            <a href="https://verification.fda.gov.ph/" target="_blank" rel="noopener noreferrer">FDA verification</a>
          </div>
        </article>
      </section>
      <section v-else class="empty-state">
        <h2>No supplier contacts found</h2>
        <p>{{ showDirectory ? 'Try a different search or add a shared supplier to your clinic.' : 'Add a clinic contact or include the shared directory.' }}</p>
        <button v-if="canCreate" type="button" class="primary-button" @click="openCreate">Add supplier</button>
      </section>

      <div v-if="showForm" class="overlay" @click.self="close">
        <form class="modal" @submit.prevent="save" :aria-busy="saving">
          <header class="modal-heading">
            <div>
              <small>{{ editing ? 'SUPPLIER DETAILS' : 'SUPPLIER SETUP' }}</small>
              <h2>{{ editing ? (editing.canEditBusiness ? 'Edit supplier' : 'Edit clinic relationship') : 'Add supplier' }}</h2>
            </div>
            <button class="close-button" type="button" aria-label="Close" @click="close">×</button>
          </header>

          <p v-if="!editing" class="modal-intro">Add the contact details you use to request and compare supply quotes.</p>
          <p v-else-if="!editing.canEditBusiness" class="modal-intro">This shared supplier’s business details are managed by its clinic. You can update your clinic’s relationship status and notes.</p>

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

          <details class="more-details">
            <summary>Compliance and clinic notes</summary>
            <div class="form-grid details-grid">
              <label>FDA LTO number
                <input v-model.trim="form.ltoNumber" :disabled="editing && !editing.canEditBusiness" />
              </label>
              <CategorySelectField id="supplier-establishment-category" label="Establishment category" v-model="form.establishmentCategory" :options="establishmentCategoryOptions" :disabled="editing && !editing.canEditBusiness" />
              <label>FDA check status
                <select v-model="form.verificationStatus" :disabled="editing && !editing.canEditBusiness">
                  <option value="not_checked">Not checked</option>
                  <option value="checked_valid">Checked valid</option>
                  <option value="expired_invalid">Expired / invalid</option>
                  <option value="not_applicable">Not applicable</option>
                  <option value="for_review">For review</option>
                </select>
              </label>
              <label>Checked date
                <input v-model="form.checkedAt" type="date" :disabled="editing && !editing.canEditBusiness" />
              </label>
              <label class="full-width">Internal clinic notes
                <textarea v-model.trim="form.notes" rows="3" placeholder="Only your clinic can see these notes." />
              </label>
              <label v-if="!editing" class="shared-directory-option full-width">
                <input v-model="form.sharedDirectory" type="checkbox" />
                <span><strong>Allow other clinics to reuse this contact</strong><small>Personal notes stay private to your clinic.</small></span>
              </label>
            </div>
          </details>

          <footer>
            <button type="button" class="secondary-button" :disabled="saving" @click="close">Cancel</button>
            <button type="submit" class="primary-button" :disabled="saving">
              <span v-if="saving" class="button-spinner" aria-hidden="true"></span>
              {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Save supplier' }}
            </button>
          </footer>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import SupplyFlowGuide from '@/components/common/SupplyFlowGuide.vue'
import CategorySelectField from '@/components/common/CategorySelectField.vue'
import { supplyCategoryOptions as buildSupplyCategoryOptions } from '@/utils/supplyCategories'
import { auth, db } from '@/config/firebaseConfig'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { usePermissions } from '@/composables/usePermissions'

defineProps({ embedded: { type: Boolean, default: false } })

const { hasPermission, isClinicAdminOwner } = usePermissions()
const loading = ref(true)
const saving = ref(false)
const loadFailed = ref(false)
const associating = ref('')
const error = ref('')
const notice = ref('')
const search = ref('')
const status = ref('')
const showDirectory = ref(false)
const showForm = ref(false)
const editing = ref(null)
const associations = ref([])
const directory = ref([])
const scope = ref({ branchId: '', ownerId: '' })

const blank = () => ({
  businessName: '', category: '', contactPerson: '', email: '', contactNumber: '', address: '',
  associationStatus: 'Active', notes: '', ltoNumber: '', establishmentCategory: '',
  verificationStatus: 'not_checked', checkedAt: '', sharedDirectory: false,
})
const form = ref(blank())

const api = async path => {
  await auth.authStateReady?.()
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in to view supplier records.')
  let lastError
  for (const base of OTP_BACKEND_CANDIDATES) {
    let response
    try {
      response = await fetch(`${base}/supply${path}`, { headers: { Authorization: `Bearer ${token}` } })
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
const reviewCount = computed(() => associations.value.filter(item => ['for_review', 'expired_invalid'].includes(item.regulatory?.verificationStatus)).length)
const visible = computed(() => {
  const seen = new Set()
  return [...associations.value, ...(showDirectory.value ? directory.value : [])].filter(supplier => {
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
  ...directory.value.map(supplier => supplier.category),
  form.value.category,
]))
const establishmentCategoryOptions = computed(() => [...new Set([
  ...associations.value.map(supplier => supplier.regulatory?.establishmentCategory),
  ...directory.value.map(supplier => supplier.regulatory?.establishmentCategory),
  form.value.establishmentCategory,
].map(value => String(value || '').trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)))

const label = value => ({
  not_checked: 'Not checked', checked_valid: 'Checked valid', expired_invalid: 'Expired / invalid',
  not_applicable: 'Not applicable', for_review: 'For review',
}[value] || 'Not checked')
const statusClass = value => ({ Active: 'is-active', Inactive: 'is-inactive', 'For review': 'is-review' }[value] || 'is-review')
const errorMessage = error => {
  if (error?.code === 'permission-denied') return 'Your role cannot read supplier records yet. Ask an administrator to enable Create Suppliers or Manage Suppliers, then try again.'
  if (error?.code === 'unavailable' || /503|unavailable|network/i.test(error?.message || '')) return 'The supplier service is temporarily unavailable. Try again in a moment.'
  return error?.message || 'Unable to complete this supplier action.'
}
const view = (supplier, link = {}) => ({
  ...supplier,
  supplierId: supplier.id,
  key: link.id || supplier.id,
  associationId: link.id || '',
  associationStatus: link.status || 'Active',
  notes: link.internalNotes || '',
  regulatory: supplier.regulatory || {},
  directoryOnly: !link.id,
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
      internalNotes: supplier.clinicSupplierNotes,
    }))
    if (showDirectory.value) await loadDirectory()
  } catch (cause) {
    error.value = errorMessage(cause)
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

async function loadDirectory() {
  error.value = ''
  try {
    const rows = await getDocs(query(collection(db, 'suppliers'), where('sharedDirectory', '==', true)))
    directory.value = rows.docs.map(supplier => view({ id: supplier.id, ...supplier.data() }))
  } catch (cause) {
    error.value = errorMessage(cause)
  }
}

async function associate(supplier) {
  if (!canCreate.value || associating.value) return
  associating.value = supplier.key
  error.value = ''
  try {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Sign in to add a supplier.')
    const batch = writeBatch(db)
    batch.set(doc(collection(db, 'clinicSuppliers')), {
      clinicId: scope.value.ownerId,
      branchId: scope.value.branchId,
      supplierId: supplier.supplierId,
      status: 'Active',
      internalNotes: '',
      associatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    })
    await batch.commit()
    notice.value = 'Supplier added to this clinic.'
    await load()
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    associating.value = ''
  }
}

function openCreate() {
  editing.value = null
  form.value = blank()
  error.value = ''
  showForm.value = true
}

function edit(supplier) {
  editing.value = supplier
  form.value = {
    ...blank(),
    businessName: supplier.businessName || '',
    category: supplier.category || '',
    contactPerson: supplier.contactPerson || '',
    email: supplier.email || '',
    contactNumber: supplier.contactNumber || '',
    address: supplier.address || '',
    associationStatus: supplier.associationStatus || 'Active',
    notes: supplier.notes || '',
    ltoNumber: supplier.regulatory?.ltoNumber || '',
    establishmentCategory: supplier.regulatory?.establishmentCategory || '',
    verificationStatus: supplier.regulatory?.verificationStatus || 'not_checked',
    checkedAt: supplier.regulatory?.checkedAt || '',
  }
  error.value = ''
  showForm.value = true
}

function close() {
  showForm.value = false
  editing.value = null
}

async function save() {
  if (!scope.value.branchId || saving.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Sign in to save supplier details.')
    const batch = writeBatch(db)
    if (editing.value) {
      if (editing.value.canEditBusiness) {
        const regulatory = {
          ltoNumber: form.value.ltoNumber,
          establishmentCategory: form.value.establishmentCategory,
          verificationStatus: form.value.verificationStatus,
          checkedAt: form.value.checkedAt || null,
          checkedBy: userId,
          verificationSource: 'https://verification.fda.gov.ph/',
        }
        batch.update(doc(db, 'suppliers', editing.value.supplierId), {
          businessName: form.value.businessName,
          category: form.value.category,
          contactPerson: form.value.contactPerson,
          email: form.value.email,
          contactNumber: form.value.contactNumber,
          address: form.value.address,
          regulatory,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        })
      }
      batch.update(doc(db, 'clinicSuppliers', editing.value.associationId), {
        status: form.value.associationStatus,
        internalNotes: form.value.notes,
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

      const supplierRef = doc(collection(db, 'suppliers'))
      const associationRef = doc(collection(db, 'clinicSuppliers'))
      const regulatory = {
        ltoNumber: form.value.ltoNumber,
        establishmentCategory: form.value.establishmentCategory,
        verificationStatus: form.value.verificationStatus,
        checkedAt: form.value.checkedAt || null,
        checkedBy: userId,
        verificationSource: 'https://verification.fda.gov.ph/',
      }
      batch.set(supplierRef, {
        businessName: form.value.businessName,
        category: form.value.category,
        contactPerson: form.value.contactPerson,
        email: form.value.email,
        contactNumber: form.value.contactNumber,
        address: form.value.address,
        sharedDirectory: form.value.sharedDirectory,
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
        internalNotes: form.value.notes,
        associatedAt: serverTimestamp(),
        createdBy: userId,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    notice.value = editing.value ? 'Supplier changes saved.' : 'Supplier saved and added to this clinic.'
    close()
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
.toolbar { display: grid; grid-template-columns: minmax(14rem, 1fr) minmax(9rem, 12rem) auto; align-items: end; gap: .75rem; border: 1px solid var(--ac-border); border-radius: .9rem; background: var(--ac-surface); padding: .9rem; }
.toolbar label, .form-grid > label { display: grid; gap: .32rem; color: var(--ac-text-secondary); font-size: .78rem; font-weight: 700; }
.toolbar input:not([type="checkbox"]), .toolbar select, .form-grid input:not([type="checkbox"]), .form-grid select, .form-grid textarea { width: 100%; min-width: 0; min-height: 2.8rem; box-sizing: border-box; border: 1px solid var(--ac-border-strong); border-radius: .6rem; padding: .65rem .75rem; color: var(--ac-text); background: var(--ac-surface); }
.toolbar input::placeholder, .form-grid input::placeholder, .form-grid textarea::placeholder { color: var(--ac-text-muted); }
.shared-toggle { display: flex !important; min-height: 2.8rem; align-items: center; gap: .55rem !important; padding: 0 .3rem; white-space: nowrap; }
.shared-toggle input, .shared-directory-option input { width: 1rem; height: 1rem; flex: 0 0 auto; margin: 0; accent-color: var(--ac-primary); }
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
.internal-note { margin: .8rem 0 0; color: var(--ac-text-muted); font-size: .8rem; overflow-wrap: anywhere; }
.card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-top: .9rem; border-top: 1px solid var(--ac-border); padding-top: .75rem; }
.card-actions button { min-height: 2.35rem; padding: .5rem .7rem; font-size: .78rem; }
.card-actions a { color: var(--ac-text-secondary); font-size: .78rem; font-weight: 700; text-decoration: underline; text-underline-offset: .15em; }
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
.more-details { margin-top: .85rem; border: 1px solid var(--ac-border); border-radius: .7rem; background: var(--ac-surface-soft); padding: .65rem .8rem; }
.more-details summary { cursor: pointer; color: var(--ac-text-secondary); font-size: .82rem; font-weight: 800; }
.details-grid { padding-top: .3rem; }
.shared-directory-option { display: flex !important; grid-template-columns: auto 1fr; align-items: flex-start; gap: .6rem !important; border: 1px solid var(--ac-border); border-radius: .6rem; padding: .7rem; }
.shared-directory-option input { margin-top: .18rem; }
.shared-directory-option span { display: grid; gap: .12rem; }
.shared-directory-option strong { color: var(--ac-text); font-size: .8rem; }
.shared-directory-option small { color: var(--ac-text-muted); font-size: .73rem; font-weight: 400; }
.modal footer { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1rem; border-top: 1px solid var(--ac-border); padding-top: .9rem; }
.modal footer button { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; }
.button-spinner { width: .9rem; height: .9rem; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 700px) {
  .page-heading { flex-direction: column; }
  .summary article { display: grid; gap: .1rem; padding: .7rem; }
  .toolbar { grid-template-columns: 1fr; align-items: stretch; }
  .shared-toggle { min-height: 2rem; }
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
