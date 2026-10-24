<template>
  <div :class="embedded ? 'module-theme supplier-directory' : 'flex module-theme supplier-directory min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <div v-page-loading="{ active: pageLoading, variant: 'cards', cardStyle: 'stat', cards: 4 }" :class="embedded ? 'directory-content' : 'directory-content flex-1'">
      <div class="directory-heading">
        <div>
          <p class="directory-eyebrow">PROCUREMENT</p>
          <h1 class="directory-title">Supplier Directory</h1>
          <p class="directory-subtitle">Manage supplier relationships, browse offered supplies, and start an inventory request.</p>
        </div>
        <button
          v-if="canCreateSuppliers"
          @click="openAddModal"
          class="directory-primary-button"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Supplier
        </button>
      </div>

      <section class="directory-summary" aria-label="Supplier summary">
        <article><span class="summary-mark">01</span><div><p class="summary-value">{{ suppliers.length }}</p><p class="summary-label">Total suppliers</p></div></article>
        <article><span class="summary-mark summary-mark-active">●</span><div><p class="summary-value">{{ suppliers.filter(s => (s.status || 'Active') === 'Active').length }}</p><p class="summary-label">Active suppliers</p></div></article>
        <article><span class="summary-mark summary-mark-pending">◷</span><div><p class="summary-value">{{ suppliers.filter(s => ['Invited', 'Pending Activation'].includes(s.status)).length }}</p><p class="summary-label">Awaiting activation</p></div></article>
      </section>

      <div class="directory-filters">
        <div class="filters-grid">
          <div>
            <label class="filter-label">Search suppliers</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Business name or contact person"
              class="directory-input"
            />
          </div>
          <div>
            <label class="filter-label">Category</label>
            <select
              v-model="selectedCategory"
              class="directory-input"
            >
              <option value="">All Categories</option>
              <option value="Injectables">Injectables</option>
              <option value="Equipment">Equipment</option>
              <option value="Skincare">Skincare</option>
              <option value="Medical Supplies">Medical Supplies</option>
            </select>
          </div>
          <div>
            <label class="filter-label">Status</label>
            <select
              v-model="selectedStatus"
              class="directory-input"
            >
              <option value="">All Status</option>
              <option value="Invited">Invited</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="suppliers.length === 0" class="directory-empty">
        <span class="empty-icon">＋</span><h2>No suppliers yet</h2><p>Add a supplier business or link an existing verified supplier account to get started.</p>
        <button v-if="canCreateSuppliers" type="button" class="directory-primary-button" @click="openAddModal">Add Supplier</button>
      </div>

      <div v-else>
        <div v-if="filteredSuppliers.length === 0" class="directory-empty">
          <span class="empty-icon">⌕</span><h2>No matching suppliers</h2><p>Try another search term or adjust the selected filters.</p>
        </div>

        <div v-else class="supplier-grid">
          <div v-for="supplier in filteredSuppliers" :key="supplier.id" class="supplier-card">
            <div class="supplier-card-top">
              <div class="supplier-avatar">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"></path>
                </svg>
              </div>
              <span :class="['supplier-status', statusClass(supplier.status)]">
                {{ supplier.status === 'Pending Activation' ? 'Pending' : (supplier.status || 'Inactive') }}
              </span>
            </div>

            <h3 class="supplier-name">{{ supplier.name || supplier.businessName || 'Supplier business' }}</h3>
            <p v-if="supplier.businessType" class="supplier-type">{{ supplier.businessType }}</p>
            <div class="supplier-categories">
              <span
                v-for="cat in normalizedCategories(supplier)"
                :key="`${supplier.id}-${cat}`"
                class="supplier-category"
              >
                {{ cat }}
              </span>
              <span
                v-if="normalizedCategories(supplier).length === 0"
                class="supplier-muted"
              >
                No category
              </span>
            </div>

            <div class="supplier-details">
              <p><span>Contact</span>{{ supplier.contact || '-' }}</p>
              <p><span>Email</span>{{ supplier.email || '-' }}</p>
              <p><span>Phone</span>{{ supplier.phone ? `+63 ${supplier.phone}` : '-' }}</p>
              <p><span>Accreditation</span>{{ supplier.accreditationStatus || 'Pending Accreditation' }}</p>
            </div>

            <div class="supplier-offerings">
              <p class="offerings-heading">Offered items <span>{{ normalizedOfferedItems(supplier).length }}</span></p>
              <div class="offerings-list">
                <p
                  v-for="(item, idx) in normalizedOfferedItems(supplier).slice(0, 3)"
                  :key="`${supplier.id}-item-${idx}`"
                  class="offered-item"
                >
                  {{ item.name }}
                  <span class="offered-item-category">{{ item.category || 'Uncategorized' }}</span>
                  <span class="offered-item-price">PHP {{ Number(item.unitCost || item.costPerUnit || item.price || 0).toLocaleString() }}</span>
                </p>
                <p v-if="normalizedOfferedItems(supplier).length === 0" class="supplier-muted">No offered items listed.</p>
                <p v-else-if="normalizedOfferedItems(supplier).length > 3" class="supplier-muted">
                  +{{ normalizedOfferedItems(supplier).length - 3 }} more
                </p>
              </div>
              <div class="supplier-card-actions">
                <router-link
                  :to="{ path: '/inventory/requests', query: { supplierId: supplier.id } }"
                  class="directory-secondary-button"
                >Start Inventory Request</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showAddModal" class="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4">
        <div class="bg-slate-800 rounded-xl p-8 max-w-3xl w-full mx-auto my-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold text-white mb-4">Add Supplier</h2>
          <div class="mb-6 flex gap-2 border-b border-slate-700" role="tablist" aria-label="Add supplier options">
            <button type="button" class="px-4 py-2 text-sm font-semibold" :class="addSupplierTab === 'create' ? 'border-b-2 border-amber-500 text-amber-300' : 'text-slate-400'" @click="addSupplierTab = 'create'">Create Supplier Account</button>
            <button type="button" class="px-4 py-2 text-sm font-semibold" :class="addSupplierTab === 'existing' ? 'border-b-2 border-amber-500 text-amber-300' : 'text-slate-400'" @click="showExistingSupplierAccounts">Existing Supplier Accounts</button>
          </div>
          <form v-if="addSupplierTab === 'create'" @submit.prevent="addSupplier" class="space-y-4">
            <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <label class="block text-slate-200 text-sm font-medium mb-2">Supplier Account Email</label>
              <div class="flex gap-2">
                <input
                  v-model="newSupplier.email"
                  type="email"
                  required
                  maxlength="254"
                  autocomplete="email"
                  placeholder="Enter email to check for an existing supplier account"
                  :class="inputClass(showAddError('email'))"
                  @input="handleSupplierEmailInput"
                  @blur="checkExistingSupplierAccount"
                />
                <button type="button" :disabled="checkingSupplierAccount || !newSupplier.email" class="shrink-0 rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50" @click="checkExistingSupplierAccount">{{ checkingSupplierAccount ? 'Checking…' : 'Check email' }}</button>
              </div>
              <p v-if="existingSupplierAccount?.verified" class="mt-2 text-xs text-emerald-300">This email belongs to a verified supplier. Use “Existing Supplier Accounts” to add their verified profile.</p>
              <p v-else-if="existingSupplierAccount" class="mt-2 text-xs text-amber-200">An unverified supplier account was found. Adding it will link the business name and email; the supplier must complete verification before ordering is enabled.</p>
              <p v-else-if="supplierAccountChecked" class="mt-2 text-xs text-slate-400">No supplier account was found. An invitation will be sent so the supplier can create an account and complete verification.</p>
              <p v-if="showAddError('email')" class="mt-1 text-xs text-red-400">{{ addErrors.email }}</p>
            </div>
            <div class="grid grid-cols-1 gap-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Supplier Business Name</label>
                <input
                  v-model="newSupplier.name"
                  type="text"
                  required
                  maxlength="120"
                  autocomplete="organization"
                  :class="inputClass(showAddError('name'))"
                  @input="markTouched('name')"
                  @blur="markTouched('name')"
                />
                <p v-if="showAddError('name')" class="mt-1 text-xs text-red-400">{{ addErrors.name }}</p>
              </div>
            </div>
            <p class="text-xs text-slate-400">The supplier will provide their contact person, phone, address, categories, and verification details during business verification.</p>
            <div class="flex justify-end gap-3 mt-6">
              <button type="button" @click="showAddModal = false" class="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
              <button type="submit" :disabled="saving" class="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50">
                {{ saving ? 'Saving...' : 'Add Supplier' }}
              </button>
            </div>
          </form>
          <section v-else>
            <p class="mb-4 text-sm text-slate-400">Link an active supplier account to this clinic's directory. This does not create another supplier login.</p>
            <input v-model="existingSupplierSearch" type="search" placeholder="Search supplier name, category, or email" class="mb-4 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-amber-500 focus:outline-none" />
            <p v-if="loadingExistingSupplierAccounts" class="py-8 text-center text-slate-400">Loading supplier accounts…</p>
            <div v-else class="max-h-[52vh] overflow-auto rounded-lg border border-slate-700">
              <table class="min-w-full text-left text-sm"><thead class="sticky top-0 bg-slate-900 text-slate-300"><tr><th class="p-3">Supplier</th><th class="p-3">Categories</th><th class="p-3">Contact</th><th class="p-3">Action</th></tr></thead><tbody><tr v-for="supplier in filteredExistingSupplierAccounts" :key="supplier.uid" class="border-t border-slate-700"><td class="p-3"><p class="font-medium text-white">{{ supplier.name }}</p><p class="text-xs text-slate-400">{{ supplier.email }}</p></td><td class="p-3 text-slate-300">{{ supplier.categories?.join(', ') || '—' }}</td><td class="p-3 text-slate-300">{{ supplier.contact || '—' }}</td><td class="p-3"><span v-if="supplier.linked" class="text-xs text-emerald-300">Already added</span><button v-else type="button" :disabled="linkingSupplierUid === supplier.uid" class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" @click="linkExistingSupplier(supplier)">{{ linkingSupplierUid === supplier.uid ? 'Adding…' : 'Add to My Directory' }}</button></td></tr><tr v-if="!filteredExistingSupplierAccounts.length"><td colspan="4" class="p-6 text-center text-slate-400">No supplier accounts found.</td></tr></tbody></table>
            </div>
            <div class="mt-6 flex justify-end"><button type="button" @click="showAddModal = false" class="rounded-lg border border-slate-600 px-6 py-2 text-slate-300 hover:bg-slate-700">Close</button></div>
          </section>
        </div>
      </div>

      <div v-if="showEditModal" class="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4">
        <div class="bg-slate-800 rounded-xl p-8 max-w-2xl w-full mx-auto my-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold text-white mb-6">Edit Supplier</h2>
          <form @submit.prevent="saveSupplierEdit" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Supplier Name</label>
                <input v-model="editSupplier.name" type="text" required class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none" />
              </div>
              <div class="col-span-2">
                <label class="block text-slate-400 text-sm mb-2">Business Type</label>
                <select v-model="editSupplier.businessType" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none">
                  <option value="">Select business type</option>
                  <option v-for="type in SUPPLIER_BUSINESS_TYPES" :key="`edit-${type}`" :value="type">{{ type }}</option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="block text-slate-400 text-sm mb-2">Categories (Multiple)</label>
                <div class="grid grid-cols-2 gap-2 bg-slate-700 rounded-lg border border-slate-600 p-3">
                  <label v-for="cat in categoryOptions" :key="`edit-${cat}`" class="flex items-center gap-2 text-slate-200 text-sm">
                    <input
                      type="checkbox"
                      :value="cat"
                      v-model="editSupplier.categories"
                      class="h-4 w-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                    />
                    <span>{{ cat }}</span>
                  </label>
                </div>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Contact Person</label>
                <input v-model="editSupplier.contact" type="text" required class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Email</label>
                <input v-model="editSupplier.email" type="email" required class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Phone</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">+63</span>
                  <input
                    v-model="editSupplier.phone"
                    type="tel"
                    required
                    maxlength="10"
                    class="w-full bg-slate-700 text-white pl-12 pr-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
                    @input="handlePhoneInput(editSupplier, $event)"
                    inputmode="numeric"
                  />
                </div>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Status</label>
                <select v-model="editSupplier.status" required class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Pending Accreditation">Pending Accreditation</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Accreditation Status</label>
                <select v-model="editSupplier.accreditationStatus" required class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none">
                  <option value="Pending Accreditation">Pending Accreditation</option>
                  <option value="Accredited">Accredited</option>
                  <option value="Expired">Expired</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-slate-400 text-sm mb-2">Address</label>
              <textarea v-model="editSupplier.address" rows="3" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"></textarea>
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button type="button" @click="showEditModal = false" class="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
              <button type="submit" :disabled="saving" class="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50">
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getFirestore, collection, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { usePermissions } from '@/composables/usePermissions'
import { loadOwnerBranchScope, loadScopedCollectionDocs } from '@/utils/ownerBranchScope'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { SUPPLIER_BUSINESS_TYPES } from '@/utils/supplierTin'

export default {
  name: 'ManagerSuppliers',
  components: { OwnerSidebar },
  props: { embedded: { type: Boolean, default: false } },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission, isClinicAdminOwner } = usePermissions()

    const showAddModal = ref(false)
    const addSupplierTab = ref('create')
    const existingSupplierAccounts = ref([])
    const existingSupplierSearch = ref('')
    const loadingExistingSupplierAccounts = ref(false)
    const linkingSupplierUid = ref('')
    const showEditModal = ref(false)
    const saving = ref(false)
    const searchQuery = ref('')
    const selectedCategory = ref('')
    const selectedStatus = ref('')
    const submitAttempted = ref(false)
    const currentScopeMode = ref('owner')
    const addTouched = ref({
      name: false,
      email: false,
      phone: false,
      address: false
    })

    const currentBranchId = ref('')
    const currentOwnerId = ref('')
    const currentBranchIds = ref([])
    const currentUserId = ref('')
    const suppliers = ref([])
    const categoryOptions = ['Injectables', 'Equipment', 'Skincare', 'Medical Supplies']
    const canCreateSuppliers = computed(() => Boolean(isClinicAdminOwner.value || hasPermission('suppliers:create')))
    const canManageSuppliers = computed(() => Boolean(isClinicAdminOwner.value || hasPermission('suppliers:update')))
    const filteredExistingSupplierAccounts = computed(() => {
      const term = existingSupplierSearch.value.trim().toLowerCase()
      if (!term) return existingSupplierAccounts.value
      return existingSupplierAccounts.value.filter(supplier => [supplier.name, supplier.email, supplier.contact, ...(supplier.categories || [])].some(value => String(value || '').toLowerCase().includes(term)))
    })

    const statusClass = (status) => {
      if (status === 'Active') return 'bg-green-500/20 text-green-400'
      if (['Invited', 'Pending Activation'].includes(status)) return 'bg-amber-500/20 text-amber-300'
      return 'bg-red-500/20 text-red-400'
    }

    const getEmptySupplier = () => ({
      name: '',
      businessType: '',
      categories: [],
      contact: '',
      email: '',
      phone: '',
      status: 'Active',
      accreditationStatus: 'Pending Accreditation',
      address: ''
    })

    const newSupplier = ref({
      ...getEmptySupplier()
    })
    const checkingSupplierAccount = ref(false)
    const supplierAccountChecked = ref(false)
    const existingSupplierAccount = ref(null)
    const editSupplier = ref({
      id: '',
      branchId: '',
      ownerId: '',
      sharedAcrossBranches: true,
      ...getEmptySupplier()
    })

    const normalizedCategories = (supplier) => {
      if (Array.isArray(supplier.categories)) return supplier.categories.filter(Boolean)
      if (supplier.category) return [supplier.category]
      return []
    }

    const normalizedOfferedItems = (supplier) => {
      if (!Array.isArray(supplier.offeredItems)) return []
      return supplier.offeredItems.filter((item) => item?.name)
    }

    const handlePhoneInput = (supplier, event) => {
      const digits = String(event?.target?.value || '').replace(/\D/g, '').slice(0, 10)
      supplier.phone = digits
      if (event?.target) event.target.value = digits
    }

    const loadSuppliers = trackPageLoad(async () => {
      if (!currentOwnerId.value && !currentBranchIds.value.length) {
        suppliers.value = []
        return
      }
      suppliers.value = await loadScopedCollectionDocs(
        db,
        'suppliers',
        currentOwnerId.value,
        currentBranchIds.value,
        { scopeMode: currentScopeMode.value }
      )
    })

    const filteredSuppliers = computed(() => {
      return suppliers.value.filter((supplier) => {
        const matchesSearch =
          (supplier.name || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          (supplier.contact || '').toLowerCase().includes(searchQuery.value.toLowerCase())
        const categories = normalizedCategories(supplier)
        const matchesCategory = !selectedCategory.value || categories.includes(selectedCategory.value)
        const matchesStatus = !selectedStatus.value || supplier.status === selectedStatus.value
        return matchesSearch && matchesCategory && matchesStatus
      })
    })

    const getSupplierPayload = (supplier) => {
      return {
        name: supplier.name,
        businessType: supplier.businessType,
        categories: supplier.categories,
        contact: supplier.contact,
        email: supplier.email,
        phone: String(supplier.phone || '').replace(/\D/g, '').slice(0, 10),
        status: supplier.status,
        accreditationStatus: supplier.accreditationStatus || 'Pending Accreditation',
        address: supplier.address
      }
    }

    const openAddModal = () => {
      addSupplierTab.value = 'create'
      showAddModal.value = true
    }
    const showExistingSupplierAccounts = async () => {
      addSupplierTab.value = 'existing'
      if (!currentBranchId.value || loadingExistingSupplierAccounts.value) return
      loadingExistingSupplierAccounts.value = true
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw Error('Your session has expired. Please sign in again.')
        const response = await fetch(`${OTP_API_BASE}/supply/suppliers/account-directory`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchId: currentBranchId.value }) })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw Error(payload?.error || 'Unable to load supplier accounts.')
        existingSupplierAccounts.value = Array.isArray(payload.data) ? payload.data : []
      } catch (error) { toast.error(error?.message || 'Unable to load supplier accounts.') } finally { loadingExistingSupplierAccounts.value = false }
    }
    const linkExistingSupplier = async (supplier) => {
      if (!currentBranchId.value || linkingSupplierUid.value) return
      linkingSupplierUid.value = supplier.uid
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw Error('Your session has expired. Please sign in again.')
        const response = await fetch(`${OTP_API_BASE}/supply/suppliers/account-link`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchId: currentBranchId.value, supplierUid: supplier.uid }) })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw Error(payload?.error || 'Unable to add supplier to this directory.')
        supplier.linked = true
        toast.success(payload.data?.alreadyLinked ? 'Supplier is already in this directory.' : 'Supplier added to this directory.')
        await loadSuppliers()
      } catch (error) { toast.error(error?.message || 'Unable to add supplier to this directory.') } finally { linkingSupplierUid.value = '' }
    }

    const markTouched = (field) => {
      addTouched.value[field] = true
    }

    const handleSupplierEmailInput = () => {
      markTouched('email')
      supplierAccountChecked.value = false
      existingSupplierAccount.value = null
    }

    const checkExistingSupplierAccount = async () => {
      const normalizedEmail = String(newSupplier.value.email || '').trim().toLowerCase()
      if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizedEmail) || !currentBranchId.value || checkingSupplierAccount.value) return
      checkingSupplierAccount.value = true
      supplierAccountChecked.value = false
      existingSupplierAccount.value = null
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Your session has expired. Please sign in again.')
        const response = await fetch(`${OTP_API_BASE}/supply/suppliers/account-lookup`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ branchId: currentBranchId.value, email: normalizedEmail }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to check the supplier account.')
        supplierAccountChecked.value = true
        if (!payload.found || !payload.supplier) return
        const account = { ...payload.supplier, verified: payload.verified === true }
        existingSupplierAccount.value = account
        if (account.verified) toast.info('Verified supplier account found. Add it from Existing Supplier Accounts.')
      } catch (error) {
        console.error(error)
        toast.error(error?.message || 'Unable to check the supplier account.')
      } finally {
        checkingSupplierAccount.value = false
      }
    }

    const inputClass = (hasError) => [
      'w-full bg-slate-700 text-white px-4 py-2 rounded-lg border focus:outline-none',
      hasError ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-amber-500'
    ]

    const addErrors = computed(() => {
      const errors = { name: '', email: '' }

      const hasLettersOrNumbers = (value) => /[A-Za-z0-9]/.test(value || '')
      const supplierNameRegex = /^[A-Za-z0-9][A-Za-z0-9\s'.,&()/-]*$/
      const emailRegex = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

      if (!newSupplier.value.name.trim()) {
        errors.name = 'Supplier name is required.'
      } else if (!hasLettersOrNumbers(newSupplier.value.name) || !supplierNameRegex.test(newSupplier.value.name.trim())) {
        errors.name = 'Use letters/numbers with basic punctuation only.'
      }

      if (!newSupplier.value.email.trim()) {
        errors.email = 'Email is required.'
      } else if (!emailRegex.test(newSupplier.value.email.trim())) {
        errors.email = 'Enter a valid email address.'
      }

      return errors
    })

    const hasAddErrors = computed(() => {
      return (
        addErrors.value.name ||
        addErrors.value.email
      )
    })

    const showAddError = (field) => {
      return (submitAttempted.value || addTouched.value[field]) && Boolean(addErrors.value[field])
    }

    const addSupplier = async () => {
      if (!canCreateSuppliers.value) {
        toast.error('You do not have permission to create suppliers.')
        return
      }
      submitAttempted.value = true
      if (hasAddErrors.value) {
        toast.error('Please fix the highlighted fields before saving.')
        return
      }
      if (!currentBranchId.value) {
        toast.error('Your account has no branch assignment.')
        return
      }
      if (existingSupplierAccount.value?.verified) {
        addSupplierTab.value = 'existing'
        toast.info('This account already exists. Select it from Existing Supplier Accounts to link it safely.')
        await showExistingSupplierAccounts()
        return
      }

      saving.value = true
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Your session has expired. Please sign in again.')
        const response = await fetch(`${OTP_API_BASE}/supply/suppliers/account`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ branchId: currentBranchId.value, name: newSupplier.value.name, email: newSupplier.value.email, existingSupplierUid: existingSupplierAccount.value?.uid || '' }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to create supplier account.')
        if (payload?.data?.alreadyLinked) toast.info('This supplier account is already linked in the directory.')
        else if (payload?.data?.pendingVerification) toast.success('Supplier account linked. Business verification is still required before ordering is enabled.')
        else if (payload?.data?.linkedExistingAccount) toast.success('Existing supplier account linked to the directory.')
        else toast.success('Supplier added. An activation email was sent to the supplier.')
        showAddModal.value = false
        resetAddForm()
        await loadSuppliers()
      } catch (error) {
        console.error(error)
        toast.error(error?.message || 'Failed to add supplier.')
      } finally {
        saving.value = false
      }
    }

    const openEditModal = (supplier) => {
      editSupplier.value = {
        id: supplier.id,
        branchId: supplier.branchId || '',
        ownerId: supplier.ownerId || '',
        sharedAcrossBranches: supplier.sharedAcrossBranches !== false,
        name: supplier.name || '',
        businessType: supplier.businessType || '',
        categories: [...normalizedCategories(supplier)],
        contact: supplier.contact || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        status: supplier.status || 'Active',
        accreditationStatus: supplier.accreditationStatus || 'Pending Accreditation',
        address: supplier.address || ''
      }
      showEditModal.value = true
    }

    const saveSupplierEdit = async () => {
      if (!canManageSuppliers.value) {
        toast.error('You do not have permission to manage suppliers.')
        return
      }
      if (!editSupplier.value.id) return
      if (!currentBranchId.value) {
        toast.error('Your account has no branch assignment.')
        return
      }
      if (!editSupplier.value.businessType) {
        toast.error('Please select a business type.')
        return
      }
      if ((editSupplier.value.categories || []).length === 0) {
        toast.error('Please select at least one category.')
        return
      }
      if (!/^9\d{9}$/.test(String(editSupplier.value.phone || '').replace(/\D/g, ''))) {
        toast.error('Please enter exactly 10 phone digits starting with 9.')
        return
      }

      saving.value = true
      try {
        const supplierName = editSupplier.value.name
        await updateDoc(doc(db, 'suppliers', editSupplier.value.id), {
          ...getSupplierPayload(editSupplier.value),
          ownerId: editSupplier.value.ownerId || currentOwnerId.value || null,
          branchId: editSupplier.value.branchId || currentBranchId.value,
          sharedAcrossBranches: true,
          updatedAt: serverTimestamp()
        })
        await logActivity(db, {
          module: 'Manager',
          action: 'Updated supplier',
          details: `Updated supplier: ${supplierName || editSupplier.value.id}.`
        })
        toast.success('Supplier updated successfully.')
        showEditModal.value = false
        await loadSuppliers()
      } catch (error) {
        console.error(error)
        toast.error('Failed to update supplier.')
      } finally {
        saving.value = false
      }
    }

    const deleteSupplier = async (supplier) => {
      if (!canManageSuppliers.value) {
        toast.error('You do not have permission to archive suppliers.')
        return
      }
      const confirmed = window.confirm(`Archive supplier "${supplier.name}"? You can restore it from Archives.`)
      if (!confirmed) return

      try {
        await setDoc(doc(db, 'archivedSuppliers', supplier.id), {
          ...getSupplierPayload(supplier),
          originalSupplierId: supplier.id,
          archivedAt: serverTimestamp(),
          archivedBy: currentUserId.value || null,
          branchId: supplier.branchId || currentBranchId.value,
          ownerId: supplier.ownerId || currentOwnerId.value || null,
          status: supplier.status || 'Inactive'
        })
        await deleteDoc(doc(db, 'suppliers', supplier.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Archived supplier',
          details: `Archived supplier: ${supplier.name || supplier.id}.`
        })
        toast.success('Supplier archived successfully.')
        await loadSuppliers()
      } catch (error) {
        console.error(error)
        toast.error('Failed to archive supplier.')
      }
    }

    let unsubscribeAuth = null

    onMounted(trackPageLoad(() => {
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          currentOwnerId.value = ''
          currentBranchIds.value = []
          suppliers.value = []
          return
        }

        currentUserId.value = user.uid
        const scope = await loadOwnerBranchScope(db, user.uid)
        currentBranchId.value = scope.branchId || ''
        currentOwnerId.value = scope.ownerId || ''
        currentBranchIds.value = scope.branchIds || []
        currentScopeMode.value = scope.scopeMode || 'owner'
        await loadSuppliers()
      })
    }))

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    const resetAddForm = () => {
      newSupplier.value = { ...getEmptySupplier() }
      checkingSupplierAccount.value = false
      supplierAccountChecked.value = false
      existingSupplierAccount.value = null
      submitAttempted.value = false
      addTouched.value = {
        name: false,
        businessType: false,
        categories: false,
        contact: false,
        email: false,
        phone: false,
        address: false
      }
    }

    watch(showAddModal, (isOpen) => {
      if (!isOpen) {
        resetAddForm()
      }
    })

    return {
      pageLoading,
      showAddModal,
      openAddModal,
      addSupplierTab,
      existingSupplierSearch,
      loadingExistingSupplierAccounts,
      linkingSupplierUid,
      filteredExistingSupplierAccounts,
      showExistingSupplierAccounts,
      linkExistingSupplier,
      showEditModal,
      saving,
      searchQuery,
      selectedCategory,
      selectedStatus,
      submitAttempted,
      addTouched,
      addErrors,
      hasAddErrors,
      suppliers,
      filteredSuppliers,
      categoryOptions,
      SUPPLIER_BUSINESS_TYPES,
      normalizedCategories,
      normalizedOfferedItems,
      handlePhoneInput,
      newSupplier,
      checkingSupplierAccount,
      supplierAccountChecked,
      existingSupplierAccount,
      editSupplier,
      markTouched,
      handleSupplierEmailInput,
      checkExistingSupplierAccount,
      showAddError,
      inputClass,
      addSupplier,
      openEditModal,
      saveSupplierEdit,
      deleteSupplier,
      canCreateSuppliers,
      canManageSuppliers,
      statusClass
    }
  }
}
</script>

<style scoped>
.supplier-directory {
  --directory-ink: #482d20;
  --directory-muted: #846b58;
  --directory-line: #ead7c2;
  --directory-accent: #925a3a;
  color: var(--directory-ink);
  background: #fcf8f1;
}
.directory-content { min-width: 0; padding: 2rem clamp(1rem, 3vw, 2.75rem); }
.directory-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.65rem; }
.directory-eyebrow { margin: 0 0 .35rem; color: #ae7654; font-size: .68rem; font-weight: 800; letter-spacing: .18em; }
.directory-title { margin: 0; color: #482d20; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(1.8rem, 3vw, 2.45rem); font-weight: 700; letter-spacing: -.035em; }
.directory-subtitle { max-width: 650px; margin: .45rem 0 0; color: var(--directory-muted); font-size: .93rem; line-height: 1.55; }
.directory-primary-button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: .5rem; min-height: 2.85rem; padding: .7rem 1.2rem; border: 1px solid #74462e; border-radius: .8rem; background: #74462e; color: #fffaf4; font-size: .88rem; font-weight: 700; box-shadow: 0 5px 14px #74462e20; transition: background .18s, transform .18s, box-shadow .18s; }
.directory-primary-button:hover { transform: translateY(-1px); background: #59341f; box-shadow: 0 8px 18px #74462e2b; }
.directory-primary-button:focus-visible,.directory-secondary-button:focus-visible { outline: 3px solid #d59e68; outline-offset: 2px; }
.directory-summary { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: .85rem; margin-bottom: 1.15rem; }
.directory-summary article { display: flex; align-items: center; gap: .85rem; min-height: 5.3rem; padding: 1rem 1.1rem; border: 1px solid var(--directory-line); border-radius: 1rem; background: #fffdf9; box-shadow: 0 3px 12px #70432a08; }
.summary-mark { display: grid; width: 2.45rem; height: 2.45rem; place-items: center; border-radius: .8rem; background: #f5e9d9; color: #855337; font-size: .78rem; font-weight: 800; }
.summary-mark-active { background: #e7f1e6; color: #397344; font-size: .8rem; }
.summary-mark-pending { background: #fff1da; color: #a36b20; font-size: 1.2rem; }
.summary-value { margin: 0; color: #482d20; font-size: 1.35rem; font-weight: 800; line-height: 1.1; }
.summary-label { margin: .25rem 0 0; color: #8d7560; font-size: .75rem; }
.directory-filters { margin-bottom: 1.35rem; padding: 1.05rem; border: 1px solid var(--directory-line); border-radius: 1rem; background: #f7eee2; }
.filters-grid { display: grid; grid-template-columns: minmax(220px,1.6fr) repeat(2,minmax(155px,1fr)); gap: .8rem; }
.filter-label { display: block; margin-bottom: .42rem; color: #765b46; font-size: .76rem; font-weight: 700; }
.directory-input { width: 100%; min-height: 2.65rem; padding: .65rem .8rem; border: 1px solid #dfc8ae; border-radius: .65rem; background: #fffdf9; color: #482d20; font-size: .86rem; outline: none; transition: border-color .16s, box-shadow .16s; }
.directory-input::placeholder { color: #aa9988; }
.directory-input:focus { border-color: #a56b46; box-shadow: 0 0 0 3px #a56b461c; }
.supplier-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1rem; align-items: stretch; }
.supplier-card { display: flex; min-width: 0; flex-direction: column; padding: 1.15rem; border: 1px solid var(--directory-line); border-radius: 1rem; background: #fffdf9; box-shadow: 0 5px 20px #70432a0a; transition: transform .18s, box-shadow .18s, border-color .18s; }
.supplier-card:hover { transform: translateY(-2px); border-color: #d2ae8d; box-shadow: 0 10px 24px #70432a13; }
.supplier-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: .8rem; margin-bottom: .8rem; }
.supplier-avatar { display: grid; width: 2.8rem; height: 2.8rem; place-items: center; border: 1px solid #ead5bd; border-radius: .85rem; background: #f7ecde; color: #805137; }
.supplier-status { display: inline-flex; align-items: center; min-height: 1.55rem; padding: .25rem .6rem; border-radius: 999px; font-size: .68rem; font-weight: 800; }
.supplier-status.bg-green-500\/20 { background: #e7f2e5; color: #376e3c; }
.supplier-status.bg-amber-500\/20 { background: #fff0d6; color: #8a5d16; }
.supplier-status.bg-red-500\/20 { background: #fae8e3; color: #994c3d; }
.supplier-name { margin: 0; color: #482d20; font-size: 1.04rem; font-weight: 800; line-height: 1.35; overflow-wrap: anywhere; }
.supplier-type { margin: .2rem 0 0; color: #92775f; font-size: .76rem; }
.supplier-categories { display: flex; min-height: 1.7rem; flex-wrap: wrap; gap: .35rem; margin: .65rem 0 .8rem; }
.supplier-category { padding: .22rem .5rem; border: 1px solid #e8d4be; border-radius: 999px; background: #f8efe4; color: #795339; font-size: .65rem; font-weight: 700; }
.supplier-muted { color: #9b8876; font-size: .72rem; }
.supplier-details { display: grid; gap: .45rem; margin-bottom: .9rem; }
.supplier-details p { display: grid; grid-template-columns: 4.15rem minmax(0,1fr); gap: .45rem; margin: 0; color: #594434; font-size: .77rem; line-height: 1.4; overflow-wrap: anywhere; }
.supplier-details p span { color: #9a806a; font-weight: 600; }
.supplier-offerings { margin-top: auto; padding-top: .8rem; border-top: 1px solid #eee1d2; }
.offerings-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 0 .55rem; color: #72553f; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.offerings-heading span { display: grid; min-width: 1.4rem; height: 1.4rem; place-items: center; border-radius: 999px; background: #f3e7d8; color: #845338; font-size: .66rem; }
.offerings-list { display: grid; gap: .45rem; }
.offered-item { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: .12rem .5rem; color: #543c2a; font-size: .75rem; font-weight: 700; }
.offered-item-category { color: #a08a74; font-size: .67rem; font-weight: 400; }
.offered-item-price { grid-column: 2; grid-row: 1 / span 2; align-self: center; color: #477047; font-size: .71rem; white-space: nowrap; }
.supplier-card-actions { display: flex; justify-content: flex-end; margin-top: .85rem; }
.directory-secondary-button { display: inline-flex; align-items: center; justify-content: center; min-height: 2.2rem; padding: .48rem .7rem; border: 1px solid #d7b99b; border-radius: .6rem; background: #fffaf4; color: #70452c; font-size: .69rem; font-weight: 800; text-decoration: none; transition: background .16s, border-color .16s; }
.directory-secondary-button:hover { border-color: #a66b45; background: #f8eee2; }
.directory-empty { display: flex; min-height: 15rem; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; border: 1px dashed #d9c1a8; border-radius: 1rem; background: #fffdf9; text-align: center; }
.empty-icon { display: grid; width: 3rem; height: 3rem; place-items: center; border-radius: 1rem; background: #f6eadd; color: #855337; font-size: 1.8rem; }
.directory-empty h2 { margin: .85rem 0 .3rem; color: #482d20; font-family: Georgia, 'Times New Roman', serif; font-size: 1.25rem; }
.directory-empty p { max-width: 400px; margin: 0 0 1rem; color: #8a725d; font-size: .84rem; line-height: 1.5; }
@media (max-width: 1050px) { .supplier-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 720px) { .directory-content { padding: 1.25rem 1rem; } .directory-heading { align-items: stretch; flex-direction: column; gap: 1rem; } .directory-primary-button { align-self: flex-start; } .directory-summary { grid-template-columns: 1fr; gap: .55rem; } .directory-summary article { min-height: 4.3rem; } .filters-grid { grid-template-columns: 1fr; } .supplier-grid { grid-template-columns: 1fr; } }
</style>

