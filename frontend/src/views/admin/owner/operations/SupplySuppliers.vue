<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Supplier List</h1>
          <p class="text-slate-400">Manage all suppliers and vendors</p>
        </div>
        <button
          v-if="canCreateSuppliers"
          @click="showAddModal = true"
          class="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Supplier
        </button>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name or contact..."
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Filter by Category</label>
            <select
              v-model="selectedCategory"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value="Injectables">Injectables</option>
              <option value="Equipment">Equipment</option>
              <option value="Skincare">Skincare</option>
              <option value="Medical Supplies">Medical Supplies</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Filter by Status</label>
            <select
              v-model="selectedStatus"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="Invited">Invited</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="suppliers.length === 0" class="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400">
        There are no suppliers yet.
      </div>

      <div v-else>
        <div v-if="filteredSuppliers.length === 0" class="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400">
          No suppliers matched your filters.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="supplier in filteredSuppliers" :key="supplier.id" class="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-amber-500 transition-colors">
            <div class="flex items-start justify-between mb-4">
              <div class="h-12 w-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"></path>
                </svg>
              </div>
              <span :class="['px-3 py-1 rounded-full text-xs font-medium', statusClass(supplier.status)]">
                {{ supplier.status }}
              </span>
            </div>

            <h3 class="text-white font-semibold text-lg mb-2">{{ supplier.name }}</h3>
            <div class="flex flex-wrap gap-1 mb-4">
              <span
                v-for="cat in normalizedCategories(supplier)"
                :key="`${supplier.id}-${cat}`"
                class="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30"
              >
                {{ cat }}
              </span>
              <span
                v-if="normalizedCategories(supplier).length === 0"
                class="text-slate-500 text-xs"
              >
                No category
              </span>
            </div>

            <div class="space-y-2 mb-4 text-sm">
              <p class="text-slate-300">Contact: {{ supplier.contact || '-' }}</p>
              <p class="text-slate-300">Email: {{ supplier.email || '-' }}</p>
              <p class="text-slate-300">Phone: {{ supplier.phone || '-' }}</p>
              <p class="text-slate-300">Business Type: {{ supplier.businessType || '-' }}</p>
              <p class="text-slate-300">TIN: {{ formatSupplierTin(supplier) || '-' }}</p>
            </div>

            <div class="pt-4 border-t border-slate-700">
              <p class="text-slate-400 text-xs mb-2">Offered Items</p>
              <div class="space-y-1">
                <p
                  v-for="(item, idx) in normalizedOfferedItems(supplier).slice(0, 3)"
                  :key="`${supplier.id}-item-${idx}`"
                  class="text-slate-300 text-xs"
                >
                  {{ item.name }}
                  <span class="text-slate-500">({{ item.category || 'Uncategorized' }})</span>
                  <span class="text-emerald-400">- PHP {{ Number(item.unitCost || item.costPerUnit || item.price || 0).toLocaleString() }}</span>
                </p>
                <p v-if="normalizedOfferedItems(supplier).length === 0" class="text-slate-500 text-xs">No offered items listed.</p>
                <p v-else-if="normalizedOfferedItems(supplier).length > 3" class="text-slate-500 text-xs">
                  +{{ normalizedOfferedItems(supplier).length - 3 }} more
                </p>
              </div>
              <div class="mt-4 flex items-center justify-end gap-2">
                <button
                  v-if="canManageSuppliers"
                  type="button"
                  @click="openEditModal(supplier)"
                  class="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700 text-xs"
                >
                  Edit
                </button>
                <button
                  v-if="canManageSuppliers"
                  type="button"
                  @click="deleteSupplier(supplier)"
                  class="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showAddModal" class="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4">
        <div class="bg-slate-800 rounded-xl p-8 max-w-3xl w-full mx-auto my-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold text-white mb-6">Add New Supplier</h2>
          <form @submit.prevent="addSupplier" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Supplier Name</label>
                <input
                  v-model="newSupplier.name"
                  type="text"
                  required
                  :class="inputClass(showAddError('name'))"
                  @input="markTouched('name')"
                  @blur="markTouched('name')"
                />
                <p v-if="showAddError('name')" class="mt-1 text-xs text-red-400">{{ addErrors.name }}</p>
              </div>
              <div class="col-span-2">
                <label class="block text-slate-400 text-sm mb-2">Business Type</label>
                <select
                  v-model="newSupplier.businessType"
                  required
                  :class="inputClass(showAddError('businessType'))"
                  @change="markTouched('businessType')"
                  @blur="markTouched('businessType')"
                >
                  <option value="">Select business type</option>
                  <option v-for="type in SUPPLIER_BUSINESS_TYPES" :key="type" :value="type">{{ type }}</option>
                </select>
                <p v-if="showAddError('businessType')" class="mt-1 text-xs text-red-400">{{ addErrors.businessType }}</p>
              </div>
              <div class="col-span-2">
                <label class="block text-slate-400 text-sm mb-2">TIN</label>
                <input
                  :value="formatTinDisplay(newSupplier.taxRegistrationNumber)"
                  type="text"
                  inputmode="numeric"
                  maxlength="15"
                  placeholder="XXX-XXX-XXX-XXX"
                  :class="inputClass(showAddError('taxRegistrationNumber'))"
                  @input="handleTinInput(newSupplier, $event)"
                  @blur="markTouched('taxRegistrationNumber')"
                />
                <p class="mt-1 text-xs text-slate-400">Enter the registered TIN of the taxpayer or business entity.</p>
                <p v-if="showAddError('taxRegistrationNumber')" class="mt-1 text-xs text-red-400">{{ addErrors.taxRegistrationNumber }}</p>
              </div>
              <div class="col-span-2">
                <label class="block text-slate-400 text-sm mb-2">Categories (Multiple)</label>
                <div class="grid grid-cols-2 gap-2 bg-slate-700 rounded-lg border border-slate-600 p-3">
                  <label v-for="cat in categoryOptions" :key="cat" class="flex items-center gap-2 text-slate-200 text-sm">
                    <input
                      type="checkbox"
                      :value="cat"
                      v-model="newSupplier.categories"
                      @change="markTouched('categories')"
                      class="h-4 w-4 rounded border-slate-500 bg-slate-800 text-amber-500 focus:ring-amber-500"
                    />
                    <span>{{ cat }}</span>
                  </label>
                </div>
                <p v-if="showAddError('categories')" class="mt-1 text-xs text-red-400">{{ addErrors.categories }}</p>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Contact Person</label>
                <input
                  v-model="newSupplier.contact"
                  type="text"
                  required
                  :class="inputClass(showAddError('contact'))"
                  @input="markTouched('contact')"
                  @blur="markTouched('contact')"
                />
                <p v-if="showAddError('contact')" class="mt-1 text-xs text-red-400">{{ addErrors.contact }}</p>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Email</label>
                <input
                  v-model="newSupplier.email"
                  type="email"
                  required
                  :class="inputClass(showAddError('email'))"
                  @input="markTouched('email')"
                  @blur="markTouched('email')"
                />
                <p v-if="showAddError('email')" class="mt-1 text-xs text-red-400">{{ addErrors.email }}</p>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Phone</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">+63</span>
                  <input
                    v-model="newSupplier.phone"
                    type="tel"
                    required
                    :class="[inputClass(showAddError('phone')), 'pl-12']"
                    @input="markTouched('phone')"
                    @blur="markTouched('phone')"
                    inputmode="numeric"
                  />
                </div>
                <p v-if="showAddError('phone')" class="mt-1 text-xs text-red-400">{{ addErrors.phone }}</p>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Status</label>
                <select
                  v-model="newSupplier.status"
                  required
                  :class="inputClass(showAddError('status'))"
                  @change="markTouched('status')"
                  @blur="markTouched('status')"
                >
              <option value="Invited">Invited</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
                </select>
                <p v-if="showAddError('status')" class="mt-1 text-xs text-red-400">{{ addErrors.status }}</p>
              </div>
            </div>
            <div>
              <label class="block text-slate-400 text-sm mb-2">Address</label>
              <textarea
                v-model="newSupplier.address"
                rows="3"
                :class="inputClass(showAddError('address'))"
                @input="markTouched('address')"
                @blur="markTouched('address')"
              ></textarea>
              <p v-if="showAddError('address')" class="mt-1 text-xs text-red-400">{{ addErrors.address }}</p>
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button type="button" @click="showAddModal = false" class="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
              <button type="submit" :disabled="saving" class="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50">
                {{ saving ? 'Saving...' : 'Add Supplier' }}
              </button>
            </div>
          </form>
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
                <label class="block text-slate-400 text-sm mb-2">TIN</label>
                <input
                  :value="formatTinDisplay(editSupplier.taxRegistrationNumber)"
                  type="text"
                  inputmode="numeric"
                  maxlength="15"
                  placeholder="XXX-XXX-XXX-XXX"
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
                  @input="handleTinInput(editSupplier, $event)"
                />
                <p class="mt-1 text-xs text-slate-400">Enter the registered TIN of the taxpayer or business entity.</p>
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
                    class="w-full bg-slate-700 text-white pl-12 pr-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
                    inputmode="numeric"
                  />
                </div>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Status</label>
                <select v-model="editSupplier.status" required class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
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
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { usePermissions } from '@/composables/usePermissions'
import { loadOwnerBranchScope, loadScopedCollectionDocs } from '@/utils/ownerBranchScope'
import {
  SUPPLIER_BUSINESS_TYPES,
  formatTinDisplay,
  isValidTinDigits,
  normalizeTinDigits,
} from '@/utils/supplierTin'

export default {
  name: 'ManagerSuppliers',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission, isClinicAdminOwner } = usePermissions()

    const showAddModal = ref(false)
    const showEditModal = ref(false)
    const saving = ref(false)
    const searchQuery = ref('')
    const selectedCategory = ref('')
    const selectedStatus = ref('')
    const submitAttempted = ref(false)
    const currentScopeMode = ref('owner')
    const addTouched = ref({
      name: false,
      businessType: false,
      taxRegistrationNumber: false,
      categories: false,
      contact: false,
      email: false,
      phone: false,
      status: false,
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

    const statusClass = (status) => {
      if (status === 'Active') return 'bg-green-500/20 text-green-400'
      if (status === 'Invited') return 'bg-amber-500/20 text-amber-300'
      return 'bg-red-500/20 text-red-400'
    }

    const getEmptySupplier = () => ({
      name: '',
      businessType: '',
      taxRegistrationNumber: '',
      categories: [],
      contact: '',
      email: '',
      phone: '',
      status: 'Active',
      address: ''
    })

    const newSupplier = ref({
      ...getEmptySupplier()
    })
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

    const formatSupplierTin = (supplier) => formatTinDisplay(supplier.taxRegistrationNumber || supplier.tinNumber || '')
    const handleTinInput = (supplier, event) => {
      supplier.taxRegistrationNumber = normalizeTinDigits(event?.target?.value || '')
    }

    const loadSuppliers = async () => {
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
    }

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
        taxRegistrationNumber: normalizeTinDigits(supplier.taxRegistrationNumber || ''),
        categories: supplier.categories,
        contact: supplier.contact,
        email: supplier.email,
        phone: supplier.phone,
        status: supplier.status,
        address: supplier.address
      }
    }

    const markTouched = (field) => {
      addTouched.value[field] = true
    }

    const inputClass = (hasError) => [
      'w-full bg-slate-700 text-white px-4 py-2 rounded-lg border focus:outline-none',
      hasError ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-amber-500'
    ]

    const addErrors = computed(() => {
      const errors = {
        name: '',
        businessType: '',
        taxRegistrationNumber: '',
        categories: '',
        contact: '',
        email: '',
        phone: '',
        status: '',
        address: ''
      }

      const hasLettersOrNumbers = (value) => /[A-Za-z0-9]/.test(value || '')
      const supplierNameRegex = /^[A-Za-z0-9][A-Za-z0-9\s'.,&()/-]*$/
      const contactRegex = /^[A-Za-z][A-Za-z\s'.-]*$/
      const addressRegex = /^[A-Za-z0-9][A-Za-z0-9\s'.,#/-]*$/
      const emailRegex = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

      if (!newSupplier.value.name.trim()) {
        errors.name = 'Supplier name is required.'
      } else if (!hasLettersOrNumbers(newSupplier.value.name) || !supplierNameRegex.test(newSupplier.value.name.trim())) {
        errors.name = 'Use letters/numbers with basic punctuation only.'
      }

      if ((newSupplier.value.categories || []).length === 0) {
        errors.categories = 'Select at least one category.'
      }

      if (!newSupplier.value.businessType) {
        errors.businessType = 'Business type is required.'
      }

      if (!isValidTinDigits(newSupplier.value.taxRegistrationNumber)) {
        errors.taxRegistrationNumber = 'Enter a valid 12-digit TIN.'
      }

      if (!newSupplier.value.contact.trim()) {
        errors.contact = 'Contact person is required.'
      } else if (!contactRegex.test(newSupplier.value.contact.trim())) {
        errors.contact = 'Use letters, spaces, apostrophes, or periods only.'
      }

      if (!newSupplier.value.email.trim()) {
        errors.email = 'Email is required.'
      } else if (!emailRegex.test(newSupplier.value.email.trim())) {
        errors.email = 'Enter a valid email address.'
      }

      if (!newSupplier.value.phone.trim()) {
        errors.phone = 'Phone is required.'
      } else {
        const digits = newSupplier.value.phone.replace(/\D/g, '')
        if (digits.length < 7 || digits.length > 15) {
          errors.phone = 'Enter a valid phone number.'
        }
      }

      if (!newSupplier.value.status) {
        errors.status = 'Status is required.'
      }

      if (newSupplier.value.address.trim()) {
        if (!hasLettersOrNumbers(newSupplier.value.address) || !addressRegex.test(newSupplier.value.address.trim())) {
          errors.address = 'Use letters/numbers with basic punctuation only.'
        }
      }

      return errors
    })

    const hasAddErrors = computed(() => {
      return (
        addErrors.value.name ||
        addErrors.value.businessType ||
        addErrors.value.taxRegistrationNumber ||
        addErrors.value.categories ||
        addErrors.value.contact ||
        addErrors.value.email ||
        addErrors.value.phone ||
        addErrors.value.status ||
        addErrors.value.address
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

      saving.value = true
      try {
        const supplierName = newSupplier.value.name
        await addDoc(collection(db, 'suppliers'), {
          ...getSupplierPayload(newSupplier.value),
          branchId: currentBranchId.value,
          ownerId: currentOwnerId.value || null,
          sharedAcrossBranches: true,
          createdAt: serverTimestamp()
        })
        await logActivity(db, {
          module: 'Manager',
          action: 'Added supplier',
          details: `Added supplier: ${supplierName || 'Unnamed supplier'}.`
        })

        toast.success('Supplier added successfully.')
        showAddModal.value = false
        resetAddForm()
        await loadSuppliers()
      } catch (error) {
        console.error(error)
        toast.error('Failed to add supplier.')
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
        taxRegistrationNumber: normalizeTinDigits(supplier.taxRegistrationNumber || supplier.tinNumber || ''),
        categories: [...normalizedCategories(supplier)],
        contact: supplier.contact || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        status: supplier.status || 'Active',
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
      if (!isValidTinDigits(editSupplier.value.taxRegistrationNumber)) {
        toast.error('Please enter a valid 12-digit TIN.')
        return
      }
      if ((editSupplier.value.categories || []).length === 0) {
        toast.error('Please select at least one category.')
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

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
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
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    const resetAddForm = () => {
      newSupplier.value = { ...getEmptySupplier() }
      submitAttempted.value = false
      addTouched.value = {
        name: false,
        businessType: false,
        taxRegistrationNumber: false,
        categories: false,
        contact: false,
        email: false,
        phone: false,
        status: false,
        address: false
      }
    }

    watch(showAddModal, (isOpen) => {
      if (!isOpen) {
        resetAddForm()
      }
    })

    return {
      showAddModal,
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
      formatTinDisplay,
      formatSupplierTin,
      handleTinInput,
      newSupplier,
      editSupplier,
      markTouched,
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

