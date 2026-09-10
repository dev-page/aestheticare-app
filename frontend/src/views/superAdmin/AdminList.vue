<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Admin List</h1>
          <p class="text-slate-400">Manage system administrators with full platform access.</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <input
            v-model="search"
            type="text"
            placeholder="Search name, email, role..."
            class="w-72 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            class="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadAdmins"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400"
            @click="openAddModal"
          >
            Add Admin
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div class="border-b border-slate-700 px-4 py-3 text-sm text-slate-400">
          Total Admin Accounts: <span class="font-semibold text-slate-200">{{ filteredAdmins.length }}</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
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
              <tr v-for="admin in filteredAdmins" :key="admin.id" class="border-b border-slate-700/60 last:border-b-0">
                <td class="px-4 py-3 text-slate-100">
                  <div class="flex items-center gap-2">
                    <span>{{ admin.fullName }}</span>
                    <span v-if="admin.id === currentAdminUid" class="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">You</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-slate-300">{{ admin.email || '-' }}</td>
                <td class="px-4 py-3 text-slate-300">
                  <div>{{ admin.adminRoleLabel || admin.role || 'Superadmin' }}</div>
                  <div class="mt-1 text-xs text-slate-500">{{ admin.permissions?.includes('administrator:full_access') ? 'Full access' : `${admin.permissions?.length || 0} permissions` }}</div>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-md px-2 py-1 text-xs font-medium" :class="statusClass(admin.status)">
                    {{ admin.status || 'Unknown' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-400">{{ admin.createdLabel }}</td>
                <td class="px-4 py-3 text-right">
                  <div v-if="canManageAdmins" class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      :disabled="admin.id === currentAdminUid"
                      :title="admin.id === currentAdminUid ? 'You cannot edit your own administrator access here.' : 'Edit administrator'"
                      @click="openEditModal(admin)"
                    >Edit</button>
                    <button
                      type="button"
                      class="rounded-md border border-rose-500/50 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      :disabled="admin.id === currentAdminUid"
                      :title="admin.id === currentAdminUid ? 'You cannot delete your own administrator account.' : 'Delete administrator'"
                      @click="deleteAdmin(admin)"
                    >Delete</button>
                  </div>
                  <span v-else class="text-xs text-slate-500">Full access required</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6"
        @click.self="closeAddModal"
      >
        <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white">{{ editingAdminId ? 'Edit Admin' : 'Add Admin' }}</h2>
              <p class="mt-1 text-sm text-slate-400">{{ editingAdminId ? 'Update this administrator account and its access.' : 'Create a platform administrator account.' }}</p>
            </div>
            <button type="button" class="text-slate-400 hover:text-white" @click="closeAddModal">✕</button>
          </div>

          <form class="mt-6 space-y-4" @submit.prevent="createAdmin">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-2">
                <span class="text-sm text-slate-300">First Name</span>
                <input v-model.trim="newAdmin.firstName" type="text" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                <p v-if="formErrors.firstName" class="text-xs text-rose-400">{{ formErrors.firstName }}</p>
              </label>
              <label class="space-y-2">
                <span class="text-sm text-slate-300">Last Name</span>
                <input v-model.trim="newAdmin.lastName" type="text" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                <p v-if="formErrors.lastName" class="text-xs text-rose-400">{{ formErrors.lastName }}</p>
              </label>
            </div>

            <label class="space-y-2 block">
              <span class="text-sm text-slate-300">Email</span>
              <input v-model.trim="newAdmin.email" type="email" :disabled="Boolean(editingAdminId)" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" />
              <p v-if="formErrors.email" class="text-xs text-rose-400">{{ formErrors.email }}</p>
            </label>

            <label class="space-y-2 block">
              <span class="text-sm text-slate-300">Phone Number <span class="text-slate-500">(optional)</span></span>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">+63</span>
                <input v-model.trim="newAdmin.phoneNumber" type="text" inputmode="numeric" maxlength="10" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pl-12 text-white" placeholder="9XXXXXXXXX" />
              </div>
              <p v-if="formErrors.phoneNumber" class="text-xs text-rose-400">{{ formErrors.phoneNumber }}</p>
            </label>

            <div class="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <label class="block space-y-2">
                <span class="text-sm font-semibold text-slate-100">Administrator Role</span>
                <div class="relative">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-left text-white transition hover:border-cyan-500/60 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="isEditingSelf"
                    @click="roleMenuOpen = !roleMenuOpen"
                  >
                    <span>
                      <span class="block text-sm font-medium">{{ selectedAdminRole.label }}</span>
                      <span class="mt-0.5 block text-xs text-slate-400">{{ newAdmin.adminRole === 'platform_owner' ? 'All permissions included' : `${selectedAdminRole.permissions.length} permissions included` }}</span>
                    </span>
                    <span class="ml-3 text-slate-400 transition-transform" :class="roleMenuOpen ? 'rotate-180' : ''">v</span>
                  </button>

                  <div v-if="roleMenuOpen" class="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-slate-600 bg-slate-800 p-1.5 shadow-2xl shadow-slate-950/50">
                    <button
                      v-for="role in systemAdminRoleTemplates"
                      :key="role.key"
                      type="button"
                      class="w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-700"
                      :class="newAdmin.adminRole === role.key ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-200'"
                      @click="selectAdminRole(role.key)"
                    >
                      <span class="flex items-center justify-between gap-3">
                        <span class="text-sm font-medium">{{ role.label }}</span>
                        <span v-if="newAdmin.adminRole === role.key" class="text-xs text-cyan-300">Selected</span>
                      </span>
                      <span class="mt-1 block text-xs text-slate-400">{{ role.description }}</span>
                    </button>
                  </div>
                </div>
                <span class="block text-xs text-slate-400">{{ selectedAdminRole.description }}</span>
              </label>

              <div class="mt-4 space-y-4">
                <div v-for="group in systemAdminPermissionGroups" :key="group.key">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{{ group.label }}</p>
                  <div class="grid gap-2 sm:grid-cols-2">
                    <label v-for="permission in group.permissions" :key="permission.key" class="flex items-center gap-2 rounded-lg border border-slate-700/70 px-3 py-2 text-sm text-slate-200" :class="newAdmin.adminRole === 'custom' ? 'cursor-pointer hover:bg-slate-800' : 'opacity-70'">
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

            <p v-if="isEditingSelf" class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Your own administrator account must keep full access so you cannot accidentally lock yourself out.
            </p>

            <div class="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <p class="text-sm font-semibold text-slate-100">Account Preview</p>
              <p class="mt-2 text-sm text-slate-400">
                Role: <span class="text-white">{{ selectedAdminRole.label }}</span>
              </p>
              <p class="text-sm text-slate-400">
                User Type: <span class="text-white">systemadmin</span>
              </p>
              <p class="text-sm text-slate-400">
                Password setup: <span class="text-white">A secure reset email will be sent</span>
              </p>
              <p class="text-sm text-slate-400">
                Permissions: <span class="text-white">{{ newAdmin.permissions.includes('administrator:full_access') ? 'Full platform access' : `${newAdmin.permissions.length} selected` }}</span>
              </p>
            </div>

            <div class="flex justify-end gap-3">
              <button type="button" class="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800" @click="closeAddModal">
                Cancel
              </button>
              <button type="submit" class="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400" :disabled="saving">
                {{ saving ? (editingAdminId ? 'Saving...' : 'Creating...') : (editingAdminId ? 'Save Changes' : 'Create Admin') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { deleteApp, initializeApp } from 'firebase/app'
import { db } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import { systemAdminSwal } from '@/utils/systemAdminAlert'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
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
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const saving = ref(false)
    const error = ref('')
    const search = ref('')
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

    const isArchived = (user) => {
      const status = String(user?.status || '').trim().toLowerCase()
      return user?.archived === true || status === 'inactive' || status === 'disabled'
    }

    const loadAdmins = () => {
      if (unsubscribeUsers) unsubscribeUsers()
      loading.value = true
      error.value = ''
      unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((user) => isSystemAdmin(user) && !isArchived(user))

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

    const fetchBackend = async (path, options = {}) => {
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
    }

    const deleteAdmin = async (admin) => {
      if (!canManageAdmins.value) {
        toast.error('Full access is required to delete administrators.')
        return
      }
      if (admin.id === currentAdminUid.value) {
        toast.error('You cannot delete your own administrator account.')
        return
      }
      const confirm = await systemAdminSwal.fire({
        title: 'Delete Admin Account?',
        text: `This will permanently remove ${admin.fullName} from Firebase Authentication and the admin list.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      })
      if (!confirm.isConfirmed) return

      try {
        const token = await getAuth().currentUser?.getIdToken()
        const response = await fetchBackend(`/admin/system-admin/${encodeURIComponent(admin.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.status === 404) {
          throw new Error('The admin deletion endpoint is not available. Restart the backend server and try again.')
        }
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Failed to delete administrator.')
        await logActivity(db, {
          action: 'Deleted system administrator',
          details: `Deleted ${admin.fullName || admin.email || 'a system administrator'}'s administrator account.`,
          module: 'System Administration',
          targetId: admin.id,
          targetName: admin.fullName || admin.email || admin.id,
        })
        toast.success('Admin account deleted.')
      } catch (deleteError) {
        console.error('Error deleting admin account:', deleteError)
        toast.error(deleteError?.message || 'Failed to delete admin account.')
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

    onMounted(() => {
      const currentAuth = getAuth()
      currentAdminUid.value = currentAuth.currentUser?.uid || ''
      unsubscribeAuth = onAuthStateChanged(currentAuth, (user) => {
        currentAdminUid.value = user?.uid || ''
      })
      loadAdmins()
    })
    onUnmounted(() => {
      unsubscribeUsers?.()
      unsubscribeAuth?.()
    })

    return {
      loading,
      saving,
      error,
      search,
      filteredAdmins,
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
      deleteAdmin,
      systemAdminPermissionGroups,
      systemAdminRoleTemplates,
    }
  },
}
</script>
