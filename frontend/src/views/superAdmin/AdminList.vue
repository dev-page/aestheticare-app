<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 6, rows: 5 }" class="admin-list-main flex-1 p-8">
      <div class="admin-list-header mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Admin List</h1>
          <p class="text-slate-400">Manage platform administrator accounts and their access.</p>
        </div>

        <div class="admin-list-controls flex flex-wrap gap-3">
          <input
            v-model="search"
            type="text"
            placeholder="Search name, email, role..."
            class="admin-search w-72 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            class="admin-refresh rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadAdmins"
          >
            <svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span>
          </button>
          <button
            type="button"
            class="admin-primary rounded-lg px-4 py-2 font-semibold"
            @click="openAddModal"
          >
            Add Admin
          </button>
        </div>
      </div>

      <p v-if="error" class="admin-error mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="admin-list-panel rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div class="border-b border-slate-700 px-4 py-3 text-sm text-slate-400">
          Total Admin Accounts: <span class="font-semibold text-slate-200">{{ filteredAdmins.length }}</span>
        </div>

        <TablePagination v-model:page="currentPage" v-model:page-size="pageSize" :total-items="filteredAdmins.length" part="top" item-label="administrators" />
        <div class="admin-table-scroll overflow-x-auto">
          <table class="admin-table w-full text-sm">
            <thead class="bg-slate-900/70">
              <tr>
                <th class="px-4 py-3 text-left text-slate-300">Name</th>
                <th class="px-4 py-3 text-left text-slate-300">Email</th>
                <th class="px-4 py-3 text-left text-slate-300">Role</th>
                <th class="px-4 py-3 text-left text-slate-300">Status</th>
                <th class="px-4 py-3 text-left text-slate-300">Created</th>
                <th class="px-4 py-3 text-right text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-300" colspan="6">Loading admin accounts...</td>
              </tr>
              <tr v-else-if="!filteredAdmins.length">
                <td class="px-4 py-3 text-slate-300" colspan="6">No admin accounts found.</td>
              </tr>
              <tr v-for="admin in paginatedAdmins" :key="admin.id" class="border-b border-slate-700/60 last:border-b-0">
                <td class="px-4 py-3 text-slate-100" data-label="Name">
                  <div class="flex items-center gap-2">
                    <span>{{ admin.fullName }}</span>
        <span v-if="admin.id === currentAdminUid" class="admin-you-badge rounded-full px-2 py-0.5 text-[11px] font-semibold">You</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-slate-300" data-label="Email">{{ admin.email || '-' }}</td>
                <td class="px-4 py-3 text-slate-300" data-label="Role">
                  <div>{{ admin.adminRoleLabel || admin.role || 'Superadmin' }}</div>
                  <div class="mt-1 text-xs text-slate-500">{{ admin.permissions?.includes('administrator:full_access') ? 'Full access' : `${admin.permissions?.length || 0} permissions` }}</div>
                </td>
                <td class="px-4 py-3" data-label="Status">
                  <span class="admin-status rounded-md px-2 py-1 text-xs font-medium" :class="statusClass(admin.status)">
                    {{ admin.status || 'Unknown' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-400" data-label="Created">{{ admin.createdLabel }}</td>
                <td class="px-4 py-3 text-right" data-label="Actions">
                  <div v-if="canManageAdmins" class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="admin-action rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      :disabled="admin.id === currentAdminUid"
                      :title="admin.id === currentAdminUid ? 'You cannot edit your own administrator access here.' : 'Edit administrator'"
                      @click="openEditModal(admin)"
                    >Edit</button>
                    <button
                      type="button"
                      class="admin-action rounded-md border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      :class="String(admin.status).toLowerCase() === 'inactive' ? 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10' : 'border-amber-500/50 text-amber-200 hover:bg-amber-500/10'"
                      :disabled="admin.id === currentAdminUid || saving"
                      :title="admin.id === currentAdminUid ? 'You cannot disable your own administrator account.' : String(admin.status).toLowerCase() === 'inactive' ? 'Enable administrator' : 'Disable administrator'"
                      @click="setAdminStatus(admin, String(admin.status).toLowerCase() === 'inactive' ? 'Active' : 'Inactive')"
                    >{{ String(admin.status).toLowerCase() === 'inactive' ? 'Enable' : 'Disable' }}</button>
                  </div>
                  <span v-else class="text-xs text-slate-500">Full access required</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <TablePagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :total-items="filteredAdmins.length"
        />
      </section>

      <div
        v-if="showAddModal"
        class="admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-5"
        @click.self="closeAddModal"
      >
        <section class="admin-modal w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <header class="admin-modal__header flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-7">
            <div>
              <h2 id="admin-modal-title" class="text-2xl font-bold text-white">{{ editingAdminId ? 'Edit Admin' : 'Add Admin' }}</h2>
              <p class="mt-1 text-sm text-slate-400">{{ editingAdminId ? 'Update this administrator account and its access.' : 'Create a platform administrator account.' }}</p>
            </div>
            <button type="button" class="admin-close rounded-full p-2" aria-label="Close" @click="closeAddModal"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg></button>
          </header>

          <form class="admin-form" @submit.prevent="createAdmin" :aria-busy="saving">
            <div class="admin-form__body space-y-5 px-5 py-5 sm:px-7">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="admin-field space-y-2">
                <span class="text-sm text-slate-300">First Name</span>
                <input v-model.trim="newAdmin.firstName" type="text" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                <small v-if="formErrors.firstName">{{ formErrors.firstName }}</small>
              </label>
              <label class="admin-field space-y-2">
                <span class="text-sm text-slate-300">Last Name</span>
                <input v-model.trim="newAdmin.lastName" type="text" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                <small v-if="formErrors.lastName">{{ formErrors.lastName }}</small>
              </label>
            </div>

            <label class="admin-field space-y-2 block">
              <span>Email address</span>
              <input v-model.trim="newAdmin.email" type="email" autocomplete="email" :disabled="Boolean(editingAdminId)" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" />
              <small v-if="formErrors.email">{{ formErrors.email }}</small>
            </label>

            <label class="admin-field space-y-2 block">
              <span>Phone number <em>Optional</em></span>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">+63</span>
                <input v-model.trim="newAdmin.phoneNumber" type="text" inputmode="numeric" maxlength="10" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pl-12 text-white" placeholder="9XXXXXXXXX" />
              </div>
              <small v-if="formErrors.phoneNumber">{{ formErrors.phoneNumber }}</small>
            </label>

            <div class="admin-role-panel rounded-xl border border-slate-700 bg-slate-950/50 p-4 sm:p-5">
              <label class="admin-field block space-y-2">
                <span>Administrator role</span>
                <div class="relative">
                  <button
                    type="button"
                    class="admin-role-select flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-left text-white transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="isEditingSelf"
                    @click="roleMenuOpen = !roleMenuOpen"
                  >
                    <span>
                      <span class="block text-sm font-medium">{{ selectedAdminRole.label }}</span>
                      <span class="mt-0.5 block text-xs text-slate-400">{{ newAdmin.adminRole === 'platform_owner' ? 'All permissions included' : `${selectedAdminRole.permissions.length} permissions included` }}</span>
                    </span>
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" class="ml-3 h-4 w-4 transition-transform" :class="roleMenuOpen ? 'rotate-180' : ''"><path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>

                  <div v-if="roleMenuOpen" class="admin-role-menu absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-slate-600 bg-slate-800 p-1.5 shadow-2xl shadow-slate-950/50">
                    <button
                      v-for="role in systemAdminRoleTemplates"
                      :key="role.key"
                      type="button"
                      class="admin-role-option w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-700"
                      :class="newAdmin.adminRole === role.key ? 'admin-role-option--selected' : ''"
                      @click="selectAdminRole(role.key)"
                    >
                      <span class="flex items-center justify-between gap-3">
                        <span class="text-sm font-medium">{{ role.label }}</span>
                        <span v-if="newAdmin.adminRole === role.key" class="admin-role-option__selected-label">Selected</span>
                      </span>
                      <span class="admin-role-option__description mt-1 block text-xs">{{ role.description }}</span>
                    </button>
                  </div>
                </div>
                <span class="block text-xs text-slate-400">{{ selectedAdminRole.description }}</span>
              </label>

              <div class="mt-4 space-y-4">
                <div v-for="group in systemAdminPermissionGroups" :key="group.key">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{{ group.label }}</p>
                  <div class="grid gap-2 sm:grid-cols-2">
                    <label v-for="permission in group.permissions" :key="permission.key" class="admin-permission flex items-center gap-2 rounded-lg border border-slate-700/70 px-3 py-2 text-sm text-slate-200" :class="newAdmin.adminRole === 'custom' ? 'cursor-pointer hover:bg-slate-800' : 'opacity-70'">
                      <input
                        type="checkbox"
                        :checked="isPermissionSelected(permission.key)"
                        :disabled="newAdmin.adminRole !== 'custom' || isEditingSelf"
                        class="accent-cyan-500"
                        @change="toggleCustomPermission(permission.key, $event)"
                      />
                      {{ permission.label }}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="isEditingSelf" class="admin-self-note rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
              Your own administrator account must keep full access so you cannot accidentally lock yourself out.
            </p>

            <div class="admin-preview rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <p class="text-sm font-semibold text-slate-100">Account preview</p>
              <p class="mt-2 text-sm text-slate-400">
                Role: <span class="text-white">{{ selectedAdminRole.label }}</span>
              </p>
              <p class="text-sm text-slate-400">
                Password setup: <span class="text-white">A secure reset email will be sent</span>
              </p>
              <p class="text-sm text-slate-400">
                Permissions: <span class="text-white">{{ newAdmin.permissions.includes('administrator:full_access') ? 'Full platform access' : `${newAdmin.permissions.length} selected` }}</span>
              </p>
            </div>

            </div>
            <footer class="admin-form__footer flex flex-col-reverse gap-3 border-t border-slate-700 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button type="button" class="admin-secondary rounded-lg border border-slate-600 px-4 py-2.5 text-slate-700 hover:bg-slate-100" @click="closeAddModal">
                Cancel
              </button>
              <button type="submit" class="admin-primary rounded-lg px-4 py-2.5 font-semibold" :disabled="saving">
                {{ saving ? (editingAdminId ? 'Saving...' : 'Creating...') : (editingAdminId ? 'Save Changes' : 'Create Admin') }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { deleteApp, initializeApp } from 'firebase/app'
import { db } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import { systemAdminSwal } from '@/utils/systemAdminAlert'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { logActivity } from '@/utils/activityLogger'
import {
  SYSTEM_ADMIN_FULL_ACCESS,
  systemAdminPermissionGroups,
  systemAdminRoleTemplates,
  systemAdminRoleTemplateMap,
} from '@/config/systemAdminPermissionRegistry'

const normalizeRoleKey = (value) => {
  const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!compact) return ''
  if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
}

const formatDate = (value) => {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null
  if (!date) return '-'
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default {
  name: 'SuperAdminAdminList',
  components: { SuperAdminSidebar, TablePagination },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const loading = ref(false)
    const saving = ref(false)
    const error = ref('')
    const search = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const admins = ref([])
    const currentAdminUid = ref('')
    const editingAdminId = ref('')
    const roleMenuOpen = ref(false)
    let unsubscribeUsers = null
    let unsubscribeAuth = null
    const showAddModal = ref(false)
    const newAdmin = ref({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      adminRole: 'verification_admin',
      permissions: [...systemAdminRoleTemplateMap.verification_admin.permissions],
    })

    const formErrors = computed(() => {
      const errors = { firstName: '', lastName: '', email: '', phoneNumber: '' }
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      const phone = String(newAdmin.value.phoneNumber || '').trim()

      if (!newAdmin.value.firstName.trim()) errors.firstName = 'First name is required.'
      if (!newAdmin.value.lastName.trim()) errors.lastName = 'Last name is required.'
      if (!newAdmin.value.email.trim()) errors.email = 'Email is required.'
      else if (!emailRegex.test(newAdmin.value.email.trim())) errors.email = 'Enter a valid email address.'
      if (phone && (!/^\d{10}$/.test(phone) || !phone.startsWith('9'))) {
        errors.phoneNumber = 'Enter a valid PH mobile number starting with 9.'
      }
      return errors
    })

    const hasFormErrors = computed(() => Object.values(formErrors.value).some(Boolean))
    const selectedAdminRole = computed(() => systemAdminRoleTemplateMap[newAdmin.value.adminRole] || systemAdminRoleTemplateMap.custom)
    const currentAdmin = computed(() => admins.value.find((admin) => admin.id === currentAdminUid.value))
    const currentAdminHasFullAccess = computed(() => currentAdmin.value?.permissions?.includes(SYSTEM_ADMIN_FULL_ACCESS) || false)
    const canManageAdmins = computed(() => currentAdminHasFullAccess.value)
    const isEditingSelf = computed(() => Boolean(editingAdminId.value && editingAdminId.value === currentAdminUid.value))
    const isPermissionSelected = (permissionKey) =>
      newAdmin.value.adminRole === 'platform_owner' || newAdmin.value.permissions.includes(permissionKey)

    const toggleCustomPermission = (permissionKey, event) => {
      if (newAdmin.value.adminRole !== 'custom' || isEditingSelf.value) return
      const permissions = new Set(newAdmin.value.permissions)
      if (event.target.checked) permissions.add(permissionKey)
      else permissions.delete(permissionKey)
      newAdmin.value.permissions = [...permissions]
    }

    const statusClass = (status) => {
      const normalized = String(status || '').toLowerCase()
      if (normalized === 'active') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
      if (normalized.includes('pending')) return 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      if (normalized === 'inactive' || normalized === 'disabled' || normalized === 'archived') return 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      return 'bg-slate-600/30 text-slate-200 border border-slate-500/40'
    }

    const isSystemAdmin = (user) => {
      const role = normalizeRoleKey(user?.role)
      const userType = String(user?.userType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
      return role === 'Superadmin' || userType === 'systemadmin'
    }

    const loadAdmins = () => {
      if (unsubscribeUsers) unsubscribeUsers()
      loading.value = true
      error.value = ''
      unsubscribeUsers = pageListener(onSnapshot, collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((user) => isSystemAdmin(user))

        // Upgrade the currently existing system-admin accounts once so they retain
        // platform-wide access under the new permission model.
        users
          .filter((user) => !user.permissionsMigratedAt)
          .forEach((user) => {
            updateDoc(doc(db, 'users', user.id), {
              adminRole: 'platform_owner',
              adminRoleLabel: 'Platform Owner',
              permissions: [SYSTEM_ADMIN_FULL_ACCESS],
              permissionsMigratedAt: new Date(),
              updatedAt: new Date(),
            }).catch((migrationError) => console.error('Failed to migrate admin permissions:', migrationError))
          })

        admins.value = users
          .map((user) => ({
            id: user.id,
            fullName:
              String(user.fullName || '').trim() ||
              `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
              'Unnamed Admin',
            email: user.email || '',
            role: normalizeRoleKey(user.role) || 'Superadmin',
            adminRole: user.permissionsMigratedAt ? (user.adminRole || 'custom') : 'platform_owner',
            adminRoleLabel: user.permissionsMigratedAt ? (user.adminRoleLabel || 'Custom Role') : 'Platform Owner',
            permissions: user.permissionsMigratedAt && Array.isArray(user.permissions) && user.permissions.length ? user.permissions : [SYSTEM_ADMIN_FULL_ACCESS],
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            phoneNumber: String(user.phoneNumber || '').replace(/^\+63/, ''),
            status: user.status || 'Unknown',
            createdLabel: formatDate(user.createdAt),
            createdAt: user.createdAt || null,
          }))

        admins.value = sortRecordsNewestFirst(admins.value)
        loading.value = false
      }, (err) => {
        console.error('Error loading admin accounts:', err)
        error.value = 'Failed to load admin accounts. Please try again.'
        loading.value = false
      })
    }

    const filteredAdmins = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()
      if (!keyword) return admins.value
      return admins.value.filter((admin) =>
        [admin.fullName, admin.email, admin.role, admin.status].join(' ').toLowerCase().includes(keyword)
      )
    })

    const openAddModal = () => {
      editingAdminId.value = ''
      roleMenuOpen.value = false
      newAdmin.value = {
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        adminRole: 'verification_admin',
        permissions: [...systemAdminRoleTemplateMap.verification_admin.permissions],
      }
      showAddModal.value = true
    }

    const applyAdminRoleTemplate = () => {
      const template = systemAdminRoleTemplateMap[newAdmin.value.adminRole]
      if (newAdmin.value.adminRole !== 'custom' && template) {
        newAdmin.value.permissions = [...template.permissions]
      }
    }

    const selectAdminRole = (roleKey) => {
      newAdmin.value.adminRole = roleKey
      applyAdminRoleTemplate()
      roleMenuOpen.value = false
    }

    const closeAddModal = () => {
      showAddModal.value = false
      editingAdminId.value = ''
      roleMenuOpen.value = false
    }

    const openEditModal = (admin) => {
      if (!canManageAdmins.value) return
      editingAdminId.value = admin.id
      roleMenuOpen.value = false
      newAdmin.value = {
        firstName: admin.firstName || admin.fullName.split(' ')[0] || '',
        lastName: admin.lastName || admin.fullName.split(' ').slice(1).join(' ') || '',
        email: admin.email || '',
        phoneNumber: admin.phoneNumber || '',
        adminRole: isEditingSelf.value ? 'platform_owner' : (admin.adminRole || 'custom'),
        permissions: isEditingSelf.value ? [SYSTEM_ADMIN_FULL_ACCESS] : [...(admin.permissions || [])],
      }
      showAddModal.value = true
    }

    const fetchBackend = trackPageLoad(async (path, options = {}) => {
      let lastError = null
      let lastResponse = null
      for (const baseUrl of OTP_BACKEND_CANDIDATES) {
        try {
          const response = await fetch(`${baseUrl}${path}`, options)
          lastResponse = response
          if (response.status === 404 || response.status === 405) continue
          return response
        } catch (requestError) {
          lastError = requestError
        }
      }
      if (lastResponse) return lastResponse
      throw lastError || new Error('Backend is unavailable.')
    })

    const setAdminStatus = async (admin, status) => {
      if (!canManageAdmins.value) {
        toast.error('Full access is required to manage administrators.')
        return
      }
      if (admin.id === currentAdminUid.value) {
        toast.error('You cannot change your own administrator status.')
        return
      }
      const disabling = status === 'Inactive'
      const confirm = await systemAdminSwal.fire({
        title: disabling ? 'Disable Admin Account?' : 'Enable Admin Account?',
        text: disabling ? `${admin.fullName} will be marked inactive and will no longer be able to sign in.` : `${admin.fullName} will be marked active and can sign in again.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: disabling ? 'Yes, disable' : 'Yes, enable',
        cancelButtonText: 'Cancel',
      })
      if (!confirm.isConfirmed) return

      saving.value = true
      try {
        const token = await getAuth().currentUser?.getIdToken()
        const response = await fetchBackend(`/admin/system-admin/${encodeURIComponent(admin.id)}/status`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        if (response.status === 404) {
          throw new Error('The admin status endpoint is not available. Restart the backend server and try again.')
        }
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Failed to update administrator status.')
        toast.success(`Admin account ${disabling ? 'disabled' : 'enabled'}.`)
      } catch (statusError) {
        console.error('Error updating admin status:', statusError)
        toast.error(statusError?.message || 'Failed to update admin status.')
      } finally {
        saving.value = false
      }
    }

    const createAdmin = async () => {
      if (hasFormErrors.value) {
        const firstError = Object.values(formErrors.value).find(Boolean)
        toast.error(firstError || 'Please fix the highlighted fields.')
        return
      }

      const confirm = await systemAdminSwal.fire({
        title: editingAdminId.value ? 'Save Admin Changes?' : 'Create Admin Account?',
        text: editingAdminId.value
          ? `Save changes for ${newAdmin.value.firstName} ${newAdmin.value.lastName}?`
          : `Create a system administrator account for ${newAdmin.value.firstName} ${newAdmin.value.lastName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: editingAdminId.value ? 'Yes, save' : 'Yes, create',
        cancelButtonText: 'Cancel',
      })
      if (!confirm.isConfirmed) return

      saving.value = true
      if (editingAdminId.value) {
        try {
          const permissions = isEditingSelf.value ? [SYSTEM_ADMIN_FULL_ACCESS] : [...newAdmin.value.permissions]
          await updateDoc(doc(db, 'users', editingAdminId.value), {
            firstName: newAdmin.value.firstName.trim(),
            lastName: newAdmin.value.lastName.trim(),
            fullName: `${newAdmin.value.firstName.trim()} ${newAdmin.value.lastName.trim()}`,
            phoneNumber: newAdmin.value.phoneNumber ? `+63${newAdmin.value.phoneNumber.trim()}` : '',
            adminRole: isEditingSelf.value ? 'platform_owner' : newAdmin.value.adminRole,
            adminRoleLabel: systemAdminRoleTemplateMap[isEditingSelf.value ? 'platform_owner' : newAdmin.value.adminRole]?.label || 'Custom Role',
            permissions,
            permissionsMigratedAt: new Date(),
            updatedAt: new Date(),
          })
          await logActivity(db, {
            action: 'Updated system administrator access',
            details: `Updated ${newAdmin.value.firstName.trim()} ${newAdmin.value.lastName.trim()}'s administrator role and permissions.`,
            module: 'System Administration',
            targetId: editingAdminId.value,
            targetName: `${newAdmin.value.firstName.trim()} ${newAdmin.value.lastName.trim()}`.trim(),
          })
          toast.success('Admin account updated successfully.')
          closeAddModal()
        } catch (updateError) {
          console.error('Error updating admin account:', updateError)
          toast.error('Failed to update admin account.')
        } finally {
          saving.value = false
        }
        return
      }
      let creatorApp = null
      let creatorAuth = null
      try {
        const appName = `superadmin-creator-${Date.now()}-${Math.random().toString(36).slice(2)}`
        creatorApp = initializeApp(getApp().options, appName)
        creatorAuth = getAuth(creatorApp)
        const temporaryPassword = `${crypto.randomUUID()}aA1!`
        const credential = await createUserWithEmailAndPassword(creatorAuth, newAdmin.value.email, temporaryPassword)
        const uid = credential.user.uid
        const phone = String(newAdmin.value.phoneNumber || '').trim()

        await setDoc(doc(db, 'users', uid), {
          firstName: newAdmin.value.firstName.trim(),
          lastName: newAdmin.value.lastName.trim(),
          fullName: `${newAdmin.value.firstName.trim()} ${newAdmin.value.lastName.trim()}`,
          email: newAdmin.value.email.trim(),
          phoneNumber: phone ? `+63${phone}` : '',
          role: 'Superadmin',
          userType: 'systemadmin',
          status: 'Active',
          adminRole: newAdmin.value.adminRole,
          adminRoleLabel: systemAdminRoleTemplateMap[newAdmin.value.adminRole]?.label || 'Custom Role',
          permissions: [...newAdmin.value.permissions],
          permissionsMigratedAt: new Date(),
          mustChangePassword: true,
          createdAt: new Date(),
        })

        await sendPasswordResetEmail(creatorAuth, newAdmin.value.email.trim())

        await logActivity(db, {
          action: 'Created system administrator',
          details: `Created ${newAdmin.value.adminRole} administrator access for ${newAdmin.value.firstName.trim()} ${newAdmin.value.lastName.trim()}.`,
          module: 'System Administration',
          targetId: uid,
          targetName: `${newAdmin.value.firstName.trim()} ${newAdmin.value.lastName.trim()}`.trim(),
        })

        toast.success('Admin account created. A password setup email was sent.')
        showAddModal.value = false
        await loadAdmins()
      } catch (err) {
        console.error('Error creating admin account:', err)
        toast.error(err?.code === 'auth/email-already-in-use' ? 'This email is already registered.' : 'Failed to create admin account.')
      } finally {
        if (creatorAuth) {
          await signOut(creatorAuth).catch(() => {})
        }
        if (creatorApp) {
          await deleteApp(creatorApp).catch(() => {})
        }
        saving.value = false
      }
    }

    onMounted(trackPageLoad(() => {
      const currentAuth = getAuth()
      currentAdminUid.value = currentAuth.currentUser?.uid || ''
      unsubscribeAuth = pageListener(onAuthStateChanged, currentAuth, (user) => {
        currentAdminUid.value = user?.uid || ''
      })
      loadAdmins()
    }))
    const paginatedAdmins = computed(() => filteredAdmins.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))
    const totalPages = computed(() => Math.max(1, Math.ceil(filteredAdmins.value.length / pageSize.value)))
    watch([search, pageSize], () => { currentPage.value = 1 })
    watch(totalPages, (count) => { if (currentPage.value > count) currentPage.value = count })
    onUnmounted(() => {
      unsubscribeUsers?.()
      unsubscribeAuth?.()
    })

    return {
      pageLoading,
      loading,
      saving,
      error,
      search,
      filteredAdmins,
      paginatedAdmins,
      currentPage,
      pageSize,
      statusClass,
      loadAdmins,
      showAddModal,
      openAddModal,
      closeAddModal,
      applyAdminRoleTemplate,
      selectAdminRole,
      roleMenuOpen,
      newAdmin,
      formErrors,
      selectedAdminRole,
      isPermissionSelected,
      toggleCustomPermission,
      createAdmin,
      currentAdminUid,
      editingAdminId,
      isEditingSelf,
      canManageAdmins,
      openEditModal,
      setAdminStatus,
      systemAdminPermissionGroups,
      systemAdminRoleTemplates,
    }
  },
}
</script>

<style scoped>
.admin-list-main{min-width:0;padding:clamp(1rem,2.2vw,2rem)!important}
.admin-list-header{align-items:center}
.admin-list-controls{width:min(100%,36rem);display:grid;grid-template-columns:minmax(0,1fr) 2.75rem auto;align-items:center}
.admin-search{width:100%;min-width:0;border-color:var(--ac-border-strong)!important;background:var(--ac-surface)!important;color:var(--ac-text)!important}
.admin-search::placeholder{color:var(--ac-text-muted)!important;opacity:.8}
.admin-refresh{width:2.75rem;height:2.75rem;display:grid;place-items:center;padding:0;border-color:var(--ac-border-strong)!important;color:var(--ac-text)!important;background:var(--ac-surface)!important}
.admin-refresh svg{color:var(--ac-text)!important}
.admin-refresh:hover:not(:disabled),.admin-action:hover:not(:disabled),.admin-secondary:hover:not(:disabled){background:var(--ac-surface-muted)!important}
.admin-primary{border:1px solid var(--ac-primary)!important;background:var(--ac-primary)!important;color:var(--ac-on-primary)!important;box-shadow:var(--ac-shadow-sm);transition:background .16s ease,transform .16s ease}
.admin-primary:hover:not(:disabled){background:var(--ac-primary-hover)!important;transform:translateY(-1px)}
.admin-primary:disabled{cursor:wait;opacity:.65}
.admin-error{border:1px solid var(--ac-danger)!important;border-radius:.75rem;background:var(--ac-danger-bg)!important;color:var(--ac-danger)!important;padding:.75rem 1rem}
.admin-list-panel{overflow:hidden;border-color:var(--ac-border)!important;background:var(--ac-surface)!important;box-shadow:var(--ac-shadow-sm)}
.admin-list-panel>div:first-child{border-color:var(--ac-border)!important;color:var(--ac-text-muted)!important}
.admin-you-badge{border:1px solid var(--ac-border)!important;background:var(--ac-accent-soft)!important;color:var(--ac-text)!important}
.admin-table{min-width:800px;border-collapse:separate;border-spacing:0;color:var(--ac-text-secondary)}
.admin-table thead{background:var(--ac-surface-muted)!important}
.admin-table th{padding:.85rem 1rem;color:var(--ac-text-muted)!important;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
.admin-table td{padding:.95rem 1rem;border-bottom:1px solid var(--ac-border)!important;color:var(--ac-text-secondary)!important;vertical-align:middle}
.admin-table tbody tr:last-child td{border-bottom:0!important}
.admin-table tbody tr:hover{background:var(--ac-surface-soft)}
.admin-action{border-color:var(--ac-border-strong)!important;background:var(--ac-surface)!important;color:var(--ac-text-secondary)!important;white-space:nowrap}
.admin-action:disabled{opacity:.45}
.admin-status{white-space:nowrap}
.admin-modal-backdrop{background:rgba(35,21,14,.76)!important;backdrop-filter:blur(5px)}
.admin-modal{display:flex;flex-direction:column;max-height:min(90vh,56rem)!important;max-height:min(90dvh,56rem)!important;border-color:var(--ac-border)!important;background:var(--ac-surface)!important;color:var(--ac-text)!important;box-shadow:var(--ac-shadow-lg)}
.admin-modal__header{flex:0 0 auto;border-color:var(--ac-border)!important;background:var(--ac-surface)!important}
.admin-close{display:grid;place-items:center;color:var(--ac-text-muted)!important}
.admin-close:hover{background:var(--ac-surface-muted)!important;color:var(--ac-text)!important}
.admin-form{display:flex;min-height:0;flex:1;flex-direction:column;background:transparent!important;box-shadow:none!important}
.admin-form__body{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain}
.admin-field{display:flex;min-width:0;flex-direction:column;gap:.45rem;color:var(--ac-text-secondary)!important;font-size:.85rem;font-weight:600}
.admin-field em{margin-left:.35rem;color:var(--ac-text-muted);font-size:.75rem;font-style:normal;font-weight:400}
.admin-field input:not([type="checkbox"]),.admin-phone-field input{width:100%;min-width:0;min-height:2.75rem;border:1px solid var(--ac-border-strong)!important;border-radius:.65rem;background:var(--ac-surface)!important;padding:.65rem .8rem;color:var(--ac-text)!important;outline:none}
.admin-field input:focus,.admin-phone-field input:focus{border-color:var(--ac-accent)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-accent) 18%,transparent)}
.admin-field input:disabled{background:var(--ac-surface-muted)!important;color:var(--ac-text-muted)!important;cursor:not-allowed;opacity:.8}
.admin-field input::placeholder{color:var(--ac-text-muted)!important;opacity:.85}
.admin-field small{color:var(--ac-danger)!important;font-size:.75rem;font-weight:500}
.admin-field__hint{color:var(--ac-text-muted)!important;font-size:.78rem;font-weight:400}
.admin-phone-field{display:flex;min-width:0;align-items:center;overflow:hidden;border:1px solid var(--ac-border-strong);border-radius:.65rem;background:var(--ac-surface)}
.admin-phone-field>span{padding:0 .8rem;color:var(--ac-text-muted);font-weight:500}
.admin-phone-field input{border:0!important;border-left:1px solid var(--ac-border)!important;border-radius:0!important}
.admin-role-panel,.admin-preview{border-color:var(--ac-border)!important;background:var(--ac-surface-soft)!important;color:var(--ac-text)!important}
.admin-role-select{border-color:var(--ac-border-strong)!important;background:var(--ac-surface)!important;color:var(--ac-text)!important}
.admin-role-select:hover{border-color:var(--ac-accent)!important}
.admin-role-select:focus{border-color:var(--ac-accent)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-accent) 18%,transparent)}
.admin-role-menu{border-color:var(--ac-border)!important;background:var(--ac-surface)!important;box-shadow:var(--ac-shadow-lg)}
.admin-role-option{color:var(--ac-text-secondary)!important}
.admin-role-option:hover{background:var(--ac-surface-muted)!important}
.admin-role-option--selected{border:1px solid var(--ac-border-strong)!important;background:var(--ac-accent-soft)!important;color:var(--ac-text)!important}
.admin-role-option--selected .admin-role-option__description{color:var(--ac-text-secondary)!important}
.admin-role-option__description{color:var(--ac-text-muted)!important}
.admin-role-option__selected-label{color:var(--ac-text)!important;font-size:.72rem;font-weight:700}
.admin-close{width:2.5rem;height:2.5rem;border:1px solid var(--ac-border)!important;background:var(--ac-surface-soft)!important;color:var(--ac-text-secondary)!important}
.admin-close svg{width:1.1rem;height:1.1rem}
.admin-permission{min-height:2.75rem;border-color:var(--ac-border)!important;background:var(--ac-surface)!important;color:var(--ac-text-secondary)!important}
.admin-permission:hover{background:var(--ac-surface-muted)!important}
.admin-permission input{flex:0 0 auto;accent-color:var(--ac-accent)}
.admin-self-note{border-color:var(--ac-warning)!important;background:var(--ac-warning-bg)!important;color:var(--ac-warning-text)!important}
.admin-preview{display:grid;grid-template-columns:1fr 1fr;gap:.2rem 1rem}
.admin-preview>p:first-child{grid-column:1/-1;margin:0 0 .35rem;color:var(--ac-text)!important}
.admin-preview>p{margin:0;color:var(--ac-text-muted)!important;font-size:.82rem}
.admin-preview>p span{color:var(--ac-text-secondary)!important;font-weight:600}
.admin-form__footer{flex:0 0 auto;border-color:var(--ac-border)!important;background:var(--ac-surface)!important}
.admin-secondary{border-color:var(--ac-border-strong)!important;background:var(--ac-surface)!important;color:var(--ac-text-secondary)!important}
@media(max-width:760px){
  .admin-list-header{align-items:stretch}
  .admin-list-controls{width:100%;grid-template-columns:minmax(0,1fr) 2.75rem auto}
  .admin-table{min-width:0}
  .admin-table thead{display:none}
  .admin-table,.admin-table tbody{display:block;width:100%}
  .admin-table tbody tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.25rem .8rem;padding:.65rem .85rem;border-bottom:1px solid var(--ac-border)}
  .admin-table tbody tr:last-child{border-bottom:0}
  .admin-table td{display:flex;min-width:0;flex-direction:column;gap:.15rem;padding:.35rem 0;border:0!important;overflow-wrap:anywhere}
  .admin-table td::before{content:attr(data-label);color:var(--ac-text-muted);font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .admin-table td[data-label="Name"],.admin-table td[data-label="Email"],.admin-table td[data-label="Actions"]{grid-column:1/-1}
  .admin-table td[data-label="Actions"]{align-items:flex-start;text-align:left}
}
@media(max-width:480px){
  .admin-list-controls{grid-template-columns:minmax(0,1fr) 2.75rem}
  .admin-list-controls .admin-primary{grid-column:1/-1;width:100%}
  .admin-modal-backdrop{align-items:flex-end;padding:0}
  .admin-modal{width:100%;max-height:94vh!important;max-height:94dvh!important;border-radius:1.15rem 1.15rem 0 0!important}
  .admin-preview{grid-template-columns:1fr}
  .admin-preview>p:first-child{grid-column:auto}
}
</style>
